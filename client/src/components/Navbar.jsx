import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../utils/api';

export default function Navbar({ user, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [showProfile, setShowProfile] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showChangePw, setShowChangePw] = useState(false);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwMsg, setPwMsg] = useState({ type: '', text: '' });
  const [pwLoading, setPwLoading] = useState(false);
  const [showPw, setShowPw] = useState({ current: false, new: false, confirm: false });
  
  const dropdownRef = useRef(null);
  const menuRef = useRef(null);

  // Close dropdown/menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowProfile(false);
      }
      if (menuRef.current && !menuRef.current.contains(e.target) && !e.target.closest('.mobile-toggle')) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showProfile, isMenuOpen]);

  // Close menu on route change
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

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
        <Link to="/" className="navbar-brand" style={{ display: 'flex', alignItems: 'center' }}><img src="/logo.png" alt="logo" style={{ width: 26, height: 26, marginRight: 8, filter: 'drop-shadow(0 0 6px rgba(0, 240, 255, 0.4))' }} /> <span className="brand-text">EventLoop</span></Link>

        {user ? (
          <>
            <button className="mobile-toggle" onClick={() => setIsMenuOpen(!isMenuOpen)} aria-label="Toggle navigation">
              {isMenuOpen ? '✕' : '☰'}
            </button>

            <div className={`navbar-links ${isMenuOpen ? 'open' : ''}`} ref={menuRef}>
              {user.role === 'superadmin' && (
                <>
                  <Link to="/superadmin" className={isActive('/superadmin')}>Admin Panel</Link>
                  <Link to="/admin" className={isActive('/admin')}>All Events</Link>
                </>
              )}
              {user.role === 'dept_admin' && (
                <>
                  <Link to="/admin" className={isActive('/admin')}>Dashboard</Link>
                </>
              )}
              {user.role === 'admin' && (
                <Link to="/admin" className={isActive('/admin')}>Dashboard</Link>
              )}
              {user.role === 'student' && (
                <>
                  <Link to="/dashboard?tab=events" className={location.pathname === '/dashboard' && searchParams.get('tab') !== 'teams' && searchParams.get('tab') !== 'certs' ? 'active' : ''}>Events</Link>
                  <Link to="/dashboard?tab=teams" className={location.pathname === '/dashboard' && searchParams.get('tab') === 'teams' ? 'active' : ''}>My Teams</Link>
                  <Link to="/dashboard?tab=certs" className={location.pathname === '/dashboard' && searchParams.get('tab') === 'certs' ? 'active' : ''}>Certificates</Link>
                </>
              )}
            </div>

            <div className="navbar-user" ref={dropdownRef}>
              <button className="profile-btn" onClick={() => setShowProfile(!showProfile)} title="Profile">
                <span className="profile-avatar">{user.name?.charAt(0).toUpperCase()}</span>
                <span className="profile-name">{user.name}</span>
                <span className={`user-badge ${getBadgeClass(user.role)}`}>
                  {user.role === 'superadmin' ? '🛡️' : user.role === 'dept_admin' ? 'HOD' : user.role}
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
                  <Link to="/settings" className="profile-dropdown-item" onClick={() => setShowProfile(false)}>
                    ⚙️ Settings
                  </Link>
                  <div className="profile-dropdown-divider" />
                  <button className="profile-dropdown-item logout-item" onClick={handleLogout}>
                    🚪 Logout
                  </button>
                </div>
              )}
            </div>
          </>
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
            <h3 style={{ marginBottom: 20, color: 'var(--text-primary)' }}>
              🔑 Change Password
            </h3>

            {pwMsg.text && (
              <div className={`alert ${pwMsg.type === 'success' ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: 20 }}>
                {pwMsg.text}
              </div>
            )}

            <form onSubmit={handleChangePassword}>
              <div className="form-group">
                <label>Current Password</label>
                <div className="password-wrapper">
                  <input className="form-control" type={showPw.current ? 'text' : 'password'} required
                    value={pwForm.currentPassword} onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })} />
                  <button type="button" className="password-toggle" onClick={() => setShowPw({ ...showPw, current: !showPw.current })}>
                    {showPw.current ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label>New Password</label>
                <div className="password-wrapper">
                  <input className="form-control" type={showPw.new ? 'text' : 'password'} required
                    value={pwForm.newPassword} onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })} />
                  <button type="button" className="password-toggle" onClick={() => setShowPw({ ...showPw, new: !showPw.new })}>
                    {showPw.new ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label>Confirm New Password</label>
                <div className="password-wrapper">
                  <input className="form-control" type={showPw.confirm ? 'text' : 'password'} required
                    value={pwForm.confirmPassword} onChange={(e) => setPwForm({ ...pwForm, confirmPassword: e.target.value })} />
                  <button type="button" className="password-toggle" onClick={() => setShowPw({ ...showPw, confirm: !showPw.confirm })}>
                    {showPw.confirm ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowChangePw(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={pwLoading}>
                  {pwLoading ? 'Saving...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
