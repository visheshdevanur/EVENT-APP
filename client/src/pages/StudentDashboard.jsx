import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiFetch, API_BASE, getUser } from '../utils/api';
import EventChat from '../components/EventChat';
import TeamChat from '../components/TeamChat';
import { QRCodeCanvas } from 'qrcode.react';

export default function StudentDashboard() {
  const [events, setEvents] = useState([]);
  const [teams, setTeams] = useState([]);
  const [certs, setCerts] = useState([]);
  const [myDocs, setMyDocs] = useState({});
  const [loading, setLoading] = useState(true);
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
  const [qrModal, setQrModal] = useState(null);

  const handleViewQR = (team) => {
    setQrModal({ title: 'My Team QR (Attendance)', token: team.qr_token || team.id });
  };

  const handleViewFoodQR = (team) => {
    setQrModal({ title: 'Food Collection QR', token: team.food_qr_token || team.id });
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [teamChatId, setTeamChatId] = useState(null);
  const [docInputs, setDocInputs] = useState({});
  const [uploadingDoc, setUploadingDoc] = useState(null);
  const [uploadingScreenshot, setUploadingScreenshot] = useState(null);
  const [rulebookUrl, setRulebookUrl] = useState(null);
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

        const docsObj = {};
        for (const team of teamsData) {
          try {
            const doc = await apiFetch(`/documents/my/${team.event_id}`);
            if (doc && doc.drive_link) {
              docsObj[team.event_id] = doc;
            }
          } catch (e) {} 
        }
        setMyDocs(docsObj);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const registeredEventIds = new Set(teams.map((t) => t.event_id));
  const sortedEvents = [...events].sort((a, b) => {
    const statusOrder = { open: 0, upcoming: 1, ongoing: 2, completed: 3 };
    return (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
  });

  const filteredEvents = sortedEvents.filter((evt) => {
    const matchesSearch = evt.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (evt.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;

    if (statusFilter === 'all') return true;
    if (statusFilter === 'registered') return registeredEventIds.has(evt.id);
    if (statusFilter === 'not_registered') return !registeredEventIds.has(evt.id);
    return evt.status === statusFilter;
  });

  if (loading) return <div className="loading-center"><img src="/logo.png" alt="Loading..." className="eventloop-loader" /></div>;

  const handleUploadDoc = async (eventId) => {
    const link = docInputs[eventId]?.trim();
    if (!link) return;
    setUploadingDoc(eventId);
    try {
      await apiFetch('/documents', {
        method: 'POST',
        body: JSON.stringify({ event_id: eventId, drive_link: link }),
      });
      setMyDocs({ ...myDocs, [eventId]: { drive_link: link } });
    } catch (err) { alert(err.error || 'Failed to save'); }
    finally { setUploadingDoc(null); }
  };

  const handleUploadScreenshot = async (teamId, file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('File too large. Maximum 5MB allowed.');
      return;
    }
    setUploadingScreenshot(teamId);
    try {
      const formData = new FormData();
      formData.append('screenshot', file);
      const result = await apiFetch(`/teams/${teamId}/upload-screenshot`, {
        method: 'POST',
        body: formData,
      });
      // Update teams state locally so the thumbnail shows immediately
      setTeams(prev => prev.map(t => t.id === teamId ? { ...t, payment_screenshot: result.team.payment_screenshot } : t));
    } catch (err) { alert(err.error || 'Failed to upload screenshot'); }
    finally { setUploadingScreenshot(null); }
  };

  return (
    <div className="container animate-in">
      {/* ───── EVENTS TAB ───── */}
      {tab === 'events' && (
        <div className="fade-in">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <div className="search-box glass-card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', maxWidth: 400, flex: 1 }}>
              <span style={{ opacity: 0.5 }}>🔍</span>
              <input 
                type="text" 
                placeholder="Search events or descriptions..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', width: '100%', fontSize: '0.95rem' }}
              />
            </div>
            <select 
              className="form-control" 
              style={{ width: 180 }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">📋 All Status</option>
              <option value="open">🟢 Open</option>
              <option value="upcoming">🔵 Upcoming</option>
              <option value="completed">✅ Completed</option>
              <option value="registered">🎟️ Registered</option>
            </select>
          </div>

          <div className="card-grid">
            {filteredEvents.length === 0 ? (
              <div className="glass-card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 20px', animation: 'fadeSlideUp 0.3s ease' }}>
                <div style={{ fontSize: '3rem', marginBottom: 16 }}>🔎</div>
                <h3>No events found</h3>
                <p style={{ opacity: 0.7 }}>Try adjusting your search or filters</p>
              </div>
            ) : (
              filteredEvents.map((evt) => (
                <div key={evt.id} className="glass-card animate-in-up" style={{ display: 'flex', flexDirection: 'column', padding: 24, gap: 16 }}>
                  <div className="event-card-header" style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--gradient-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 800, flexShrink: 0 }}>
                        {evt.logo ? <img src={`${API_BASE.replace('/api', '')}${evt.logo}`} style={{ width: '100%', height: '100%', borderRadius: 10, objectFit: 'cover' }} /> : evt.title?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{evt.title}</h3>
                        <span className={`status-badge status-${evt.status}`} style={{ marginTop: 4, fontSize: '0.6rem' }}>{evt.status}</span>
                      </div>
                    </div>
                  </div>

                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {evt.description}
                  </p>

                  <div className="event-meta" style={{ flex: 1 }}>
                    <div className="event-meta-row" style={{ fontSize: '0.8rem', gap: 8, display: 'flex', alignItems: 'center', color: 'var(--text-secondary)' }}>
                      <span>📅</span> {new Date(evt.event_date).toLocaleDateString()}
                    </div>
                    <div className="event-meta-row" style={{ fontSize: '0.8rem', gap: 8, display: 'flex', alignItems: 'center', color: 'var(--text-secondary)', marginTop: 8 }}>
                      <span>👥</span> {evt.min_team_size}-{evt.max_team_size} members
                    </div>
                    {evt.departments?.name && (
                      <div className="event-meta-row" style={{ fontSize: '0.8rem', gap: 8, display: 'flex', alignItems: 'center', color: 'var(--text-secondary)', marginTop: 8 }}>
                        <span>🏛️</span> {evt.departments.name}
                      </div>
                    )}
                    <div className="event-meta-row" style={{ fontSize: '0.8rem', gap: 8, display: 'flex', alignItems: 'center', color: '#ff4d4d', fontWeight: 600, marginTop: 8 }}>
                      <span>⏳</span> Reg. Deadline: {new Date(evt.registration_deadline).toLocaleDateString()}
                    </div>
                  </div>

                  <div style={{ marginTop: 'auto' }}>
                    {evt.status === 'open' && !registeredEventIds.has(evt.id) && (
                      new Date() < new Date(evt.registration_deadline) ? (
                        <Link to={`/register-team/${evt.id}`} className="btn btn-primary" style={{ width: '100%' }}>Register Team</Link>
                      ) : (
                        <div className="alert alert-error" style={{ fontSize: '0.8rem', textAlign: 'center', padding: '8px' }}>🛑 Registration Closed</div>
                      )
                    )}
                    {evt.rule_book && (
                      <button className="btn btn-secondary" style={{ width: '100%', fontSize: '0.85rem', marginTop: 8 }} onClick={() => setRulebookUrl(`${API_BASE.replace('/api', '')}${evt.rule_book}`)}>📖 View Rule Book</button>
                    )}
                    {registeredEventIds.has(evt.id) && <div className="alert alert-success" style={{ fontSize: '0.8rem', textAlign: 'center', padding: '8px' }}>🎟️ Registered</div>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ───── TEAMS TAB ───── */}
      {tab === 'teams' && (
        <div className="fade-in">
          {teams.length === 0 ? (
            <div className="glass-card" style={{ textAlign: 'center', padding: 60 }}>
              <div style={{ fontSize: '3rem' }}>👥</div>
              <h3>Not in any teams yet</h3>
              <p style={{ opacity: 0.7 }}>Join an event to see your team info here</p>
            </div>
          ) : (
            <div className="card-grid">
              {teams.map((t) => {
                const isApproved = t.payment_status === 'confirmed' || t.payment_status === 'approved';
                const isRejected = t.payment_status === 'rejected';
                const statusLabel = isApproved ? '✅ Approved' : (isRejected ? '❌ Rejected' : '⏳ Pending');
                const statusClass = isApproved ? 'completed' : (isRejected ? 'error' : 'upcoming'); // mapping to existing colors

                return (
                  <div key={t.id} className="glass-card animate-in-up" style={{ padding: 24, borderLeft: isApproved ? '4px solid var(--accent-emerald)' : '4px solid var(--accent-amber)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                      <div>
                        <h3 style={{ margin: 0 }}>{t.team_name}</h3>
                        <p style={{ fontSize: '0.85rem', opacity: 0.7 }}>{t.events?.title}</p>
                      </div>
                      <div className={`status-badge status-${statusClass}`}>{statusLabel}</div>
                    </div>
                    
                    {isApproved ? (
                      <>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => handleViewQR(t)}>🎫 Attendance QR</button>
                          <button className="btn btn-secondary btn-sm" onClick={() => handleViewFoodQR(t)}>🍽️ Food QR</button>
                          <button className="btn btn-secondary btn-sm" onClick={() => setTeamChatId(t.id)}>💬 Open Chat</button>
                        </div>

                        {/* Document Submission */}
                        <div className="form-group" style={{ marginTop: 16 }}>
                          <label style={{ fontSize: '0.8rem' }}>Submission Link (Optional)</label>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <input 
                              className="form-control" 
                              placeholder="Drive link..."
                              value={docInputs[t.event_id] || ''}
                              onChange={(e) => setDocInputs({ ...docInputs, [t.event_id]: e.target.value })}
                            />
                            <button className="btn btn-primary" onClick={() => handleUploadDoc(t.event_id)} disabled={uploadingDoc === t.event_id}>
                              {uploadingDoc === t.event_id ? '...' : 'Save'}
                            </button>
                          </div>
                          {myDocs[t.event_id] && (
                            <p style={{ fontSize: '0.75rem', marginTop: 4, color: 'var(--accent-emerald)' }}>
                              ✅ Submitted: <a href={myDocs[t.event_id].drive_link} target="_blank" style={{ color: 'inherit' }}>Link</a>
                            </p>
                          )}
                        </div>
                      </>
                    ) : (
                      <div style={{ padding: '12px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                        {isRejected ? "Your team registration was rejected by the admin." : "Features will unlock after an admin approves your team."}
                      </div>
                    )}

                    {/* Payment Screenshot Upload — always visible */}
                    <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 8 }}>📸 Upload Payment Screenshot</label>
                      {t.payment_screenshot ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <img 
                            src={`${API_BASE.replace('/api', '')}${t.payment_screenshot}`} 
                            alt="Payment proof" 
                            style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}
                            onClick={() => window.open(`${API_BASE.replace('/api', '')}${t.payment_screenshot}`, '_blank')}
                          />
                          <div>
                            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--accent-emerald)' }}>✅ Screenshot uploaded</p>
                            <label style={{ fontSize: '0.75rem', color: 'var(--accent-indigo)', cursor: 'pointer', marginTop: 4, display: 'inline-block' }}>
                              Replace
                              <input 
                                type="file" 
                                accept="image/*" 
                                style={{ display: 'none' }}
                                onChange={(e) => handleUploadScreenshot(t.id, e.target.files[0])}
                              />
                            </label>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', margin: 0 }}>
                            {uploadingScreenshot === t.id ? 'Uploading...' : '📎 Choose Image'}
                            <input 
                              type="file" 
                              accept="image/*" 
                              style={{ display: 'none' }}
                              disabled={uploadingScreenshot === t.id}
                              onChange={(e) => handleUploadScreenshot(t.id, e.target.files[0])}
                            />
                          </label>
                          <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>Max 5MB • PNG, JPG, WEBP</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* ───── CERTIFICATES TAB ───── */}
      {tab === 'certs' && (
        <div className="fade-in">
          {certs.length === 0 ? (
            <div className="glass-card" style={{ textAlign: 'center', padding: 60 }}>
              <div style={{ fontSize: '3rem' }}>📜</div>
              <h3>No certificates yet</h3>
              <p style={{ opacity: 0.7 }}>Certificates will appear here once events you participated in are completed.</p>
            </div>
          ) : (
            <div className="card-grid">
              {certs.map((c) => (
                <div key={c.teamId} className="glass-card animate-in-up" style={{ padding: 24, textAlign: 'center' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🎓</div>
                  <h3 style={{ margin: '0 0 4px' }}>{c.eventTitle}</h3>
                  <p style={{ fontSize: '0.85rem', opacity: 0.7, margin: '0 0 4px' }}>Team: {c.teamName}</p>
                  <p style={{ fontSize: '0.8rem', opacity: 0.5, marginBottom: 16 }}>{c.eventDate ? new Date(c.eventDate).toLocaleDateString() : ''}</p>
                  <button
                    className="btn btn-primary"
                    style={{ width: '100%' }}
                    onClick={async () => {
                      try {
                        const res = await fetch(`${API_BASE.replace('/api', '')}${c.downloadUrl}`, {
                          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                        });
                        if (!res.ok) throw new Error('Download failed');
                        const blob = await res.blob();
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `certificate_${c.eventTitle?.replace(/\s+/g, '_') || 'cert'}.pdf`;
                        a.click();
                        URL.revokeObjectURL(url);
                      } catch (err) { alert('Failed to download certificate'); }
                    }}
                  >📥 Download Certificate</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ───── MODALS ───── */}
      {qrModal && (
        <div className="modal-overlay" onClick={() => setQrModal(null)}>
          <div className="modal-content glass-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 360, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h2>{qrModal.title}</h2>
            {qrModal.token ? (
              <>
                <div style={{ background: '#ffffff', padding: 20, borderRadius: 12, marginBottom: 16 }}>
                  <QRCodeCanvas value={String(qrModal.token)} size={200} level="H" />
                </div>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 20 }}>Scan this QR code at the venue</p>
              </>
            ) : (
              <p style={{ color: '#ef4444', marginBottom: 20 }}>⚠️ QR token not available. Contact admin.</p>
            )}
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setQrModal(null)}>Close</button>
          </div>
        </div>
      )}

      {teamChatId && (
        <div className="modal-overlay" onClick={() => setTeamChatId(null)} style={{ zIndex: 1000 }}>
          <div className="modal-content glass-card" style={{ maxWidth: 800, width: '95%', height: '85vh', padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Team Chat</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setTeamChatId(null)}>Close</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
               <TeamChat teamId={teamChatId} teamName={teams.find(t => t.id === teamChatId)?.team_name || 'Team'} />
            </div>
          </div>
        </div>
      )}
      {/* ───── RULEBOOK VIEWER MODAL ───── */}
      {rulebookUrl && (
        <div className="modal-overlay" onClick={() => setRulebookUrl(null)} style={{ zIndex: 1100 }}>
          <div className="modal-content glass-card" onClick={e => e.stopPropagation()} style={{ width: '95%', maxWidth: 900, height: '90vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <h3 style={{ margin: 0 }}>📖 Rule Book</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <a href={rulebookUrl} download className="btn btn-primary btn-sm">📥 Download</a>
                <button className="btn btn-secondary btn-sm" onClick={() => setRulebookUrl(null)}>← Back</button>
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              {rulebookUrl.match(/\.(png|jpg|jpeg|webp)$/i) ? (
                <img src={rulebookUrl} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="Rule Book" />
              ) : (
                <iframe src={rulebookUrl} style={{ width: '100%', height: '100%', border: 'none' }} title="Rule Book" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
