const express = require('express');
const supabase = require('../db/supabase');
const { requireAuth, requireAdmin, requireSuperAdmin, requireDeptAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

// ── GET /api/rooms — List rooms based on role ──
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    let query = supabase.from('rooms').select('*').order('created_at', { ascending: false });

    // Restrict per department unless superadmin
    if (req.user.role !== 'superadmin') {
      if (!req.user.departmentId) return res.json([]);
      query = query.eq('department_id', req.user.departmentId);
    }

    const { data: rooms, error } = await query;
    if (error) throw error;

    res.json(rooms);
  } catch (err) {
    console.error('List rooms error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/rooms/available — List available rooms for dates ──
router.get('/available', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { start, end, excludeEventId } = req.query;
    if (!start || !end) return res.status(400).json({ error: 'Start and end dates required' });

    let query = supabase.from('rooms').select('*').order('created_at', { ascending: false });

    if (req.user.role !== 'superadmin') {
      if (!req.user.departmentId) return res.json([]);
      query = query.eq('department_id', req.user.departmentId);
    }

    const { data: rooms, error } = await query;
    if (error) throw error;

    // Fetch overlapping requests
    const { data: approvedRequests, error: reqErr } = await supabase
      .from('room_requests')
      .select('room_id, events!inner(id, event_date, end_date)')
      .eq('status', 'approved')
      .lte('events.event_date', end)
      .gte('events.end_date', start);
      
    if (reqErr) throw reqErr;

    const blockedRoomIds = new Set(
      (approvedRequests || [])
        .filter(r => !excludeEventId || r.events.id !== excludeEventId)
        .map(r => r.room_id)
    );

    const roomsWithStatus = rooms.map((r) => ({
      ...r,
      isAvailable: !blockedRoomIds.has(r.id)
    }));

    return res.json(roomsWithStatus);
  } catch (err) {
    console.error('List rooms error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/rooms — Dept Admin or Super Admin creates a room ──
router.post('/', requireAuth, requireDeptAdmin, async (req, res) => {
  try {
    const { name, capacity, location, departmentId } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ error: 'Room name is required' });
    }

    const targetDeptId = req.user.role === 'superadmin' ? departmentId : req.user.departmentId;
    if (!targetDeptId) return res.status(400).json({ error: 'Department context required' });

    const { data: room, error } = await supabase
      .from('rooms')
      .insert({
        name: name.trim(),
        capacity: capacity || null,
        location: location?.trim() || null,
        department_id: targetDeptId
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'A room with this name already exists' });
      }
      throw error;
    }

    await supabase.from('activity_logs').insert({
      user_id: req.user.id,
      action: `Created room: ${name}`,
      department_id: targetDeptId
    });

    res.status(201).json(room);
  } catch (err) {
    console.error('Create room error:', err);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// ── DELETE /api/rooms/:id — Dept Admin deletes a room ──
router.delete('/:id', requireAuth, requireDeptAdmin, async (req, res) => {
  try {
    // Basic verification of ownership
    if (req.user.role !== 'superadmin') {
      const { data: r } = await supabase.from('rooms').select('department_id').eq('id', req.params.id).single();
      if (!r || r.department_id !== req.user.departmentId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }
    }

    const { data, error } = await supabase.from('rooms').delete().eq('id', req.params.id).select().single();
    if (error) throw error;

    await supabase.from('activity_logs').insert({
      user_id: req.user.id,
      action: `Deleted room: ${data.name}`,
      department_id: data.department_id
    });

    res.json({ message: 'Room deleted' });
  } catch (err) {
    console.error('Delete room error:', err);
    res.status(500).json({ error: 'Failed to delete room' });
  }
});

// ── POST /api/rooms/request — Admin requests a room for an event ──
router.post('/request', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { roomId, eventId } = req.body;
    if (!roomId || !eventId) {
      return res.status(400).json({ error: 'roomId and eventId are required' });
    }

    // Fetch the target event's dates
    const { data: targetEvent } = await supabase
      .from('events')
      .select('event_date, end_date')
      .eq('id', eventId)
      .single();

    if (targetEvent) {
      // Truncate to day boundaries
      const startOfDay = new Date(targetEvent.event_date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetEvent.end_date || targetEvent.event_date);
      endOfDay.setHours(23, 59, 59, 999);

      // Check if this room is ALREADY approved for another event on THESE days
      const { data: conflicts } = await supabase
        .from('room_requests')
        .select('id, events!inner(title, event_date, end_date)')
        .eq('room_id', roomId)
        .eq('status', 'approved')
        .lte('events.event_date', endOfDay.toISOString())
        .gte('events.end_date', startOfDay.toISOString());

      if (conflicts && conflicts.length > 0) {
        return res.status(409).json({ 
          error: `Room already approved for event: "${conflicts[0].events.title}" on this date. You cannot request it.` 
        });
      }
    }

    const { data: request, error } = await supabase
      .from('room_requests')
      .insert({
        room_id: roomId,
        event_id: eventId,
        requested_by: req.user.id,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Room already requested for this event' });
      }
      throw error;
    }

    res.status(201).json(request);
  } catch (err) {
    console.error('Request room error:', err);
    res.status(500).json({ error: 'Failed to request room' });
  }
});

// ── GET /api/rooms/requests — Dept Admin views requests ──
router.get('/requests', requireAuth, requireDeptAdmin, async (req, res) => {
  try {
    let query = supabase
      .from('room_requests')
      .select('*, rooms!inner(*), events(id, title), users:requested_by(id, name, email)')
      .order('created_at', { ascending: false });

    if (req.user.role !== 'superadmin') {
      query = query.eq('rooms.department_id', req.user.departmentId);
    }

    const { data: requests, error } = await query;
    if (error) throw error;
    res.json(requests || []);
  } catch (err) {
    console.error('List room requests error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/rooms/my-requests — Admin sees own room requests ──
router.get('/my-requests', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { data: requests, error } = await supabase
      .from('room_requests')
      .select('*, rooms(*), events(id, title)')
      .eq('requested_by', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(requests || []);
  } catch (err) {
    console.error('My room requests error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PATCH /api/rooms/requests/:id/approve — Dept Admin approves ──
router.patch('/requests/:id/approve', requireAuth, requireDeptAdmin, async (req, res) => {
  try {
    // First fetch the request to get room and event IDs
    const { data: request, error: fetchErr } = await supabase
      .from('room_requests')
      .select('*, rooms(name, department_id)')
      .eq('id', req.params.id)
      .single();

    if (fetchErr || !request) return res.status(404).json({ error: 'Request not found' });

    // Fetch the target event's dates
    const { data: targetEvent } = await supabase
      .from('events')
      .select('event_date, end_date')
      .eq('id', request.event_id)
      .single();

    if (targetEvent) {
      // Truncate to day boundaries for dates
      const startOfDay = new Date(targetEvent.event_date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetEvent.end_date || targetEvent.event_date);
      endOfDay.setHours(23, 59, 59, 999);

      // Check for EXISTING approved events for THIS room that overlap with THESE days
      const { data: conflicts } = await supabase
        .from('room_requests')
        .select('id, events!inner(id, title, event_date, end_date)')
        .eq('room_id', request.room_id)
        .eq('status', 'approved')
        .neq('event_id', request.event_id) // ignore this event
        .lte('events.event_date', endOfDay.toISOString())
        .gte('events.end_date', startOfDay.toISOString());

      if (conflicts && conflicts.length > 0) {
        return res.status(409).json({ 
          error: `Room already approved for event: "${conflicts[0].events.title}" on this date.` 
        });
      }
    }

    const { data: updatedRequest, error: updateErr } = await supabase
      .from('room_requests')
      .update({ status: 'approved', department_admin_id: req.user.id })
      .eq('id', req.params.id)
      .select('*, rooms(name, department_id)')
      .single();

    if (updateErr) throw updateErr;

    await supabase.from('activity_logs').insert({
      user_id: req.user.id,
      action: `Approved room request for room: ${updatedRequest.rooms?.name}`,
      department_id: updatedRequest.rooms?.department_id
    });

    res.json({ message: `Room "${updatedRequest.rooms?.name}" approved`, request: updatedRequest });
  } catch (err) {
    console.error('Approve room error:', err);
    res.status(500).json({ error: 'Failed to approve' });
  }
});

// ── PATCH /api/rooms/requests/:id/reject — Dept Admin rejects ──
router.patch('/requests/:id/reject', requireAuth, requireDeptAdmin, async (req, res) => {
  try {
    const { data: request, error } = await supabase
      .from('room_requests')
      .update({ status: 'rejected', department_admin_id: req.user.id })
      .eq('id', req.params.id)
      .select('*, rooms(name, department_id)')
      .single();

    if (error || !request) return res.status(404).json({ error: 'Request not found' });

    await supabase.from('activity_logs').insert({
      user_id: req.user.id,
      action: `Rejected room request for room: ${request.rooms?.name}`,
      department_id: request.rooms?.department_id
    });

    res.json({ message: `Room "${request.rooms?.name}" rejected`, request });
  } catch (err) {
    console.error('Reject room error:', err);
    res.status(500).json({ error: 'Failed to reject' });
  }
});

module.exports = router;
