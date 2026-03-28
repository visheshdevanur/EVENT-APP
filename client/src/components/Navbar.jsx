import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { apiFetch } from '../utils/api';

export default function Navbar({ user, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [showProfile, setShowProfile] = useState(false);
  const [showChangePw, setShowChangePw] = useState(false);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwMsg, setPwMsg] = useState({ type: '', text: '' });
  const [pwLoading, setPwLoading] = useState(false);
  const [showPw, setShowPw] = useState({ current: false, new: false, confirm: false });
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowProfile(false);
      }
    }
    if (showProfile) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showProfile]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setShowProfile(false);
    onLogout();
    navigate('/');
  };

  const isActive = (path) => location.pathname === path ? 'active' : '';

  const getBadgeClass = (role) => {
    if (role === 'superadmin') return 'badge-superadmin';
    if (role === 'admin') return 'badge-admin';
    return 'badge-student';
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwMsg({ type: '', text: '' });

    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwMsg({ type: 'error', text: 'New passwords do not match' });
      return;
    }
    if (pwForm.newPassword.length < 6) {
      setPwMsg({ type: 'error', text: 'Password must be at least 6 characters' });
      return;
    }

    setPwLoading(true);
    try {
      const data = await apiFetch('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: pwForm.currentPassword,
          newPassword: pwForm.newPassword,
        }),
      });
      setPwMsg({ type: 'success', text: data.message });
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => { setShowChangePw(false); setPwMsg({ type: '', text: '' }); }, 2000);
    } catch (err) {
      setPwMsg({ type: 'error', text: err.error || 'Failed to change password' });
    } finally { setPwLoading(false); }
  };

  return (
    <>
      <nav className="navbar">
        <Link to="/" className="navbar-brand">⚡ EventPortal</Link>

        {user ? (
          <div className="navbar-links">
            {user.role === 'superadmin' && (
              <>
                <Link to="/superadmin" className={isActive('/superadmin')}>Users</Link>
                <Link to="/admin" className={isActive('/admin')}>Events</Link>
              </>
            )}
            {user.role === 'admin' && (
              <Link to="/admin" className={isActive('/admin')}>Dashboard</Link>
            )}
            {user.role === 'student' && (
              <Link to="/dashboard" className={isActive('/dashboard')}>Dashboard</Link>
            )}

            {/* Profile area — self-contained with ref for outside-click */}
            <div className="navbar-user" ref={dropdownRef}>
              <button className="profile-btn" onClick={() => setShowProfile(!showProfile)} title="Profile">
                <span className="profile-avatar">{user.name?.charAt(0).toUpperCase()}</span>
                <span className="profile-name">{user.name}</span>
                <span className={`user-badge ${getBadgeClass(user.role)}`}>
                  {user.role === 'superadmin' ? '🛡️' : user.role}
                </span>
              </button>

              {showProfile && (
                <div className="profile-dropdown">
                  <div className="profile-dropdown-header">
                    <div className="profile-dropdown-avatar">{user.name?.charAt(0).toUpperCase()}</div>
                    <div>
                      <div className="profile-dropdown-name">{user.name}</div>
                      <div className="profile-dropdown-email">{user.email}</div>
                      <span className={`user-badge ${getBadgeClass(user.role)}`} style={{ marginTop: 4 }}>
                        {user.role}
                      </span>
                    </div>
                  </div>
                  <div className="profile-dropdown-divider" />
                  <button className="profile-dropdown-item" onClick={() => { setShowChangePw(true); setShowProfile(false); }}>
                    🔑 Change Password
                  </button>
                  <div className="profile-dropdown-divider" />
                  <button className="profile-dropdown-item logout-item" onClick={handleLogout}>
                    🚪 Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="navbar-links">
            <Link to="/" className={isActive('/')}>Login</Link>
          </div>
        )}
      </nav>

      {/* ────── CHANGE PASSWORD MODAL ────── */}
      {showChangePw && (
        <div className="modal-overlay" onClick={() => setShowChangePw(false)}>
          <div className="modal-content glass-card" onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 420, animation: 'fadeSlideUp 0.3s ease' }}>
            <h3 style={{ marginBottom: 20, background: 'var(--gradient-main)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              🔑 Change Password
            </h3>

            {pwMsg.text && (
              <div className={`alert ${pwMsg.type === 'success' ? 'alert-success' : 'alert-error'}`}
                style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  marginBottom: 16,
                  fontSize: '0.85rem',
                  background: pwMsg.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                  color: pwMsg.type === 'success' ? '#10b981' : '#ef4444',
                  border: `1px solid ${pwMsg.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                }}>
                {pwMsg.text}
              </div>
            )}

            <form onSubmit={handleChangePassword}>
              <div className="form-group">
                <label>Current Password</label>
                <div style={{ position: 'relative' }}>
                  <input className="form-control" type={showPw.current ? 'text' : 'password'} value={pwForm.currentPassword}
                    onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })}
                    placeholder="Enter current password" required style={{ paddingRight: 44 }} />
                  <button type="button" onClick={() => setShowPw({ ...showPw, current: !showPw.current })}
                    style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.1rem', padding: 4 }}>
                    {showPw.current ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label>New Password</label>
                <div style={{ position: 'relative' }}>
                  <input className="form-control" type={showPw.new ? 'text' : 'password'} value={pwForm.newPassword}
                    onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
                    placeholder="Enter new password" required style={{ paddingRight: 44 }} />
                  <button type="button" onClick={() => setShowPw({ ...showPw, new: !showPw.new })}
                    style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.1rem', padding: 4 }}>
                    {showPw.new ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label>Confirm New Password</label>
                <div style={{ position: 'relative' }}>
                  <input className="form-control" type={showPw.confirm ? 'text' : 'password'} value={pwForm.confirmPassword}
                    onChange={(e) => setPwForm({ ...pwForm, confirmPassword: e.target.value })}
                    placeholder="Confirm new password" required style={{ paddingRight: 44 }} />
                  <button type="button" onClick={() => setShowPw({ ...showPw, confirm: !showPw.confirm })}
                    style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.1rem', padding: 4 }}>
                    {showPw.confirm ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={pwLoading}>
                  {pwLoading ? 'Changing...' : 'Update Password'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowChangePw(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
