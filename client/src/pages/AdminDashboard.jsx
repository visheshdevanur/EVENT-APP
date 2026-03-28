import { useState, useEffect } from 'react';
import { apiFetch, API_BASE } from '../utils/api';
import QRScanner from '../components/QRScanner';
import EventChat from '../components/EventChat';

export default function AdminDashboard() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [certMsg, setCertMsg] = useState('');
  const [uploadingTemplate, setUploadingTemplate] = useState(null);
  const [uploadingPaymentQR, setUploadingPaymentQR] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [chatEvent, setChatEvent] = useState(null);

  // Per-event expanded state
  const [expandedEvent, setExpandedEvent] = useState(null);
  const [eventTeams, setEventTeams] = useState([]);
  const [scannerEvent, setScannerEvent] = useState(null);
  const [scanType, setScanType] = useState('attendance');
  const [scanToken, setScanToken] = useState('');
  const [scanResult, setScanResult] = useState(null);

  const [newEvent, setNewEvent] = useState({
    title: '', description: '', eventDate: '', registrationDeadline: '',
    maxTeamSize: 4, minTeamSize: 1, entryFee: 0, contact1: '', contact2: '',
  });

  useEffect(() => { loadEvents(); }, []);

  async function loadEvents() {
    try {
      const data = await apiFetch('/events/my');
      setEvents(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  const filteredEvents = events.filter((evt) =>
    evt.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    evt.status.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateEvent = async (e) => {
    e.preventDefault();

    // Validation: min team size must be ≤ max team size
    if (newEvent.minTeamSize > newEvent.maxTeamSize) {
      alert('Min team size must be less than or equal to max team size');
      return;
    }

    // Validation: registration deadline must be before event date
    if (newEvent.registrationDeadline && newEvent.eventDate &&
        new Date(newEvent.registrationDeadline) >= new Date(newEvent.eventDate)) {
      alert('Registration deadline must be before the event date');
      return;
    }

    setCreating(true);
    try {
      await apiFetch('/events', { method: 'POST', body: JSON.stringify(newEvent) });
      setShowCreateForm(false);
      setNewEvent({ title: '', description: '', eventDate: '', registrationDeadline: '', maxTeamSize: 4, minTeamSize: 1, entryFee: 0, contact1: '', contact2: '' });
      await loadEvents();
    } catch (err) { alert(err.error || 'Failed to create event'); }
    finally { setCreating(false); }
  };


  // QR scan handler — scoped to the event being scanned
  const handleScanResult = async (token) => {
    if (!token?.trim()) return;
    setScanResult(null);
    try {
      const data = await apiFetch('/attendance/checkin', {
        method: 'POST',
        body: JSON.stringify({ qrToken: token.trim(), type: scanType }),
      });
      setScanResult({ type: 'success', message: data.message, data });
      setScanToken('');
      // Refresh teams for this event
      if (expandedEvent) handleViewTeams(expandedEvent);
    } catch (err) {
      setScanResult({ type: 'error', message: err.error || 'Check-in failed' });
    }
  };

  const handleCompleteEvent = async (eventId) => {
    if (!confirm('Mark this event as completed?')) return;
    try {
      await apiFetch(`/events/${eventId}/complete`, { method: 'PATCH' });
      await loadEvents();
    } catch (err) { alert(err.error || 'Failed'); }
  };

  const handleUpdateStatus = async (eventId, status) => {
    try {
      await apiFetch(`/events/${eventId}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      await loadEvents();
    } catch (err) { alert(err.error || 'Failed'); }
  };

  const handleViewTeams = async (eventId) => {
    setExpandedEvent(eventId);
    try {
      const data = await apiFetch(`/teams/event/${eventId}`);
      setEventTeams(data);
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
      await apiFetch(`/teams/${teamId}/payment-status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      if (expandedEvent) await handleViewTeams(expandedEvent);
    } catch (err) { alert(err.error || 'Failed'); }
  };

  const handleGenerateCerts = async (eventId) => {
    setCertMsg('');
    try {
      const data = await apiFetch(`/certificates/generate/${eventId}`, { method: 'POST' });
      setCertMsg(data.message || `Generated ${data.generated} certificate(s)`);
    } catch (err) { setCertMsg(err.error || 'Failed'); }
  };

  const handleUploadTemplate = async (eventId, file) => {
    setUploadingTemplate(eventId);
    try {
      const formData = new FormData();
      formData.append('template', file);
      const res = await fetch(`${API_BASE}/events/${eventId}/upload-template`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw data;
      alert('✅ Certificate template uploaded!');
      await loadEvents();
    } catch (err) { alert(err.error || 'Upload failed'); }
    finally { setUploadingTemplate(null); }
  };

  const handleUploadPaymentQR = async (eventId, file) => {
    setUploadingPaymentQR(eventId);
    try {
      const formData = new FormData();
      formData.append('paymentQr', file);
      const res = await fetch(`${API_BASE}/events/${eventId}/upload-payment-qr`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw data;
      alert('✅ Payment QR uploaded!');
      await loadEvents();
    } catch (err) { alert(err.error || 'Upload failed'); }
    finally { setUploadingPaymentQR(null); }
  };

  const handleConfirmPayment = async (teamId) => {
    try {
      const res = await fetch(`${API_BASE}/teams/${teamId}/confirm-payment`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json();
      if (!res.ok) throw data;
      alert('Payment confirmed!');
      if (expandedEvent) handleViewTeams(expandedEvent);
    } catch (err) { alert(err.error || 'Failed to confirm'); }
  };

  const toggleScanner = (eventId) => {
    if (scannerEvent === eventId) {
      setScannerEvent(null);
      setScanResult(null);
    } else {
      setScannerEvent(eventId);
      setScanResult(null);
      setScanToken('');
    }
  };

  if (loading) return <div className="loading-center"><div className="spinner"></div></div>;

  return (
    <div className="page-container">
      <div className="page-header animate-in">
        <h1>Admin Dashboard ⚡</h1>
        <p>Create events, scan QR codes, manage attendance & food, and generate certificates</p>
      </div>

      {/* ────── CREATE EVENT ────── */}
      <div className="admin-section animate-in">
        <div className="admin-section-header">
          <h2>📅 My Events ({events.length})</h2>
          <button id="btn-toggle-create" className="btn btn-primary" onClick={() => setShowCreateForm(!showCreateForm)}>
            {showCreateForm ? 'Cancel' : '+ Create Event'}
          </button>
        </div>

        {/* Search bar */}
        <div className="search-bar" style={{ marginBottom: 20 }}>
          <input
            className="form-control search-input"
            placeholder="🔍 Search your events by name or status..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {showCreateForm && (
          <form onSubmit={handleCreateEvent} className="glass-card" style={{ marginBottom: 24, maxWidth: 600 }}>
            <div className="form-group">
              <label>Event Title</label>
              <input id="input-event-title" className="form-control" value={newEvent.title} onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea id="input-event-desc" className="form-control" value={newEvent.description} onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label>Event Date</label>
                <input id="input-event-date" type="datetime-local" className="form-control" value={newEvent.eventDate} onChange={(e) => setNewEvent({ ...newEvent, eventDate: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Registration Deadline</label>
                <input id="input-reg-deadline" type="datetime-local" className="form-control" value={newEvent.registrationDeadline} onChange={(e) => setNewEvent({ ...newEvent, registrationDeadline: e.target.value })} required />
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
                <label>📞 Contact 1 (required)</label>
                <input className="form-control" placeholder="Phone / email" value={newEvent.contact1} onChange={(e) => setNewEvent({ ...newEvent, contact1: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>📞 Contact 2 (optional)</label>
                <input className="form-control" placeholder="Phone / email" value={newEvent.contact2} onChange={(e) => setNewEvent({ ...newEvent, contact2: e.target.value })} />
              </div>
            </div>
            <button id="btn-create-event" type="submit" className="btn btn-primary" disabled={creating}>
              {creating ? 'Creating...' : 'Create Event'}
            </button>
          </form>
        )}

        {certMsg && <div className="alert alert-success" style={{ marginBottom: 16 }}>{certMsg}</div>}

        {/* ────── EVENT LIST (filtered) ────── */}
        {filteredEvents.length === 0 && !showCreateForm && (
          <div className="empty-state"><h3>{searchQuery ? 'No events match your search' : 'No events yet — create one!'}</h3></div>
        )}
        {filteredEvents.map((evt) => (
          <div key={evt.id} className="glass-card animate-in" style={{ marginBottom: 24 }}>
            <div className="event-card-header">
              <h3>{evt.title}</h3>
              <span className={`status-badge status-${evt.status}`}>{evt.status}</span>
            </div>
            <div className="event-meta">
              <div className="event-meta-row">
                <span className="icon">📅</span>
                {new Date(evt.event_date).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}
              </div>
              <div className="event-meta-row">
                <span className="icon">👥</span>
                Team: {evt.min_team_size}–{evt.max_team_size} members
              </div>
              <div className="event-meta-row">
                <span className="icon">💰</span>
                {evt.entry_fee > 0 ? `₹${evt.entry_fee}` : 'Free'}
              </div>
            </div>

            {/* Upload actions — disabled for completed events */}
            {evt.status !== 'completed' && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                📜 {evt.certificate_template ? '✅ Template' : 'Upload Template'}
                <input type="file" accept=".pdf,.png,.jpg,.jpeg" hidden
                  onChange={(e) => e.target.files[0] && handleUploadTemplate(evt.id, e.target.files[0])}
                  disabled={uploadingTemplate === evt.id}
                />
              </label>
              <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                💳 {evt.payment_qr_image ? '✅ Payment QR' : 'Upload Payment QR'}
                <input type="file" accept=".png,.jpg,.jpeg,.webp" hidden
                  onChange={(e) => e.target.files[0] && handleUploadPaymentQR(evt.id, e.target.files[0])}
                  disabled={uploadingPaymentQR === evt.id}
                />
              </label>
              <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                📖 {evt.rule_book ? '✅ Rule Book' : 'Upload Rule Book'}
                <input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" hidden
                  onChange={async (e) => {
                    if (!e.target.files[0]) return;
                    const formData = new FormData();
                    formData.append('rulebook', e.target.files[0]);
                    try {
                      const res = await fetch(`${API_BASE}/events/${evt.id}/upload-rulebook`, {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                        body: formData,
                      });
                      const data = await res.json();
                      if (!res.ok) throw data;
                      alert('✅ Rule book uploaded!');
                      await loadEvents();
                    } catch (err) { alert(err.error || 'Upload failed'); }
                  }}
                />
              </label>
            </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {evt.status === 'upcoming' && (
                <button className="btn btn-secondary btn-sm" onClick={() => handleUpdateStatus(evt.id, 'open')}>Open Registration</button>
              )}
              {evt.status === 'open' && (
                <button className="btn btn-secondary btn-sm" onClick={() => handleUpdateStatus(evt.id, 'ongoing')}>Start Event</button>
              )}
              {(evt.status === 'open' || evt.status === 'ongoing') && (
                <button className="btn btn-danger btn-sm" onClick={() => handleCompleteEvent(evt.id)}>Complete</button>
              )}
              <button className="btn btn-secondary btn-sm" onClick={() => expandedEvent === evt.id ? setExpandedEvent(null) : handleViewTeams(evt.id)}>
                {expandedEvent === evt.id ? '▲ Hide Teams' : '▼ View Teams'}
              </button>
              {evt.status !== 'completed' && (evt.status === 'open' || evt.status === 'ongoing') && (
                <button className={`btn ${scannerEvent === evt.id ? 'btn-danger' : 'btn-primary'} btn-sm`} onClick={() => toggleScanner(evt.id)}>
                  {scannerEvent === evt.id ? '⏹ Close Scanner' : '📷 Open Scanner'}
                </button>
              )}
              {evt.status === 'completed' && (
                <button className="btn btn-success btn-sm" onClick={() => handleGenerateCerts(evt.id)}>Generate Certs</button>
              )}
              <button className={`btn ${chatEvent === evt.id ? 'btn-danger' : 'btn-secondary'} btn-sm`}
                onClick={() => setChatEvent(chatEvent === evt.id ? null : evt.id)}>
                {chatEvent === evt.id ? '✕ Close Chat' : '💬 Chat'}
              </button>
            </div>

            {/* ────── IN-EVENT QR SCANNER ────── */}
            {scannerEvent === evt.id && (
              <div style={{ background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)', padding: 20, marginBottom: 16, border: '1px solid var(--border-accent)' }}>
                <h4 style={{ marginBottom: 12 }}>📷 Scanning for: <strong>{evt.title}</strong></h4>

                {/* Scan type toggle */}
                <div className="tab-bar" style={{ marginBottom: 16 }}>
                  <button className={`tab-btn ${scanType === 'attendance' ? 'active' : ''}`} onClick={() => { setScanType('attendance'); setScanResult(null); }}>
                    🎟️ Attendance
                  </button>
                  <button className={`tab-btn ${scanType === 'food' ? 'active' : ''}`} onClick={() => { setScanType('food'); setScanResult(null); }}>
                    🍽️ Food
                  </button>
                </div>

                {/* Camera scanner */}
                <QRScanner
                  onScan={handleScanResult}
                  onError={(msg) => setScanResult({ type: 'error', message: msg })}
                />

                {/* Manual fallback */}
                <div style={{ marginTop: 12 }}>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 6 }}>Or paste QR token:</p>
                  <div className="scan-input-wrapper">
                    <input
                      className="form-control"
                      placeholder="Paste QR token..."
                      value={scanToken}
                      onChange={(e) => setScanToken(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleScanResult(scanToken)}
                    />
                    <button className="btn btn-success" onClick={() => handleScanResult(scanToken)}>
                      Check In ({scanType})
                    </button>
                  </div>
                </div>

                {scanResult && (
                  <div className={`scan-result ${scanResult.type}`}>
                    {scanResult.message}
                    {scanResult.data?.members && (
                      <div style={{ marginTop: 6, fontSize: '0.85rem' }}>
                        Members: {scanResult.data.members.map((m) => m.name).join(', ')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ────── TEAMS TABLE (inside event) ────── */}
            {expandedEvent === evt.id && (
              <div style={{ marginTop: 8 }}>
                {eventTeams.length === 0 ? (
                  <div className="empty-state" style={{ padding: 24 }}><p>No teams registered</p></div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Team Name</th>
                          <th>Members</th>
                          <th>Payment</th>
                          <th>Proof</th>
                          <th>Attended</th>
                          <th>Food</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {eventTeams.map((t) => (
                          <tr key={t.id}>
                            <td style={{ fontWeight: 600 }}>{t.team_name}</td>
                            <td>{(t.members || []).map((m) => m.name).join(', ')}</td>
                            <td><span className={`status-badge status-${t.payment_status}`}>{t.payment_status}</span></td>
                            <td>
                              {t.payment_screenshot ? (
                                <a href={t.payment_screenshot} target="_blank" rel="noopener noreferrer"
                                  className="btn btn-secondary btn-sm" style={{ fontSize: '0.75rem', padding: '4px 8px' }}>
                                  📷 View
                                </a>
                              ) : (
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                              )}
                            </td>
                            <td>{t.attended ? '✅' : '—'}</td>
                            <td>{t.food_collected ? '🍽️' : '—'}</td>
                            <td>
                              {evt.status !== 'completed' ? (
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                <select
                                  className="form-control"
                                  style={{ width: 120, padding: '4px 8px', fontSize: '0.8rem', marginBottom: 0 }}
                                  value={t.payment_status}
                                  onChange={(e) => handleChangePaymentStatus(t.id, e.target.value)}
                                >
                                  <option value="pending">⏳ Pending</option>
                                  <option value="confirmed">✅ Confirmed</option>
                                  <option value="rejected">❌ Rejected</option>
                                </select>
                                <button className="btn btn-danger btn-sm" onClick={() => handleDeleteTeam(t.id, t.team_name)}
                                  title="Delete team">
                                  🗑
                                </button>
                              </div>
                              ) : (
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>🔒 Locked</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ────── EVENT CHAT ────── */}
            {chatEvent === evt.id && (
              <div style={{ marginTop: 12 }}>
                <h4 style={{ marginBottom: 8 }}>💬 Event Chat — {evt.title}</h4>
                <EventChat eventId={evt.id} eventTitle={evt.title} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
