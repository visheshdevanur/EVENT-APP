const express = require('express');
const supabase = require('../db/supabase');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

// ── POST /api/documents/upload — Student uploads a drive link for an event ──
router.post('/upload', requireAuth, async (req, res) => {
  try {
    const { eventId, driveLink, description } = req.body;
    if (!eventId || !driveLink?.trim()) {
      return res.status(400).json({ error: 'eventId and driveLink are required' });
    }

    // Verify the event exists
    const { data: event } = await supabase
      .from('events')
      .select('id')
      .eq('id', eventId)
      .single();

    if (!event) return res.status(404).json({ error: 'Event not found' });

    // Upsert — student can update their link
    const { data: doc, error } = await supabase
      .from('document_uploads')
      .upsert(
        {
          event_id: eventId,
          user_id: req.user.id,
          drive_link: driveLink.trim(),
          description: description?.trim() || null,
        },
        { onConflict: 'event_id,user_id' }
      )
      .select()
      .single();

    if (error) {
      console.error('Document upload error:', error);
      return res.status(500).json({ error: 'Failed to save document link' });
    }

    res.status(201).json({ message: 'Document link saved', document: doc });
  } catch (err) {
    console.error('Document upload error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/documents/my/:eventId — Student gets own doc link for an event ──
router.get('/my/:eventId', requireAuth, async (req, res) => {
  try {
    const { data: doc } = await supabase
      .from('document_uploads')
      .select('*')
      .eq('event_id', req.params.eventId)
      .eq('user_id', req.user.id)
      .single();

    res.json(doc || null);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/documents/event/:eventId — Admin views all docs for an event ──
router.get('/event/:eventId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { data: docs, error } = await supabase
      .from('document_uploads')
      .select('*, users:user_id(id, name, email, student_id)')
      .eq('event_id', req.params.eventId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(docs || []);
  } catch (err) {
    console.error('List documents error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
