const express = require('express');
const supabase = require('../db/supabase');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

// ── POST /api/attendance/checkin — Admin scans QR code ──
// Supports two types: "attendance" (default) and "food"
router.post('/checkin', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { qrToken, type = 'attendance' } = req.body;

    if (!qrToken) {
      return res.status(400).json({ error: 'qrToken is required' });
    }

    // Search both QR token columns to auto-detect type
    const { data: team, error } = await supabase
      .from('teams')
      .select('*, events(title, status)')
      .or(`qr_token.eq.${qrToken},food_qr_token.eq.${qrToken},id.eq.${qrToken}`)
      .single();

    if (error || !team) {
      return res.status(404).json({ error: 'Invalid QR code — team not found' });
    }

    // Auto-detect type: if token matches food_qr_token, treat as food
    const effectiveType = (team.food_qr_token === qrToken) ? 'food' : (type || 'attendance');

    if (team.payment_status !== 'confirmed') {
      return res.status(400).json({ error: 'Team payment is not confirmed' });
    }

    // Handle attendance check-in
    if (effectiveType === 'attendance') {
      if (team.attended) {
        return res.json({ message: 'Team already checked in for attendance', team, type: 'attendance' });
      }

      const { data: updated } = await supabase
        .from('teams')
        .update({ attended: true })
        .eq('id', team.id)
        .select('*, events(title)')
        .single();

      const { data: members } = await supabase
        .from('team_members')
        .select('users(id, student_id, name)')
        .eq('team_id', team.id);

      return res.json({
        message: `✅ Team "${updated.team_name}" checked in for attendance — ${updated.events?.title}`,
        team: updated,
        members: (members || []).map((m) => m.users),
        type: 'attendance',
      });
    }

    // Handle food check-in
    if (effectiveType === 'food') {
      if (team.food_collected) {
        return res.json({ message: 'Food already collected for this team', team, type: 'food' });
      }

      const { data: updated } = await supabase
        .from('teams')
        .update({ food_collected: true })
        .eq('id', team.id)
        .select('*, events(title)')
        .single();

      const { data: members } = await supabase
        .from('team_members')
        .select('users(id, student_id, name)')
        .eq('team_id', team.id);

      return res.json({
        message: `🍽️ Food collected for team "${updated.team_name}" — ${updated.events?.title}`,
        team: updated,
        members: (members || []).map((m) => m.users),
        type: 'food',
      });
    }

    res.status(400).json({ error: 'Invalid type. Use "attendance" or "food"' });
  } catch (err) {
    console.error('Checkin error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
