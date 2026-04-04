const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const XLSX = require('xlsx');
const supabase = require('../db/supabase');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

// ── Ensure upload directories exist ──
const dirs = ['templates', 'payment-qr', 'rulebooks', 'logos', 'posters'];
dirs.forEach((d) => {
  const p = path.join(__dirname, '..', 'uploads', d);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

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
  limits: { fileSize: 10 * 1024 * 1024 },
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
  limits: { fileSize: 5 * 1024 * 1024 },
});

// ── Multer config for rulebooks ──
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

// ── Multer config for logos ──
const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads', 'logos')),
  filename: (req, file, cb) => cb(null, `${req.params.id}_${Date.now()}${path.extname(file.originalname)}`),
});
const uploadLogo = multer({
  storage: logoStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.webp', '.svg'];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

// ── Multer config for posters ──
const posterStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads', 'posters')),
  filename: (req, file, cb) => cb(null, `${req.params.id}_${Date.now()}${path.extname(file.originalname)}`),
});
const uploadPoster = multer({
  storage: posterStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.webp'];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

// ── POST /api/events — Admin creates a new event ──
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { title, description, eventDate, endDate, registrationDeadline, maxTeamSize, minTeamSize, entryFee, contact1, contact2 } = req.body;

    if (!title || !eventDate || !endDate || !registrationDeadline || !description?.trim()) {
      return res.status(400).json({ error: 'title, description, eventDate, endDate, and registrationDeadline are required' });
    }

    if (!contact1?.trim()) {
      return res.status(400).json({ error: 'At least one contact detail is required' });
    }

    if (minTeamSize && maxTeamSize && Number(minTeamSize) > Number(maxTeamSize)) {
      return res.status(400).json({ error: 'Min team size must be less than or equal to max team size' });
    }

    if (new Date(registrationDeadline) >= new Date(eventDate)) {
      return res.status(400).json({ error: 'Registration deadline must be before the event date' });
    }
    const { data: event, error } = await supabase
      .from('events')
      .insert({
        title,
        description: description.trim(),
        event_date: eventDate,
        end_date: endDate,
        registration_deadline: registrationDeadline,
        max_team_size: maxTeamSize || 4,
        min_team_size: minTeamSize || 1,
        entry_fee: entryFee || 0,
        contact1: contact1.trim(),
        contact2: contact2?.trim() || null,
        status: 'open',
        created_by: req.user.id,
        department_id: req.user.departmentId || null
      })
      .select()
      .single();

    if (error) {
      console.error('Event create error:', error);
      return res.status(500).json({ error: 'Failed to create event' });
    }

    await supabase.from('activity_logs').insert({
      user_id: req.user.id,
      action: `Created event: ${title}`,
      department_id: req.user.departmentId || null
    });

    res.status(201).json(event);
  } catch (err) {
    console.error('Event error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/events/my — Admin's own events only, DeptAdmin sees all dept events ──
router.get('/my', requireAuth, requireAdmin, async (req, res) => {
  try {
    let query = supabase.from('events').select('*, departments(name)').order('event_date', { ascending: true });

    if (req.user.role === 'dept_admin') {
      query = query.eq('department_id', req.user.departmentId);
    } else if (req.user.role === 'admin') {
      query = query.eq('created_by', req.user.id);
    } // superadmin sees all

    const { data: events, error } = await query;

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
      .select('*, departments(name)')
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
      .select('*, departments(name)')
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

// ── PATCH /api/events/:id — Admin updates event ──
router.patch('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const updates = {};
    const { status, title, description, eventDate, endDate, registrationDeadline, maxTeamSize, minTeamSize, entryFee, contact1, contact2 } = req.body;

    if (status) {
      const validStatuses = ['upcoming', 'open', 'ongoing', 'completed', 'canceled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
      }
      updates.status = status;
    }

    if (title) updates.title = title;
    if (description !== undefined) updates.description = description.trim();
    if (eventDate) updates.event_date = eventDate;
    if (endDate) updates.end_date = endDate;
    if (registrationDeadline) updates.registration_deadline = registrationDeadline;
    if (maxTeamSize !== undefined) updates.max_team_size = maxTeamSize;
    if (minTeamSize !== undefined) updates.min_team_size = minTeamSize;
    if (entryFee !== undefined) updates.entry_fee = entryFee;
    if (contact1 !== undefined) updates.contact1 = contact1;
    if (contact2 !== undefined) updates.contact2 = contact2;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const { data: event, error } = await supabase
      .from('events')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error || !event) return res.status(404).json({ error: 'Event not found' });

    await supabase.from('activity_logs').insert({
      user_id: req.user.id,
      action: `Updated event: ${event.title}`,
      department_id: req.user.departmentId || null
    });

    res.json({ message: 'Event updated', event });
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

// ── POST /api/events/:id/upload-logo — Upload event logo ──
router.post('/:id/upload-logo', requireAuth, requireAdmin, uploadLogo.single('logo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No logo uploaded' });

    const logoPath = `/uploads/logos/${req.file.filename}`;

    const { data, error } = await supabase
      .from('events')
      .update({ logo: logoPath })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ message: 'Logo uploaded', logo: logoPath, event: data });
  } catch (err) {
    console.error('Upload logo error:', err);
    res.status(500).json({ error: 'Failed to upload logo' });
  }
});

// ── POST /api/events/:id/upload-poster — Upload event poster ──
router.post('/:id/upload-poster', requireAuth, requireAdmin, uploadPoster.single('poster'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No poster uploaded' });

    const posterPath = `/uploads/posters/${req.file.filename}`;

    const { data, error } = await supabase
      .from('events')
      .update({ poster: posterPath })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ message: 'Poster uploaded', poster: posterPath, event: data });
  } catch (err) {
    console.error('Upload poster error:', err);
    res.status(500).json({ error: 'Failed to upload poster' });
  }
});

// ── GET /api/events/:id/export — Export participant details as XLSX ──
router.get('/:id/export', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { data: event } = await supabase
      .from('events')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (!event) return res.status(404).json({ error: 'Event not found' });

    // Get all teams for this event
    const { data: teams } = await supabase
      .from('teams')
      .select('*')
      .eq('event_id', req.params.id);

    // Get document uploads
    const { data: docs } = await supabase
      .from('document_uploads')
      .select('user_id, drive_link')
      .eq('event_id', req.params.id);
    const docsMap = {};
    if (docs) docs.forEach(d => docsMap[d.user_id] = d.drive_link);

    const rows = [];

    for (const team of teams || []) {
      // Get members with phone
      const { data: members } = await supabase
        .from('team_members')
        .select('user_id, users(id, student_id, name, email, phone)')
        .eq('team_id', team.id);

      const memberList = (members || []).map((m) => m.users);

      // Get leader info
      const leader = memberList.find((m) => m.id === team.leader_id);

      for (const member of memberList) {
        rows.push({
          'Team Name': team.team_name,
          'Member Name': member.name,
          'Email': member.email,
          'Phone': member.phone || '',
          'USN': member.student_id,
          'Is Leader': member.id === team.leader_id ? 'Yes' : 'No',
          'Leader Phone': leader?.phone || '',
          'Payment Status': team.payment_status,
          'Attendance': team.attended ? 'Yes' : 'No',
          'Food Collected': team.food_collected ? 'Yes' : 'No',
          'Payment Screenshot': team.payment_screenshot ? 'Yes' : 'No',
          'Document Link': docsMap[member.id] || '',
        });
      }
    }

    if (rows.length === 0) {
      rows.push({ 'Team Name': 'No participants', 'Member Name': '', 'Email': '', 'Phone': '', 'USN': '', 'Is Leader': '', 'Leader Phone': '', 'Payment Status': '', 'Attendance': '', 'Food Collected': '', 'Payment Screenshot': '', 'Document Link': '' });
    }

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Participants');

    // Set column widths
    worksheet['!cols'] = [
      { wch: 20 }, { wch: 25 }, { wch: 30 }, { wch: 15 }, { wch: 15 },
      { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 14 }, { wch: 18 },
    ];

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const filename = `${event.title.replace(/[^a-zA-Z0-9]/g, '_')}_participants.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: 'Failed to export participants' });
  }
});

module.exports = router;
