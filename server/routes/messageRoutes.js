const express = require('express');
const supabase = require('../db/supabase');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

// ══════════════ TEAM PRIVATE CHAT ══════════════
// These MUST be before /:eventId routes so Express doesn't match "team" as an eventId

// Helper: verify user is a member of the team
async function verifyTeamMember(teamId, userId) {
  const { data, error } = await supabase
    .from('team_members')
    .select('user_id')
    .eq('team_id', teamId)
    .eq('user_id', userId)
    .single();
  
  if (error) {
    console.error('verifyTeamMember error:', error);
  }
  return !!data;
}

// ── GET /api/messages/team/:teamId — Get private team messages ──
router.get('/team/:teamId', requireAuth, async (req, res) => {
  try {
    const isMember = await verifyTeamMember(req.params.teamId, req.user.id);
    if (!isMember) return res.status(403).json({ error: 'You are not a member of this team' });

    const { data: messages, error } = await supabase
      .from('team_messages')
      .select('*, users(name, role)')
      .eq('team_id', req.params.teamId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    res.json(messages || []);
  } catch (err) {
    console.error('Get team messages error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/messages/team/:teamId — Send a team message ──
router.post('/team/:teamId', requireAuth, async (req, res) => {
  try {
    const isMember = await verifyTeamMember(req.params.teamId, req.user.id);
    if (!isMember) return res.status(403).json({ error: 'You are not a member of this team' });

    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Message cannot be empty' });

    const { data, error } = await supabase
      .from('team_messages')
      .insert({
        team_id: req.params.teamId,
        user_id: req.user.id,
        message: message.trim(),
      })
      .select('*, users(name, role)')
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('Send team message error:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// ══════════════ EVENT CHAT (all participants + admin) ══════════════

// ── GET /api/messages/:eventId — Get messages for an event ──
router.get('/:eventId', requireAuth, async (req, res) => {
  try {
    const { data: messages, error } = await supabase
      .from('event_messages')
      .select('*, users(name, role)')
      .eq('event_id', req.params.eventId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    res.json(messages || []);
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/messages/:eventId — Send a message ──
router.post('/:eventId', requireAuth, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Message cannot be empty' });

    const { data, error } = await supabase
      .from('event_messages')
      .insert({
        event_id: req.params.eventId,
        user_id: req.user.id,
        message: message.trim(),
      })
      .select('*, users(name, role)')
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

module.exports = router;
