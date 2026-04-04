require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// ── CORS ─────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));

// ── Body Parsers ─────────────────────────────────
// JSON for most routes
app.use(express.json());

// ── Route Imports ────────────────────────────────
const authRoutes = require('./routes/authRoutes');
const eventRoutes = require('./routes/eventRoutes');
const teamRoutes = require('./routes/teamRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const certificateRoutes = require('./routes/certificateRoutes');
const messageRoutes = require('./routes/messageRoutes');
const userRoutes = require('./routes/userRoutes');
const sharingRoutes = require('./routes/sharingRoutes');
const roomRoutes = require('./routes/roomRoutes');
const documentRoutes = require('./routes/documentRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const activityLogRoutes = require('./routes/activityLogRoutes');

// ── Mount Routes ─────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/certificates', certificateRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/users', userRoutes);
app.use('/api/sharing', sharingRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/activity-logs', activityLogRoutes);

// ── Health Check ─────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Static: certificates (for direct access if needed) ──
app.use('/certificates', express.static(path.join(__dirname, 'certificates')));

// ── Static: uploads (templates, payment QR images) ──
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Error Handler ────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start Server ─────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀 Event Portal Server running on http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health\n`);
});

module.exports = app;
