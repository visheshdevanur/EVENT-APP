import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import StudentDashboard from './pages/StudentDashboard';
import AdminDashboard from './pages/AdminDashboard';
import DeptAdminDashboard from './pages/DeptAdminDashboard';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import RegisterTeam from './pages/RegisterTeam';
import Toast from './components/Toast';
import { getUser } from './utils/api';
import './index.css';

import { ThemeProvider } from './context/ThemeContext';
import Settings from './pages/Settings';

function App() {
  const [user, setUser] = useState(getUser());

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    setUser(null);
  };

  const getHomePath = (u) => {
    if (u?.role === 'student') return '/dashboard';
    if (u?.role === 'superadmin') return '/superadmin';
    if (['admin', 'dept_admin'].includes(u?.role)) return '/admin';
    return '/';
  };

  return (
    <ThemeProvider>
      <BrowserRouter>
        <Navbar user={user} onLogout={handleLogout} />
        <Routes>
          <Route
            path="/"
            element={user ? <Navigate to={getHomePath(user)} /> : <Login onLogin={handleLogin} />}
          />
          <Route
            path="/dashboard"
            element={user ? <StudentDashboard /> : <Navigate to="/" />}
          />
          <Route
            path="/admin"
            element={['admin', 'dept_admin', 'superadmin'].includes(user?.role) ? <AdminDashboard /> : <Navigate to="/" />}
          />
          <Route
            path="/superadmin"
            element={user?.role === 'superadmin' ? <SuperAdminDashboard /> : <Navigate to="/" />}
          />
          <Route
            path="/settings"
            element={user ? <Settings onUpdateUser={(u) => setUser(u)} /> : <Navigate to="/" />}
          />
          <Route
            path="/register-team/:eventId"
            element={user ? <RegisterTeam /> : <Navigate to="/" />}
          />
        </Routes>
        <Toast />
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
