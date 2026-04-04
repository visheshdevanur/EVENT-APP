const express = require('express');
const path = require('path');
const fs = require('fs');
const supabase = require('../db/supabase');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');
const { generateCertificatesForEvent } = require('../services/certificateService');

const router = express.Router();

const CERT_DIR = path.join(__dirname, '..', 'certificates');

// ── POST /api/certificates/generate/:eventId — Admin generates certs ──
router.post('/generate/:eventId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { eventId } = req.params;

    // Verify the event is completed
    const { data: event } = await supabase
      .from('events')
      .select('status')
      .eq('id', eventId)
      .single();

    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (event.status !== 'completed') {
      return res.status(400).json({ error: 'Event must be marked as completed before generating certificates' });
    }

    const result = await generateCertificatesForEvent(supabase, eventId);
    res.json({ message: `Generated ${result.generated} certificate(s)`, ...result });
  } catch (err) {
    console.error('Certificate generation error:', err);
    res.status(500).json({ error: 'Failed to generate certificates' });
  }
});

// ── GET /api/certificates/download/:teamId/:studentId — Download cert ──
router.get('/download/:teamId/:studentId', requireAuth, async (req, res) => {
  try {
    const { teamId, studentId } = req.params;

    // Get team to find event_id
    const { data: team } = await supabase
      .from('teams')
      .select('event_id, certificates_generated')
      .eq('id', teamId)
      .single();

    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (!team.certificates_generated) {
      return res.status(400).json({ error: 'Certificates have not been generated yet' });
    }

    const storagePath = `${team.event_id}/${studentId}.pdf`;
    const { data, error } = await supabase.storage.from('certificates').download(storagePath);

    if (error || !data) {
      console.error('Storage download error:', error);
      return res.status(404).json({ error: 'Certificate file not found. Please ask admin to regenerate certificates.' });
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="certificate_${studentId}.pdf"`);
    res.send(buffer);
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).json({ error: 'Failed to download certificate' });
  }
});

// ── GET /api/certificates/my — User's available certificates ──
router.get('/my', requireAuth, async (req, res) => {
  try {
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
      .select('id, team_name, event_id, certificates_generated, events(title, event_date)')
      .in('id', teamIds)
      .eq('certificates_generated', true);

    const certs = (teams || []).map((t) => ({
      teamId: t.id,
      teamName: t.team_name,
      eventTitle: t.events?.title,
      eventDate: t.events?.event_date,
      downloadUrl: `/api/certificates/download/${t.id}/${req.user.id}`,
    }));

    res.json(certs);
  } catch (err) {
    console.error('My certs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
