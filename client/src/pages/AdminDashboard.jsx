import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiFetch, API_BASE, getUser } from '../utils/api';
import QRScanner from '../components/QRScanner';
import EventChat from '../components/EventChat';
import CollegeCalendar from '../components/CollegeCalendar';

const COUNTRY_CODES = [
  { code: '+91', label: '+91' },
  { code: '+1', label: '+1' },
  { code: '+44', label: '+44' },
  { code: '+61', label: '+61' },
  { code: '+971', label: '+971' },
  { code: '+65', label: '+65' },
];

export default function AdminDashboard() {
  const [events, setEvents] = useState([]);
  const [availableRooms, setAvailableRooms] = useState([]);
  const [myRoomRequests, setMyRoomRequests] = useState([]);
  const [allRooms, setAllRooms] = useState([]);
  const [deptRoomRequests, setDeptRoomRequests] = useState([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomCapacity, setNewRoomCapacity] = useState('');

  // Dept Admin: Manage Admins + Logs
  const [deptUsers, setDeptUsers] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [showCreateAdmin, setShowCreateAdmin] = useState(false);
  const [adminForm, setAdminForm] = useState({ studentId: '', name: '', email: '', password: '' });
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [certMsg, setCertMsg] = useState({});
  const [generatingCerts, setGeneratingCerts] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [chatEvent, setChatEvent] = useState(null);
  const [expandedTeamId, setExpandedTeamId] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get('tab') || 'events');

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t) setTab(t);
  }, [searchParams]);

  const handleTabChange = (newTab) => {
    setTab(newTab);
    setSearchParams({ tab: newTab });
  };
  const user = getUser();

  // Expanded Data
  const [expandedEvent, setExpandedEvent] = useState(null);
  const [eventTeams, setEventTeams] = useState([]);
  const [eventDocs, setEventDocs] = useState([]);
  const [showDocsFor, setShowDocsFor] = useState(null);

  // Scanner State
  const [scannerEvent, setScannerEvent] = useState(null);
  const [scanType, setScanType] = useState('attendance');
  const [scanResult, setScanResult] = useState(null);
  const [scanToken, setScanToken] = useState('');

  const [newEvent, setNewEvent] = useState({
    title: '', description: '', eventDate: '', endDate: '', registrationDeadline: '',
    maxTeamSize: 4, minTeamSize: 1, entryFee: 0,
    contact1Code: '+91', contact1Phone: '',
    contact2Code: '+91', contact2Phone: '',
    roomIds: [],
  });

  const [newLogo, setNewLogo] = useState(null);
  const [newRulebook, setNewRulebook] = useState(null);
  const [newPaymentQr, setNewPaymentQr] = useState(null);

  // Edit Event Modal
  const [editEvent, setEditEvent] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [eventsData, requestsData] = await Promise.all([
        apiFetch('/events/my'),
        apiFetch('/rooms/my-requests'),
      ]);
      setEvents(eventsData);
      setMyRoomRequests(requestsData || []);

      if (user?.role === 'dept_admin') {
        const [rData, reqData, usersData, logsData] = await Promise.all([
          apiFetch('/rooms'),
          apiFetch('/rooms/requests'),
          apiFetch('/users'),
          apiFetch('/activity-logs'),
        ]);
        setAllRooms(rData || []);
        setDeptRoomRequests(reqData || []);
        setDeptUsers(usersData || []);
        setActivityLogs(logsData || []);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    if (newEvent.eventDate && newEvent.endDate) {
      const start = new Date(newEvent.eventDate);
      const end = new Date(newEvent.endDate);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return;

      // Truncate to start and end of respective days to enforce date-only overlap
      const startOfDay = new Date(start);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(end);
      endOfDay.setHours(23, 59, 59, 999);

      apiFetch(`/rooms/available?start=${startOfDay.toISOString()}&end=${endOfDay.toISOString()}`)
        .then(data => setAvailableRooms(data || []))
        .catch(err => console.error(err));
    } else {
      apiFetch('/rooms').then(data => setAvailableRooms(data || [])).catch(console.error);
    }
  }, [newEvent.eventDate, newEvent.endDate]);

  const filteredEvents = events.filter((evt) => {
    const matchesSearch = evt.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || evt.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const handleCreateEvent = async (e) => {
    e.preventDefault();

    if (newEvent.minTeamSize > newEvent.maxTeamSize) {
      alert('Min team size must be less than or equal to max team size');
      return;
    }
    if (!newEvent.description.trim()) {
      alert('Event description is mandatory');
      return;
    }
    if (newEvent.entryFee > 0 && !newPaymentQr) {
      alert('Payment QR Code is mandatory for paid events');
      return;
    }
    if (new Date(newEvent.eventDate) >= new Date(newEvent.endDate)) {
      alert('To Date must be after From Date');
      return;
    }
    if (newEvent.registrationDeadline && newEvent.eventDate &&
        new Date(newEvent.registrationDeadline) >= new Date(newEvent.eventDate)) {
      alert('Registration deadline must be before the event date');
      return;
    }

    setCreating(true);
    try {
      // 1. Create event
      const eventData = {
        ...newEvent,
        contact1: `${newEvent.contact1Code} ${newEvent.contact1Phone}`.trim(),
        contact2: newEvent.contact2Phone ? `${newEvent.contact2Code} ${newEvent.contact2Phone}`.trim() : '',
      };
      
      const createdEvent = await apiFetch('/events', { method: 'POST', body: JSON.stringify(eventData) });

      // 2. Upload Logo
      if (newLogo) {
        const formData = new FormData();
        formData.append('logo', newLogo);
        await fetch(`${API_BASE}/events/${createdEvent.id}/upload-logo`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          body: formData,
        });
      }

      // 3. Upload Rulebook
      if (newRulebook) {
        const formData = new FormData();
        formData.append('rulebook', newRulebook);
        await fetch(`${API_BASE}/events/${createdEvent.id}/upload-rulebook`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          body: formData,
        });
      }

      // 4. Request Rooms
      if (newEvent.roomIds && newEvent.roomIds.length > 0) {
        for (const rId of newEvent.roomIds) {
          await apiFetch('/rooms/request', {
            method: 'POST',
            body: JSON.stringify({ roomId: rId, eventId: createdEvent.id }),
          });
        }
      }

      // 5. Upload Payment QR
      if (newPaymentQr) {
        const formData = new FormData();
        formData.append('paymentQr', newPaymentQr);
        await fetch(`${API_BASE}/events/${createdEvent.id}/upload-payment-qr`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          body: formData,
        });
      }

      setShowCreateForm(false);
      setNewEvent({ title: '', description: '', eventDate: '', endDate: '', registrationDeadline: '', maxTeamSize: 4, minTeamSize: 1, entryFee: 0, contact1Code: '+91', contact1Phone: '', contact2Code: '+91', contact2Phone: '', roomIds: [] });
      setNewLogo(null);
      setNewRulebook(null);
      setNewPaymentQr(null);
      await loadData();
    } catch (err) { alert(err.error || 'Failed to create event'); }
    finally { setCreating(false); }
  };

  const handleScanResult = async (token) => {
    if (!token?.trim()) return;
    setScanResult(null);
    try {
      const data = await apiFetch('/attendance/checkin', {
        method: 'POST',
        body: JSON.stringify({ qrToken: token.trim(), type: scanType }),
      });
      setScanResult({ type: 'success', message: data.message, data });
      if (expandedEvent) handleViewTeams(expandedEvent);
    } catch (err) {
      setScanResult({ type: 'error', message: err.error || 'Check-in failed' });
    }
  };

  const handleCompleteEvent = async (eventId) => {
    if (!confirm('Mark this event as completed?')) return;
    try {
      await apiFetch(`/events/${eventId}/complete`, { method: 'PATCH' });
      await loadData();
    } catch (err) { alert(err.error || 'Failed'); }
  };

  const handleUpdateStatus = async (eventId, status) => {
    try {
      await apiFetch(`/events/${eventId}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      await loadData();
    } catch (err) { alert(err.error || 'Failed'); }
  };

  const handleViewTeams = async (eventId) => {
    setExpandedEvent(eventId);
    setShowDocsFor(null);
    try {
      const data = await apiFetch(`/teams/event/${eventId}`);
      setEventTeams(data);
    } catch (err) { console.error(err); }
  };

  const handleViewDocs = async (eventId) => {
    setShowDocsFor(eventId);
    setExpandedEvent(null);
    try {
      const data = await apiFetch(`/documents/event/${eventId}`);
      setEventDocs(data);
    } catch (err) { console.error(err); }
  };

  const handleDeleteTeam = async (teamId, teamName) => {
    if (!confirm(`Delete team "${teamName}"? This cannot be undone.`)) return;
    try {
      await apiFetch(`/teams/${teamId}`, { method: 'DELETE' });
      if (expandedEvent) await handleViewTeams(expandedEvent);
    } catch (err) { alert(err.error || 'Failed to delete team'); }
  };

  const handleChangePaymentStatus = async (teamId, status) => {
    try {
      await apiFetch(`/teams/${teamId}/payment-status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      if (expandedEvent) await handleViewTeams(expandedEvent);
    } catch (err) { alert(err.error || 'Failed'); }
  };

  const handleConfirmPayment = async (teamId) => {
    try {
      await fetch(`${API_BASE}/teams/${teamId}/confirm-payment`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
      });
      if (expandedEvent) await handleViewTeams(expandedEvent);
    } catch (err) { alert(err.message || 'Failed'); }
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    try {
      await apiFetch('/rooms', { method: 'POST', body: JSON.stringify({ name: newRoomName, capacity: parseInt(newRoomCapacity) || 0 }) });
      setNewRoomName(''); setNewRoomCapacity('');
      await loadData();
    } catch (err) { alert(err.error || 'Failed to create room'); }
  };

  const handleApproveRoom = async (reqId) => {
    try { await apiFetch(`/rooms/requests/${reqId}/approve`, { method: 'PATCH' }); await loadData(); } catch (err) { alert(err.error || 'Failed'); }
  };

  const handleRejectRoom = async (reqId) => {
    try { await apiFetch(`/rooms/requests/${reqId}/reject`, { method: 'PATCH' }); await loadData(); } catch (err) { alert(err.error || 'Failed'); }
  };

  const handleCreateDeptUser = async (e) => {
    e.preventDefault();
    setCreatingAdmin(true);
    try {
      await apiFetch('/users/create-admin', {
        method: 'POST',
        body: JSON.stringify({
          studentId: adminForm.studentId,
          name: adminForm.name,
          email: adminForm.email,
          password: adminForm.password,
          role: 'admin',
          departmentId: user?.department_id,
        }),
      });
      alert('✅ Admin account created!');
      setAdminForm({ studentId: '', name: '', email: '', password: '' });
      setShowCreateAdmin(false);
      await loadData();
    } catch (err) { alert(err.error || 'Failed to create admin'); }
    finally { setCreatingAdmin(false); }
  };

  const handleDeleteDeptUser = async (userId, userName) => {
    if (!confirm(`Are you sure you want to delete "${userName}"?`)) return;
    try {
      await apiFetch(`/users/${userId}`, { method: 'DELETE' });
      await loadData();
    } catch (err) { alert(err.error || 'Failed to delete user'); }
  };

  const handleStatusChange = async (eventId, newStatus) => {
    try {
      await apiFetch(`/events/${eventId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      await loadData();
    } catch (err) { alert(err.error || 'Failed to update status'); }
  };

  const handleOpenEdit = (evt) => {
    setEditEvent({
      id: evt.id,
      title: evt.title || '',
      description: evt.description || '',
      eventDate: evt.event_date ? evt.event_date.slice(0, 16) : '',
      endDate: evt.end_date ? evt.end_date.slice(0, 16) : '',
      registrationDeadline: evt.registration_deadline ? evt.registration_deadline.slice(0, 16) : '',
      maxTeamSize: evt.max_team_size || 4,
      minTeamSize: evt.min_team_size || 1,
      entryFee: evt.entry_fee || 0,
      contact1: evt.contact1 || '',
      contact2: evt.contact2 || '',
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setSavingEdit(true);
    try {
      await apiFetch(`/events/${editEvent.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: editEvent.title,
          description: editEvent.description,
          eventDate: editEvent.eventDate,
          endDate: editEvent.endDate,
          registrationDeadline: editEvent.registrationDeadline,
          maxTeamSize: editEvent.maxTeamSize,
          minTeamSize: editEvent.minTeamSize,
          entryFee: editEvent.entryFee,
          contact1: editEvent.contact1,
          contact2: editEvent.contact2,
        }),
      });
      setEditEvent(null);
      await loadData();
    } catch (err) { alert(err.error || 'Failed to save changes'); }
    finally { setSavingEdit(false); }
  };

  const handleGenerateCerts = async (eventId) => {
    setCertMsg(prev => ({ ...prev, [eventId]: '' }));
    setGeneratingCerts(prev => ({ ...prev, [eventId]: true }));
    try {
      const data = await apiFetch(`/certificates/generate/${eventId}`, { method: 'POST' });
      setCertMsg(prev => ({ ...prev, [eventId]: data.message || `Generated ${data.generated} certificate(s)` }));
    } catch (err) { setCertMsg(prev => ({ ...prev, [eventId]: err.error || 'Failed' })); }
    finally { setGeneratingCerts(prev => ({ ...prev, [eventId]: false })); }
  };

  const handleUploadTemplate = async (eventId, file) => {
    if (!file) return;
    const formData = new FormData();
    formData.append('template', file);
    try {
      await fetch(`${API_BASE}/events/${eventId}/upload-template`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: formData,
      });
      alert('✅ Certificate template uploaded!');
      await loadData();
    } catch (err) { alert('Failed to upload template'); }
  };

  const handleFileReupload = async (eventId, fieldName, endpoint) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = fieldName === 'rulebook' ? '.pdf,.doc,.docx,.png,.jpg,.jpeg' : '.png,.jpg,.jpeg,.webp';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const formData = new FormData();
      formData.append(fieldName, file);
      try {
        await fetch(`${API_BASE}/events/${eventId}/${endpoint}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          body: formData,
        });
        alert(`✅ ${fieldName} uploaded!`);
        await loadData();
      } catch (err) { alert(`Failed to upload ${fieldName}`); }
    };
    input.click();
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

  const toggleScanner = (eventId) => {
    if (scannerEvent === eventId) { setScannerEvent(null); setScanResult(null); }
    else { setScannerEvent(eventId); setScanResult(null); }
  };

  if (loading) return <div className="loading-center"><img src="/logo.png" alt="Loading..." className="eventloop-loader" /></div>;

  return (
    <div className="page-container">
      <div className="page-header animate-in">
        <h1>Admin Dashboard ⚡</h1>
        <p>Manage your events, rooms, teams, and export data</p>
      </div>

      <div className="stats-row animate-in" style={{ animationDelay: '80ms', marginBottom: 24 }}>
         <div className="stat-card glass-card clickable-stat" onClick={() => { setTab('events'); setFilterStatus('all'); }}>
           <div className="stat-number" style={{ color: '#00f0ff' }}>{events.length}</div>
           <div className="stat-label">Total Events</div>
         </div>
         <div className="stat-card glass-card clickable-stat" onClick={() => { setTab('events'); setFilterStatus('open'); }}>
           <div className="stat-number" style={{ color: '#00ff9d' }}>{events.filter(e => e.status === 'open').length}</div>
           <div className="stat-label">Open for Registration</div>
         </div>
         <div className="stat-card glass-card clickable-stat" onClick={() => { setTab('events'); setFilterStatus('completed'); }}>
           <div className="stat-number" style={{ color: '#a1a1aa' }}>{events.filter(e => e.status === 'completed').length}</div>
           <div className="stat-label">Completed Events</div>
         </div>

      </div>

      {user?.role === 'dept_admin' && (
        <div className="tab-container glass-card animate-in" style={{ padding: '8px', marginBottom: 24, display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}>
          <button className={`btn ${tab === 'events' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => handleTabChange('events')}>📅 Events</button>
          <button className={`btn ${tab === 'admins' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => handleTabChange('admins')}>👥 Manage Admins</button>
          <button className={`btn ${tab === 'calendar' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => handleTabChange('calendar')}>📆 College Calendar</button>
          <button className={`btn ${tab === 'rooms' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => handleTabChange('rooms')}>🏢 Room Management</button>
          <button className={`btn ${tab === 'logs' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => handleTabChange('logs')}>📜 Activity Logs</button>
        </div>
      )}

      {user?.role === 'admin' && (
        <div className="tab-container glass-card animate-in" style={{ padding: '8px', marginBottom: 24, display: 'inline-flex', gap: 8 }}>
          <button className={`btn ${tab === 'events' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => handleTabChange('events')}>📅 Events</button>
          <button className={`btn ${tab === 'calendar' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => handleTabChange('calendar')}>📆 College Calendar</button>
        </div>
      )}

      {tab === 'events' && (
      <div className="tab-content animate-in">

        {showCreateForm && (
          <form onSubmit={handleCreateEvent} className="glass-card" style={{ marginBottom: 24, maxWidth: 650 }}>
            <h3 style={{ marginBottom: 16 }}>✨ Create New Event</h3>
            
            <div className="form-group">
              <label>Event Title *</label>
              <input className="form-control" value={newEvent.title} onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })} required />
            </div>
            
            <div className="form-group">
              <label>Description *</label>
              <textarea className="form-control" value={newEvent.description} onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })} required />
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
              <div className="form-group">
                <label>From Date *</label>
                <input type="datetime-local" className="form-control" value={newEvent.eventDate} onChange={(e) => setNewEvent({ ...newEvent, eventDate: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>To Date *</label>
                <input type="datetime-local" className="form-control" value={newEvent.endDate} onChange={(e) => setNewEvent({ ...newEvent, endDate: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Registration Deadline *</label>
                <input type="datetime-local" className="form-control" value={newEvent.registrationDeadline} onChange={(e) => setNewEvent({ ...newEvent, registrationDeadline: e.target.value })} required />
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label>Min Team Size</label>
                <input type="number" className="form-control" value={newEvent.minTeamSize} onChange={(e) => setNewEvent({ ...newEvent, minTeamSize: +e.target.value })} min={1} />
              </div>
              <div className="form-group">
                <label>Max Team Size</label>
                <input type="number" className="form-control" value={newEvent.maxTeamSize} onChange={(e) => setNewEvent({ ...newEvent, maxTeamSize: +e.target.value })} min={1} />
              </div>
              <div className="form-group">
                <label>Entry Fee (₹)</label>
                <input type="number" className="form-control" value={newEvent.entryFee} onChange={(e) => setNewEvent({ ...newEvent, entryFee: +e.target.value })} min={0} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label>📞 Primary Contact *</label>
                <div className="phone-input-group">
                  <select className="form-control country-code-select" value={newEvent.contact1Code} onChange={(e) => setNewEvent({ ...newEvent, contact1Code: e.target.value })}>
                    {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                  </select>
                  <input className="form-control phone-number-input" type="tel" pattern="[0-9]{10}" title="Please enter exactly 10 digits" maxLength="10" value={newEvent.contact1Phone} onChange={(e) => setNewEvent({ ...newEvent, contact1Phone: e.target.value })} placeholder="Phone number" required />
                </div>
              </div>
              <div className="form-group">
                <label>📞 Secondary Contact (optional)</label>
                <div className="phone-input-group">
                  <select className="form-control country-code-select" value={newEvent.contact2Code} onChange={(e) => setNewEvent({ ...newEvent, contact2Code: e.target.value })}>
                    {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                  </select>
                  <input className="form-control phone-number-input" type="tel" pattern="[0-9]{10}" title="Please enter exactly 10 digits" maxLength="10" value={newEvent.contact2Phone} onChange={(e) => setNewEvent({ ...newEvent, contact2Phone: e.target.value })} placeholder="Phone number" />
                </div>
              </div>
            </div>

            <div className="form-group">
              <label>🏠 Select Room(s) (optional)</label>
              <p style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: 8 }}>Choose one or more available rooms for your event</p>
              <div style={{ 
                maxHeight: '180px', 
                overflowY: 'auto', 
                background: 'rgba(255,255,255,0.03)', 
                padding: '12px', 
                borderRadius: '8px', 
                border: '1px solid rgba(255,255,255,0.1)',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: '12px'
              }}>
                {availableRooms.length === 0 ? (
                  <p style={{ opacity: 0.5, fontSize: '0.9rem', gridColumn: '1/-1', textAlign: 'center', padding: '20px' }}>
                    Select dates first to check room availability
                  </p>
                ) : (
                  availableRooms.map(r => (
                    <label key={r.id} style={{ 
                      display: 'flex', 
                      alignItems: 'flex-start', 
                      gap: '10px', 
                      cursor: r.isAvailable === false ? 'not-allowed' : 'pointer',
                      opacity: r.isAvailable === false ? 0.5 : 1,
                      padding: '8px',
                      borderRadius: '6px',
                      background: newEvent.roomIds?.includes(r.id) ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                      transition: 'all 0.2s',
                      border: newEvent.roomIds?.includes(r.id) ? '1px solid var(--accent-indigo)' : '1px solid transparent'
                    }}>
                      <input 
                        type="checkbox" 
                        value={r.id}
                        disabled={r.isAvailable === false}
                        checked={newEvent.roomIds?.includes(r.id)}
                        onChange={(e) => {
                          const id = r.id;
                          const currentGroup = newEvent.roomIds || [];
                          const updated = e.target.checked 
                            ? [...currentGroup, id]
                            : currentGroup.filter(rid => rid !== id);
                          setNewEvent({ ...newEvent, roomIds: updated });
                        }}
                        style={{ marginTop: '4px' }}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{r.name}</span>
                        <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                          👥 Cap: {r.capacity} 
                          {r.location && ` | 📍 ${r.location}`}
                        </span>
                        {r.isAvailable === false && (
                          <span style={{ fontSize: '0.7rem', color: '#eb3b5a', fontWeight: 600 }}>❌ Booked for selected dates</span>
                        )}
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label>🖼️ Event Logo (optional)</label>
                <input type="file" className="form-control" accept=".png,.jpg,.jpeg,.webp" onChange={(e) => setNewLogo(e.target.files[0])} />
              </div>
              <div className="form-group">
                <label>📱 Payment QR (optional)</label>
                <input type="file" className="form-control" accept=".png,.jpg,.jpeg,.webp" onChange={(e) => setNewPaymentQr(e.target.files[0])} />
              </div>
              <div className="form-group">
                <label>📖 Rule Book (optional)</label>
                <input type="file" className="form-control" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" onChange={(e) => setNewRulebook(e.target.files[0])} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <button type="submit" className="btn btn-primary btn-lg" disabled={creating} style={{ flex: 1 }}>
                {creating ? 'Creating Event...' : 'Create Event'}
              </button>
              <button type="button" className="btn btn-secondary btn-lg" onClick={() => setShowCreateForm(false)} disabled={creating}>
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* ────── DASHBOARD HEADER ────── */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div className="search-box glass-card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', maxWidth: 400, flex: 1 }}>
            <span style={{ opacity: 0.5 }}>🔍</span>
            <input 
              type="text" 
              placeholder="Search your events..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', width: '100%', fontSize: '0.95rem' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <select 
              className="form-control" 
              style={{ width: 140 }}
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">📋 All Status</option>
              <option value="open">🟢 Open</option>
              <option value="upcoming">🔵 Upcoming</option>
              <option value="ongoing">🟠 Ongoing</option>
              <option value="completed">✅ Completed</option>
            </select>
            {user?.role !== 'superadmin' && user?.role !== 'dept_admin' && (
              <button className="btn btn-primary" onClick={() => setShowCreateForm(true)}>+ Create Event</button>
            )}
          </div>
        </div>

        {filteredEvents.length === 0 && !showCreateForm ? (
          <div className="glass-card" style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: '3rem', marginBottom: 16 }}>🔎</div>
            <h3>{searchQuery ? 'No events match your search' : 'No events yet — create one!'}</h3>
          </div>
        ) : (
          <div className="card-grid">
            {filteredEvents.map((evt) => {
              const req = myRoomRequests.find(r => r.event_id === evt.id);
              return (
                <div key={evt.id} className="glass-card animate-in-up" style={{ display: 'flex', flexDirection: 'column', padding: 24 }}>
                  <div className="event-card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--gradient-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 800, flexShrink: 0 }}>
                        {evt.logo ? (
                          <img src={`${API_BASE.replace('/api', '')}${evt.logo}`} style={{ width: '100%', height: '100%', borderRadius: 10, objectFit: 'cover' }} />
                        ) : (
                          evt.title?.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{evt.title}</h3>
                        <span className={`status-badge status-${evt.status}`} style={{ marginTop: 4, fontSize: '0.6rem' }}>{evt.status}</span>
                      </div>
                    </div>
                  </div>

                  <div className="event-meta" style={{ flex: 1, marginTop: 16 }}>
                    <div className="event-meta-row" style={{ fontSize: '0.85rem', gap: 8, display: 'flex', alignItems: 'center', color: 'var(--text-secondary)' }}>
                      <span>📅</span> {new Date(evt.event_date).toLocaleDateString()}
                    </div>
                    <div className="event-meta-row" style={{ fontSize: '0.85rem', gap: 8, display: 'flex', alignItems: 'center', color: 'var(--text-secondary)', marginTop: 8 }}>
                      <span>⏳</span> {new Date(evt.registration_deadline) < new Date() ? '🛑 Closed' : '⏳ Open until ' + new Date(evt.registration_deadline).toLocaleDateString()}
                    </div>
                    {req && (
                      <div className="event-meta-row" style={{ fontSize: '0.85rem', gap: 8, display: 'flex', alignItems: 'center', marginTop: 8, padding: '4px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: 4 }}>
                        <span>🏠</span> {req.rooms?.name} (<span className={`status-${req.status === 'approved' ? 'confirmed' : 'pending'}`} style={{ fontWeight: 600 }}>{req.status}</span>)
                      </div>
                    )}
                  </div>

                  {/* Status dropdown for admin */}
                  {user?.role === 'admin' && (
                    <div style={{ marginTop: 12 }}>
                      {evt.status === 'completed' || evt.status === 'canceled' ? (
                        <div style={{ padding: '6px 12px', background: evt.status === 'completed' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600, textAlign: 'center', color: evt.status === 'completed' ? '#10b981' : '#ef4444' }}>
                          {evt.status === 'completed' ? '✅ Event Completed — Locked' : '🚫 Event Canceled — Locked'}
                        </div>
                      ) : (
                        <select
                          className="form-control"
                          value={evt.status}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === 'completed' && !confirm('Mark as completed? This cannot be undone.')) return;
                            handleStatusChange(evt.id, val);
                          }}
                          style={{ fontSize: '0.8rem', padding: '4px 8px' }}
                        >
                          <option value="open">🟢 Open</option>
                          <option value="ongoing">🟠 Ongoing</option>
                          <option value="completed">✅ Completed</option>
                          <option value="canceled">🚫 Canceled</option>
                        </select>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                    {user?.role === 'superadmin' || user?.role === 'dept_admin' ? (
                      <button className="btn btn-primary btn-sm" onClick={() => handleExport(evt.id, evt.title)} style={{ width: '100%' }}>📥 Export Participants Data</button>
                    ) : evt.status === 'completed' ? (
                      <>
                        <button className="btn btn-primary btn-sm" onClick={() => handleExport(evt.id, evt.title)} style={{ width: '100%' }}>📥 Export Participants Data</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => handleViewTeams(evt.id)} style={{ width: '100%' }}>👥 View Teams</button>
                        <div style={{ padding: 12, background: 'rgba(99,102,241,0.08)', borderRadius: 8, marginTop: 4 }}>
                          <p style={{ fontSize: '0.8rem', margin: '0 0 8px', fontWeight: 600 }}>🎓 Certificates</p>
                          <div style={{ marginBottom: 8 }}>
                            <label style={{ fontSize: '0.75rem', opacity: 0.8, display: 'block', marginBottom: 4 }}>Upload Template (PDF/Image)</label>
                            <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => handleUploadTemplate(evt.id, e.target.files[0])} style={{ fontSize: '0.75rem', width: '100%' }} />
                          </div>
                          <button className="btn btn-primary btn-sm" onClick={() => handleGenerateCerts(evt.id)} disabled={generatingCerts[evt.id]} style={{ width: '100%' }}>
                            {generatingCerts[evt.id] ? '⏳ Generating...' : '🎓 Generate Certificates'}
                          </button>
                          {certMsg[evt.id] && <p style={{ fontSize: '0.75rem', marginTop: 8, color: '#10b981' }}>{certMsg[evt.id]}</p>}
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => handleViewTeams(evt.id)}>👥 Teams</button>
                          <button className="btn btn-secondary btn-sm" onClick={() => handleViewDocs(evt.id)}>📄 Docs</button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => toggleScanner(evt.id)}>📷 Scanner</button>
                          <button className="btn btn-secondary btn-sm" onClick={() => setChatEvent(evt.id)}>💬 Chat</button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          <button className="btn btn-primary btn-sm" onClick={() => handleExport(evt.id, evt.title)}>📥 Export</button>
                          <button className="btn btn-secondary btn-sm" onClick={() => handleOpenEdit(evt)}>✏️ Edit</button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ────── STUDENT DOCUMENTS SECTION (MODAL) ────── */}
        {showDocsFor && (
          <div className="poster-modal-overlay" onClick={() => setShowDocsFor(null)}>
            <div className="poster-modal glass-card animate-in full-screen-modal" onClick={(e) => e.stopPropagation()}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                 <h2>📄 Uploaded Documents</h2>
                 <button className="btn btn-secondary btn-sm" onClick={() => setShowDocsFor(null)}>Close</button>
               </div>
               <div>
                 {eventDocs.length === 0 ? (
                   <div className="empty-state"><h3>No documents uploaded yet</h3></div>
                 ) : (
                   <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                     {eventDocs.map(doc => (
                       <div key={doc.id} className="doc-upload-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                         <div>
                           <h4 style={{ margin: '0 0 4px 0' }}>{doc.users?.name} <code style={{ fontSize: '0.8rem', opacity: 0.7 }}>{doc.users?.student_id}</code></h4>
                           {doc.description && <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{doc.description}</p>}
                         </div>
                         <a href={doc.drive_link} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm">🔗 Open Link</a>
                       </div>
                     ))}
                   </div>
                 )}
               </div>
            </div>
          </div>
        )}

        {/* ────── EXPANDED TEAMS SECTION (MODAL) ────── */}
        {expandedEvent && (
          <div className="poster-modal-overlay" onClick={() => setExpandedEvent(null)}>
            <div className="poster-modal glass-card animate-in full-screen-modal" onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2>👥 Registered Teams</h2>
                <button className="btn btn-secondary btn-sm" onClick={() => setExpandedEvent(null)}>Close</button>
              </div>

            {eventTeams.length === 0 ? (
              <div className="empty-state"><h3>No teams registered yet</h3></div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Team Name</th>
                      <th>Leader</th>
                      <th>Leader Phone</th>
                      <th>Members</th>
                      <th>Document</th>
                      <th>Payment</th>
                      <th>Attended</th>
                      <th>Food</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eventTeams.map((team) => (
                      <tr key={team.id}>
                        <td style={{ fontWeight: 600 }}>{team.team_name}</td>
                        <td>{team.members?.find((m) => m.id === team.leader_id)?.name}</td>
                        <td style={{ fontSize: '0.85rem' }}>{team.leader_phone || '—'}</td>
                        <td>
                          <button style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.85rem' }} onClick={() => setExpandedTeamId(expandedTeamId === team.id ? null : team.id)}>
                            {team.members.length} members {expandedTeamId === team.id ? '▲' : '▼'}
                          </button>
                          {expandedTeamId === team.id && (
                            <div style={{ marginTop: 8, padding: 8, background: 'var(--bg-glass)', borderRadius: 4 }}>
                              {team.members.map((m) => (
                                <div key={m.id} style={{ fontSize: '0.8rem', padding: '4px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                                  {m.name} ({m.student_id}) <br/> <a href={`mailto:${m.email}`}>{m.email}</a> <br/> {m.phone}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td>
                          {team.leader_document_link ? (
                            <a href={team.leader_document_link} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm" style={{ padding: '4px 8px', fontSize: '0.75rem' }}>View Link</a>
                          ) : (
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>None</span>
                          )}
                        </td>
                        <td>
                          <span className={`status-badge status-${team.payment_status === 'confirmed' || team.payment_status === 'verified' ? 'completed' : (team.payment_status === 'rejected' || team.payment_status === 'failed' ? 'error' : 'upcoming')}`}>
                            {team.payment_status === 'confirmed' || team.payment_status === 'verified' ? 'Approved' : (team.payment_status === 'rejected' || team.payment_status === 'failed' ? 'Rejected' : 'Pending')}
                          </span>
                          
                          {team.payment_screenshot && (
                             <div style={{ marginTop: 8, marginBottom: 8 }}>
                               <img 
                                 src={`${API_BASE.replace('/api', '')}${team.payment_screenshot}`} 
                                 alt="Payment proof" 
                                 style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer', display: 'block', marginBottom: 4 }}
                                 onClick={() => window.open(`${API_BASE.replace('/api', '')}${team.payment_screenshot}`, '_blank')}
                               />
                               <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>Click to enlarge</span>
                             </div>
                          )}

                          <div style={{ marginTop: 8, display: 'flex', gap: 4, flexDirection: 'column' }}>
                            {team.payment_status !== 'confirmed' && team.payment_status !== 'verified' && (
                              <button className="btn btn-success btn-sm" style={{ padding: '2px 8px', fontSize: '0.7rem' }} onClick={() => handleConfirmPayment(team.id)}>✅ Approve</button>
                            )}
                            {team.payment_status !== 'rejected' && team.payment_status !== 'failed' && (
                              <button className="btn btn-danger btn-sm" style={{ padding: '2px 8px', fontSize: '0.7rem' }} onClick={() => handleChangePaymentStatus(team.id, 'rejected')}>❌ Reject</button>
                            )}
                            {team.payment_status !== 'pending' && (
                              <button className="btn btn-secondary btn-sm" style={{ padding: '2px 8px', fontSize: '0.7rem' }} onClick={() => handleChangePaymentStatus(team.id, 'pending')}>⏳ Keep Pending</button>
                            )}
                          </div>
                        </td>
                        <td>{team.attended ? '✅' : '❌'}</td>
                        <td>{team.food_collected ? '✅' : '❌'}</td>
                        <td>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDeleteTeam(team.id, team.team_name)}>🗑</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
        )}

        {/* ────── SCANNER SECTION (MODAL) ────── */}
        {scannerEvent && (
          <div className="poster-modal-overlay" onClick={() => setScannerEvent(null)}>
            <div className="poster-modal glass-card animate-in full-screen-modal" onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2>📷 QR Scanner</h2>
                <button className="btn btn-secondary btn-sm" onClick={() => setScannerEvent(null)}>Close</button>
              </div>
              
              <div>
                <div className="scan-input-wrapper">
                  <select className="form-control" value={scanType} onChange={(e) => setScanType(e.target.value)}>
                    <option value="attendance">Mark Attendance</option>
                    <option value="food">Mark Food Collection</option>
                  </select>
                  <input 
                    className="form-control" 
                    placeholder="Or type/paste token manually..." 
                    value={scanToken} 
                    onChange={(e) => setScanToken(e.target.value)} 
                  />
                  <button className="btn btn-primary" onClick={() => handleScanResult(scanToken)}>Submit</button>
                </div>

                {scanResult && (
                  <div className={`scan-result ${scanResult.type}`}>
                    <strong style={{ display: 'block', fontSize: '1.1rem', marginBottom: 4 }}>
                      {scanResult.type === 'success' ? '✅ Success' : '❌ Error'}
                    </strong>
                    {scanResult.message}
                  </div>
                )}

                <QRScanner onScan={handleScanResult} />
              </div>
            </div>
          </div>
        )}

        {/* ────── CHAT SECTION (MODAL) ────── */}
        {chatEvent && (
          <div className="poster-modal-overlay" onClick={() => setChatEvent(null)}>
            <div className="poster-modal glass-card animate-in full-screen-modal" onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2>💬 Event Chat Support</h2>
                <button className="btn btn-secondary btn-sm" onClick={() => setChatEvent(null)}>Close Chat</button>
              </div>
              <EventChat eventId={chatEvent} />
            </div>
          </div>
        )}
      </div>
      )}

      {/* ────── COLLEGE CALENDAR TAB ────── */}
      {tab === 'calendar' && (user?.role === 'dept_admin' || user?.role === 'admin') && (
        <div className="tab-content animate-in">
          <div className="glass-card" style={{ padding: 24 }}>
            <h2 style={{ marginBottom: 20 }}>📆 College Calendar</h2>
            <CollegeCalendar />
          </div>
        </div>
      )}

      {/* ────── ROOM MANAGEMENT TAB ────── */}
      {tab === 'rooms' && user?.role === 'dept_admin' && (
        <div className="tab-content animate-in">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            
            {/* Create Room Form */}
            <div className="glass-card" style={{ padding: 24 }}>
              <h2 style={{ marginBottom: 16 }}>🏢 Manage Rooms</h2>
              <form onSubmit={handleCreateRoom} style={{ marginBottom: 24 }}>
                <div className="form-group">
                  <label>Room Name / Number</label>
                  <input className="form-control" value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} required placeholder="e.g., Seminar Hall A" />
                </div>
                <div className="form-group">
                  <label>Capacity</label>
                  <input className="form-control" type="number" value={newRoomCapacity} onChange={(e) => setNewRoomCapacity(e.target.value)} placeholder="Max seating capacity" />
                </div>
                <button type="submit" className="btn btn-primary" disabled={!newRoomName}>➕ Create Room</button>
              </form>

              <h3>Existing Rooms</h3>
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {allRooms.map(r => (
                  <li key={r.id} style={{ padding: 12, background: 'rgba(255,255,255,0.05)', marginBottom: 8, borderRadius: 8, display: 'flex', justifyContent: 'space-between' }}>
                    <span><strong>{r.name}</strong> (Cap: {r.capacity})</span>
                  </li>
                ))}
                {allRooms.length === 0 && <li style={{ opacity: 0.6, padding: 12 }}>No rooms created yet.</li>}
              </ul>
            </div>

            {/* Room Booking Requests */}
            <div className="glass-card" style={{ padding: 24 }}>
              <h2 style={{ marginBottom: 16 }}>📋 Room Booking Requests</h2>
              {deptRoomRequests.length === 0 ? (
                <p style={{ opacity: 0.6 }}>No room booking requests from your department admins.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {deptRoomRequests.map(req => (
                    <div key={req.id} style={{ padding: 16, background: 'rgba(255,255,255,0.04)', borderRadius: 8, borderLeft: req.status === 'approved' ? '4px solid #10b981' : (req.status === 'rejected' ? '4px solid #ef4444' : '4px solid #f59e0b') }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div>
                          <h4 style={{ margin: '0 0 4px' }}>{req.rooms?.name}</h4>
                          <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.8 }}>For Event: <strong>{req.events?.title}</strong></p>
                          <p style={{ margin: '4px 0 0', fontSize: '0.8rem', opacity: 0.6 }}>Requested by: {req.users?.name}</p>
                        </div>
                        <span className={`status-badge status-${req.status === 'approved' ? 'completed' : (req.status === 'rejected' ? 'error' : 'upcoming')}`}>{req.status}</span>
                      </div>
                      {req.status === 'pending' && (
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                          <button className="btn btn-success btn-sm" onClick={() => handleApproveRoom(req.id)}>✅ Approve</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleRejectRoom(req.id)}>❌ Reject</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ───── MANAGE ADMINS TAB (dept_admin only) ───── */}
      {tab === 'admins' && user?.role === 'dept_admin' && (
        <div className="tab-content animate-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <h2>👥 Department Admins</h2>
            <button className="btn btn-primary" onClick={() => setShowCreateAdmin(!showCreateAdmin)}>
              {showCreateAdmin ? 'Cancel' : '+ Add Admin'}
            </button>
          </div>

          {showCreateAdmin && (
            <form onSubmit={handleCreateDeptUser} className="glass-card" style={{ marginBottom: 24, maxWidth: 550 }}>
              <h3 style={{ marginBottom: 16 }}>Create New Event Admin</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div className="form-group">
                  <label>Employee/Student ID *</label>
                  <input className="form-control" placeholder="e.g. EMP001" value={adminForm.studentId} onChange={(e) => setAdminForm({ ...adminForm, studentId: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Full Name *</label>
                  <input className="form-control" placeholder="Full Name" value={adminForm.name} onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Email *</label>
                  <input className="form-control" type="email" placeholder="admin@college.edu" value={adminForm.email} onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Temporary Password *</label>
                  <div style={{ position: 'relative' }}>
                    <input className="form-control" type={showAdminPassword ? 'text' : 'password'} placeholder="Min 6 chars" value={adminForm.password} onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })} required minLength={6} style={{ width: '100%' }} />
                    <button type="button" onClick={() => setShowAdminPassword(!showAdminPassword)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer' }}>
                      {showAdminPassword ? '👁️' : '🕶️'}
                    </button>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button type="submit" className="btn btn-primary" disabled={creatingAdmin} style={{ flex: 1 }}>
                  {creatingAdmin ? 'Creating...' : '✅ Create Admin Account'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateAdmin(false)}>Cancel</button>
              </div>
            </form>
          )}

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name / Email</th>
                  <th>Role</th>
                  <th>Joined</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {deptUsers.filter(u => u.role === 'admin' || u.role === 'dept_admin').map(u => (
                  <tr key={u.id}>
                    <td>{u.student_id}</td>
                    <td>
                      <strong>{u.name}</strong><br />
                      <span style={{ opacity: 0.7, fontSize: '0.85rem' }}>{u.email}</span>
                    </td>
                    <td>
                      <span className={`role-badge ${u.role === 'dept_admin' ? 'role-admin' : 'role-student'}`} style={{ background: u.role === 'dept_admin' ? 'rgba(255,165,0,0.15)' : 'rgba(0,200,150,0.15)', color: u.role === 'dept_admin' ? '#ffaa00' : '#20bf6b' }}>
                        {u.role === 'dept_admin' ? '🏛️ HOD' : '🔧 Admin'}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8rem', opacity: 0.7 }}>{new Date(u.created_at).toLocaleDateString()}</td>
                    <td>
                      {u.role === 'admin' && (
                        <button className="btn btn-danger btn-sm" onClick={() => handleDeleteDeptUser(u.id, u.name)}>Delete</button>
                      )}
                      {u.role === 'dept_admin' && (
                        <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>Protected</span>
                      )}
                    </td>
                  </tr>
                ))}
                {deptUsers.filter(u => u.role === 'admin' || u.role === 'dept_admin').length === 0 && (
                  <tr><td colSpan="5" className="empty-state">No admins in your department yet. Click "+ Add Admin" to create one.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Also show students in department */}
          <div style={{ marginTop: 32 }}>
            <h3 style={{ marginBottom: 12 }}>📚 Students in Department ({deptUsers.filter(u => u.role === 'student').length})</h3>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>USN</th>
                    <th>Name / Email</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {deptUsers.filter(u => u.role === 'student').map(u => (
                    <tr key={u.id}>
                      <td>{u.student_id}</td>
                      <td>
                        <strong>{u.name}</strong><br />
                        <span style={{ opacity: 0.7, fontSize: '0.85rem' }}>{u.email}</span>
                      </td>
                      <td style={{ fontSize: '0.8rem', opacity: 0.7 }}>{new Date(u.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {deptUsers.filter(u => u.role === 'student').length === 0 && (
                    <tr><td colSpan="3" className="empty-state">No students registered in your department yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ───── ACTIVITY LOGS TAB (dept_admin only) ───── */}
      {tab === 'logs' && user?.role === 'dept_admin' && (
        <div className="tab-content animate-in">
          <h2 style={{ marginBottom: 20 }}>📜 Department Activity Logs</h2>
          {activityLogs.length === 0 ? (
            <div className="glass-card" style={{ textAlign: 'center', padding: 60 }}>
              <div style={{ fontSize: '3rem', marginBottom: 16 }}>📋</div>
              <h3>No activity logs yet</h3>
              <p style={{ opacity: 0.7 }}>Actions like creating events, managing teams, and admin changes will appear here.</p>
            </div>
          ) : (
            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="data-table" style={{ marginBottom: 0 }}>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>User</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {activityLogs.map(log => (
                    <tr key={log.id}>
                      <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                        {new Date(log.timestamp).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td>
                        <strong>{log.users?.name || 'System'}</strong>
                        {log.users?.role && (
                          <span style={{ fontSize: '0.7rem', opacity: 0.6, marginLeft: 6 }}>({log.users.role})</span>
                        )}
                      </td>
                      <td>{log.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ───── EDIT EVENT MODAL ───── */}
      {editEvent && (
        <div className="modal-overlay" onClick={() => setEditEvent(null)} style={{ zIndex: 1000 }}>
          <div className="modal-content glass-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 600, width: '95%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0 }}>✏️ Edit Event</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setEditEvent(null)}>✕ Close</button>
            </div>
            <form onSubmit={handleSaveEdit}>
              <div className="form-group">
                <label>Event Title *</label>
                <input className="form-control" value={editEvent.title} onChange={(e) => setEditEvent({ ...editEvent, title: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea className="form-control" rows={3} value={editEvent.description} onChange={(e) => setEditEvent({ ...editEvent, description: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label>Event Start Date *</label>
                  <input type="datetime-local" className="form-control" value={editEvent.eventDate} onChange={(e) => setEditEvent({ ...editEvent, eventDate: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Event End Date *</label>
                  <input type="datetime-local" className="form-control" value={editEvent.endDate} onChange={(e) => setEditEvent({ ...editEvent, endDate: e.target.value })} required />
                </div>
              </div>
              <div className="form-group">
                <label>Registration Deadline *</label>
                <input type="datetime-local" className="form-control" value={editEvent.registrationDeadline} onChange={(e) => setEditEvent({ ...editEvent, registrationDeadline: e.target.value })} required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label>Min Team Size</label>
                  <input type="number" className="form-control" value={editEvent.minTeamSize} onChange={(e) => setEditEvent({ ...editEvent, minTeamSize: +e.target.value })} min={1} />
                </div>
                <div className="form-group">
                  <label>Max Team Size</label>
                  <input type="number" className="form-control" value={editEvent.maxTeamSize} onChange={(e) => setEditEvent({ ...editEvent, maxTeamSize: +e.target.value })} min={1} />
                </div>
                <div className="form-group">
                  <label>Entry Fee (₹)</label>
                  <input type="number" className="form-control" value={editEvent.entryFee} onChange={(e) => setEditEvent({ ...editEvent, entryFee: +e.target.value })} min={0} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label>📞 Primary Contact *</label>
                  <input className="form-control" value={editEvent.contact1} onChange={(e) => setEditEvent({ ...editEvent, contact1: e.target.value })} required placeholder="+91XXXXXXXXXX" />
                </div>
                <div className="form-group">
                  <label>📞 Secondary Contact</label>
                  <input className="form-control" value={editEvent.contact2} onChange={(e) => setEditEvent({ ...editEvent, contact2: e.target.value })} placeholder="+91XXXXXXXXXX" />
                </div>
              </div>
              {/* File Re-uploads */}
              <div style={{ marginTop: 16, padding: 16, background: 'rgba(255,255,255,0.04)', borderRadius: 8 }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '0.95rem' }}>📎 Re-upload Files</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleFileReupload(editEvent.id, 'logo', 'upload-logo')}>🖼️ Logo</button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleFileReupload(editEvent.id, 'rulebook', 'upload-rulebook')}>📖 Rule Book</button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleFileReupload(editEvent.id, 'paymentQr', 'upload-payment-qr')}>📱 Payment QR</button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                <button type="submit" className="btn btn-primary btn-lg" disabled={savingEdit} style={{ flex: 1 }}>
                  {savingEdit ? 'Saving...' : '💾 Save Changes'}
                </button>
                <button type="button" className="btn btn-secondary btn-lg" onClick={() => setEditEvent(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
