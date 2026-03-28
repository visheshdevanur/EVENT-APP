import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiFetch, getUser } from '../utils/api';

export default function RegisterTeam() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const user = getUser();

  const [event, setEvent] = useState(null);
  const [teamName, setTeamName] = useState('');
  const [memberInput, setMemberInput] = useState('');
  const [memberIds, setMemberIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPaymentQR, setShowPaymentQR] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const data = await apiFetch(`/events/${eventId}`);
        setEvent(data);
        if (user?.student_id) {
          setMemberIds([user.student_id]);
        }
      } catch (err) { setError('Event not found'); }
      finally { setLoading(false); }
    }
    load();
  }, [eventId]);

  const addMember = () => {
    const id = memberInput.trim();
    if (!id) return;
    if (memberIds.includes(id)) { setError('USN already added'); return; }
    if (event && memberIds.length >= event.max_team_size) { setError(`Maximum team size is ${event.max_team_size}`); return; }
    setMemberIds([...memberIds, id]);
    setMemberInput('');
    setError('');
  };

  const removeMember = (id) => setMemberIds(memberIds.filter((m) => m !== id));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      const data = await apiFetch('/teams/register', {
        method: 'POST',
        body: JSON.stringify({ eventId, teamName, memberStudentIds: memberIds }),
      });
      setSuccess(data.message || 'Team registered successfully!');

      // If paid event, show payment QR after registration
      if (event?.entry_fee > 0 && event?.payment_qr_image) {
        setShowPaymentQR(true);
      } else {
        setTimeout(() => navigate('/dashboard'), 2000);
      }
    } catch (err) { setError(err.error || 'Registration failed'); }
    finally { setSubmitting(false); }
  };

  if (loading) return <div className="loading-center"><div className="spinner"></div></div>;

  return (
    <div className="page-container">
      <div className="page-header animate-in">
        <h1>Register Your Team</h1>
        <p>for {event?.title || 'Event'}</p>
      </div>

      {/* ── Payment QR Display (after registration for paid events) ── */}
      {showPaymentQR && event?.payment_qr_image && (
        <div className="glass-card animate-in" style={{ maxWidth: 500, textAlign: 'center', marginBottom: 24 }}>
          <h3 style={{ marginBottom: 4 }}>💳 Scan to Pay</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 16 }}>
            Scan the QR code below to pay <strong>₹{event.entry_fee}</strong>. Once paid, the admin will confirm your payment.
          </p>
          <img
            src={event.payment_qr_image}
            alt="Payment QR"
            style={{ maxWidth: 300, width: '100%', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}
          />
          <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>
              Done — Go to Dashboard
            </button>
          </div>
        </div>
      )}

      {/* ── Payment QR Preview (before registration, if event has one) ── */}
      {!showPaymentQR && event?.entry_fee > 0 && event?.payment_qr_image && (
        <div className="glass-card animate-in" style={{ maxWidth: 500, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <img
              src={event.payment_qr_image}
              alt="Payment QR"
              style={{ width: 80, height: 80, borderRadius: 'var(--radius-sm)', objectFit: 'cover', border: '1px solid var(--border-subtle)' }}
            />
            <div>
              <p style={{ fontWeight: 600 }}>💳 Payment Required: ₹{event.entry_fee}</p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                After registering, you'll see the full payment QR code. Pay and the admin will confirm.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Registration Form ── */}
      {!showPaymentQR && (
        <div className="glass-card register-team-form animate-in" style={{ animationDelay: '100ms' }}>
          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          {event && (
            <div className="alert alert-info" style={{ marginBottom: 24 }}>
              Team size: {event.min_team_size}–{event.max_team_size} members
              {event.entry_fee > 0 ? ` | Fee: ₹${event.entry_fee}` : ' | Free event'}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Team Name</label>
              <input
                id="input-team-name"
                className="form-control"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="e.g. CodeCrafters"
                required
              />
            </div>

            <div className="form-group">
              <label>Team Members (USN)</label>
              <div className="add-member-row">
                <input
                  id="input-member-id"
                  className="form-control"
                  value={memberInput}
                  onChange={(e) => setMemberInput(e.target.value)}
                  placeholder="Enter USN"
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addMember(); } }}
                />
                <button type="button" id="btn-add-member" className="btn btn-secondary" onClick={addMember}>Add</button>
              </div>
              <div className="student-id-tags">
                {memberIds.map((id) => (
                  <span key={id} className="student-id-tag">
                    {id}
                    {id !== user?.student_id && (
                      <button type="button" onClick={() => removeMember(id)}>×</button>
                    )}
                  </span>
                ))}
              </div>
            </div>

            <button
              id="btn-submit-team"
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: '100%', marginTop: 12 }}
              disabled={submitting || memberIds.length === 0 || !teamName}
            >
              {submitting ? 'Registering...' : 'Register Team'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
