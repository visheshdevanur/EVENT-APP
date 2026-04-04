import { useState, useEffect } from 'react';
import { apiFetch, API_BASE } from '../utils/api';

export default function DeptAdminDashboard() {
  const [targetDeptId, setTargetDeptId] = useState('');
  const [users, setUsers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [roomRequests, setRoomRequests] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('users');
  const [eventFilter, setEventFilter] = useState('all');
  const [roomFilter, setRoomFilter] = useState('all');
  const [roomSearch, setRoomSearch] = useState('');
  
  const [showCreateAdmin, setShowCreateAdmin] = useState(false);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  
  const [adminForm, setAdminForm] = useState({ studentId: '', name: '', email: '', password: '', role: 'admin' });
  const [roomForm, setRoomForm] = useState({ name: '', capacity: '', location: '' });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const u = JSON.parse(userStr);
        setTargetDeptId(u.department_id);
      }

      const [usersData, roomsData, requestsData, logsData, eventsData] = await Promise.all([
        apiFetch('/users'),
        apiFetch('/rooms'),
        apiFetch('/rooms/requests'),
        apiFetch('/activity-logs'),
        apiFetch('/events/my')
      ]);
      setUsers(usersData);
      setRooms(roomsData);
      setRoomRequests(requestsData);
      setActivityLogs(logsData);
      setEvents(eventsData || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  const getConflictedCount = () => {
    return roomRequests.filter(req => 
      req.status === 'pending' && roomRequests.some(r => 
        r.room_id === req.room_id && 
        r.status === 'approved' &&
        r.id !== req.id &&
        new Date(req.events?.event_date).setHours(0,0,0,0) <= new Date(r.events?.end_date || r.events?.event_date).setHours(23,59,59,999) &&
        new Date(req.events?.end_date || req.events?.event_date).setHours(23,59,59,999) >= new Date(r.events?.event_date).setHours(0,0,0,0)
      )
    ).length;
  };

  const pendingRequests = roomRequests.filter(r => r.status === 'pending');
  const conflictCount = getConflictedCount();

  const handleDeleteUser = async (userId, userName) => {
    if (!confirm(`Are you sure you want to delete admin "${userName}"?`)) return;
    try {
      await apiFetch(`/users/${userId}`, { method: 'DELETE' });
      await loadData();
    } catch (err) { alert(err.error || 'Failed to delete user'); }
  };

  const handleExport = async (eventId, title) => {
    try {
      const res = await fetch(`${API_BASE}/events/${eventId}/export`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) throw new Error('Failed to export participants');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/[^a-zA-Z0-9]/g, '_')}_participants.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await apiFetch('/users/create-admin', {
        method: 'POST',
        body: JSON.stringify({ ...adminForm, departmentId: targetDeptId }),
      });
      alert('✅ Admin manager account created!');
      setAdminForm({ studentId: '', name: '', email: '', password: '', role: 'admin' });
      setShowCreateAdmin(false);
      await loadData();
    } catch (err) { alert(err.error || 'Failed to create admin'); }
    finally { setCreating(false); }
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await apiFetch('/rooms', {
        method: 'POST',
        body: JSON.stringify({
          name: roomForm.name,
          capacity: roomForm.capacity ? Number(roomForm.capacity) : null,
          location: roomForm.location || null,
          departmentId: targetDeptId
        }),
      });
      alert('✅ Room created!');
      setRoomForm({ name: '', capacity: '', location: '' });
      setShowCreateRoom(false);
      await loadData();
    } catch (err) { alert(err.error || 'Failed to create room'); }
    finally { setCreating(false); }
  };

  const handleDeleteRoom = async (roomId, roomName) => {
    if (!confirm(`Delete room "${roomName}"? This cannot be undone.`)) return;
    try {
      await apiFetch(`/rooms/${roomId}`, { method: 'DELETE' });
      await loadData();
    } catch (err) { alert(err.error || 'Failed to delete room'); }
  };

  const handleApproveRequest = async (requestId) => {
    try {
      await apiFetch(`/rooms/requests/${requestId}/approve`, { method: 'PATCH' });
      await loadData();
    } catch (err) { alert(err.error || 'Failed'); }
  };

  const handleRejectRequest = async (requestId) => {
    try {
      await apiFetch(`/rooms/requests/${requestId}/reject`, { method: 'PATCH' });
      await loadData();
    } catch (err) { alert(err.error || 'Failed'); }
  };

  const filteredEvents = events
    .filter(e => eventFilter === 'all' || e.status === eventFilter)
    .sort((a, b) => new Date(b.event_date) - new Date(a.event_date));

  if (loading) return <div className="loading-center"><img src="/logo.png" alt="Loading..." className="eventloop-loader" /></div>;

  return (
    <div className="page-container">
      <div className="page-header animate-in">
        <h1>🏢 Department Admin Portal</h1>
        <p>Manage event managers, allocate rooms, and oversee department activities</p>
      </div>

      <div className="stats-row animate-in" style={{ animationDelay: '80ms' }}>
        <div className="stat-card glass-card clickable-stat" onClick={() => setActiveTab('users')}>
          <div className="stat-number">{users.filter(u => u.role === 'admin').length}</div>
          <div className="stat-label">Admins</div>
        </div>
        <div className="stat-card glass-card clickable-stat" onClick={() => setActiveTab('users')}>
          <div className="stat-number">{users.filter(u => u.role === 'student').length}</div>
          <div className="stat-label">Students</div>
        </div>
        <div className="stat-card glass-card clickable-stat" onClick={() => setActiveTab('rooms')}>
          <div className="stat-number">{rooms.length}</div>
          <div className="stat-label">Rooms</div>
        </div>
        <div className="stat-card glass-card clickable-stat" onClick={() => { setActiveTab('rooms'); setRoomFilter('pending'); }}>
          <div className="stat-number" style={{ color: pendingRequests.length > 0 ? '#f7b731' : 'inherit' }}>
            {pendingRequests.length}
          </div>
          <div className="stat-label">Pend. Requests</div>
        </div>
        <div className="stat-card glass-card clickable-stat" onClick={() => { setActiveTab('rooms'); setRoomFilter('conflicted'); }}>
          <div className="stat-number" style={{ color: conflictCount > 0 ? '#ff2a5f' : 'inherit' }}>
             {conflictCount}
          </div>
          <div className="stat-label">Conflicts</div>
        </div>
      </div>

      <div className="tabs-container split-tabs animate-in" style={{ animationDelay: '150ms', marginTop: '2rem' }}>
        <div className="tabs-header">
          <button className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>👥 Admins & Users</button>
          <button className={`tab-btn ${activeTab === 'events' ? 'active' : ''}`} onClick={() => setActiveTab('events')}>📅 Dept Events</button>
          <button className={`tab-btn ${activeTab === 'rooms' ? 'active' : ''}`} onClick={() => setActiveTab('rooms')}>🚪 Room Allocation</button>
          <button className={`tab-btn ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>📜 Activity Logs</button>
        </div>

        <div className="tab-content glass-card">
          {activeTab === 'users' && (
            <div className="tab-pane active fade-in">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2>Department Members</h2>
                <button className="btn btn-primary" onClick={() => setShowCreateAdmin(!showCreateAdmin)}>
                  {showCreateAdmin ? 'Cancel' : '+ Create Event Manager (Admin)'}
                </button>
              </div>

              {showCreateAdmin && (
                <form className="glass-card fade-in" style={{ marginBottom: 20 }} onSubmit={handleCreateAdmin}>
                  <h3>Create New Admin</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                    <input className="form-control" placeholder="USN (e.g. 1KS22CS001)" autoComplete="off" value={adminForm.studentId} onChange={(e) => setAdminForm({ ...adminForm, studentId: e.target.value })} required />
                    <input className="form-control" placeholder="Full Name" autoComplete="off" value={adminForm.name} onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })} required />
                    <input className="form-control" type="email" placeholder="Email" autoComplete="off" value={adminForm.email} onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })} required />
                    <div style={{ position: 'relative' }}>
                      <input className="form-control" type={showAdminPassword ? 'text' : 'password'} placeholder="Temporary Password" autoComplete="new-password" value={adminForm.password} onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })} required style={{ width: '100%' }} />
                      <button type="button" onClick={() => setShowAdminPassword(!showAdminPassword)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer', outline: 'none' }}>
                        {showAdminPassword ? '👁️' : '🕶️'}
                      </button>
                    </div>
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={creating}>{creating ? 'Creating...' : 'Create Admin'}</button>
                </form>
              )}

              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>USN</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Joined</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id}>
                        <td>{u.student_id}</td>
                        <td style={{ fontWeight: 600 }}>{u.name}</td>
                        <td style={{ opacity: 0.8 }}>{u.email}</td>
                        <td>
                          <span className={`role-badge ${u.role === 'admin' ? 'role-admin' : 'role-student'}`}>
                            {u.role.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ opacity: 0.7 }}>{new Date(u.created_at).toLocaleDateString()}</td>
                        <td>
                          {(u.role === 'admin' || u.role === 'student') && (
                            <button className="btn btn-sm btn-danger" onClick={() => handleDeleteUser(u.id, u.name)}>Delete</button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 && <tr><td colSpan="6" className="empty-state">No users found in this department</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'events' && (
            <div className="tab-pane active fade-in">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2>Department Events</h2>
                <select className="form-control" style={{ width: 'auto', minWidth: '200px' }} value={eventFilter} onChange={(e) => setEventFilter(e.target.value)}>
                  <option value="all">View All Events</option>
                  <option value="upcoming">Upcoming</option>
                  <option value="open">Open</option>
                  <option value="ongoing">Ongoing</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              
              {filteredEvents.length === 0 ? (
                <div className="empty-state">
                  <h3>No events match your filter.</h3>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Event Title</th>
                        <th>Description</th>
                        <th>Status</th>
                        <th>Event Date</th>
                        <th>Cost</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEvents.map(evt => (
                        <tr key={evt.id}>
                          <td style={{ fontWeight: 600 }}>{evt.title}</td>
                          <td style={{ opacity: 0.8 }}>{evt.description || '-'}</td>
                          <td>
                            <span className={`status-badge status-${evt.status}`}>{evt.status}</span>
                          </td>
                          <td>{(new Date(evt.event_date)).toLocaleString()}</td>
                          <td>{evt.entry_fee > 0 ? `₹${evt.entry_fee}` : 'FREE'}</td>
                          <td>
                            <button className="btn btn-sm btn-primary" onClick={() => handleExport(evt.id, evt.title)}>
                              Download CSV
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'rooms' && (
            <div className="tab-pane active fade-in">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                <div className="room-list-section" style={{ borderRight: '1px solid rgba(255,255,255,0.1)', paddingRight: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h2>My Rooms</h2>
                    <button className="btn btn-sm btn-primary" onClick={() => setShowCreateRoom(!showCreateRoom)}>
                      {showCreateRoom ? 'Cancel' : '+ Add Room'}
                    </button>
                  </div>
                  {showCreateRoom && (
                    <form className="glass-card fade-in" style={{ marginBottom: 20 }} onSubmit={handleCreateRoom}>
                      <input className="form-control" style={{ marginBottom: 8 }} placeholder="Room Name (e.g. Auditorium 1)" value={roomForm.name} onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })} required />
                      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                        <input className="form-control" type="number" placeholder="Capacity (e.g. 200)" value={roomForm.capacity} onChange={(e) => setRoomForm({ ...roomForm, capacity: e.target.value })} />
                        <input className="form-control" placeholder="Location/Block" value={roomForm.location} onChange={(e) => setRoomForm({ ...roomForm, location: e.target.value })} />
                      </div>
                      <button type="submit" className="btn btn-sm btn-primary" disabled={creating}>Add Room</button>
                    </form>
                  )}
                  {rooms.length === 0 ? (
                    <p className="empty-state">No rooms created yet.</p>
                  ) : (
                    <ul className="request-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {rooms.map(room => (
                        <li key={room.id} className="request-item" style={{ marginBottom: 0, padding: '1rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <strong style={{ fontSize: '1.1rem' }}>{room.name}</strong>
                              <div className="text-sm opacity-70" style={{ marginTop: '4px' }}>
                                {room.capacity ? `Capacity: ${room.capacity}` : 'No capacity set'} {room.location ? ` | ${room.location}` : ''}
                              </div>
                            </div>
                            <button className="btn btn-sm btn-danger" onClick={() => handleDeleteRoom(room.id, room.name)}>Delete</button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="room-requests-section">
                  <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                    <div className="search-box glass-card" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px', flex: 1 }}>
                      <span style={{ opacity: 0.5 }}>🔍</span>
                      <input 
                        type="text" 
                        placeholder="Search rooms/events..." 
                        value={roomSearch}
                        onChange={(e) => setRoomSearch(e.target.value)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', width: '100%', fontSize: '0.85rem' }}
                      />
                    </div>
                    <select className="form-control" style={{ width: 130 }} value={roomFilter} onChange={(e) => setRoomFilter(e.target.value)}>
                      <option value="all">All</option>
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="conflicted">⚠️ Conflicts</option>
                    </select>
                  </div>

                  {roomRequests.length === 0 ? (
                    <p className="empty-state">No room requests.</p>
                  ) : (
                    <ul className="request-list" style={{ listStyle: 'none', padding: 0 }}>
                      {roomRequests.filter(req => {
                        const matchesSearch = req.rooms?.name?.toLowerCase().includes(roomSearch.toLowerCase()) || 
                                              req.events?.title?.toLowerCase().includes(roomSearch.toLowerCase());
                        if (!matchesSearch) return false;

                        if (roomFilter === 'all') return true;
                        if (roomFilter === 'conflicted') {
                          return req.status === 'pending' && roomRequests.some(r => 
                            r.room_id === req.room_id && 
                            r.status === 'approved' &&
                            r.id !== req.id &&
                            new Date(req.events?.event_date).setHours(0,0,0,0) <= new Date(r.events?.end_date || r.events?.event_date).setHours(23,59,59,999) &&
                            new Date(req.events?.end_date || req.events?.event_date).setHours(23,59,59,999) >= new Date(r.events?.event_date).setHours(0,0,0,0)
                          );
                        }
                        return req.status === roomFilter;
                      }).map(req => {
                        // Conflict Detection: check if any OTHER request for THIS room is ALREADY approved for THESE dates
                        const isConflicted = req.status === 'pending' && roomRequests.some(r => 
                          r.room_id === req.room_id && 
                          r.status === 'approved' &&
                          r.id !== req.id &&
                          new Date(req.events?.event_date).setHours(0,0,0,0) <= new Date(r.events?.end_date || r.events?.event_date).setHours(23,59,59,999) &&
                          new Date(req.events?.end_date || req.events?.event_date).setHours(23,59,59,999) >= new Date(r.events?.event_date).setHours(0,0,0,0)
                        );

                        return (
                          <li key={req.id} className="request-item" style={{ 
                            borderLeft: req.status === 'pending' ? '4px solid #f7b731' : req.status === 'approved' ? '4px solid #20bf6b' : '4px solid #eb3b5a',
                            padding: '1.25rem',
                            marginBottom: '1rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.5rem',
                            backgroundColor: 'rgba(255, 255, 255, 0.03)',
                            borderRadius: '8px'
                          }}>
                            <div className="request-details">
                              <div className="request-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <strong style={{ fontSize: '1.15rem', color: 'var(--text-primary)' }}>{req.rooms?.name || 'Unknown Room'}</strong>
                                  <span className={`status-badge status-${req.status}`} style={{ fontSize: '0.75rem', padding: '2px 10px' }}>{req.status?.toUpperCase()}</span>
                                </div>
                                {isConflicted && <span style={{ backgroundColor: '#eb3b5a', color: 'white', padding: '4px 10px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700 }}>⚠️ CONFLICT: ALREADY BOOKED</span>}
                              </div>
                              <p className="request-event" style={{ margin: 0, fontSize: '0.95rem' }}>For: <strong>{req.events?.title || 'Unknown Event'}</strong></p>
                              <p className="request-requester" style={{ margin: 0, fontSize: '0.85rem', opacity: 0.8 }}>Requested by: {req.users?.name} ({req.users?.email})</p>
                              <p className="request-time" style={{ margin: 0, fontSize: '0.8rem', opacity: 0.6 }}>{new Date(req.created_at).toLocaleString()}</p>
                            </div>
                            {req.status === 'pending' && (
                              <div className="request-actions" style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                                <button className="btn btn-sm btn-success" style={{ flex: 1 }} onClick={() => handleApproveRequest(req.id)}>Approve</button>
                                <button className="btn btn-sm btn-danger" style={{ flex: 1 }} onClick={() => handleRejectRequest(req.id)}>Reject</button>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="tab-pane active fade-in">
              <h2>Recent Activities</h2>
              <ul className="request-list">
                {activityLogs.map((log) => (
                  <li key={log.id} className="request-item" style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600 }}>{log.users?.name || 'Unknown User'} <span style={{ opacity: 0.6, fontSize: '0.85em' }}>({log.users?.role})</span></span>
                      <span className="text-sm opacity-70">{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                    <p style={{ marginTop: 4, fontFamily: 'monospace', background: 'rgba(255,255,255,0.05)', padding: '6px 10px', borderRadius: 6 }}>
                      {log.action}
                    </p>
                  </li>
                ))}
                {activityLogs.length === 0 && <p className="empty-state">No activity logs recorded yet.</p>}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
