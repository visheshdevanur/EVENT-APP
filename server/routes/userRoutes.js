const express = require('express');
const bcrypt = require('bcryptjs');
const supabase = require('../db/supabase');
const { requireAuth, requireSuperAdmin, requireDeptAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

// ── POST /api/users/create-admin — SuperAdmin creates DeptAdmin OR DeptAdmin creates Admin ──
router.post('/create-admin', requireAuth, async (req, res) => {
  try {
    const { studentId, name, email, password, role, departmentId } = req.body;
    if (!studentId || !name || !email || !password || !role || !departmentId) {
      return res.status(400).json({ error: 'All fields required' });
    }

    // Role-based permission checks
    if (req.user.role === 'superadmin') {
      if (role !== 'dept_admin') {
        return res.status(403).json({ error: 'Superadmin can only create dept_admin' });
      }
    } else if (req.user.role === 'dept_admin') {
      if (role !== 'admin') {
        return res.status(403).json({ error: 'Department admin can only create admin managers' });
      }
      if (req.user.departmentId !== departmentId) {
        return res.status(403).json({ error: 'Cannot create an admin for a different department' });
      }
    } else {
      return res.status(403).json({ error: 'Unauthorized to create admins' });
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
      .insert({ student_id: studentId, name, email, role, department_id: departmentId, password_hash: passwordHash })
      .select('id, student_id, name, email, role, department_id')
      .single();

    if (error) throw error;

    await supabase.from('activity_logs').insert({
      user_id: req.user.id,
      action: `Created ${role}: ${name}`,
      department_id: departmentId
    });

    res.status(201).json({ message: 'Account created', user });
  } catch (err) {
    console.error('Create admin error:', err);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// ── GET /api/users — List users based on role ──
router.get('/', requireAuth, async (req, res) => {
  try {
    let query = supabase.from('users').select('id, student_id, name, email, role, created_at, department_id').order('created_at', { ascending: false });

    // Restrict what dept_admin can see
    if (req.user.role === 'dept_admin') {
      query = query.eq('department_id', req.user.departmentId);
    } else if (req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { data: users, error } = await query;

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
    const validRoles = ['student', 'admin', 'dept_admin', 'superadmin'];
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

// ── PATCH /api/users/:id — Update user details ──
router.patch('/:id', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { name, phone, student_id } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (phone) updates.phone = phone;

    // student_id is required
    if (student_id) updates.student_id = student_id;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', req.params.id)
      .select('id, student_id, name, email, role, phone')
      .single();

    if (error || !user) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User updated', user });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── DELETE /api/users/:id — Delete a user ──
router.delete('/:id', requireAuth, requireDeptAdmin, async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }

    // Role-based permission checks
    if (req.user.role === 'dept_admin') {
       const { data: targetUser } = await supabase.from('users').select('department_id, role').eq('id', req.params.id).single();
       if (!targetUser) return res.status(404).json({ error: 'User not found' });
       if (targetUser.department_id !== req.user.department_id) {
         return res.status(403).json({ error: 'Can only delete users from your department' });
       }
       if (targetUser.role === 'superadmin' || targetUser.role === 'dept_admin') {
         return res.status(403).json({ error: 'Dept Admins cannot delete Super Admins or other Dept Admins' });
       }
    }

    const { data, error } = await supabase
      .from('users')
      .delete()
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    await supabase.from('activity_logs').insert({
      user_id: req.user.id,
      action: `Deleted user: ${data.name} (${data.role})`,
      department_id: data.department_id
    });

    res.json({ message: 'User deleted' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PATCH /api/users/profile — Update current user's profile info ──
router.patch('/profile', requireAuth, async (req, res) => {
  try {
    const { name, phone } = req.body;
    const updates = {};
    if (name) updates.name = name.trim();
    if (phone) updates.phone = phone.trim();

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No update data provided' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', req.user.id)
      .select('id, student_id, name, email, role, phone, department_id')
      .single();

    if (error) throw error;
    res.json({ message: 'Profile updated successfully', user });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
