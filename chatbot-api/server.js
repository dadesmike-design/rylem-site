import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { SYSTEM_PROMPT } from './system-prompt.js';
import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { notifyTeam } from './notifications.js';
import { logVisit } from './visitor-tracker.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.CHATBOT_PORT || 3847;

// --- Gemini API key (from openclaw config) ---
import { readFileSync as readSync } from 'fs';
const GEMINI_KEY = process.env.GEMINI_API_KEY || (() => {
  try {
    const raw = readSync('/Users/mikedades/.openclaw/openclaw.json', 'utf8');
    const match = raw.match(/"GEMINI_API_KEY"\s*:\s*"([^"]+)"/);
    return match ? match[1] : '';
  } catch { return ''; }
})();

const genAI = new GoogleGenerativeAI(GEMINI_KEY);

// --- Safety: input sanitization ---
const MAX_MESSAGE_LENGTH = 1000;
const MAX_HISTORY_LENGTH = 20;
const BLOCKED_PATTERNS = [
  /ignore\s+(previous|prior|above|all)\s+(instructions|prompts|rules)/i,
  /system\s*prompt/i,
  /you\s+are\s+now/i,
  /pretend\s+(you('re|are)|to\s+be)/i,
  /act\s+as\s+(if|a|an|though)/i,
  /roleplay/i,
  /jailbreak/i,
  /DAN\s*mode/i,
  /developer\s*mode/i,
  /bypass/i,
  /override\s+(your|the|all)/i,
  /new\s+instructions/i,
  /forget\s+(everything|your|all|previous)/i,
  /disregard/i,
  /<\/?script/i,
  /javascript:/i,
  /on(error|load|click)\s*=/i,
];

function isMalicious(text) {
  return BLOCKED_PATTERNS.some(p => p.test(text));
}

function sanitize(text) {
  if (typeof text !== 'string') return '';
  return text.slice(0, MAX_MESSAGE_LENGTH).replace(/[<>]/g, '');
}

// --- Logging ---
const LOG_DIR = join(__dirname, 'logs');
if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR);

function logConversation(sessionId, role, content, flagged = false) {
  const ts = new Date().toISOString();
  const line = JSON.stringify({ ts, sessionId, role, content: content.slice(0, 500), flagged }) + '\n';
  const logFile = join(LOG_DIR, `${new Date().toISOString().slice(0, 10)}.jsonl`);
  try { appendFileSync(logFile, line); } catch {}
}

// --- Express setup ---
const app = express();

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: ['http://localhost:3847', 'https://rylem.com', 'https://www.rylem.com', 'https://chat.rylem.com', 'https://dadesmike-design.github.io'],
  methods: ['POST', 'GET'],
}));

app.use(express.json({ limit: '10kb' }));

// Trust Cloudflare proxy for real visitor IPs
app.set('trust proxy', true);

// Track every visitor that hits the chat API
app.use('/api/chat', (req, res, next) => {
  const ip = req.headers['cf-connecting-ip'] || req.ip || 'unknown';
  const page = req.headers['referer'] || 'direct';
  const ua = req.headers['user-agent'] || '';
  logVisit(ip, page, ua, req.headers['referer']);
  next();
});

// Lightweight tracking pixel for non-chat pages
app.get('/t.gif', (req, res) => {
  const ip = req.headers['cf-connecting-ip'] || req.ip || 'unknown';
  const page = req.query.p || req.headers['referer'] || 'unknown';
  const ua = req.headers['user-agent'] || '';
  logVisit(ip, page, ua, req.headers['referer']);
  // 1x1 transparent GIF
  const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  res.set({ 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' });
  res.send(gif);
});

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  message: { error: 'Too many requests. Please wait a moment.' },
});
app.use('/api/chat', limiter);

// --- Session store ---
const sessions = new Map();
const SESSION_TTL = 30 * 60 * 1000;

function getSession(id) {
  const s = sessions.get(id);
  if (s && Date.now() - s.lastActive < SESSION_TTL) {
    s.lastActive = Date.now();
    return s;
  }
  const newSession = { history: [], lastActive: Date.now() };
  sessions.set(id, newSession);
  return newSession;
}

setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (now - s.lastActive > SESSION_TTL) sessions.delete(id);
  }
}, 5 * 60 * 1000);

// --- Chat endpoint ---
app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required.' });
    }

    const cleanMessage = sanitize(message);
    const sid = typeof sessionId === 'string' ? sessionId.slice(0, 64) : 'anon';

    // Check for malicious input
    if (isMalicious(cleanMessage)) {
      logConversation(sid, 'user', cleanMessage, true);
      const deflection = "I'm here to help with staffing needs. How can I connect you with the right person at Rylem?";
      logConversation(sid, 'assistant', deflection, true);
      return res.json({ reply: deflection, flagged: true });
    }

    const session = getSession(sid);
    logConversation(sid, 'user', cleanMessage);

    // Build Gemini chat
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: SYSTEM_PROMPT,
    });

    const chat = model.startChat({
      history: session.history.slice(-MAX_HISTORY_LENGTH),
    });

    const result = await chat.sendMessage(cleanMessage);
    const reply = result.response.text() || "I'm sorry, I'm having trouble right now. Please try again or call us at (206) 777-7990.";

    // Update session history
    session.history.push(
      { role: 'user', parts: [{ text: cleanMessage }] },
      { role: 'model', parts: [{ text: reply }] }
    );

    if (session.history.length > MAX_HISTORY_LENGTH * 2) {
      session.history = session.history.slice(-MAX_HISTORY_LENGTH * 2);
    }

    logConversation(sid, 'assistant', reply);

    // Check if visitor shared contact info → auto-notify team
    checkAndNotify(session, sid);

    res.json({ reply });
  } catch (err) {
    console.error('Chat error:', err.message);
    res.status(500).json({
      error: "I'm experiencing a temporary issue. Please call us at (206) 777-7990 or email info@rylem.com.",
    });
  }
});

// --- Lead capture endpoint ---
app.post('/api/lead', async (req, res) => {
  try {
    const { name, company, email, phone, role, notes, type, contactPref, chatSummary } = req.body;
    const lead = {
      ts: new Date().toISOString(),
      name: sanitize(name || ''),
      company: sanitize(company || ''),
      email: sanitize(email || ''),
      phone: sanitize(phone || ''),
      role: sanitize(role || ''),
      notes: sanitize(notes || ''),
      type: type === 'candidate' ? 'candidate' : 'client',
      contactPref: sanitize(contactPref || ''),
      chatSummary: (chatSummary || '').slice(0, 2000),
    };

    const leadsFile = join(__dirname, 'logs', 'leads.jsonl');
    appendFileSync(leadsFile, JSON.stringify(lead) + '\n');

    // INSTANT notifications — Telegram + Email to team
    notifyTeam(lead).then(results => {
      console.log('Notifications sent:', results);
    }).catch(err => {
      console.error('Notification error:', err.message);
    });

    res.json({ success: true, message: 'Someone from our team will be reaching out to you shortly.' });
  } catch (err) {
    console.error('Lead capture error:', err.message);
    res.status(500).json({ error: 'Could not save your information. Please email info@rylem.com directly.' });
  }
});

// --- Auto-detect contact info in chat and trigger lead capture ---
function extractContactInfo(text) {
  const phone = text.match(/(\+?1?\s?[-.(]?\d{3}[-.)]\s?\d{3}[-.]?\d{4})/);
  const email = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
  return { phone: phone ? phone[1] : null, email: email ? email[1] : null };
}

function hasContactInfo(messages) {
  for (const m of messages) {
    if (m.role === 'user') {
      const info = extractContactInfo(m.parts[0].text);
      if (info.phone || info.email) return info;
    }
  }
  return null;
}

// Check after each chat response if we have enough to notify
function checkAndNotify(session, sid) {
  if (session.notified) return; // already sent notification for this session

  const contact = hasContactInfo(session.history);
  if (!contact) return;

  // Build lead from chat history
  const userMessages = session.history
    .filter(m => m.role === 'user')
    .map(m => m.parts[0].text);

  const chatSummary = session.history
    .map(m => `${m.role === 'user' ? 'Visitor' : 'Rylem AI'}: ${m.parts[0].text}`)
    .join('\n');

  // Try to detect if client or candidate
  const allText = userMessages.join(' ').toLowerCase();
  const isCandidate = /looking for.*(job|role|work|position|opportunity)|my resume|job seeker|career|applying|open.*position|job.*opening/i.test(allText);
  const isHiringManager = /need.*hire|looking to hire|hire.*talent|hire.*engineer|hire.*developer|hire.*contractor|staffing|scale.*team|need contractors|looking for.*staff|we're hiring|we are hiring|sap migration|team is drowning/i.test(allText);
  // If clearly a candidate → candidate. If hiring intent or unclear → client (treat all non-candidates as potential business).
  const type = isCandidate && !isHiringManager ? 'candidate' : 'client';

  // Extract name (if they said "I'm [name]" or "my name is [name]")
  let name = '';
  for (const msg of userMessages) {
    const nameMatch = msg.match(/(?:my name is|i'm|i am|this is)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/i);
    if (nameMatch) { name = nameMatch[1]; break; }
  }

  const lead = {
    ts: new Date().toISOString(),
    name,
    company: '',
    email: contact.email || '',
    phone: contact.phone || '',
    role: '',
    notes: `Auto-captured from chat session ${sid}`,
    type,
    contactPref: contact.phone ? 'text/phone' : 'email',
    chatSummary,
  };

  // Save and notify
  const leadsFile = join(__dirname, 'logs', 'leads.jsonl');
  appendFileSync(leadsFile, JSON.stringify(lead) + '\n');

  notifyTeam(lead).then(results => {
    console.log(`Auto-capture lead notification sent for session ${sid}:`, results);
  }).catch(err => {
    console.error('Auto-capture notification error:', err.message);
  });

  session.notified = true;
}

// --- Serve test page ---
app.use(express.static(join(__dirname, 'public')));

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Rylem chatbot test server running on http://localhost:${PORT}`);
});
