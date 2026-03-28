const express = require('express');
const path = require('path');
const multer = require('multer');
const supabase = require('../db/supabase');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

// ── Multer config for certificate templates ──
const templateStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads', 'templates')),
  filename: (req, file, cb) => cb(null, `${req.params.id}_${Date.now()}${path.extname(file.originalname)}`),
});
const uploadTemplate = multer({
  storage: templateStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.png', '.jpg', '.jpeg'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// ── Multer config for payment QR images ──
const paymentQRStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads', 'payment-qr')),
  filename: (req, file, cb) => cb(null, `${req.params.id}_${Date.now()}${path.extname(file.originalname)}`),
});
const uploadPaymentQR = multer({
  storage: paymentQRStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// ── POST /api/events — Admin creates a new event ──
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { title, description, eventDate, registrationDeadline, maxTeamSize, minTeamSize, entryFee, contact1, contact2 } = req.body;

    if (!title || !eventDate || !registrationDeadline) {
      return res.status(400).json({ error: 'title, eventDate, and registrationDeadline are required' });
    }

    if (!contact1?.trim()) {
      return res.status(400).json({ error: 'At least one contact detail is required' });
    }

    // Validate min ≤ max team size
    if (minTeamSize && maxTeamSize && Number(minTeamSize) > Number(maxTeamSize)) {
      return res.status(400).json({ error: 'Min team size must be less than or equal to max team size' });
    }

    // Validate registration deadline is before event date
    if (new Date(registrationDeadline) >= new Date(eventDate)) {
      return res.status(400).json({ error: 'Registration deadline must be before the event date' });
    }
    const { data: event, error } = await supabase
      .from('events')
      .insert({
        title,
        description: description || '',
        event_date: eventDate,
        registration_deadline: registrationDeadline,
        max_team_size: maxTeamSize || 4,
        min_team_size: minTeamSize || 1,
        entry_fee: entryFee || 0,
        contact1: contact1.trim(),
        contact2: contact2?.trim() || null,
        status: 'open',
        created_by: req.user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Event create error:', error);
      return res.status(500).json({ error: 'Failed to create event' });
    }

    res.status(201).json(event);
  } catch (err) {
    console.error('Event error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/events/my — Admin's own events only ──
router.get('/my', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { data: events, error } = await supabase
      .from('events')
      .select('*')
      .eq('created_by', req.user.id)
      .order('event_date', { ascending: true });

    if (error) throw error;
    res.json(events);
  } catch (err) {
    console.error('My events error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/events — List all events ──────────────
router.get('/', async (req, res) => {
  try {
    const { data: events, error } = await supabase
      .from('events')
      .select('*')
      .order('event_date', { ascending: true });

    if (error) throw error;
    res.json(events);
  } catch (err) {
    console.error('List events error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/events/:id — Single event details ────
router.get('/:id', async (req, res) => {
  try {
    const { data: event, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !event) return res.status(404).json({ error: 'Event not found' });
    res.json(event);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PATCH /api/events/:id/complete — Admin marks event completed ──
router.patch('/:id/complete', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { data: event, error } = await supabase
      .from('events')
      .update({ status: 'completed' })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error || !event) return res.status(404).json({ error: 'Event not found' });
    res.json({ message: 'Event marked as completed', event });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PATCH /api/events/:id — Admin updates event status ──
router.patch('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['upcoming', 'open', 'ongoing', 'completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
    }

    const { data: event, error } = await supabase
      .from('events')
      .update({ status })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error || !event) return res.status(404).json({ error: 'Event not found' });
    res.json({ message: `Event status updated to ${status}`, event });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/events/:id/upload-template — Upload certificate template ──
router.post('/:id/upload-template', requireAuth, requireAdmin, uploadTemplate.single('template'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No template file uploaded' });

    const templatePath = `/uploads/templates/${req.file.filename}`;

    const { data, error } = await supabase
      .from('events')
      .update({ certificate_template: templatePath })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ message: 'Certificate template uploaded', templatePath, event: data });
  } catch (err) {
    console.error('Upload template error:', err);
    res.status(500).json({ error: 'Failed to upload template' });
  }
});

// ── POST /api/events/:id/upload-payment-qr — Upload payment QR image ──
router.post('/:id/upload-payment-qr', requireAuth, requireAdmin, uploadPaymentQR.single('paymentQr'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No payment QR image uploaded' });

    const qrPath = `/uploads/payment-qr/${req.file.filename}`;

    const { data, error } = await supabase
      .from('events')
      .update({ payment_qr_image: qrPath })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ message: 'Payment QR uploaded', paymentQrImage: qrPath, event: data });
  } catch (err) {
    console.error('Upload payment QR error:', err);
    res.status(500).json({ error: 'Failed to upload payment QR' });
  }
});

// ── POST /api/events/:id/upload-rulebook — Upload event rule book ──
const rulebookStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads', 'rulebooks')),
  filename: (req, file, cb) => cb(null, `${req.params.id}_${Date.now()}${path.extname(file.originalname)}`),
});
const uploadRulebook = multer({
  storage: rulebookStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.png', '.jpg', '.jpeg'];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
  },
  limits: { fileSize: 15 * 1024 * 1024 },
});

router.post('/:id/upload-rulebook', requireAuth, requireAdmin, uploadRulebook.single('rulebook'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const rbPath = `/uploads/rulebooks/${req.file.filename}`;

    const { data, error } = await supabase
      .from('events')
      .update({ rule_book: rbPath })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ message: 'Rule book uploaded', ruleBook: rbPath, event: data });
  } catch (err) {
    console.error('Upload rulebook error:', err);
    res.status(500).json({ error: 'Failed to upload rule book' });
  }
});

module.exports = router;
