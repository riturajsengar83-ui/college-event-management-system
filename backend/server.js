/*
 * college-event-backend/server.js
 * Real-time College Event Management backend
 *
 * Stack: Express + JSON file database + Socket.IO + JWT
 * (Pure JavaScript - no native modules / no Python build tools required)
 *
 * Quick start:
 *   cd backend
 *   npm install
 *   cp .env.example .env   # then edit .env with your SMTP settings
 *   npm start
 *
 * Then open http://localhost:3001 (frontend is served here).
 */
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const JWT_SECRET = process.env.JWT_SECRET || 'college-event-secret-change-me-in-production';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'riturajsengar83@gmail.com'; // the only account allowed to have admin rights
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const PORT = process.env.PORT || 3001;
const DB_FILE = path.join(__dirname, 'database.json');
const OTP_TTL_MIN = parseInt(process.env.OTP_TTL_MIN || '10', 10);

/* ---------- email transport (OTP) ---------- */
const nodemailer = require('nodemailer');
let transporter = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_FROM) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_PORT === '465',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  console.log('[SMTP] Real email transport configured.');
} else {
  console.log('[SMTP] Not configured — running in DEMO mode. OTPs are printed to the server console.');
}
async function sendOtpEmail(to, code) {
  const subject = 'College Event System - Password Reset Code';
  const text = `Your password reset code is ${code}. It expires in ${OTP_TTL_MIN} minutes.\nIf you did not request this, ignore this email.`;
  if (transporter) {
    await transporter.sendMail({ from: process.env.SMTP_FROM, to, subject, text });
  } else {
    console.log(`[DEMO OTP] To: ${to} | Code: ${code} | Expires: ${new Date(Date.now() + OTP_TTL_MIN * 60 * 1000).toLocaleTimeString()}`);
  }
}

/* ---------- tiny JSON file database ---------- */
let DB = { users: [], events: [], registrations: [], messages: [], otps: [] };
function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      DB = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } else {
      saveDB();
    }
  } catch (e) {
    console.warn('Could not read database.json, starting fresh.', e.message);
    DB = { users: [], events: [], registrations: [], messages: [] };
  }
  // ensure collections exist
  ['users','events','registrations','messages','otps'].forEach(k => { if (!Array.isArray(DB[k])) DB[k] = []; });
}
function saveDB() {
  fs.writeFileSync(DB_FILE, JSON.stringify(DB, null, 2));
}
function find(arr, id) { return arr.find(x => x.id == id); }
function nextId(arr) { return arr.length ? Math.max(...arr.map(x => x.id)) + 1 : 1; }
/* Admin rights belong to exactly one pre-registered email. Everyone else is a student. */
function roleOf(user) { return user && user.email === ADMIN_EMAIL ? 'admin' : 'student'; }

/* ---------- seed demo data ---------- */
function seed() {
  // Keep exactly one admin account. Prefer the configured email, then any
  // existing admin; if neither exists, create one.
  let admin = DB.users.find(u => u.email === ADMIN_EMAIL) || DB.users.find(u => u.role === 'admin');
  if (!admin) {
    admin = {
      id: nextId(DB.users), username: ADMIN_USERNAME, email: ADMIN_EMAIL,
      password: bcrypt.hashSync(ADMIN_PASSWORD, 10), role: 'admin',
      enrollment_no: null, branch: null, created_at: new Date().toISOString()
    };
    DB.users.push(admin);
  } else {
    // The environment is authoritative: it can move the admin account to a new
    // email/username and rotate the password without creating a duplicate.
    admin.email = ADMIN_EMAIL;
    admin.username = ADMIN_USERNAME;
    admin.role = 'admin';
    if (process.env.ADMIN_PASSWORD) admin.password = bcrypt.hashSync(ADMIN_PASSWORD, 10);
    else if (!admin.password) admin.password = bcrypt.hashSync(ADMIN_PASSWORD, 10);
  }
  // Everyone except the admin is a student.
  DB.users.forEach(u => { if (u !== admin) u.role = 'student'; });
  // Keep usernames unique so login never resolves to the wrong account.
  DB.users.forEach(u => {
    if (u !== admin && u.username === ADMIN_USERNAME) u.username = ADMIN_USERNAME + '#' + u.id;
  });
  if (!DB.users.some(u => u.username === 'student')) {
    DB.users.push({
      id: nextId(DB.users), username: 'student', email: 'student@mits.ac.in',
      password: bcrypt.hashSync('student123', 10), role: 'student',
      enrollment_no: '0901CS261001', branch: 'CSE', created_at: new Date().toISOString()
    });
  }
  if (DB.events.length === 0) {
    DB.events.push(
      { id: nextId(DB.events), event_id: 'EVT-101', name: 'Hackathon 2026', date: '2026-10-18', venue: 'CSE Block', seats: 150, paid: 1, created_at: new Date().toISOString() }
    );
    DB.events.push(
      { id: nextId(DB.events), event_id: 'EVT-102', name: 'Tech Quiz Finals', date: '2026-10-24', venue: 'Auditorium', seats: 100, paid: 1, created_at: new Date().toISOString() }
    );
    DB.events.push(
      { id: nextId(DB.events), event_id: 'EVT-103', name: 'Cultural Night', date: '2026-11-02', venue: 'Main Lawn', seats: 400, paid: 0, created_at: new Date().toISOString() }
    );
  }
  saveDB();
}
loadDB();
seed();
console.log(`[ADMIN] env: ADMIN_USERNAME=${process.env.ADMIN_USERNAME ? 'set' : 'default'}, ADMIN_EMAIL=${process.env.ADMIN_EMAIL ? 'set' : 'default'}, ADMIN_PASSWORD=${process.env.ADMIN_PASSWORD ? 'set' : 'default'}`);

/* ---------- express setup ---------- */
const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

/* ---------- auth middleware ---------- */
function authMiddleware(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
function adminOnly(req, res, next) {
  // Check the live account, not just the token, so old elevated tokens stop working after demotion.
  const user = DB.users.find(u => u.id === req.user.id);
  if (roleOf(user) !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
}

/* ---------- auth routes ---------- */
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password, enrollment_no, branch } = req.body;
    if (!username || !email || !password) return res.status(400).json({ error: 'Missing fields' });
    if (DB.users.some(u => u.username === username || u.email === email)) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }
    const hash = await bcrypt.hash(password, 10);
    const user = {
      id: nextId(DB.users), username, email, password: hash, role: 'student',
      enrollment_no: enrollment_no || null, branch: branch || null,
      created_at: new Date().toISOString()
    };
    DB.users.push(user); saveDB();
    const token = jwt.sign({ id: user.id, username, email, role: roleOf(user) }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, username, email, role: roleOf(user), enrollment_no, branch } });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

/* ---------- diagnostics: which admin env vars this server can see ---------- */
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    adminEnv: {
      ADMIN_USERNAME: !!process.env.ADMIN_USERNAME,
      ADMIN_EMAIL: !!process.env.ADMIN_EMAIL,
      ADMIN_PASSWORD: !!process.env.ADMIN_PASSWORD
    }
  });
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password, role: requestedRole } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Missing fields' });
    const user = DB.users.find(u => u.username === username || u.email === username);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const role = roleOf(user);
    // The selector is enforced here: an account can only sign in under its real role.
    if (requestedRole && requestedRole !== role) {
      return res.status(403).json({ error: requestedRole === 'admin'
        ? 'This is not the registered admin account. Sign in as Student.'
        : 'This account is the admin. Sign in as Admin.' });
    }
    const token = jwt.sign({ id: user.id, username: user.username, email: user.email, role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, username: user.username, email: user.email, role, enrollment_no: user.enrollment_no, branch: user.branch, photo: user.photo || null } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ---------- password reset via OTP ---------- */
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email or username is required' });
    const user = DB.users.find(u => u.email === email || u.username === email);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + OTP_TTL_MIN * 60 * 1000).toISOString();
    DB.otps = DB.otps.filter(o => !(o.email === user.email && !o.used));
    DB.otps.push({
      id: nextId(DB.otps), email: user.email, code, expiresAt, used: false, created_at: new Date().toISOString()
    });
    saveDB();
    await sendOtpEmail(user.email, code);
    res.json({ ok: true, demo: !transporter });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) return res.status(400).json({ error: 'Missing fields' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    const user = DB.users.find(u => u.email === email || u.username === email);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const otp = DB.otps.find(o => o.email === user.email && o.code === code && !o.used && new Date(o.expiresAt) > new Date());
    if (!otp) return res.status(400).json({ error: 'Invalid or expired code' });
    user.password = await bcrypt.hash(newPassword, 10);
    otp.used = true;
    saveDB();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ---------- signup: send OTP to real email ---------- */
app.post('/api/auth/signup-send-otp', async (req, res) => {
  try {
    const { username, email, password, enrollment_no, branch } = req.body;
    if (!username || !email || !password) return res.status(400).json({ error: 'Missing fields' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    if (DB.users.some(u => u.username === username || u.email === email)) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + OTP_TTL_MIN * 60 * 1000).toISOString();
    // remove any pending unverified OTP for this email (old codes are invalidated)
    DB.otps = DB.otps.filter(o => !(o.email === email && !o.used));
    DB.otps.push({
      id: nextId(DB.otps), email, code, expiresAt, used: false, created_at: new Date().toISOString(),
      pending: { username, email, password, role: 'student', enrollment_no: enrollment_no || null, branch: branch || null }
    });
    saveDB();
    await sendOtpEmail(email, code);
    console.log(`[SIGNUP OTP] To: ${email} | Code: ${code} | Expires: ${new Date(Date.now() + OTP_TTL_MIN * 60 * 1000).toLocaleTimeString()}`);
    res.json({ ok: true, demo: !transporter });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ---------- signup: verify OTP and create account ---------- */
app.post('/api/auth/signup-verify-otp', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: 'Missing fields' });
    const otp = DB.otps.find(o => o.email === email && o.code === code && !o.used);
    if (!otp) {
      // check if code exists but is expired
      const expired = DB.otps.find(o => o.email === email && o.code === code && !o.used && new Date(o.expiresAt) <= new Date());
      if (expired) return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
      // check if code exists but already used
      const used = DB.otps.find(o => o.email === email && o.code === code && o.used);
      if (used) return res.status(400).json({ error: 'OTP already used. Please request a new one.' });
      return res.status(400).json({ error: 'Invalid OTP. Please check the code and try again.' });
    }
    if (new Date(otp.expiresAt) <= new Date()) {
      return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
    }
    const p = otp.pending;
    if (!p) return res.status(400).json({ error: 'No pending signup found. Please sign up again.' });
    if (DB.users.some(u => u.username === p.username || u.email === p.email)) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }
    const hash = await bcrypt.hash(p.password, 10);
    const user = {
      id: nextId(DB.users), username: p.username, email: p.email, password: hash, role: p.role,
      enrollment_no: p.enrollment_no, branch: p.branch, created_at: new Date().toISOString()
    };
    DB.users.push(user);
    otp.used = true;
    saveDB();
    const token = jwt.sign({ id: user.id, username: p.username, email: user.email, role: roleOf(user) }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, username: p.username, email: user.email, role: roleOf(user), enrollment_no: user.enrollment_no, branch: user.branch } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/me', authMiddleware, (req, res) => {
  const user = DB.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json({ user: { id: user.id, username: user.username, email: user.email, role: roleOf(user), enrollment_no: user.enrollment_no, branch: user.branch, photo: user.photo || null } });
});

/* ---------- profile photo upload ---------- */
app.post('/api/auth/upload-photo', authMiddleware, async (req, res) => {
  try {
    const { photo } = req.body;
    if (!photo) return res.status(400).json({ error: 'No photo provided' });
    if (!photo.startsWith('data:image/')) return res.status(400).json({ error: 'Invalid image format' });
    const user = DB.users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.photo = photo;
    saveDB();
    res.json({ ok: true, photo: user.photo });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ---------- students (admin only) ---------- */
app.get('/api/students', authMiddleware, adminOnly, (req, res) => {
  const students = DB.users.filter(u => u.role === 'student').map(u => ({
    id: u.id, username: u.username, email: u.email,
    enrollment_no: u.enrollment_no, branch: u.branch
  }));
  res.json(students);
});

/* ---------- events ---------- */
app.get('/api/events', authMiddleware, (req, res) => {
  const result = DB.events.map(e => {
    const cnt = DB.registrations.filter(r => r.event_id === e.id).length;
    return { id: e.id, event_id: e.event_id, name: e.name, date: e.date, venue: e.venue, seats: e.seats, paid: !!e.paid, registered: cnt, seats_left: e.seats - cnt, created_at: e.created_at };
  });
  res.json(result);
});

app.post('/api/events', authMiddleware, adminOnly, (req, res) => {
  try {
    const { event_id, name, date, venue, seats, paid } = req.body;
    if (!name || !date || !venue || !seats) return res.status(400).json({ error: 'Missing fields' });
    const eid = event_id || ('EVT-' + Math.floor(1000 + Math.random() * 9000));
    const ev = { id: nextId(DB.events), event_id: eid, name, date, venue, seats: parseInt(seats, 10), paid: !!paid, created_at: new Date().toISOString() };
    DB.events.push(ev); saveDB();
    io.emit('data_changed', { type: 'event', action: 'added', data: ev });
    res.json({ id: ev.id, event_id: ev.event_id, name, date, venue, seats: ev.seats, paid: ev.paid });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/events/:id', authMiddleware, adminOnly, (req, res) => {
  const id = parseInt(req.params.id, 10);
  DB.events = DB.events.filter(e => e.id !== id);
  DB.messages = DB.messages.filter(m => m.event_id !== id);
  DB.registrations = DB.registrations.filter(r => r.event_id !== id);
  saveDB();
  io.emit('data_changed', { type: 'event', action: 'deleted', id: id });
  res.json({ ok: true });
});

/* ---------- registrations ---------- */
app.get('/api/registrations', authMiddleware, (req, res) => {
  let rows = DB.registrations.map(r => {
    const u = DB.users.find(x => x.id === r.user_id);
    const e = DB.events.find(x => x.id === r.event_id);
    return { id: r.id, user_id: r.user_id, event_id: r.event_id, paid: !!r.paid, created_at: r.created_at,
      username: u ? u.username : '-', enrollment_no: u ? u.enrollment_no : '-', branch: u ? u.branch : '-',
      event_code: e ? e.event_id : '-', event_name: e ? e.name : '-' };
  });
  if (req.user.role !== 'admin') rows = rows.filter(r => r.user_id === req.user.id);
  rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json(rows);
});

/* Only admins may add students to events. The student is chosen explicitly. */
app.post('/api/registrations', authMiddleware, adminOnly, (req, res) => {
  try {
    const { event_id, user_id } = req.body;
    const event = DB.events.find(e => e.id === event_id);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    const student = DB.users.find(u => u.id == user_id && u.role === 'student');
    if (!student) return res.status(404).json({ error: 'Student not found' });
    const cnt = DB.registrations.filter(r => r.event_id === event_id).length;
    if (cnt >= event.seats) return res.status(400).json({ error: 'No seats left' });
    const already = DB.registrations.find(r => r.user_id === student.id && r.event_id === event_id);
    if (already) return res.status(400).json({ error: 'This student is already registered for this event' });
    const paid = event.paid ? 0 : 1; // free events auto-paid
    const reg = { id: nextId(DB.registrations), user_id: student.id, event_id: event_id, paid, created_at: new Date().toISOString() };
    DB.registrations.push(reg); saveDB();
    io.emit('data_changed', { type: 'registration', action: 'added', data: reg });
    res.json({ id: reg.id, user_id: reg.user_id, event_id: reg.event_id, paid: !!reg.paid, username: student.username });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

/* ---------- self-registration: students sign up for events themselves ---------- */
app.post('/api/registrations/self', authMiddleware, (req, res) => {
  try {
    const eventId = parseInt(req.body.event_id, 10);
    const event = DB.events.find(e => e.id === eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    const user = DB.users.find(u => u.id === req.user.id);
    if (!user || roleOf(user) !== 'student') return res.status(403).json({ error: 'Only students can register for events' });
    const cnt = DB.registrations.filter(r => r.event_id === event.id).length;
    if (cnt >= event.seats) return res.status(400).json({ error: 'No seats left' });
    const already = DB.registrations.find(r => r.user_id === user.id && r.event_id === event.id);
    if (already) return res.status(400).json({ error: 'You are already registered for this event' });
    const paid = event.paid ? 0 : 1; // free events auto-paid
    const reg = { id: nextId(DB.registrations), user_id: user.id, event_id: event.id, paid, created_at: new Date().toISOString() };
    DB.registrations.push(reg); saveDB();
    io.emit('data_changed', { type: 'registration', action: 'added', data: reg });
    res.json({ id: reg.id, user_id: reg.user_id, event_id: reg.event_id, paid: !!reg.paid, username: user.username });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/registrations/:id', authMiddleware, adminOnly, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const reg = DB.registrations.find(r => r.id === id);
  if (!reg) return res.status(404).json({ error: 'Registration not found' });
  if (req.user.role !== 'admin' && reg.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
  DB.registrations = DB.registrations.filter(r => r.id !== id);
  saveDB();
  io.emit('data_changed', { type: 'registration', action: 'deleted', id: id });
  res.json({ ok: true });
});

/* ---------- messages (REST) ---------- */
app.get('/api/messages/:eventId', authMiddleware, (req, res) => {
  const eventId = parseInt(req.params.eventId, 10);
  const rows = DB.messages.filter(m => m.event_id === eventId).map(m => {
    const u = DB.users.find(x => x.id === m.sender_id);
    return { id: m.id, message: m.message, created_at: m.created_at, sender_id: m.sender_id,
      username: u ? u.username : '?', enrollment_no: u ? u.enrollment_no : '-', role: u ? u.role : 'student' };
  }).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  res.json(rows);
});

app.post('/api/messages', authMiddleware, (req, res) => {
  try {
    const { event_id, message } = req.body;
    if (!message || !message.trim()) return res.status(400).json({ error: 'Empty message' });
    const event = DB.events.find(e => e.id === event_id);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (req.user.role !== 'admin') {
      const reg = DB.registrations.find(r => r.user_id === req.user.id && r.event_id === event_id);
      if (!reg) return res.status(403).json({ error: 'You are not registered for this event' });
    }
    const msg = { id: nextId(DB.messages), event_id, sender_id: req.user.id, message: message.trim(), created_at: new Date().toISOString() };
    DB.messages.push(msg); saveDB();
    const row = { id: msg.id, message: msg.message, created_at: msg.created_at, sender_id: msg.sender_id,
      username: req.user.username, enrollment_no: req.user.username, role: req.user.role };
    io.to('event_' + event_id).emit('new_message', row);
    res.json(row);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

/* ---------- socket.io (real-time chat) ---------- */
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', credentials: true }, transports: ['websocket', 'polling'] });

io.use((socket, next) => {
  const token = socket.handshake.auth?.token
    || (socket.handshake.headers['authorization'] || '').replace('Bearer ', '');
  if (!token) return next(new Error('Authentication required'));
  try {
    socket.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) { return next(new Error('Invalid token')); }
});

io.on('connection', (socket) => {
  socket.on('join_event', (eventId) => { socket.join('event_' + eventId); });
  socket.on('leave_event', (eventId) => { socket.leave('event_' + eventId); });
  socket.on('disconnect', () => {});
});

/* ---------- serve frontend ---------- */
app.use(express.static(path.join(__dirname, '../web')));
app.get('*', (req, res) => { res.sendFile(path.join(__dirname, '../web/index.html')); });

server.listen(PORT, () => {
  console.log(`College Event backend running on http://localhost:${PORT}`);
});
