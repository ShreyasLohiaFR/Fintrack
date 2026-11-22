const jwt = require('jsonwebtoken');
const User = require('../models/User');

const AUTH_COOKIE = 'fintrack_token';

// Browser sessions carry the JWT in an httpOnly cookie; non-browser clients
// (tests, scripts) keep using Authorization: Bearer <token>. Header wins when
// both are present.
const extractToken = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }
  if (req.cookies && req.cookies[AUTH_COOKIE]) {
    return req.cookies[AUTH_COOKIE];
  }
  return null;
};

const protect = async (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({ success: false, message: 'Please log in to access this' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const authenticatedUser = await User.findById(decoded.id);

    if (!authenticatedUser) {
      return res.status(401).json({ success: false, message: 'User no longer exists' });
    }

    req.user = authenticatedUser;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
  }
};

module.exports = { protect };
