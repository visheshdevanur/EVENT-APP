const express = require('express');
const bcrypt = require('bcryptjs');
const supabase = require('../db/supabase');
const { requireAuth, requireSuperAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

// ── POST /api/users/create-admin — Superadmin creates a new admin account ──
router.post('/create-admin', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { studentId, name, email, password } = req.body;
    if (!studentId || !name || !email || !password) {
      return res.status(400).json({ error: 'All fields required: studentId, name, email, password' });
    }

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
      .insert({ student_id: studentId, name, email, role: 'admin', password_hash: passwordHash })
      .select('id, student_id, name, email, role')
      .single();

    if (error) throw error;
    res.status(201).json({ message: 'Admin account created', user });
  } catch (err) {
    console.error('Create admin error:', err);
    res.status(500).json({ error: 'Failed to create admin' });
  }
});

// ── GET /api/users — List all users ──
router.get('/', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, student_id, name, email, role, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(users);
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PATCH /api/users/:id/role — Change user role ──
router.patch('/:id/role', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    const validRoles = ['student', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: `Role must be one of: ${validRoles.join(', ')}` });
    }

    // Prevent changing own role
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot change your own role' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .update({ role })
      .eq('id', req.params.id)
      .select('id, student_id, name, email, role')
      .single();

    if (error || !user) return res.status(404).json({ error: 'User not found' });
    res.json({ message: `User role updated to ${role}`, user });
  } catch (err) {
    console.error('Update role error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── DELETE /api/users/:id — Delete a user ──
router.delete('/:id', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }

    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ message: 'User deleted' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
