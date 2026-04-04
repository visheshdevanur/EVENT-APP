const express = require('express');
const supabase = require('../db/supabase');
const { requireAuth, requireSuperAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * GET /api/departments
 * Public-ish route so students can select department on registration
 */
router.get('/', async (req, res) => {
  try {
    const { data: departments, error } = await supabase
      .from('departments')
      .select('*')
      .order('name');
      
    if (error) throw error;
    res.json(departments);
  } catch (err) {
    console.error('Fetch departments error:', err);
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

/**
 * POST /api/departments
 * Admin only (Super Admin)
 */
router.post('/', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Department name is required' });

    const { data: dept, error } = await supabase
      .from('departments')
      .insert({ name, created_by: req.user.id })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // Postgres unique violation
        return res.status(409).json({ error: 'Department with this name already exists' });
      }
      throw error;
    }

    // Log Activity
    await supabase.from('activity_logs').insert({
      user_id: req.user.id,
      action: `Created department: ${name}`
    });

    res.status(201).json(dept);
  } catch (err) {
    console.error('Create department error:', err);
    res.status(500).json({ error: 'Failed to create department' });
  }
});

/**
 * DELETE /api/departments/:id
 * Admin only (Super Admin)
 */
router.delete('/:id', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if it's used
    const { count: userCount } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('department_id', id);
    if (userCount > 0) return res.status(400).json({ error: 'Cannot delete department with active users' });

    const { data, error } = await supabase.from('departments').delete().eq('id', id).select().single();
    if (error) throw error;

    await supabase.from('activity_logs').insert({
      user_id: req.user.id,
      action: `Deleted department: ${data.name}`
    });

    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    console.error('Delete department error:', err);
    res.status(500).json({ error: 'Failed to delete department' });
  }
});

module.exports = router;
