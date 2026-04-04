import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../utils/api';

const COUNTRY_CODES = [
  { code: '+91', label: '+91' },
  { code: '+1', label: '+1' },
  { code: '+44', label: '+44' },
  { code: '+61', label: '+61' },
  { code: '+971', label: '+971' },
  { code: '+65', label: '+65' },
  { code: '+49', label: '+49' },
  { code: '+33', label: '+33' },
  { code: '+81', label: '+81' },
  { code: '+86', label: '+86' },
  { code: '+82', label: '+82' },
  { code: '+55', label: '+55' },
  { code: '+7', label: '+7' },
  { code: '+27', label: '+27' },
  { code: '+234', label: '+234' },
  { code: '+254', label: '+254' },
  { code: '+60', label: '+60' },
  { code: '+63', label: '+63' },
  { code: '+92', label: '+92' },
  { code: '+880', label: '+880' },
  { code: '+94', label: '+94' },
  { code: '+977', label: '+977' },
];

export default function Login({ onLogin }) {
  const [mode, setMode] = useState('login'); // login | register | forgot | reset
  const [step, setStep] = useState('info'); // info | otp
  const [otpValue, setOtpValue] = useState('');
  const [form, setForm] = useState({ studentId: '', name: '', email: '', password: '', role: 'student', countryCode: '+91', phone: '', departmentId: '' });
  const [departments, setDepartments] = useState([]);
  const [resetForm, setResetForm] = useState({ email: '', resetCode: '', newPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const handleResetChange = (e) => setResetForm({ ...resetForm, [e.target.name]: e.target.value });

  const switchMode = (newMode) => { 
    setMode(newMode); 
    setStep('info');
    setOtpValue('');
    setError(''); 
    setSuccess(''); 
  };

  useEffect(() => {
    if (mode === 'register') {
      apiFetch('/departments')
        .then(data => {
          setDepartments(data);
          if (data.length > 0 && !form.departmentId) {
            setForm(f => ({ ...f, departmentId: data[0].id }));
          }
        })
        .catch(err => console.error("Could not fetch departments", err));
    }
  }, [mode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const data = await apiFetch('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email: form.email, password: form.password }),
        });
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        onLogin(data.user);
        
        switch (data.user.role) {
          case 'superadmin': navigate('/super-admin'); break;
          case 'dept_admin': navigate('/dept-admin'); break;
          case 'admin': navigate('/admin'); break;
          default: navigate('/events'); break;
        }
      } else if (mode === 'register') {
        if (step === 'info') {
          // STEP 1: Send OTP
          await apiFetch('/auth/send-signup-otp', {
            method: 'POST',
            body: JSON.stringify({
              ...form,
              phone: form.phone ? `${form.countryCode}${form.phone}` : ''
            }),
          });
          setStep('otp');
          setSuccess('Verification code sent to your email!');
        } else {
          // STEP 2: Verify OTP
          const data = await apiFetch('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ email: form.email, otp: otpValue }),
          });
          localStorage.setItem('token', data.token);
          localStorage.setItem('user', JSON.stringify(data.user));
          onLogin(data.user);
          setSuccess('Account verified successfully!');
          navigate('/events');
        }
      }
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
    <div className="auth-split-wrapper">
      <div className="auth-showcase">
        <div className="auth-showcase-content">
          <div className="brand-logo" style={{ display: 'flex', alignItems: 'center' }}><img src="/logo.png" alt="logo" style={{ width: 36, height: 36, marginRight: 12, filter: 'drop-shadow(0 0 10px rgba(0, 240, 255, 0.4))' }} /> <span className="brand-text">EventLoop</span></div>
          <h1>{mode === 'login' ? 'Welcome Back' : 'Join the Experience'}</h1>
          <p>
            {mode === 'login' 
              ? 'Access your personalized dashboard to manage registrations, teams, and college events seamlessly.' 
              : 'Create an account to participate in premium college events, form teams, and earn certificates securely.'}
          </p>
        </div>
      </div>
      
      <div className="auth-form-side">
        <div className="auth-card animate-in">
          <h2>{titles[mode]}</h2>
          <p className="auth-subtitle">{subtitles[mode]}</p>

          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          {/* ───── LOGIN / REGISTER FORM ───── */}
           {(mode === 'login' || mode === 'register') && (
            <form onSubmit={handleSubmit}>
              {mode === 'register' && step === 'info' && (
                <>
                  <div className="form-group">
                    <label>USN / Student ID</label>
                    <input id="input-student-id" className="form-control" name="studentId"
                      value={form.studentId} onChange={handleChange} placeholder="e.g. 1KS22CS001" required />
                  </div>
                  <div className="form-group">
                    <label>Department</label>
                    <select className="form-control" name="departmentId" value={form.departmentId} onChange={handleChange} required>
                      <option value="" disabled>Select your department</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Full Name</label>
                    <input id="input-name" className="form-control" name="name"
                      value={form.name} onChange={handleChange} placeholder="Your full name" required />
                  </div>
                  <div className="form-group">
                    <label>📱 Phone Number</label>
                    <div className="phone-input-group">
                      <select
                        className="form-control country-code-select"
                        name="countryCode"
                        value={form.countryCode}
                        onChange={handleChange}
                      >
                        {COUNTRY_CODES.map((c) => (
                          <option key={c.code} value={c.code}>{c.label}</option>
                        ))}
                      </select>
                      <input
                        className="form-control phone-number-input"
                        name="phone"
                        value={form.phone}
                        onChange={handleChange}
                        placeholder="9876543210"
                        type="tel"
                        pattern="[0-9]{10}"
                        title="Please enter exactly 10 digits"
                        maxLength="10"
                        required
                      />
                    </div>
                  </div>
                </>
              )}

              {mode === 'register' && step === 'otp' && (
                <div className="fade-in">
                  <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🛡️</div>
                    <h2>Verify Your Email</h2>
                    <p style={{ opacity: 0.7 }}>We've sent a 6-digit code to <br/><b>{form.email}</b></p>
                  </div>
                  <div className="form-group">
                    <label style={{ textAlign: 'center', display: 'block', width: '100%' }}>Enter OTP</label>
                    <input 
                      className="form-control" 
                      type="text" 
                      value={otpValue} 
                      onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="123456" 
                      style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '8px', fontWeight: 700 }}
                      required 
                    />
                  </div>
                  <div style={{ textAlign: 'center', marginTop: '12px' }}>
                    <button type="button" className="btn-link" onClick={() => setStep('info')} style={{ fontSize: '0.9rem' }}>
                      ⬅️ Edit Email / Info
                    </button>
                  </div>
                </div>
              )}

              {(mode === 'login' || (mode === 'register' && step === 'info')) && (
                <>
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
                </>
              )}

              {mode === 'login' && (
                <div style={{ textAlign: 'right', marginBottom: 16 }}>
                  <a className="forgot-link" onClick={() => switchMode('forgot')}>Forgot Password?</a>
                </div>
              )}

              <button id="btn-auth-submit" type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: '12px' }} disabled={loading}>
                {loading ? 'Please wait...' : (mode === 'register' ? (step === 'info' ? 'Send OTP' : 'Verify & Create Account') : 'Sign In')}
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
    </div>
  );
}
