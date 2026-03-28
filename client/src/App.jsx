import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import StudentDashboard from './pages/StudentDashboard';
import AdminDashboard from './pages/AdminDashboard';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import RegisterTeam from './pages/RegisterTeam';
import { getUser } from './utils/api';
import './index.css';

function App() {
  const [user, setUser] = useState(getUser());

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    setUser(null);
  };

  const getHomePath = (u) => {
    if (u.role === 'superadmin') return '/superadmin';
    if (u.role === 'admin') return '/admin';
    return '/dashboard';
  };

  return (
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
          element={user?.role === 'admin' || user?.role === 'superadmin' ? <AdminDashboard /> : <Navigate to="/" />}
        />
        <Route
          path="/superadmin"
          element={user?.role === 'superadmin' ? <SuperAdminDashboard /> : <Navigate to="/" />}
        />
        <Route
          path="/register-team/:eventId"
          element={user ? <RegisterTeam /> : <Navigate to="/" />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
