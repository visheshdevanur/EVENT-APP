import { useState, useEffect } from 'react';
import { apiFetch, API_BASE } from '../utils/api';
import CollegeCalendar from '../components/CollegeCalendar';

export default function SuperAdminDashboard() {
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState('departments');
  const [showCreateDept, setShowCreateDept] = useState(false);
  
  // Track which department we are assigning a HOD for
  const [assigningHodDeptId, setAssigningHodDeptId] = useState(null);
  const [showHodPassword, setShowHodPassword] = useState(false);
  
  const [deptForm, setDeptForm] = useState({ name: '' });
  const [deptAdminForm, setDeptAdminForm] = useState({ studentId: '', name: '', email: '', password: '', role: 'dept_admin' });
  const [creating, setCreating] = useState(false);

  // Filter state for Global Users
  const [userDeptFilter, setUserDeptFilter] = useState('all');
  const [editingUserId, setEditingUserId] = useState(null);
  const [editUserForm, setEditUserForm] = useState({ name: '', phone: '', student_id: '' });
  const [updatingUser, setUpdatingUser] = useState(false);

  // Events per department state
  const [allEvents, setAllEvents] = useState([]);
  const [expandedDeptId, setExpandedDeptId] = useState(null);
  const [deptEventFilter, setDeptEventFilter] = useState('all');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [deptsData, usersData, logsData, eventsData] = await Promise.all([
        apiFetch('/departments'),
        apiFetch('/users'),
        apiFetch('/activity-logs'),
        apiFetch('/events')
      ]);
      setDepartments(deptsData);
      setUsers(usersData);
      setActivityLogs(logsData);
      setAllEvents(eventsData || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  const handleCreateDept = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await apiFetch('/departments', { method: 'POST', body: JSON.stringify(deptForm) });
      alert('✅ Department created!');
      setDeptForm({ name: '' });
      setShowCreateDept(false);
      await loadData();
    } catch (err) { alert(err.error || 'Failed to create department'); }
    finally { setCreating(false); }
  };

  const handleDeleteDept = async (id, name) => {
    if (!confirm(`Are you sure you want to delete the department "${name}"?`)) return;
    try {
      await apiFetch(`/departments/${id}`, { method: 'DELETE' });
      await loadData();
    } catch (err) { alert(err.error || 'Failed to delete department (it might have users attached).'); }
  };

  const handleCreateDeptAdmin = async (e, deptId) => {
    e.preventDefault();
    
    // Server-side will enforce that this is a superadmin assigning dept_admin
    setCreating(true);
    try {
      await apiFetch('/users/create-admin', {
        method: 'POST',
        body: JSON.stringify({ ...deptAdminForm, departmentId: deptId }),
      });
      alert('✅ Department Admin (HOD) account created & assigned!');
      setDeptAdminForm({ studentId: '', name: '', email: '', password: '', role: 'dept_admin' });
      setAssigningHodDeptId(null);
      await loadData();
    } catch (err) { alert(err.error || 'Failed to create department admin'); }
    finally { setCreating(false); }
  };

  const handleDeleteUser = async (userId, userName) => {
    if (!confirm(`Are you sure you want to DELETE user "${userName}"?`)) return;
    try {
      await apiFetch(`/users/${userId}`, { method: 'DELETE' });
      await loadData();
    } catch (err) { alert(err.error || 'Failed to delete user'); }
  };

  const handleUpdateUser = async (e, userId) => {
    e.preventDefault();
    setUpdatingUser(true);
    try {
      await apiFetch(`/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: editUserForm.name, phone: editUserForm.phone, student_id: editUserForm.student_id })
      });
      setEditingUserId(null);
      await loadData();
    } catch (err) {
      alert(err.error || 'Failed to update user');
    } finally {
      setUpdatingUser(false);
    }
  };

  if (loading) return <div className="loading-center"><img src="/logo.png" alt="Loading..." className="eventloop-loader" /></div>;

  const filteredUsers = users.filter((u) => {
    return userDeptFilter === 'all' || u.department_id === userDeptFilter;
  });

  return (
    <div className="page-container">
      <div className="page-header animate-in">
        <h1>👑 Principal / Super Admin Panel</h1>
        <p>Global oversight of College Departments and HODs</p>
      </div>

      <div className="stats-row animate-in" style={{ animationDelay: '80ms' }}>
        <div className="stat-card glass-card clickable-stat" onClick={() => setActiveTab('departments')}>
          <div className="stat-number">{departments.length}</div>
          <div className="stat-label">Departments</div>
        </div>
        <div className="stat-card glass-card clickable-stat" onClick={() => setActiveTab('departments')}>
          <div className="stat-number">{users.filter(u => u.role === 'dept_admin').length}</div>
          <div className="stat-label">HODs (Dept Admin)</div>
        </div>
        <div className="stat-card glass-card clickable-stat" onClick={() => setActiveTab('users')}>
          <div className="stat-number">{users.length}</div>
          <div className="stat-label">Total Users</div>
        </div>
      </div>

      <div className="tabs-container split-tabs animate-in" style={{ animationDelay: '150ms', marginTop: '2rem' }}>
        <div className="tabs-header">
          <button className={`tab-btn ${activeTab === 'departments' ? 'active' : ''}`} onClick={() => setActiveTab('departments')}>🏛️ Departments & HODs</button>
          <button className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>👥 Global Users</button>
          <button className={`tab-btn ${activeTab === 'calendar' ? 'active' : ''}`} onClick={() => setActiveTab('calendar')}>📅 College Calendar</button>
          <button className={`tab-btn ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>📜 Global Logs</button>
        </div>

        <div className="tab-content glass-card">
          {activeTab === 'departments' && (
            <div className="tab-pane active fade-in">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2>College Departments</h2>
                <button className="btn btn-primary" onClick={() => setShowCreateDept(!showCreateDept)}>
                  {showCreateDept ? 'Cancel' : '+ Add Department'}
                </button>
              </div>

              {showCreateDept && (
                <form className="glass-card fade-in" style={{ marginBottom: 20 }} onSubmit={handleCreateDept}>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <input className="form-control" style={{ flex: 1 }} placeholder="Department Name (e.g. Computer Science)" value={deptForm.name} onChange={(e) => setDeptForm({ name: e.target.value })} required />
                    <button type="submit" className="btn btn-primary" disabled={creating}>{creating ? 'Adding...' : 'Add Dept'}</button>
                  </div>
                </form>
              )}

              <ul className="request-list">
                {departments.map((dept) => {
                  const currentHod = users.find(u => u.department_id === dept.id && u.role === 'dept_admin');
                  
                  const isExpanded = expandedDeptId === dept.id;
                  const deptEvents = allEvents.filter(e => e.department_id === dept.id);
                  const filteredDeptEvents = deptEvents.filter(e => deptEventFilter === 'all' || e.status === deptEventFilter);

                  return (
                    <li key={dept.id} className="request-item" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.5rem', marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <strong 
                            style={{ fontSize: '1.2rem', display: 'block', marginBottom: '4px', cursor: 'pointer', color: '#00f0ff', textDecoration: 'underline' }}
                            onClick={() => setExpandedDeptId(dept.id)}
                            title="Click to view events for this department in full screen"
                          >
                            {dept.name}
                          </strong>
                          <div className="text-sm opacity-70">Joined: {new Date(dept.created_at).toLocaleDateString()} &middot; {deptEvents.length} Events</div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          {!currentHod ? (
                            <button className="btn btn-sm btn-success" onClick={() => setAssigningHodDeptId(assigningHodDeptId === dept.id ? null : dept.id)}>
                              {assigningHodDeptId === dept.id ? 'Cancel' : 'Assign HOD'}
                            </button>
                          ) : (
                            <div style={{ background: 'rgba(32, 191, 107, 0.1)', padding: '4px 12px', borderRadius: '4px', border: '1px solid rgba(32, 191, 107, 0.3)', color: '#20bf6b' }}>
                              <strong>HOD Assigned:</strong> {currentHod.name}
                            </div>
                          )}
                          <button className="btn btn-sm btn-danger" onClick={() => handleDeleteDept(dept.id, dept.name)}>Delete Dept</button>
                        </div>
                      </div>

                      {assigningHodDeptId === dept.id && !currentHod && (
                        <form className="glass-card fade-in" style={{ background: 'rgba(0,0,0,0.1)', border: '1px solid rgba(255,255,255,0.1)', marginTop: '0.5rem' }} onSubmit={(e) => handleCreateDeptAdmin(e, dept.id)}>
                          <h4 style={{ marginBottom: '1rem' }}>Assign new HOD to {dept.name}</h4>
                          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                            <input className="form-control" placeholder="Employee/HOD ID" autoComplete="off" value={deptAdminForm.studentId} onChange={(e) => setDeptAdminForm({ ...deptAdminForm, studentId: e.target.value })} required />
                            <input className="form-control" placeholder="Full Name" autoComplete="off" value={deptAdminForm.name} onChange={(e) => setDeptAdminForm({ ...deptAdminForm, name: e.target.value })} required />
                            <input className="form-control" type="email" placeholder="Email" autoComplete="off" value={deptAdminForm.email} onChange={(e) => setDeptAdminForm({ ...deptAdminForm, email: e.target.value })} required />
                            <div style={{ position: 'relative' }}>
                              <input className="form-control" type={showHodPassword ? 'text' : 'password'} placeholder="Temp Password" autoComplete="new-password" value={deptAdminForm.password} onChange={(e) => setDeptAdminForm({ ...deptAdminForm, password: e.target.value })} required style={{ width: '100%' }} />
                              <button type="button" onClick={() => setShowHodPassword(!showHodPassword)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer', outline: 'none' }}>
                                {showHodPassword ? '👁️' : '🕶️'}
                              </button>
                            </div>
                          </div>
                          <button type="submit" className="btn btn-sm btn-primary" disabled={creating}>{creating ? 'Assigning...' : 'Complete Assignment'}</button>
                        </form>
                      )}
                    </li>
                  )
                })}
                {departments.length === 0 && <p className="empty-state">No departments registered yet.</p>}
              </ul>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="tab-pane active fade-in">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2>Global Users</h2>
                <select className="form-control" style={{ width: 'auto', minWidth: '250px' }} value={userDeptFilter} onChange={(e) => setUserDeptFilter(e.target.value)}>
                  <option value="all">View All Branches</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>

              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Name / Details</th>
                      <th>Department</th>
                      <th>Role</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map(u => {
                      const dName = departments.find(d => d.id === u.department_id)?.name || 'Unknown/None';
                      return (
                        editingUserId === u.id ? (
                          <tr key={u.id}>
                            <td>
                              <input className="form-control" value={editUserForm.student_id} onChange={e => setEditUserForm({...editUserForm, student_id: e.target.value})} style={{ width: '100px' }} />
                            </td>
                            <td>
                              <input className="form-control" value={editUserForm.name} onChange={e => setEditUserForm({...editUserForm, name: e.target.value})} style={{ marginBottom: 4 }} />
                              <span style={{ opacity: 0.5, fontSize: '0.85rem' }}>{u.email}</span>
                            </td>
                            <td>{dName}</td>
                            <td>
                              <input className="form-control" value={editUserForm.phone} onChange={e => setEditUserForm({...editUserForm, phone: e.target.value})} placeholder="Phone" style={{ width: '120px' }} />
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button className="btn btn-sm btn-success" onClick={(e) => handleUpdateUser(e, u.id)} disabled={updatingUser}>{updatingUser ? '...' : 'Save'}</button>
                                <button className="btn btn-sm btn-secondary" onClick={() => setEditingUserId(null)}>Cancel</button>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          <tr key={u.id}>
                            <td>{u.student_id}</td>
                            <td>
                              <strong>{u.name}</strong><br />
                              <span style={{ opacity: 0.7, fontSize: '0.85rem' }}>{u.email}</span>
                            </td>
                            <td>{dName}</td>
                            <td>
                              <span className={`role-badge ${u.role === 'superadmin' ? 'role-admin' : u.role === 'dept_admin' ? 'role-admin' : u.role === 'admin' ? 'role-admin' : 'role-student'}`}>
                                {u.role.replace('_', ' ').toUpperCase()}
                              </span>
                              {u.phone && <div style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: 4 }}>📞 {u.phone}</div>}
                            </td>
                            <td>
                              {u.role !== 'superadmin' && (
                                <div style={{ display: 'flex', gap: 4 }}>
                                  <button className="btn btn-sm btn-primary" onClick={() => { 
                                    setEditingUserId(u.id); 
                                    setEditUserForm({ name: u.name, phone: u.phone || '', student_id: u.student_id || '' }); 
                                  }}>Edit</button>
                                  <button className="btn btn-sm btn-danger" onClick={() => handleDeleteUser(u.id, u.name)}>Delete</button>
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      );
                    })}
                    {filteredUsers.length === 0 && (
                      <tr>
                        <td colSpan="5" className="empty-state">No users found for this filter.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'calendar' && (
            <div className="tab-pane active fade-in">
              <div style={{ marginBottom: 24 }}>
                <h2>🏛️ College-wide Event Schedule</h2>
                <p style={{ opacity: 0.7 }}>Viewing all events happening across all departments.</p>
              </div>
              <CollegeCalendar />
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="tab-pane active fade-in">
              <h2>Global Activity Logs</h2>
              <ul className="request-list">
                {activityLogs.map((log) => (
                  <li key={log.id} className="request-item" style={{ padding: '12px', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600 }}>{log.users?.name || 'Unknown User'} <span style={{ opacity: 0.6, fontSize: '0.85em' }}>({log.users?.role})</span></span>
                      <span className="text-sm opacity-70">{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                    <div style={{ fontSize: '0.85rem', opacity: 0.8, color: '#f7b731', marginTop: 2 }}>📍 Dept: {log.departments?.name || 'Global'}</div>
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

      {/* ────── DEPARTMENT EVENTS FULL SCREEN MODAL ────── */}
      {expandedDeptId && (() => {
        const targetDept = departments.find(d => d.id === expandedDeptId);
        const deptEvents = allEvents.filter(e => e.department_id === expandedDeptId);
        const filteredDeptEvents = deptEvents.filter(e => deptEventFilter === 'all' || e.status === deptEventFilter);

        return (
          <div className="poster-modal-overlay" onClick={() => setExpandedDeptId(null)}>
            <div className="poster-modal glass-card animate-in full-screen-modal" onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2>📅 {targetDept?.name} Events</h2>
                <button className="btn btn-secondary btn-sm" onClick={() => setExpandedDeptId(null)}>Close</button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                <select 
                  className="form-control" 
                  style={{ width: '200px' }} 
                  value={deptEventFilter} 
                  onChange={(e) => setDeptEventFilter(e.target.value)}
                >
                  <option value="all">All Statuses</option>
                  <option value="open">🟢 Open</option>
                  <option value="ongoing">⏳ Ongoing</option>
                  <option value="completed">✅ Completed</option>
                </select>
              </div>

              {filteredDeptEvents.length === 0 ? (
                <div className="empty-state">
                  <h3>No events found for this filter.</h3>
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
                        <th>Reg Deadline</th>
                        <th>Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDeptEvents.map(evt => (
                        <tr key={evt.id}>
                          <td style={{ fontWeight: 600 }}>{evt.title}</td>
                          <td style={{ opacity: 0.8 }}>{evt.description || '-'}</td>
                          <td>
                            <span className={`status-badge status-${evt.status}`}>{evt.status}</span>
                          </td>
                          <td>{(new Date(evt.event_date)).toLocaleString()}</td>
                          <td>{(new Date(evt.registration_deadline)).toLocaleString()}</td>
                          <td>{evt.entry_fee > 0 ? `₹${evt.entry_fee}` : 'FREE'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        );
      })()}

    </div>
  );
}
