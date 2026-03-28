const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../db/supabase');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

// ── POST /api/auth/register ────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { studentId, name, email, password, role } = req.body;

    if (!studentId || !name || !email || !password) {
      return res.status(400).json({ error: 'All fields are required: studentId, name, email, password' });
    }

    // Check for existing user
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .or(`student_id.eq.${studentId},email.eq.${email}`)
      .limit(1);

    if (existing && existing.length > 0) {
      return res.status(409).json({ error: 'A user with this student ID or email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const { data: user, error } = await supabase
      .from('users')
      .insert({
        student_id: studentId,
        name,
        email,
        role: 'student',  // Always register as student — superadmin promotes to admin
        password_hash: passwordHash,
      })
      .select('id, student_id, name, email, role')
      .single();

    if (error) {
      console.error('Supabase insert error:', JSON.stringify(error, null, 2));
      return res.status(500).json({ error: 'Failed to create user', details: error.message || error });
    }

    const token = jwt.sign(
      { id: user.id, studentId: user.student_id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({ user, token });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/auth/login ───────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, studentId: user.student_id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      user: { id: user.id, student_id: user.student_id, name: user.name, email: user.email, role: user.role },
      token,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/auth/forgot-password ─────────────────
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const { data: user } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('email', email)
      .single();

    if (!user) {
      return res.json({ message: 'If an account with that email exists, a reset code has been sent.' });
    }

    // Generate a 6-digit reset code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const resetExpiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await supabase
      .from('users')
      .update({ reset_code: resetCode, reset_code_expiry: resetExpiry })
      .eq('id', user.id);

    // Send email with nodemailer
    try {
      const nodemailer = require('nodemailer');
      const smtpEmail = (process.env.SMTP_EMAIL || '').trim();
      const smtpPass = (process.env.SMTP_PASSWORD || '').trim();

      if (!smtpEmail || !smtpPass) {
        throw new Error('SMTP_EMAIL or SMTP_PASSWORD not configured in .env');
      }

      console.log(`📧 Attempting to send email via ${smtpEmail}...`);

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: smtpEmail,
          pass: smtpPass,
        },
      });

      await transporter.sendMail({
        from: `"EventPortal" <${smtpEmail}>`,
        to: user.email,
        subject: '🔐 Password Reset Code — EventPortal',
        html: `
          <div style="font-family: 'Inter', sans-serif; max-width: 480px; margin: 0 auto; background: #111827; color: #f1f5f9; padding: 32px; border-radius: 16px;">
            <h2 style="color: #6366f1; margin-bottom: 8px;">⚡ EventPortal</h2>
            <p>Hi ${user.name},</p>
            <p>Your password reset code is:</p>
            <div style="background: linear-gradient(135deg, #6366f1, #a855f7); padding: 20px; border-radius: 12px; text-align: center; margin: 24px 0;">
              <span style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #fff;">${resetCode}</span>
            </div>
            <p style="color: #94a3b8; font-size: 14px;">This code expires in 15 minutes. If you didn't request this, please ignore this email.</p>
          </div>
        `,
      });

      console.log(`✉️ Reset code emailed to ${email} successfully!`);
    } catch (emailErr) {
      console.error('❌ Email send failed:', emailErr.message);
      console.log(`🔑 Fallback — reset code for ${email}: ${resetCode}`);
    }

    res.json({ message: 'Reset code sent to your email.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/auth/reset-password ──────────────────
router.post('/reset-password', async (req, res) => {
  try {
    const { email, resetCode, newPassword } = req.body;
    if (!email || !resetCode || !newPassword) {
      return res.status(400).json({ error: 'Email, reset code, and new password are required' });
    }

    const { data: user } = await supabase
      .from('users')
      .select('id, reset_code, reset_code_expiry')
      .eq('email', email)
      .single();

    if (!user || !user.reset_code) {
      return res.status(400).json({ error: 'Invalid reset request. Please request a new code.' });
    }

    if (user.reset_code !== resetCode) {
      return res.status(400).json({ error: 'Invalid reset code' });
    }

    if (new Date(user.reset_code_expiry) < new Date()) {
      return res.status(400).json({ error: 'Reset code has expired. Please request a new one.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await supabase
      .from('users')
      .update({ password_hash: passwordHash, reset_code: null, reset_code_expiry: null })
      .eq('id', user.id);

    res.json({ message: 'Password reset successfully! You can now sign in.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/auth/change-password — Logged-in user changes own password ──
router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }

    const { data: user } = await supabase
      .from('users')
      .select('id, password_hash')
      .eq('id', req.user.id)
      .single();

    if (!user) return res.status(404).json({ error: 'User not found' });

    const isValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValid) return res.status(400).json({ error: 'Current password is incorrect' });

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await supabase
      .from('users')
      .update({ password_hash: passwordHash })
      .eq('id', user.id);

    res.json({ message: 'Password changed successfully!' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
