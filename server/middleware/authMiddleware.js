const jwt = require('jsonwebtoken');

/**
 * Verify JWT and attach user to req.user
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, studentId, role }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Require admin role — must be used AFTER requireAuth
 * Allows 'admin', 'dept_admin', and 'superadmin'
 */
function requireAdmin(req, res, next) {
  if (!['admin', 'dept_admin', 'superadmin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

/**
 * Require department administration role
 * Allows 'dept_admin' and 'superadmin'
 */
function requireDeptAdmin(req, res, next) {
  if (!['dept_admin', 'superadmin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Department Admin access required' });
  }
  next();
}

/**
 * Require superadmin role — must be used AFTER requireAuth
 */
function requireSuperAdmin(req, res, next) {
  if (req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Super admin access required' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin, requireDeptAdmin, requireSuperAdmin };
