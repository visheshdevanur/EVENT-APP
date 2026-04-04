import { useState, useEffect } from 'react';
import { apiFetch, API_BASE } from '../utils/api';

export default function CollegeCalendar() {
  const [events, setEvents] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);

  useEffect(() => {
    loadEvents();
  }, []);

  async function loadEvents() {
    try {
      const data = await apiFetch('/events');
      setEvents(data);
    } catch (err) {
      console.error('Failed to load events for calendar:', err);
    } finally {
      setLoading(false);
    }
  }

  const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const calendarDays = [];
  const startDay = firstDayOfMonth(year, month);
  const totalDays = daysInMonth(year, month);

  for (let i = 0; i < startDay; i++) {
    calendarDays.push(null);
  }
  for (let i = 1; i <= totalDays; i++) {
    calendarDays.push(i);
  }

  const getEventsForDay = (day) => {
    if (!day) return [];
    return events.filter(evt => {
      const eventDate = new Date(evt.event_date);
      return eventDate.getDate() === day && eventDate.getMonth() === month && eventDate.getFullYear() === year;
    });
  };

  const statusColors = {
    upcoming: { bg: 'rgba(99, 102, 241, 0.15)', text: '#818cf8', label: '📅 Upcoming' },
    ongoing: { bg: 'rgba(16, 185, 129, 0.15)', text: '#34d399', label: '🟢 Ongoing' },
    completed: { bg: 'rgba(107, 114, 128, 0.15)', text: '#9ca3af', label: '✅ Completed' },
    canceled: { bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171', label: '❌ Canceled' },
  };

  const formatDate = (d) => {
    if (!d) return 'TBD';
    return new Date(d).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  const formatTime = (d) => {
    if (!d) return '';
    return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) return <div className="loading-center"><img src="/logo.png" alt="Loading..." className="eventloop-loader" /></div>;

  return (
    <div className="glass-card" style={{ padding: 24, borderRadius: 20 }}>
      {/* --- HEADER --- */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>📅 {monthNames[month]} {year}</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={prevMonth}>◀</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setCurrentDate(new Date())}>Today</button>
          <button className="btn btn-secondary btn-sm" onClick={nextMonth}>▶</button>
        </div>
      </div>

      {/* --- WEEKDAYS --- */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, marginBottom: 8, textAlign: 'center', opacity: 0.5, fontSize: '0.8rem', fontWeight: 600 }}>
        <div>SUN</div><div>MON</div><div>TUE</div><div>WED</div><div>THU</div><div>FRI</div><div>SAT</div>
      </div>

      {/* --- CALENDAR GRID --- */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
        {calendarDays.map((day, idx) => {
          const dayEvents = getEventsForDay(day);
          const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();

          return (
            <div 
              key={idx} 
              style={{ 
                minHeight: 100, 
                padding: 8, 
                borderRadius: 12, 
                background: day ? 'var(--bg-glass)' : 'transparent',
                border: isToday ? '2px solid var(--accent-indigo)' : '1px solid var(--border-subtle)',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                gap: 4
              }}
            >
              <span style={{ fontSize: '0.8rem', opacity: day ? 0.7 : 0, fontWeight: 700 }}>{day}</span>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {dayEvents.map(evt => (
                  <div 
                    key={evt.id} 
                    onClick={() => setSelectedEvent(evt)}
                    style={{ 
                      fontSize: '0.65rem', 
                      background: 'var(--gradient-main)', 
                      padding: '2px 6px', 
                      borderRadius: 4, 
                      whiteSpace: 'nowrap', 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis',
                      color: 'white',
                      cursor: 'pointer',
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(99,102,241,0.4)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                    title={`Click to view: ${evt.title}`}
                  >
                    {evt.title}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* --- EVENT DETAIL MODAL --- */}
      {selectedEvent && (
        <div 
          className="modal-overlay" 
          onClick={() => setSelectedEvent(null)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
        >
          <div 
            className="glass-card animate-in" 
            onClick={e => e.stopPropagation()}
            style={{ 
              maxWidth: 560, 
              width: '92%', 
              maxHeight: '85vh', 
              overflowY: 'auto', 
              padding: 32, 
              borderRadius: 20,
              position: 'relative'
            }}
          >
            {/* Close button */}
            <button 
              onClick={() => setSelectedEvent(null)}
              style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.1)', border: 'none', color: 'var(--text-primary)', fontSize: '1.2rem', width: 36, height: 36, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            >✕</button>

            {/* Logo */}
            {selectedEvent.logo && (
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <img 
                  src={selectedEvent.logo.startsWith('http') ? selectedEvent.logo : `${API_BASE.replace('/api', '')}${selectedEvent.logo}`}
                  alt={selectedEvent.title}
                  style={{ width: 80, height: 80, borderRadius: 16, objectFit: 'cover', border: '2px solid var(--border-subtle)' }}
                  onError={e => { e.target.style.display = 'none'; }}
                />
              </div>
            )}

            {/* Title */}
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0 0 8px', textAlign: 'center', paddingRight: 30 }}>{selectedEvent.title}</h2>

            {/* Status badge */}
            {(() => {
              const s = statusColors[selectedEvent.status] || statusColors.upcoming;
              return (
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                  <span style={{ background: s.bg, color: s.text, padding: '4px 16px', borderRadius: 20, fontSize: '0.85rem', fontWeight: 600 }}>
                    {s.label}
                  </span>
                </div>
              );
            })()}

            {/* Info Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <InfoItem icon="📅" label="Date" value={formatDate(selectedEvent.event_date)} />
              <InfoItem icon="⏰" label="Time" value={formatTime(selectedEvent.event_date) || 'TBD'} />
              {selectedEvent.last_date && (
                <InfoItem icon="⏳" label="Registration Deadline" value={formatDate(selectedEvent.last_date)} />
              )}
              <InfoItem icon="👥" label="Team Size" value={`${selectedEvent.min_team_size || 1} — ${selectedEvent.max_team_size || 1} members`} />
              <InfoItem icon="💰" label="Entry Fee" value={selectedEvent.entry_fee > 0 ? `₹${selectedEvent.entry_fee}` : 'Free'} />
              {selectedEvent.departments?.name && (
                <InfoItem icon="🏢" label="Department" value={selectedEvent.departments.name} />
              )}
            </div>

            {/* Description */}
            {selectedEvent.description && (
              <div style={{ marginBottom: 20 }}>
                <h4 style={{ margin: '0 0 8px', fontSize: '0.9rem', opacity: 0.6, textTransform: 'uppercase', letterSpacing: 1 }}>Description</h4>
                <p style={{ margin: 0, lineHeight: 1.6, fontSize: '0.95rem', opacity: 0.85 }}>{selectedEvent.description}</p>
              </div>
            )}

            {/* Contacts */}
            {(selectedEvent.contact1_name || selectedEvent.contact2_name) && (
              <div style={{ marginBottom: 20 }}>
                <h4 style={{ margin: '0 0 8px', fontSize: '0.9rem', opacity: 0.6, textTransform: 'uppercase', letterSpacing: 1 }}>Contacts</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {selectedEvent.contact1_name && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--bg-glass)', borderRadius: 10 }}>
                      <span>👤</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{selectedEvent.contact1_name}</div>
                        {selectedEvent.contact1_phone && <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>📞 {selectedEvent.contact1_phone}</div>}
                      </div>
                    </div>
                  )}
                  {selectedEvent.contact2_name && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--bg-glass)', borderRadius: 10 }}>
                      <span>👤</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{selectedEvent.contact2_name}</div>
                        {selectedEvent.contact2_phone && <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>📞 {selectedEvent.contact2_phone}</div>}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Action button */}
            <button 
              className="btn btn-primary" 
              style={{ width: '100%', marginTop: 8 }} 
              onClick={() => setSelectedEvent(null)}
            >Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoItem({ icon, label, value }) {
  return (
    <div style={{ padding: '10px 12px', background: 'var(--bg-glass)', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
      <div style={{ fontSize: '0.7rem', opacity: 0.5, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>{icon} {label}</div>
      <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{value}</div>
    </div>
  );
}
