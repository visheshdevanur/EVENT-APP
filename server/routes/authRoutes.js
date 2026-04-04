const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../db/supabase');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

// ── POST /api/auth/register ────────────────────────
// 1. SEND SIGNUP OTP
router.post('/send-signup-otp', async (req, res) => {
  try {
    const { studentId, name, email, password, phone, departmentId } = req.body;
    
    if (!studentId || !name || !email || !password || !departmentId) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if user already exists
    const { data: existing } = await supabase.from('users').select('id').or(`student_id.eq.${studentId},email.eq.${email}`).limit(1);
    if (existing && existing.length > 0) {
      return res.status(409).json({ error: 'A user with this student ID or email already exists' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const signupData = { studentId, name, password, phone, departmentId };

    // Upsert OTP
    await supabase.from('otp_verifications').upsert({
      email,
      otp,
      expires_at: expiresAt,
      signup_data: signupData
    });

    // Send email
    try {
      const nodemailer = require('nodemailer');
      const smtpEmail = (process.env.SMTP_EMAIL || '').trim();
      const smtpPass = (process.env.SMTP_PASSWORD || '').trim();

      if (!smtpEmail || !smtpPass) {
        console.warn('⚠️ SMTP not configured. OTP:', otp);
        return res.json({ message: 'OTP sent (Development Mode: Check server logs)', dev: true, otp: process.env.NODE_ENV === 'development' ? otp : undefined });
      }

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: smtpEmail, pass: smtpPass }
      });

      await transporter.sendMail({
        from: `"EventPortal" <${smtpEmail}>`,
        to: email,
        subject: '🚀 Verify Your Email — EventPortal',
        html: `
          <div style="font-family: 'Inter', sans-serif; max-width: 480px; margin: 0 auto; background: #111827; color: #f1f5f9; padding: 32px; border-radius: 16px; border: 1px solid #1f2937;">
            <h2 style="color: #6366f1; margin: 0 0 16px 0;">⚡ EventPortal</h2>
            <p style="font-size: 16px;">Welcome, <b>${name}</b>!</p>
            <p>Use the code below to verify your email and complete your registration:</p>
            <div style="background: rgba(99, 102, 241, 0.1); border: 1px dashed #6366f1; padding: 24px; border-radius: 12px; text-align: center; margin: 24px 0;">
              <span style="font-size: 42px; font-weight: 800; letter-spacing: 12px; color: #818cf8;">${otp}</span>
            </div>
            <p style="color: #94a3b8; font-size: 14px;">This code expires in 10 minutes. If you didn't request this, please ignore this email.</p>
          </div>
        `
      });

      res.json({ message: 'OTP sent to your email' });
    } catch (mailErr) {
      console.error('Mail error:', mailErr);
      res.json({ message: 'OTP (logged for dev): ' + otp, dev_otp: otp });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. REGISTER (VERIFY OTP)
router.post('/register', async (req, res) => {
  const { email, otp } = req.body;
  try {
    const { data: v, error: vErr } = await supabase
      .from('otp_verifications')
      .select('*')
      .eq('email', email)
      .eq('otp', otp)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (vErr || !v) return res.status(400).json({ error: 'Invalid or expired OTP' });

    const { studentId, name, password, phone, departmentId } = v.signup_data;
    const passwordHash = await bcrypt.hash(password, 12);

    const { data: user, error } = await supabase
      .from('users')
      .insert({
        student_id: studentId,
        name,
        email,
        phone: phone?.trim() || null,
        department_id: departmentId,
        role: 'student',
        password_hash: passwordHash,
      })
      .select('id, student_id, name, email, role, phone, department_id')
      .single();

    if (error) throw error;

    // Cleanup
    await supabase.from('otp_verifications').delete().eq('email', email);

    const token = jwt.sign(
      { id: user.id, studentId: user.student_id, role: user.role, departmentId: user.department_id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({ user, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
      { id: user.id, studentId: user.student_id, role: user.role, departmentId: user.department_id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      user: { id: user.id, student_id: user.student_id, name: user.name, email: user.email, role: user.role, phone: user.phone, department_id: user.department_id },
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
