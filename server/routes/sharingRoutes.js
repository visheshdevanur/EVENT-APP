const express = require('express');
const supabase = require('../db/supabase');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { requireAuth } = require('../middleware/authMiddleware');

// Multer config for sharing media
const sharingDir = path.join(__dirname, '..', 'uploads', 'sharing');
if (!fs.existsSync(sharingDir)) fs.mkdirSync(sharingDir, { recursive: true });

const sharingStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, sharingDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const uploadMedia = multer({
  storage: sharingStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB for videos
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|mp4|webm|mov/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype.split('/')[1]);
    if (ext || mime) return cb(null, true);
    cb(new Error('Only images and videos are allowed'));
  },
});

const router = express.Router();

// ── GET /api/sharing — Fetch all global posts ──
router.get('/', requireAuth, async (req, res) => {
  try {
    const { data: posts, error } = await supabase
      .from('sharing_posts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Enrich with user info
    const userIds = [...new Set((posts || []).map((p) => p.user_id))];
    let usersMap = {};
    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, name, role, email, student_id')
        .in('id', userIds);
      usersMap = (users || []).reduce((acc, u) => { acc[u.id] = u; return acc; }, {});
    }

    const enriched = (posts || []).map((p) => ({
      ...p,
      user_name: usersMap[p.user_id]?.name || 'Unknown',
      user_role: usersMap[p.user_id]?.role || 'student',
      user_email: usersMap[p.user_id]?.email || '',
      user_student_id: usersMap[p.user_id]?.student_id || '',
    }));

    res.json(enriched);
  } catch (err) {
    console.error('Get sharing posts error:', err);
    res.status(500).json({ error: 'Failed to load posts' });
  }
});

// ── POST /api/sharing — Create a new post ──
router.post('/', requireAuth, uploadMedia.single('media'), async (req, res) => {
  try {
    const { content } = req.body;

    if (!content && !req.file) {
      return res.status(400).json({ error: 'Post must have text or media' });
    }

    let media_url = null;
    let media_type = null;

    if (req.file) {
      media_url = `/uploads/sharing/${req.file.filename}`;
      const ext = path.extname(req.file.originalname).toLowerCase();
      media_type = ['.mp4', '.webm', '.mov'].includes(ext) ? 'video' : 'image';
    }

    const { data: post, error } = await supabase
      .from('sharing_posts')
      .insert({
        user_id: req.user.id,
        content: content || null,
        media_url,
        media_type,
      })
      .select()
      .single();

    if (error) throw error;

    // Get user info to return enriched post
    const { data: user } = await supabase
      .from('users')
      .select('name, role, email, student_id')
      .eq('id', req.user.id)
      .single();

    res.status(201).json({
      ...post,
      user_name: user?.name || 'Unknown',
      user_role: user?.role || 'student',
      user_email: user?.email || '',
      user_student_id: user?.student_id || '',
    });
  } catch (err) {
    console.error('Create sharing post error:', err);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// ── DELETE /api/sharing/:postId — Delete a post ──
router.delete('/:postId', requireAuth, async (req, res) => {
  try {
    // Fetch the post first
    const { data: post, error: fetchErr } = await supabase
      .from('sharing_posts')
      .select('*')
      .eq('id', req.params.postId)
      .single();

    if (fetchErr || !post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Only the author or an admin can delete
    const isAdmin = req.user.role === 'admin' || req.user.role === 'superadmin';
    if (post.user_id !== req.user.id && !isAdmin) {
      return res.status(403).json({ error: 'Not authorized to delete this post' });
    }

    // Delete the media file if it exists
    if (post.media_url) {
      const filePath = path.join(__dirname, '..', post.media_url);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    const { error } = await supabase
      .from('sharing_posts')
      .delete()
      .eq('id', req.params.postId);

    if (error) throw error;

    res.json({ message: 'Post deleted' });
  } catch (err) {
    console.error('Delete sharing post error:', err);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

module.exports = router;
