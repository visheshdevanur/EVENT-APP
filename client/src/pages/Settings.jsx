import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { apiFetch, getUser } from '../utils/api';

export default function Settings({ onUpdateUser }) {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [user, setUser] = useState(getUser());
  
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    phone: user?.phone || ''
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg({ type: '', text: '' });
    try {
      const res = await apiFetch('/users/profile', {
        method: 'PATCH',
        body: JSON.stringify(profileForm)
      });
      localStorage.setItem('user', JSON.stringify(res.user));
      setUser(res.user);
      onUpdateUser(res.user);
      setMsg({ type: 'success', text: 'Profile updated successfully!' });
    } catch (err) {
      setMsg({ type: 'danger', text: err.error || 'Failed to update profile' });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      return setMsg({ type: 'danger', text: 'New passwords do not match' });
    }
    setLoading(true);
    setMsg({ type: '', text: '' });
    try {
      await apiFetch('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        })
      });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setMsg({ type: 'success', text: 'Password changed successfully!' });
    } catch (err) {
      setMsg({ type: 'danger', text: err.error || 'Failed to change password' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: 800, padding: '40px 20px' }}>
      <button 
        onClick={() => navigate(-1)} 
        style={{ 
          background: 'none', 
          border: 'none', 
          color: 'var(--accent-indigo)', 
          cursor: 'pointer', 
          display: 'flex', 
          alignItems: 'center', 
          gap: 8, 
          marginBottom: 16,
          fontSize: '1rem',
          fontWeight: 600,
          padding: 0
        }}
      >
        ← Back to Dashboard
      </button>
      <h1 style={{ marginBottom: 32, fontSize: '2.5rem', fontWeight: 800 }}>⚙️ Settings</h1>
      
      {msg.text && (
        <div className={`alert alert-${msg.type}`} style={{ marginBottom: 24, borderRadius: 12 }}>
          {msg.text}
        </div>
      )}

      <div style={{ display: 'grid', gap: 32 }}>
        
        {/* --- THEME SECTION --- */}
        <section className="glass-card" style={{ padding: 24 }}>
          <h2 style={{ marginBottom: 16, fontSize: '1.5rem' }}>🌓 Appearance</h2>
          <p style={{ opacity: 0.7, marginBottom: 24 }}>Choose your preferred theme for the portal.</p>
          <div style={{ display: 'flex', gap: 16 }}>
            <button 
              className={`btn ${theme === 'dark' ? 'btn-primary' : 'btn-secondary'}`} 
              onClick={() => theme !== 'dark' && toggleTheme()}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              🌙 Dark Mode
            </button>
            <button 
              className={`btn ${theme === 'light' ? 'btn-primary' : 'btn-secondary'}`} 
              onClick={() => theme !== 'light' && toggleTheme()}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              ☀️ Light Mode
            </button>
          </div>
        </section>

        {/* --- PROFILE SECTION --- */}
        <section className="glass-card" style={{ padding: 24 }}>
          <h2 style={{ marginBottom: 16, fontSize: '1.5rem' }}>👤 Profile Information</h2>
          <form onSubmit={handleProfileUpdate}>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8, opacity: 0.8 }}>Full Name (Username)</label>
              <input 
                className="form-control" 
                value={profileForm.name}
                onChange={(e) => setProfileForm({...profileForm, name: e.target.value})}
                placeholder="Enter your name"
                required
              />
            </div>
            <div className="form-group" style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', marginBottom: 8, opacity: 0.8 }}>Mobile Number</label>
              <input 
                className="form-control" 
                value={profileForm.phone}
                onChange={(e) => setProfileForm({...profileForm, phone: e.target.value})}
                placeholder="Enter your phone number"
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Update Profile'}
            </button>
          </form>
        </section>

        {/* --- SECURITY SECTION --- */}
        <section className="glass-card" style={{ padding: 24 }}>
          <h2 style={{ marginBottom: 16, fontSize: '1.5rem' }}>🔐 Security</h2>
          <form onSubmit={handlePasswordChange}>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8, opacity: 0.8 }}>Current Password</label>
              <input 
                type="password"
                className="form-control" 
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm({...passwordForm, currentPassword: e.target.value})}
                required
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              <div className="form-group">
                <label style={{ display: 'block', marginBottom: 8, opacity: 0.8 }}>New Password</label>
                <input 
                  type="password"
                  className="form-control" 
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label style={{ display: 'block', marginBottom: 8, opacity: 0.8 }}>Confirm New Password</label>
                <input 
                  type="password"
                  className="form-control" 
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                  required
                />
              </div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Changing...' : 'Change Password'}
            </button>
          </form>
        </section>

      </div>
    </div>
  );
}
