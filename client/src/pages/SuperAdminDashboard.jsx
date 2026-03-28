import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';

export default function SuperAdminDashboard() {
  const [users, setUsers] = useState([]);
  const [allEvents, setAllEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [showCreateAdmin, setShowCreateAdmin] = useState(false);
  const [creating, setCreating] = useState(false);
  const [adminForm, setAdminForm] = useState({ studentId: '', name: '', email: '', password: '' });
  const [activeTab, setActiveTab] = useState('users');
  const [eventSearch, setEventSearch] = useState('');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [usersData, eventsData] = await Promise.all([
        apiFetch('/users'),
        apiFetch('/events'),
      ]);
      setUsers(usersData);
      setAllEvents(eventsData);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  const handleChangeRole = async (userId, newRole) => {
    const action = newRole === 'admin' ? 'promote to Admin' : 'demote to Student';
    if (!confirm(`Are you sure you want to ${action} this user?`)) return;
    try {
      await apiFetch(`/users/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role: newRole }),
      });
      await loadUsers();
    } catch (err) { alert(err.error || 'Failed to update role'); }
  };

  const handleDeleteUser = async (userId, userName) => {
    if (!confirm(`Are you sure you want to DELETE user "${userName}"? This cannot be undone.`)) return;
    try {
      await apiFetch(`/users/${userId}`, { method: 'DELETE' });
      await loadData();
    } catch (err) { alert(err.error || 'Failed to delete user'); }
  };

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await apiFetch('/users/create-admin', {
        method: 'POST',
        body: JSON.stringify(adminForm),
      });
      alert('✅ Admin account created!');
      setAdminForm({ studentId: '', name: '', email: '', password: '' });
      setShowCreateAdmin(false);
      await loadData();
    } catch (err) { alert(err.error || 'Failed to create admin'); }
    finally { setCreating(false); }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.student_id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = filterRole === 'all' || u.role === filterRole;
    return matchesSearch && matchesRole;
  });

  const stats = {
    total: users.length,
    admins: users.filter((u) => u.role === 'admin').length,
    students: users.filter((u) => u.role === 'student').length,
    totalEvents: allEvents.length,
  };

  if (loading) return <div className="loading-center"><div className="spinner"></div></div>;

  return (
    <div className="page-container">
      <div className="page-header animate-in">
        <h1>🛡️ Super Admin Panel</h1>
        <p>Manage users, promote coordinators, and oversee the platform</p>
      </div>

      {/* Stats Cards */}
      <div className="stats-row animate-in" style={{ animationDelay: '80ms' }}>
        <div className="stat-card glass-card">
          <div className="stat-number">{stats.total}</div>
          <div className="stat-label">Total Users</div>
        </div>
        <div className="stat-card glass-card">
          <div className="stat-number" style={{ color: '#f59e0b' }}>{stats.admins}</div>
          <div className="stat-label">Admins</div>
        </div>
        <div className="stat-card glass-card">
          <div className="stat-number" style={{ color: '#6366f1' }}>{stats.students}</div>
          <div className="stat-label">Students</div>
        </div>
        <div className="stat-card glass-card">
          <div className="stat-number" style={{ color: '#00f0ff' }}>{stats.totalEvents}</div>
          <div className="stat-label">Total Events</div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="tab-bar animate-in" style={{ marginBottom: 24 }}>
        <button className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>
          👥 Users
        </button>
        <button className={`tab-btn ${activeTab === 'events' ? 'active' : ''}`} onClick={() => setActiveTab('events')}>
          📅 All Events ({allEvents.length})
        </button>
      </div>

      {/* Search & Filter */}
      {/* ────── USER MANAGEMENT TAB ────── */}
      {activeTab === 'users' && (
      <div className="admin-section animate-in" style={{ animationDelay: '160ms' }}>
        <div className="admin-section-header">
          <h2>👥 User Management</h2>
          <button className="btn btn-primary" onClick={() => setShowCreateAdmin(!showCreateAdmin)}>
            {showCreateAdmin ? 'Cancel' : '+ Add Admin'}
          </button>
        </div>

        {/* Create Admin Form */}
        {showCreateAdmin && (
          <form onSubmit={handleCreateAdmin} className="glass-card" style={{ marginBottom: 24, maxWidth: 500 }}>
            <h3 style={{ marginBottom: 16 }}>🛡️ Create New Admin Account</h3>
            <div className="form-group">
              <label>Staff / USN</label>
              <input className="form-control" value={adminForm.studentId}
                onChange={(e) => setAdminForm({ ...adminForm, studentId: e.target.value })}
                placeholder="e.g. STAFF001" required />
            </div>
            <div className="form-group">
              <label>Full Name</label>
              <input className="form-control" value={adminForm.name}
                onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })}
                placeholder="Admin's full name" required />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input className="form-control" type="email" value={adminForm.email}
                onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                placeholder="admin@example.com" required />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input className="form-control" type="password" value={adminForm.password}
                onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                placeholder="Set a password" required />
            </div>
            <button type="submit" className="btn btn-primary" disabled={creating} style={{ width: '100%' }}>
              {creating ? 'Creating...' : 'Create Admin Account'}
            </button>
          </form>
        )}

        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <input
            className="form-control search-input"
            style={{ flex: 1, minWidth: 200 }}
            placeholder="🔍 Search by name, email, or USN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <select
            className="form-control"
            style={{ width: 160 }}
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
          >
            <option value="all">All Roles</option>
            <option value="admin">Admins Only</option>
            <option value="student">Students Only</option>
          </select>
        </div>

        {/* Users Table */}
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>USN</th>
                <th>Email</th>
                <th>Role</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 && (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No users found</td></tr>
              )}
              {filteredUsers.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600 }}>{u.name}</td>
                  <td><code style={{ fontSize: '0.85rem' }}>{u.student_id}</code></td>
                  <td>{u.email}</td>
                  <td>
                    <span className={`status-badge ${u.role === 'admin' ? 'status-ongoing' : u.role === 'superadmin' ? 'status-completed' : 'status-open'}`}>
                      {u.role === 'superadmin' ? '🛡️ superadmin' : u.role}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {new Date(u.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </td>
                  <td>
                    {u.role === 'superadmin' ? (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Protected</span>
                    ) : (
                      <div style={{ display: 'flex', gap: 6 }}>
                        {u.role === 'student' ? (
                          <button className="btn btn-success btn-sm" onClick={() => handleChangeRole(u.id, 'admin')}>
                            ⬆ Make Admin
                          </button>
                        ) : (
                          <button className="btn btn-secondary btn-sm" onClick={() => handleChangeRole(u.id, 'student')}>
                            ⬇ Demote
                          </button>
                        )}
                        <button className="btn btn-danger btn-sm" onClick={() => handleDeleteUser(u.id, u.name)}>
                          🗑
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* ────── ALL EVENTS TAB ────── */}
      {activeTab === 'events' && (
        <div className="admin-section animate-in">
          <h2 style={{ marginBottom: 16 }}>📅 All Events (Created by All Admins)</h2>

          {/* Search bar */}
          <div style={{ marginBottom: 16 }}>
            <input
              className="form-control search-input"
              placeholder="🔍 Search by event name or creator..."
              value={eventSearch}
              onChange={(e) => setEventSearch(e.target.value)}
            />
          </div>

          {(() => {
            const filtered = allEvents.filter((evt) => {
              const creator = users.find((u) => u.id === evt.created_by);
              const q = eventSearch.toLowerCase();
              return evt.title.toLowerCase().includes(q) ||
                evt.status.toLowerCase().includes(q) ||
                (creator?.name || '').toLowerCase().includes(q);
            });
            return filtered.length === 0 ? (
              <div className="empty-state"><h3>{eventSearch ? 'No events match your search' : 'No events created yet'}</h3></div>
            ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Created By</th>
                    <th>Status</th>
                    <th>Event Date</th>
                    <th>Registration Deadline</th>
                    <th>Fee</th>
                    <th>Team Size</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((evt) => {
                    const creator = users.find((u) => u.id === evt.created_by);
                    return (
                      <tr key={evt.id}>
                        <td style={{ fontWeight: 600 }}>{evt.title}</td>
                        <td>{creator ? creator.name : <span style={{ color: 'var(--text-muted)' }}>Unknown</span>}</td>
                        <td><span className={`status-badge status-${evt.status}`}>{evt.status}</span></td>
                        <td>{new Date(evt.event_date).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                        <td>{new Date(evt.registration_deadline).toLocaleDateString('en-IN')}</td>
                        <td>{evt.entry_fee > 0 ? `₹${evt.entry_fee}` : 'Free'}</td>
                        <td>{evt.min_team_size}–{evt.max_team_size}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
