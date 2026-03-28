import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch, API_BASE, getUser } from '../utils/api';
import EventChat from '../components/EventChat';
import TeamChat from '../components/TeamChat';

export default function StudentDashboard() {
  const [events, setEvents] = useState([]);
  const [teams, setTeams] = useState([]);
  const [certs, setCerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('events');
  const [qrModal, setQrModal] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [chatEvent, setChatEvent] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [teamFilter, setTeamFilter] = useState('all');
  const [certSearch, setCertSearch] = useState('');
  const [teamSearch, setTeamSearch] = useState('');
  const [teamChatId, setTeamChatId] = useState(null);
  const user = getUser();

  useEffect(() => {
    async function load() {
      try {
        const [eventsData, teamsData, certsData] = await Promise.all([
          apiFetch('/events'),
          apiFetch('/teams/my'),
          apiFetch('/certificates/my'),
        ]);
        setEvents(eventsData);
        setTeams(teamsData);
        setCerts(certsData);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const handleViewQR = async (teamId) => {
    try {
      const data = await apiFetch(`/teams/${teamId}/qr`);
      setQrModal(data);
    } catch (err) { alert(err.error || 'Could not load QR'); }
  };

  // Build set of event IDs where user is already registered
  const registeredEventIds = new Set(teams.map((t) => t.event_id));

  // Sort events: open first, then upcoming, ongoing, completed last
  const statusOrder = { open: 0, upcoming: 1, ongoing: 2, completed: 3 };
  const sortedEvents = [...events].sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9));

  // Apply filters
  const filteredEvents = sortedEvents.filter((evt) => {
    // Text search
    const matchesSearch = evt.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      evt.status.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    // Status / registration filter
    switch (statusFilter) {
      case 'open': return evt.status === 'open';
      case 'completed': return evt.status === 'completed';
      case 'registered': return registeredEventIds.has(evt.id);
      case 'not_registered': return !registeredEventIds.has(evt.id);
      default: return true;
    }
  });

  // Sort teams: rejected first, then pending, then confirmed
  const teamStatusOrder = { rejected: 0, pending: 1, failed: 2, confirmed: 3 };
  const sortedTeams = [...teams].sort((a, b) => (teamStatusOrder[a.payment_status] ?? 9) - (teamStatusOrder[b.payment_status] ?? 9));

  // Filter teams by dropdown + search
  const filteredTeams = sortedTeams.filter((t) => {
    const matchesFilter = teamFilter === 'all' || t.payment_status === teamFilter;
    const q = teamSearch.toLowerCase();
    const matchesSearch = !q ||
      t.team_name.toLowerCase().includes(q) ||
      (t.events?.title || '').toLowerCase().includes(q) ||
      (t.members || []).some((m) => m.name.toLowerCase().includes(q));
    return matchesFilter && matchesSearch;
  });

  if (loading) return <div className="loading-center"><div className="spinner"></div></div>;

  return (
    <div className="page-container">
      <div className="page-header animate-in">
        <h1>Welcome, {user?.name || 'Student'} 👋</h1>
        <p>Browse events, manage your teams, and download certificates</p>
      </div>

      <div className="tab-bar animate-in" style={{ animationDelay: '100ms' }}>
        <button className={`tab-btn ${tab === 'events' ? 'active' : ''}`} onClick={() => setTab('events')}>
          Events
        </button>
        <button className={`tab-btn ${tab === 'teams' ? 'active' : ''}`} onClick={() => setTab('teams')}>
          My Teams ({teams.length})
        </button>
        <button className={`tab-btn ${tab === 'certs' ? 'active' : ''}`} onClick={() => setTab('certs')}>
          Certificates ({certs.length})
        </button>
      </div>

      {/* ────── EVENTS TAB ────── */}
      {tab === 'events' && (
        <div>
          {/* Search + Filter row */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              className="form-control search-input"
              style={{ flex: 1, minWidth: 200 }}
              placeholder="🔍 Search events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <select
              className="form-control"
              style={{ width: 180, padding: '10px 12px' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">📋 All Events</option>
              <option value="open">🟢 Open</option>
              <option value="completed">✅ Completed</option>
              <option value="registered">🎟️ Registered</option>
              <option value="not_registered">🆕 Not Registered</option>
            </select>
          </div>

          <div className="card-grid">
          {filteredEvents.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon">📅</div>
              <h3>{searchQuery || statusFilter !== 'all' ? 'No events match your filter' : 'No events yet'}</h3>
              <p>Check back later for upcoming events</p>
            </div>
          )}
          {filteredEvents.map((evt) => (
            <div key={evt.id} className="glass-card animate-in">
              <div className="event-card-header">
                <h3>{evt.title}</h3>
                <span className={`status-badge status-${evt.status}`}>{evt.status}</span>
              </div>
              {evt.description && <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 12 }}>{evt.description}</p>}
              <div className="event-meta">
                <div className="event-meta-row">
                  <span className="icon">📅</span>
                  {new Date(evt.event_date).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}
                </div>
                <div className="event-meta-row">
                  <span className="icon">⏰</span>
                  Deadline: {new Date(evt.registration_deadline).toLocaleDateString('en-IN')}
                </div>
                <div className="event-meta-row">
                  <span className="icon">👥</span>
                  Team: {evt.min_team_size}–{evt.max_team_size} members
                </div>
                {evt.contact1 && (
                  <div className="event-meta-row">
                    <span className="icon">📞</span>
                    {evt.contact1}{evt.contact2 ? ` · ${evt.contact2}` : ''}
                  </div>
                )}
              </div>
              <div className={`event-fee ${evt.entry_fee <= 0 ? 'free' : ''}`}>
                {evt.entry_fee > 0 ? `₹${evt.entry_fee}` : 'FREE'}
              </div>
              {evt.status === 'open' && !registeredEventIds.has(evt.id) && (
                <Link to={`/register-team/${evt.id}`} className="btn btn-primary" id={`btn-register-${evt.id}`}>
                  Register Team
                </Link>
              )}
              {registeredEventIds.has(evt.id) && (
                <span className="status-badge status-confirmed" style={{ marginTop: 8 }}>
                  ✅ Already Registered
                </span>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                {evt.rule_book && (
                  <a href={evt.rule_book} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
                    📖 Rule Book
                  </a>
                )}
                {evt.status !== 'completed' && (
                  <button className={`btn ${chatEvent === evt.id ? 'btn-danger' : 'btn-secondary'} btn-sm`}
                    onClick={() => setChatEvent(chatEvent === evt.id ? null : evt.id)}>
                    {chatEvent === evt.id ? '✕ Close Chat' : '💬 Chat'}
                  </button>
                )}
              </div>
              {chatEvent === evt.id && evt.status !== 'completed' && (
                <div style={{ marginTop: 12 }}>
                  <EventChat eventId={evt.id} eventTitle={evt.title} />
                </div>
              )}
            </div>
          ))}
          </div>
        </div>
      )}

      {/* ────── TEAMS TAB ────── */}
      {tab === 'teams' && (
        <div>
          {/* Search + Filter row */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              className="form-control search-input"
              style={{ flex: 1, minWidth: 200 }}
              placeholder="🔍 Search by team, event, or member name..."
              value={teamSearch}
              onChange={(e) => setTeamSearch(e.target.value)}
            />
            <select
              className="form-control"
              style={{ width: 180, padding: '10px 12px' }}
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
            >
              <option value="all">📋 All Teams</option>
              <option value="pending">⏳ Pending</option>
              <option value="rejected">❌ Rejected</option>
              <option value="confirmed">✅ Confirmed</option>
            </select>
          </div>

          <div className="card-grid">
          {filteredTeams.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon">👥</div>
              <h3>{teamFilter !== 'all' ? 'No teams match this filter' : 'No teams yet'}</h3>
              <p>Register for an event to create your first team</p>
            </div>
          )}
          {filteredTeams.map((team) => (
            <div key={team.id} className="glass-card team-card animate-in">
              <div className="team-event-tag">{team.events?.title || 'Event'}</div>
              <h3>{team.team_name}</h3>
              <span className={`status-badge status-${team.payment_status}`}>
                {team.payment_status}
              </span>
              <div className="team-members-list" style={{ marginTop: 12 }}>
                {(team.members || []).map((m) => (
                  <div key={m.id} className="team-member-row">
                    <div className="team-member-avatar">{m.name?.charAt(0)}</div>
                    <span>{m.name}</span>
                    <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{m.student_id}</span>
                  </div>
                ))}
              </div>

              {/* Payment Screenshot Upload */}
              {team.events?.entry_fee > 0 && team.payment_status !== 'confirmed' && (
                <div style={{ marginTop: 12, padding: 12, borderRadius: 'var(--radius-sm)', background: 'rgba(0, 240, 255, 0.05)', border: '1px solid rgba(0, 240, 255, 0.2)' }}>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
                    💳 Upload payment proof screenshot:
                  </p>
                  {team.payment_screenshot ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="status-badge status-confirmed">📷 Screenshot Uploaded</span>
                      <a href={team.payment_screenshot} target="_blank" rel="noopener noreferrer"
                        className="btn btn-secondary btn-sm">View</a>
                    </div>
                  ) : (
                    <label className="btn btn-primary btn-sm" style={{ cursor: 'pointer' }}>
                      📤 Upload Screenshot
                      <input type="file" accept="image/*" hidden
                        onChange={async (e) => {
                          if (!e.target.files[0]) return;
                          const formData = new FormData();
                          formData.append('screenshot', e.target.files[0]);
                          try {
                            const res = await fetch(`${API_BASE}/teams/${team.id}/upload-screenshot`, {
                              method: 'POST',
                              headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                              body: formData,
                            });
                            const data = await res.json();
                            if (!res.ok) throw data;
                            alert('✅ Payment screenshot uploaded!');
                            const teamsData = await apiFetch('/teams/my');
                            setTeams(teamsData);
                          } catch (err) { alert(err.error || 'Upload failed'); }
                        }}
                      />
                    </label>
                  )}
                </div>
              )}

              <div className="team-actions">
                {team.payment_status === 'confirmed' && (
                  <button className="btn btn-secondary btn-sm" onClick={() => handleViewQR(team.id)}>
                    🔳 View QR Codes
                  </button>
                )}
                {team.attended && <span className="status-badge status-confirmed">✓ Attended</span>}
                {team.food_collected && <span className="status-badge status-open">🍽️ Food Collected</span>}
                {team.attended && team.events?.status !== 'completed' && (
                  <button
                    className={`btn ${teamChatId === team.id ? 'btn-danger' : 'btn-secondary'} btn-sm`}
                    onClick={() => setTeamChatId(teamChatId === team.id ? null : team.id)}
                  >
                    {teamChatId === team.id ? '✕ Close Chat' : '💬 Team Chat'}
                  </button>
                )}
              </div>
              {teamChatId === team.id && team.events?.status !== 'completed' && (
                <div style={{ marginTop: 12 }}>
                  <TeamChat teamId={team.id} teamName={team.team_name} />
                </div>
              )}
            </div>
          ))}
          </div>
        </div>
      )}

      {/* ────── CERTS TAB ────── */}
      {tab === 'certs' && (
        <div>
          {/* Search bar */}
          <div style={{ marginBottom: 16 }}>
            <input
              className="form-control search-input"
              placeholder="🔍 Search certificates by event name or team..."
              value={certSearch}
              onChange={(e) => setCertSearch(e.target.value)}
            />
          </div>

          {(() => {
            const filtered = certs.filter((c) => {
              const q = certSearch.toLowerCase();
              return (c.eventTitle || '').toLowerCase().includes(q) ||
                (c.teamName || '').toLowerCase().includes(q);
            });
            return filtered.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">🏆</div>
                <h3>{certSearch ? 'No certificates match your search' : 'No certificates yet'}</h3>
                <p>Attend events to receive participation certificates</p>
              </div>
            ) : filtered.map((cert, i) => (
              <div key={i} className="glass-card cert-card animate-in" style={{ marginBottom: 16 }}>
                <div className="cert-info">
                  <h4>{cert.eventTitle}</h4>
                  <p>Team: {cert.teamName} — {new Date(cert.eventDate).toLocaleDateString('en-IN')}</p>
                </div>
                <button className="btn btn-primary btn-sm" onClick={async () => {
                  try {
                    const res = await fetch(cert.downloadUrl, {
                      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                    });
                    if (!res.ok) throw new Error('Download failed');
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `certificate_${cert.eventTitle}.pdf`;
                    a.click();
                    URL.revokeObjectURL(url);
                  } catch (e) { alert('Failed to download certificate'); }
                }}>
                  ⬇ Download
                </button>
              </div>
            ));
          })()}
        </div>
      )}

      {/* ────── DUAL QR Modal ────── */}
      {qrModal && (
        <div className="qr-modal-overlay" onClick={() => setQrModal(null)}>
          <div className="qr-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <h3>Team QR Codes</h3>

            <div style={{ display: 'flex', gap: 24, justifyContent: 'center', flexWrap: 'wrap', marginTop: 16 }}>
              {/* Attendance QR */}
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontWeight: 600, marginBottom: 8, color: 'var(--accent-indigo)' }}>🎟️ Attendance</p>
                <img src={qrModal.attendanceQR} alt="Attendance QR" width={200} height={200} style={{ borderRadius: 12 }} />
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4, wordBreak: 'break-all', maxWidth: 200 }}>
                  {qrModal.attendanceToken}
                </p>
              </div>

              {/* Food QR */}
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontWeight: 600, marginBottom: 8, color: 'var(--accent-purple)' }}>🍽️ Food</p>
                <img src={qrModal.foodQR} alt="Food QR" width={200} height={200} style={{ borderRadius: 12 }} />
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4, wordBreak: 'break-all', maxWidth: 200 }}>
                  {qrModal.foodToken}
                </p>
              </div>
            </div>

            <button className="btn btn-secondary" onClick={() => setQrModal(null)} style={{ marginTop: 20 }}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
