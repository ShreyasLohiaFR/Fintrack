const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { isSupportedCurrency, SUPPORTED_CURRENCIES, DEFAULT_CURRENCY } = require('../utils/currency');

const AUTH_COOKIE = 'fintrack_token';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: THIRTY_DAYS_MS
});

const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  currency: user.currency || DEFAULT_CURRENCY
});

const createToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d'
  });
};

const sendAuthResponse = (user, statusCode, res) => {
  const token = createToken(user._id);
  // httpOnly cookie carries the browser session (unreadable from JS);
  // the token is also returned for non-browser API clients.
  res.cookie(AUTH_COOKIE, token, cookieOptions());
  res.status(statusCode).json({
    success: true,
    token,
    user: publicUser(user)
  });
};

exports.register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
    }

    if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ success: false, message: 'Name, email, and password must be text' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    if (password.length > 72) {
      return res.status(400).json({ success: false, message: 'Password cannot be longer than 72 characters' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'An account with this email already exists' });
    }

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password
    });

    sendAuthResponse(user, 201, res);
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide an email and password' });
    }

    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ success: false, message: 'Email and password must be text' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    sendAuthResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};

exports.getMe = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      user: publicUser(req.user)
    });
  } catch (error) {
    next(error);
  }
};

exports.logout = (req, res) => {
  res.clearCookie(AUTH_COOKIE, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/'
  });
  res.status(200).json({ success: true, message: 'Logged out' });
};

exports.updateMe = async (req, res, next) => {
  try {
    const { currency } = req.body;

    if (currency === undefined) {
      return res.status(400).json({ success: false, message: 'Nothing to update' });
    }

    if (!isSupportedCurrency(currency)) {
      return res.status(400).json({
        success: false,
        message: `Unsupported currency. Supported: ${SUPPORTED_CURRENCIES.join(', ')}`
      });
    }

    req.user.currency = currency;
    await req.user.save();

    res.status(200).json({ success: true, user: publicUser(req.user) });
  } catch (error) {
    next(error);
  }
};
