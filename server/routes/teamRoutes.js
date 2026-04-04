const express = require('express');
const supabase = require('../db/supabase');
const QRCode = require('qrcode');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { requireAuth } = require('../middleware/authMiddleware');

// Multer config for payment screenshots
const screenshotDir = path.join(__dirname, '..', 'uploads', 'payment-screenshots');
if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });

const screenshotStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, screenshotDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const uploadScreenshot = multer({ storage: screenshotStorage, limits: { fileSize: 5 * 1024 * 1024 } });

const router = express.Router();

// ── POST /api/teams/register — Register a team for an event ──
router.post('/register', requireAuth, async (req, res) => {
  try {
    const { eventId, teamName, memberStudentIds } = req.body;

    if (!eventId || !teamName || !memberStudentIds || !Array.isArray(memberStudentIds)) {
      return res.status(400).json({ error: 'eventId, teamName, and memberStudentIds (array) are required' });
    }

    // 1) Fetch the event and validate registration is open
    const { data: event, error: eventErr } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (eventErr || !event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (event.status !== 'open') {
      return res.status(400).json({ error: 'Event is not open for registration' });
    }

    if (new Date(event.registration_deadline) < new Date()) {
      return res.status(400).json({ error: 'Registration deadline has passed' });
    }

    // 2) Ensure the leader is included in the team
    const allStudentIds = [...new Set(memberStudentIds)];

    // Validate team size
    if (allStudentIds.length < event.min_team_size) {
      return res.status(400).json({
        error: `Team must have at least ${event.min_team_size} member(s)`,
      });
    }
    if (allStudentIds.length > event.max_team_size) {
      return res.status(400).json({
        error: `Team cannot exceed ${event.max_team_size} member(s)`,
      });
    }

    // 3) Resolve student IDs to user records
    const { data: users, error: usersErr } = await supabase
      .from('users')
      .select('id, student_id')
      .in('student_id', allStudentIds);

    if (usersErr) throw usersErr;

    if (!users || users.length !== allStudentIds.length) {
      const foundIds = (users || []).map((u) => u.student_id);
      const invalid = allStudentIds.filter((id) => !foundIds.includes(id));
      return res.status(400).json({
        error: `The following USNs are not valid portal users: ${invalid.join(', ')}`,
      });
    }

    const userUuids = users.map((u) => u.id);

    // 4) Check none of these users are already registered for this event
    const { data: existingMembers } = await supabase
      .from('team_members')
      .select('user_id, team_id')
      .in('user_id', userUuids);

    if (existingMembers && existingMembers.length > 0) {
      // Check if any of those teams belong to this event
      const teamIds = [...new Set(existingMembers.map((m) => m.team_id))];
      const { data: conflictingTeams } = await supabase
        .from('teams')
        .select('id')
        .in('id', teamIds)
        .eq('event_id', eventId);

      if (conflictingTeams && conflictingTeams.length > 0) {
        const conflictTeamIds = new Set(conflictingTeams.map((t) => t.id));
        const conflictUserIds = existingMembers
          .filter((m) => conflictTeamIds.has(m.team_id))
          .map((m) => m.user_id);
        const conflictStudentIds = users
          .filter((u) => conflictUserIds.includes(u.id))
          .map((u) => u.student_id);
        return res.status(409).json({
          error: `These USNs are already registered for this event: ${conflictStudentIds.join(', ')}`,
        });
      }
    }

    // 5) Create the team
    const leaderId = users.find((u) => u.student_id === allStudentIds[0])?.id || req.user.id;

    const { data: team, error: teamErr } = await supabase
      .from('teams')
      .insert({
        team_name: teamName,
        event_id: eventId,
        leader_id: leaderId,
        payment_status: event.entry_fee > 0 ? 'pending' : 'confirmed',
        qr_token: crypto.randomUUID(),
        food_qr_token: crypto.randomUUID()
      })
      .select()
      .single();

    if (teamErr) {
      console.error('Team creation error:', teamErr);
      if (teamErr.code === '23505') {
        return res.status(409).json({ error: 'A team with this name already exists for this event' });
      }
      return res.status(500).json({ error: 'Failed to create team' });
    }

    // 6) Insert team members
    const memberRows = userUuids.map((uid) => ({ team_id: team.id, user_id: uid }));
    const { error: membersErr } = await supabase.from('team_members').insert(memberRows);

    if (membersErr) {
      // Rollback team
      await supabase.from('teams').delete().eq('id', team.id);
      console.error('Members insert error:', membersErr);
      return res.status(500).json({ error: 'Failed to add team members' });
    }

    res.status(201).json({
      message: event.entry_fee > 0 ? 'Team registered. Proceed to payment.' : 'Team registered and confirmed (no fee).',
      team,
      members: allStudentIds,
    });
  } catch (err) {
    console.error('Register team error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/teams/my — Get current user's teams ───
router.get('/my', requireAuth, async (req, res) => {
  try {
    // Get team IDs for this user
    const { data: memberRows } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', req.user.id);

    if (!memberRows || memberRows.length === 0) {
      return res.json([]);
    }

    const teamIds = memberRows.map((r) => r.team_id);

    const { data: teams } = await supabase
      .from('teams')
      .select('*, events(*)')
      .in('id', teamIds);

    // For each team, get members
    const result = [];
    for (const team of teams || []) {
      const { data: members } = await supabase
        .from('team_members')
        .select('user_id, users(id, student_id, name, email, phone)')
        .eq('team_id', team.id);
      result.push({ ...team, members: (members || []).map((m) => m.users) });
    }

    res.json(result);
  } catch (err) {
    console.error('My teams error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/teams/:id/qr — Get dual QR codes for a confirmed team ──
router.get('/:id/qr', requireAuth, async (req, res) => {
  try {
    let { data: team } = await supabase
      .from('teams')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (team.payment_status !== 'confirmed') {
      return res.status(400).json({ error: 'Team payment is not confirmed yet' });
    }

    // Auto-generate food_qr_token if missing (for teams created before this column existed)
    if (!team.food_qr_token) {
      const { randomUUID } = require('crypto');
      const newFoodToken = randomUUID();
      const { data: updated } = await supabase
        .from('teams')
        .update({ food_qr_token: newFoodToken })
        .eq('id', team.id)
        .select()
        .single();
      if (updated) team = updated;
    }

    const [attendanceQR, foodQR] = await Promise.all([
      QRCode.toDataURL(team.qr_token, { width: 300, color: { dark: '#1e293b', light: '#ffffff' } }),
      QRCode.toDataURL(team.food_qr_token, { width: 300, color: { dark: '#7c3aed', light: '#ffffff' } }),
    ]);

    res.json({
      attendanceQR,
      attendanceToken: team.qr_token,
      foodQR,
      foodToken: team.food_qr_token,
      team
    });
  } catch (err) {
    console.error('QR error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/teams/event/:eventId — All teams for an event (admin) ──
router.get('/event/:eventId', requireAuth, async (req, res) => {
  try {
    const { data: teams } = await supabase
      .from('teams')
      .select('*')
      .eq('event_id', req.params.eventId);

    const { data: docs } = await supabase
      .from('document_uploads')
      .select('user_id, drive_link')
      .eq('event_id', req.params.eventId);
    const docsMap = {};
    if (docs) docs.forEach(d => docsMap[d.user_id] = d.drive_link);

    const result = [];
    for (const team of teams || []) {
      const { data: members } = await supabase
        .from('team_members')
        .select('user_id, users(id, student_id, name, email, phone)')
        .eq('team_id', team.id);
      // Attach leader info with phone for admin visibility
      const leader = (members || []).find((m) => m.users?.id === team.leader_id);
      const leaderDoc = docsMap[team.leader_id] || null;
      result.push({ 
        ...team, 
        members: (members || []).map((m) => m.users), 
        leader_phone: leader?.users?.phone || null,
        leader_document_link: leaderDoc
      });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PATCH /api/teams/:id/confirm-payment — Admin manually confirms payment ──
router.patch('/:id/confirm-payment', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { data: team, error } = await supabase
      .from('teams')
      .update({ payment_status: 'confirmed' })
      .eq('id', req.params.id)
      .select('*, events(title)')
      .single();

    if (error || !team) return res.status(404).json({ error: 'Team not found' });
    res.json({ message: `Payment confirmed for team "${team.team_name}"`, team });
  } catch (err) {
    console.error('Confirm payment error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PATCH /api/teams/:id/payment-status — Admin sets payment status ──
router.patch('/:id/payment-status', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    const { status } = req.body;
    if (!['pending', 'confirmed', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be pending, confirmed, or rejected' });
    }

    const { data: team, error } = await supabase
      .from('teams')
      .update({ payment_status: status })
      .eq('id', req.params.id)
      .select('*, events(title)')
      .single();

    if (error || !team) return res.status(404).json({ error: 'Team not found' });
    res.json({ message: `Payment status set to "${status}" for team "${team.team_name}"`, team });
  } catch (err) {
    console.error('Payment status error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── DELETE /api/teams/:id — Admin deletes a team ──
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Delete team members first (FK constraint)
    await supabase.from('team_members').delete().eq('team_id', req.params.id);

    const { error } = await supabase.from('teams').delete().eq('id', req.params.id);
    if (error) throw error;

    res.json({ message: 'Team deleted' });
  } catch (err) {
    console.error('Delete team error:', err);
    res.status(500).json({ error: 'Failed to delete team' });
  }
});

// ── POST /api/teams/:id/upload-screenshot — Student uploads payment proof ──
router.post('/:id/upload-screenshot', requireAuth, uploadScreenshot.single('screenshot'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Screenshot file is required' });

    const filePath = `/uploads/payment-screenshots/${req.file.filename}`;

    const { data: team, error } = await supabase
      .from('teams')
      .update({ payment_screenshot: filePath })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error || !team) return res.status(404).json({ error: 'Team not found' });

    res.json({ message: 'Payment screenshot uploaded!', team });
  } catch (err) {
    console.error('Screenshot upload error:', err);
    res.status(500).json({ error: 'Failed to upload screenshot' });
  }
});

module.exports = router;
