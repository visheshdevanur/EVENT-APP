const express = require('express');
const supabase = require('../db/supabase');
const { requireAuth, requireDeptAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * GET /api/activity-logs
 * SuperAdmin sees all. DeptAdmin sees only their department.
 */
router.get('/', requireAuth, requireDeptAdmin, async (req, res) => {
  try {
    let query = supabase
      .from('activity_logs')
      .select('*, users(name, email, role), departments(name)')
      .order('timestamp', { ascending: false });

    if (req.user.role !== 'superadmin') {
      query = query.eq('department_id', req.user.departmentId);
    }

    const { data: logs, error } = await query;
    
    if (error) throw error;
    res.json(logs || []);
  } catch (err) {
    console.error('Fetch activity logs error:', err);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

module.exports = router;
