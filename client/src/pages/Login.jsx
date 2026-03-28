import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../utils/api';

export default function Login({ onLogin }) {
  const [mode, setMode] = useState('login'); // login | register | forgot | reset
  const [form, setForm] = useState({ studentId: '', name: '', email: '', password: '', role: 'student' });
  const [resetForm, setResetForm] = useState({ email: '', resetCode: '', newPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const handleResetChange = (e) => setResetForm({ ...resetForm, [e.target.name]: e.target.value });

  const switchMode = (newMode) => { setMode(newMode); setError(''); setSuccess(''); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = mode === 'register' ? '/auth/register' : '/auth/login';
      const body = mode === 'register'
        ? form
        : { email: form.email, password: form.password };

      const data = await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      onLogin(data.user);
      navigate(data.user.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      setError(err.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const data = await apiFetch('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: resetForm.email }),
      });
      setSuccess(data.message);
      if (data.resetCode) {
        setResetForm({ ...resetForm, resetCode: data.resetCode });
      }
      setMode('reset');
    } catch (err) {
      setError(err.error || 'Failed to send reset code');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const data = await apiFetch('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify(resetForm),
      });
      setSuccess(data.message);
      setTimeout(() => switchMode('login'), 2000);
    } catch (err) {
      setError(err.error || 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  const titles = {
    login: 'Welcome Back',
    register: 'Create Account',
    forgot: 'Forgot Password',
    reset: 'Reset Password',
  };

  const subtitles = {
    login: 'Sign in to your portal account',
    register: 'Join the college event portal',
    forgot: 'Enter your email to get a reset code',
    reset: 'Enter the code and set a new password',
  };

  return (
    <div className="auth-container">
      <div className="auth-card glass-card animate-in">
        <h2>{titles[mode]}</h2>
        <p className="auth-subtitle">{subtitles[mode]}</p>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        {/* ───── LOGIN / REGISTER FORM ───── */}
        {(mode === 'login' || mode === 'register') && (
          <form onSubmit={handleSubmit}>
            {mode === 'register' && (
              <>
                <div className="form-group">
                  <label>USN</label>
                  <input id="input-student-id" className="form-control" name="studentId"
                    value={form.studentId} onChange={handleChange} placeholder="e.g. 1KS22CS001" required />
                </div>
                <div className="form-group">
                  <label>Full Name</label>
                  <input id="input-name" className="form-control" name="name"
                    value={form.name} onChange={handleChange} placeholder="Your full name" required />
                </div>
              </>
            )}
            <div className="form-group">
              <label>Email</label>
              <input id="input-email" className="form-control" type="email" name="email"
                value={form.email} onChange={handleChange} placeholder="you@example.com" required />
            </div>
            <div className="form-group">
              <label>Password</label>
              <div className="password-wrapper">
                <input id="input-password" className="form-control" type={showPassword ? 'text' : 'password'}
                  name="password" value={form.password} onChange={handleChange} placeholder="••••••••" required />
                <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {mode === 'login' && (
              <div style={{ textAlign: 'right', marginBottom: 12 }}>
                <a className="forgot-link" onClick={() => switchMode('forgot')}>Forgot Password?</a>
              </div>
            )}

            <button id="btn-auth-submit" type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Please wait...' : mode === 'register' ? 'Create Account' : 'Sign In'}
            </button>
          </form>
        )}

        {/* ───── FORGOT PASSWORD FORM ───── */}
        {mode === 'forgot' && (
          <form onSubmit={handleForgotPassword}>
            <div className="form-group">
              <label>Email</label>
              <input className="form-control" type="email" name="email"
                value={resetForm.email} onChange={handleResetChange}
                placeholder="you@example.com" required />
            </div>
            <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Sending...' : 'Send Reset Code'}
            </button>
          </form>
        )}

        {/* ───── RESET PASSWORD FORM ───── */}
        {mode === 'reset' && (
          <form onSubmit={handleResetPassword}>
            <div className="form-group">
              <label>Email</label>
              <input className="form-control" type="email" name="email"
                value={resetForm.email} onChange={handleResetChange}
                placeholder="you@example.com" required />
            </div>
            <div className="form-group">
              <label>Reset Code</label>
              <input className="form-control" name="resetCode"
                value={resetForm.resetCode} onChange={handleResetChange}
                placeholder="6-digit code" required />
            </div>
            <div className="form-group">
              <label>New Password</label>
              <div className="password-wrapper">
                <input className="form-control" type={showPassword ? 'text' : 'password'}
                  name="newPassword" value={resetForm.newPassword} onChange={handleResetChange}
                  placeholder="New password" required />
                <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
        )}

        {/* ───── BOTTOM TOGGLE ───── */}
        <div className="auth-toggle">
          {mode === 'login' && <>Don't have an account? <a onClick={() => switchMode('register')}>Register</a></>}
          {mode === 'register' && <>Already have an account? <a onClick={() => switchMode('login')}>Sign In</a></>}
          {(mode === 'forgot' || mode === 'reset') && <><a onClick={() => switchMode('login')}>← Back to Sign In</a></>}
        </div>
      </div>
    </div>
  );
}
