#!/usr/bin/env node
/**
 * rc-call-monitor.js
 * RingCentral Real-Time Call Monitor for SolveWorks
 *
 * Flow:
 *   JWT Auth → WebSocket Subscription → Detect Call End →
 *   Poll for Recording → Download MP3 → Whisper Transcription →
 *   GPT-4o Scoring → Telegram Alert (if flagged) → Update Data Files
 */

'use strict';


// Read credentials from .env file (security fix - no hardcoded creds)
const __fs = require('fs');
const __envContent = __fs.readFileSync('/Users/mikedades/clawd/.env', 'utf8');
__envContent.split('\n').forEach(line => {
  const idx = line.indexOf('=');
  if (idx > 0 && !line.startsWith('#')) {
    process.env[line.substring(0, idx).trim()] = line.substring(idx + 1).trim();
  }
});

const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Load ws — fail fast with clear message if not installed
let WebSocket;
try {
  WebSocket = require('ws');
} catch (e) {
  const msg = 'FATAL: ws package not installed. Run: npm install ws\n';
  process.stderr.write(msg);
  process.exit(1);
}

// ============================================================
// CONFIGURATION
// ============================================================

const CONFIG = {
  rc: {
    clientId:     process.env.RINGCENTRAL_APP_KEY,
    clientSecret: process.env.RINGCENTRAL_APP_SECRET,
    jwtToken: process.env.RINGCENTRAL_JWT,
    apiHost:   'platform.ringcentral.com',
    mediaHost: 'media.ringcentral.com',
    accountId: '316428040',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },
  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID,
  },
  data: {
    recordingsDir: '/Users/mikedades/.openclaw/workspace/data/recordings',
    scoresFile:    '/Users/mikedades/.openclaw/workspace/data/call-scores.json',
    analysesFile:  '/Users/mikedades/.openclaw/workspace/data/call-analyses.json',
  },
  logFile: '/tmp/rc-monitor.log',

  // Thresholds
  minCallDurationSecs:    30,
  recordingPollIntervalMs: 30_000,   // 30s between polls
  recordingPollMaxMs:    300_000,    // 5 min total
  wsReconnectInitialMs:    30_000,
  wsReconnectMaxMs:      300_000,    // 5 min max backoff
  subscriptionRenewBeforeSecs: 300,  // renew 5 min before expiry
  subscriptionExpiresIn: 86400,      // 24h
};

// RC event filters to subscribe to
const EVENT_FILTERS = [
  `/restapi/v1.0/account/~/telephony/sessions`,
];

// ============================================================
// LOGGER
// ============================================================

const logStream = (() => {
  try {
    return fs.createWriteStream(CONFIG.logFile, { flags: 'a' });
  } catch (e) {
    return process.stderr;
  }
})();

function log(level, ...args) {
  const ts = new Date().toISOString();
  const parts = args.map(a => {
    if (a instanceof Error) return `${a.message}\n${a.stack}`;
    if (typeof a === 'object') return JSON.stringify(a);
    return String(a);
  });
  const line = `[${ts}] [${level}] ${parts.join(' ')}\n`;
  logStream.write(line);
}

const logger = {
  info:  (...a) => log('INFO',  ...a),
  warn:  (...a) => log('WARN',  ...a),
  error: (...a) => log('ERROR', ...a),
  debug: (...a) => log('DEBUG', ...a),
};

// ============================================================
// UTILITIES
// ============================================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function loadJson(filePath, defaultValue) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (e) {
    logger.error(`loadJson failed for ${filePath}:`, e.message);
  }
  return defaultValue;
}

function saveJson(filePath, data) {
  try {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    logger.error(`saveJson failed for ${filePath}:`, e.message);
  }
}

function appendToJsonArray(filePath, item) {
  const arr = loadJson(filePath, []);
  arr.push(item);
  saveJson(filePath, arr);
}

function formatDuration(seconds) {
  if (!seconds) return 'unknown';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ============================================================
// HTTP HELPERS
// ============================================================

/**
 * Make an HTTPS request and return { status, headers, body }.
 * body is parsed as JSON if possible, otherwise raw string.
 * Throws on HTTP 4xx/5xx.
 */
function httpsRequest(options, bodyBuf = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const raw = Buffer.concat(chunks);
        const text = raw.toString('utf8');
        let parsed;
        try { parsed = JSON.parse(text); } catch { parsed = text; }
        if (res.statusCode >= 400) {
          const err = new Error(`HTTP ${res.statusCode}: ${text.substring(0, 400)}`);
          err.statusCode = res.statusCode;
          err.response = parsed;
          return reject(err);
        }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });
    req.on('error', reject);
    if (bodyBuf) req.write(bodyBuf);
    req.end();
  });
}

/**
 * Download a binary file from url to destPath, following redirects.
 * Uses Bearer token auth.
 */
function downloadBinary(url, destPath, token) {
  return new Promise((resolve, reject) => {
    const follow = (currentUrl, depth) => {
      if (depth > 5) return reject(new Error('Too many redirects'));
      let urlObj;
      try { urlObj = new URL(currentUrl); } catch (e) { return reject(e); }

      const req = https.request({
        hostname: urlObj.hostname,
        path:     urlObj.pathname + urlObj.search,
        method:   'GET',
        headers:  { Authorization: `Bearer ${token}` },
      }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
          return follow(res.headers.location, depth + 1);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`Download HTTP ${res.statusCode} from ${currentUrl}`));
        }
        ensureDir(path.dirname(destPath));
        const file = fs.createWriteStream(destPath);
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve(destPath)));
        file.on('error', (e) => { fs.unlink(destPath, () => {}); reject(e); });
      });
      req.on('error', reject);
      req.end();
    };
    follow(url, 0);
  });
}

// ============================================================
// RINGCENTRAL AUTH
// ============================================================

const rcToken = {
  value:   null,
  expiry:  0,   // ms timestamp
};

async function rcRefreshToken() {
  const creds = Buffer.from(`${CONFIG.rc.clientId}:${CONFIG.rc.clientSecret}`).toString('base64');
  const body  = Buffer.from(
    `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer` +
    `&assertion=${encodeURIComponent(CONFIG.rc.jwtToken)}`
  );

  const res = await httpsRequest({
    hostname: CONFIG.rc.apiHost,
    path:     '/restapi/oauth/token',
    method:   'POST',
    headers:  {
      Authorization:   `Basic ${creds}`,
      'Content-Type':  'application/x-www-form-urlencoded',
      'Content-Length': body.length,
    },
  }, body);

  rcToken.value  = res.body.access_token;
  rcToken.expiry = Date.now() + (res.body.expires_in - 120) * 1000; // 2min safety buffer
  logger.info(`RC token refreshed, expires in ${res.body.expires_in}s`);
}

async function rcEnsureToken() {
  if (!rcToken.value || Date.now() >= rcToken.expiry) {
    await rcRefreshToken();
  }
  return rcToken.value;
}

// Schedule periodic token refresh so it never expires mid-session
// Token is 1h; we'll refresh every 55 minutes
setInterval(async () => {
  try {
    await rcRefreshToken();
  } catch (e) {
    logger.error('Periodic token refresh failed:', e.message);
  }
}, 55 * 60 * 1000); // kept ref'd

// ============================================================
// RINGCENTRAL API
// ============================================================

/**
 * Make an authenticated RC REST API call with retry on 401/429.
 */
async function rcApi(method, apiPath, body = null, attempt = 0) {
  const token = await rcEnsureToken();
  const bodyBuf = body ? Buffer.from(JSON.stringify(body)) : null;

  try {
    return await httpsRequest({
      hostname: CONFIG.rc.apiHost,
      path:     apiPath,
      method,
      headers: {
        Authorization:   `Bearer ${token}`,
        'Content-Type':  'application/json',
        'Accept':        'application/json',
        ...(bodyBuf ? { 'Content-Length': bodyBuf.length } : {}),
      },
    }, bodyBuf);
  } catch (e) {
    if (e.statusCode === 401 && attempt < 2) {
      logger.warn('RC 401, refreshing token and retrying...');
      await rcRefreshToken();
      return rcApi(method, apiPath, body, attempt + 1);
    }
    if (e.statusCode === 429 && attempt < 2) {
      logger.warn('RC rate limited (429), waiting 65s...');
      await sleep(65_000);
      return rcApi(method, apiPath, body, attempt + 1);
    }
    throw e;
  }
}

// ============================================================
// RINGCENTRAL SUBSCRIPTION MANAGEMENT
// ============================================================

const subscription = {
  id:            null,
  expiresAt:     0,
  renewalTimer:  null,
  wsUrl:         null,
};

async function rcCreateSubscription() {
  const res = await rcApi('POST', '/restapi/v1.0/subscription', {
    eventFilters: EVENT_FILTERS,
    deliveryMode: {
      transportType: 'WebSocket',
      encryption:    false,
    },
    expiresIn: CONFIG.subscriptionExpiresIn,
  });

  subscription.id        = res.body.id;
  subscription.expiresAt = Date.now() + (res.body.expiresIn || CONFIG.subscriptionExpiresIn) * 1000;
  subscription.wsUrl     = res.body.deliveryMode && res.body.deliveryMode.address;

  logger.info(`Subscription created: ${subscription.id}`);
  logger.info(`WebSocket URL: ${subscription.wsUrl}`);

  scheduleRenewal(res.body.expiresIn || CONFIG.subscriptionExpiresIn);
  return subscription;
}

function scheduleRenewal(expiresIn) {
  if (subscription.renewalTimer) clearTimeout(subscription.renewalTimer);
  const renewIn = Math.max(10_000, (expiresIn - CONFIG.subscriptionRenewBeforeSecs) * 1000);
  logger.info(`Subscription renewal scheduled in ${Math.round(renewIn / 60000)}min`);
  subscription.renewalTimer = setTimeout(async () => {
    try {
      await rcRenewSubscription();
    } catch (e) {
      logger.error('Subscription renewal failed:', e.message);
      // WS manager will handle reconnect
    }
  }, renewIn);
  subscription.renewalTimer.unref();
}

async function rcRenewSubscription() {
  if (!subscription.id) return;
  const res = await rcApi('PUT', `/restapi/v1.0/subscription/${subscription.id}`, {
    eventFilters: EVENT_FILTERS,
    expiresIn:    CONFIG.subscriptionExpiresIn,
  });
  const expiresIn = res.body.expiresIn || CONFIG.subscriptionExpiresIn;
  subscription.expiresAt = Date.now() + expiresIn * 1000;
  logger.info(`Subscription renewed, expires in ${expiresIn}s`);
  scheduleRenewal(expiresIn);
}

async function rcDeleteSubscription() {
  if (!subscription.id) return;
  if (subscription.renewalTimer) {
    clearTimeout(subscription.renewalTimer);
    subscription.renewalTimer = null;
  }
  try {
    await rcApi('DELETE', `/restapi/v1.0/subscription/${subscription.id}`);
    logger.info('Subscription deleted');
  } catch (e) {
    logger.warn('Failed to delete subscription:', e.message);
  }
  subscription.id = null;
}

// ============================================================
// RINGCENTRAL CALL LOG / RECORDING POLLING
// ============================================================

/**
 * Poll call log for a session until a recording is found or deadline hit.
 */
async function pollForRecording(sessionId, sessionStartIso) {
  const deadline = Date.now() + CONFIG.recordingPollMaxMs;
  let attempt = 0;

  // Wait before first poll — recording takes time to process
  logger.info(`Waiting 15s before first poll for session ${sessionId}...`);
  await sleep(15_000);

  while (Date.now() < deadline) {
    attempt++;
    logger.info(`Polling call log for recording (attempt ${attempt}): session=${sessionId}`);

    try {
      // Search call log by sessionId
      const qs = new URLSearchParams({
        sessionId,
        view:          'Detailed',
        recordingType: 'All',
        perPage:       '10',
      });
      const res = await rcApi('GET', `/restapi/v1.0/account/~/call-log?${qs}`);
      const records = res.body.records || [];

      for (const record of records) {
        if (record.recording && record.recording.id) {
          logger.info(`Recording found: id=${record.recording.id}, uri=${record.recording.contentUri}`);
          return {
            id:          record.recording.id,
            contentUri:  record.recording.contentUri,
            duration:    record.duration,
            from:        record.from,
            to:          record.to,
            direction:   record.direction,
            startTime:   record.startTime,
          };
        }
      }

      if (records.length > 0) {
        logger.info(`Call log found (${records.length} records) but no recording yet...`);
      } else {
        logger.info(`Call log not found yet for session ${sessionId}...`);
      }
    } catch (e) {
      logger.warn(`Poll attempt ${attempt} error:`, e.message);
    }

    await sleep(CONFIG.recordingPollIntervalMs);
  }

  logger.warn(`Recording not found for session ${sessionId} after ${CONFIG.recordingPollMaxMs / 1000}s`);
  return null;
}

async function downloadRecording(recordingId, contentUri) {
  const token   = await rcEnsureToken();
  const url     = contentUri ||
    `https://${CONFIG.rc.mediaHost}/restapi/v1.0/account/${CONFIG.rc.accountId}/recording/${recordingId}/content`;
  const outPath = path.join(CONFIG.data.recordingsDir, `${recordingId}.mp3`);

  if (fs.existsSync(outPath)) {
    logger.info(`Recording ${recordingId} already on disk, skipping download`);
    return outPath;
  }

  logger.info(`Downloading recording ${recordingId}...`);
  await downloadBinary(url, outPath, token);
  logger.info(`Saved to ${outPath} (${Math.round(fs.statSync(outPath).size / 1024)}KB)`);
  return outPath;
}

// ============================================================
// OPENAI — WHISPER TRANSCRIPTION
// ============================================================

async function transcribeRecording(filePath, attempt = 0) {
  const stats = fs.statSync(filePath);
  if (stats.size === 0) throw new Error('Recording file is empty');
  if (stats.size > 24 * 1024 * 1024) {
    throw new Error(`File too large for Whisper: ${Math.round(stats.size / 1024 / 1024)}MB (max 24MB)`);
  }

  const fileData = fs.readFileSync(filePath);
  const filename = path.basename(filePath);
  const boundary = `----FormBoundary${crypto.randomBytes(16).toString('hex')}`;

  // Build multipart body manually (no form-data package needed)
  const preamble = Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
    `Content-Type: audio/mpeg\r\n\r\n`
  );
  const modelPart = Buffer.from(
    `\r\n--${boundary}\r\n` +
    `Content-Disposition: form-data; name="model"\r\n\r\n` +
    `whisper-1\r\n` +
    `--${boundary}--\r\n`
  );
  const bodyBuf = Buffer.concat([preamble, fileData, modelPart]);

  logger.info(`Transcribing ${filename} (${Math.round(stats.size / 1024)}KB)...`);

  try {
    const res = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'api.openai.com',
        path:     '/v1/audio/transcriptions',
        method:   'POST',
        headers:  {
          Authorization:   `Bearer ${CONFIG.openai.apiKey}`,
          'Content-Type':  `multipart/form-data; boundary=${boundary}`,
          'Content-Length': bodyBuf.length,
        },
      }, (res) => {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          if (res.statusCode !== 200) {
            const err = new Error(`Whisper HTTP ${res.statusCode}: ${text.substring(0, 300)}`);
            err.statusCode = res.statusCode;
            return reject(err);
          }
          try {
            resolve(JSON.parse(text));
          } catch {
            reject(new Error(`Whisper response not JSON: ${text.substring(0, 200)}`));
          }
        });
      });
      req.on('error', reject);
      req.write(bodyBuf);
      req.end();
    });

    const transcript = res.text || '';
    logger.info(`Transcript (${transcript.length} chars): ${transcript.substring(0, 120)}...`);
    return transcript;

  } catch (e) {
    if (attempt < 1) {
      logger.warn(`Whisper failed, retrying in 5s: ${e.message}`);
      await sleep(5_000);
      return transcribeRecording(filePath, attempt + 1);
    }
    throw e;
  }
}

// ============================================================
// OPENAI — GPT-4o SCORING
// ============================================================

async function scoreCall(transcript, callInfo) {
  const prompt = `You are a call quality analyst for a professional recruiting firm. Analyze this transcript and return a JSON evaluation.

CALL INFORMATION:
- Duration: ${callInfo.duration || 'unknown'} seconds
- Direction: ${callInfo.direction || 'unknown'}
- From: ${callInfo.from?.name || callInfo.from?.phoneNumber || 'unknown'}
- To: ${callInfo.to?.name || callInfo.to?.phoneNumber || 'unknown'}
- Start: ${callInfo.startTime || 'unknown'}

TRANSCRIPT:
"""
${transcript.substring(0, 8000)}
"""

Return ONLY a valid JSON object with this exact structure (no markdown, no explanation):
{
  "isVoicemail": false,
  "voicemailReason": null,
  "callerName": "Name or Unknown",
  "company": "Company or Unknown",
  "recruiter": "Recruiter name or Unknown",
  "scores": {
    "professionalism": 7,
    "pitchQuality": 6,
    "informationGathering": 8,
    "followUpCommitment": 7,
    "compliance": 9
  },
  "averageScore": 7.4,
  "flags": [],
  "summary": "2-3 sentence factual summary of what happened on the call.",
  "nextSteps": "Description of agreed follow-up, or null"
}

VOICEMAIL DETECTION — set isVoicemail: true if ANY of these apply:
- No real two-way conversation (only one speaker)
- Contains voicemail greeting ("You've reached...", "Please leave a message...", "after the beep", etc.)
- Automated system response or IVR menu
- Phone number readback with no conversation
- Transcript is essentially empty or just ambient noise described
- Call is entirely one-sided (someone leaving a voicemail message)

SCORING CRITERIA (1-10):
- professionalism: Tone, language, proper greeting and close
- pitchQuality: How effectively the recruiter presented the opportunity
- informationGathering: Quality of information gathering from candidate/client
- followUpCommitment: Whether clear next steps were established
- compliance: Regulatory compliance, proper disclosures, no misleading statements

FLAGS — include the exact string key if triggered:
- "angryCaller" — caller expressed anger, frustration, or hostility
- "complianceConcern" — any compliance, legal, or regulatory issue detected
- "noNextSteps" — no follow-up or next steps established by end of call
- "missedFollowup" — a previously promised follow-up was evidently missed
- "poorPitch" — pitchQuality score is below 4
- "clientEscalation" — client threatened to escalate, complained to management, etc.
- "candidateComplaint" — candidate complained about the service, recruiter, or firm
- "lowOverallScore" — averageScore is below 5

Return ONLY the JSON object.`;

  const bodyBuf = Buffer.from(JSON.stringify({
    model:           'gpt-4o',
    messages:        [{ role: 'user', content: prompt }],
    temperature:     0.1,
    max_tokens:      1200,
    response_format: { type: 'json_object' },
  }));

  const res = await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.openai.com',
      path:     '/v1/chat/completions',
      method:   'POST',
      headers:  {
        Authorization:   `Bearer ${CONFIG.openai.apiKey}`,
        'Content-Type':  'application/json',
        'Content-Length': bodyBuf.length,
      },
    }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode !== 200) {
          const err = new Error(`GPT-4o HTTP ${res.statusCode}: ${text.substring(0, 300)}`);
          err.statusCode = res.statusCode;
          return reject(err);
        }
        try {
          const parsed = JSON.parse(text);
          const content = parsed.choices[0].message.content;
          resolve(JSON.parse(content));
        } catch (e) {
          reject(new Error(`GPT-4o parse error: ${text.substring(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(bodyBuf);
    req.end();
  });

  return res;
}

// ============================================================
// VOICEMAIL PRE-FILTER (fast, before calling GPT)
// ============================================================

const VM_PHRASES = [
  "you've reached the voicemail",
  "you have reached the voicemail",
  "please leave a message",
  "leave your message after the",
  "after the beep",
  "after the tone",
  "not available to take your call",
  "is not available right now",
  "no one is available",
  "mailbox is full",
  "your call has been forwarded",
  "we are unable to take your call",
  "the number you have dialed",
  "please hold while we connect",
  "this voicemail box",
  "record your message",
  "hang up and try again",
];

function preFilterVoicemail(transcript, durationSecs) {
  // Too short
  if (durationSecs != null && durationSecs < CONFIG.minCallDurationSecs) {
    return { isVoicemail: true, reason: `Duration too short (${durationSecs}s)` };
  }
  // Empty or near-empty transcript
  if (!transcript || transcript.trim().length < 10) {
    return { isVoicemail: true, reason: 'Transcript empty or too short' };
  }
  const lower = transcript.toLowerCase();
  for (const phrase of VM_PHRASES) {
    if (lower.includes(phrase)) {
      return { isVoicemail: true, reason: `Voicemail phrase: "${phrase}"` };
    }
  }
  return { isVoicemail: false };
}

// ============================================================
// TELEGRAM ALERTING
// ============================================================

async function sendTelegramMessage(text, attempt = 0) {
  const bodyBuf = Buffer.from(JSON.stringify({
    chat_id:    CONFIG.telegram.chatId,
    text,
    parse_mode: 'HTML',
  }));

  try {
    await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'api.telegram.org',
        path:     `/bot${CONFIG.telegram.token}/sendMessage`,
        method:   'POST',
        headers:  {
          'Content-Type':  'application/json',
          'Content-Length': bodyBuf.length,
        },
      }, (res) => {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          if (res.statusCode !== 200) {
            return reject(new Error(`Telegram HTTP ${res.statusCode}: ${text.substring(0, 200)}`));
          }
          resolve();
        });
      });
      req.on('error', reject);
      req.write(bodyBuf);
      req.end();
    });
    logger.info('Telegram alert sent successfully');
  } catch (e) {
    if (attempt < 1) {
      logger.warn(`Telegram send failed, retrying in 3s: ${e.message}`);
      await sleep(3_000);
      return sendTelegramMessage(text, attempt + 1);
    }
    logger.error('Telegram send failed after retry:', e.message);
    // Don't throw — non-fatal
  }
}

const FLAG_LABELS = {
  angryCaller:        '😤 Angry Caller',
  complianceConcern:  '⚖️ Compliance',
  noNextSteps:        '📅 No Next Steps',
  missedFollowup:     '❌ Missed Follow-up',
  poorPitch:          '📉 Poor Pitch',
  clientEscalation:   '🔺 Client Escalation',
  candidateComplaint: '😠 Candidate Complaint',
  lowOverallScore:    '⚠️ Low Score',
};

function buildAlertMessage(scoring, callInfo) {
  const flags   = (scoring.flags || []).map(f => FLAG_LABELS[f] || f).join(', ');
  const avg     = scoring.averageScore != null ? Number(scoring.averageScore).toFixed(1) : '?';
  const dur     = formatDuration(callInfo.duration);
  const caller  = escapeHtml(scoring.callerName || 'Unknown');
  const company = escapeHtml(scoring.company    || 'Unknown');
  const recruit = escapeHtml(scoring.recruiter  || 'Unknown');
  const summary = escapeHtml(scoring.summary    || 'No summary available.');

  return (
    `🚨 <b>Flagged Call — ${caller} (${company})</b>\n` +
    `Score: ${avg}/10 | Flags: ${flags}\n` +
    `Duration: ${dur} | Recruiter: ${recruit}\n` +
    `Summary: ${summary}`
  );
}

// ============================================================
// CALL PROCESSOR — orchestrates a single call end-to-end
// ============================================================

const processedSessions = new Set();

async function processCallEnd(sessionData) {
  const { sessionId, startTime, endTime, parties } = sessionData;

  // Deduplicate
  if (processedSessions.has(sessionId)) {
    logger.debug(`Session ${sessionId} already processed`);
    return;
  }
  processedSessions.add(sessionId);

  // Compute duration from event timestamps (approximate)
  let durationSecs = null;
  if (startTime && endTime) {
    durationSecs = Math.round((new Date(endTime) - new Date(startTime)) / 1000);
  }

  // Extract initial call info
  const firstParty = parties.find(p => p.direction === 'Inbound') || parties[0] || {};
  let callInfo = {
    sessionId,
    from:      firstParty.from  || {},
    to:        firstParty.to    || {},
    direction: firstParty.direction || 'Unknown',
    duration:  durationSecs,
    startTime,
    endTime,
  };

  logger.info(`=== Processing session ${sessionId} (est. ${durationSecs}s) ===`);

  // Quick duration check before spending API calls
  if (durationSecs !== null && durationSecs < CONFIG.minCallDurationSecs) {
    logger.info(`Session ${sessionId}: too short (${durationSecs}s), skipping`);
    return;
  }

  // Look for recording ID already embedded in session event
  let embeddedRecordingId = null;
  for (const party of parties) {
    if (party.recordings && party.recordings.length > 0) {
      const rec = party.recordings.find(r => r.id && !r.active) || party.recordings[0];
      if (rec && rec.id) {
        embeddedRecordingId = rec.id;
        break;
      }
    }
  }

  // Get full recording info (with contentUri, actual duration, etc.)
  let recInfo;
  if (embeddedRecordingId) {
    logger.info(`Recording ID found in session event: ${embeddedRecordingId}`);
    // Still poll call log to get contentUri and confirmed duration
    recInfo = await pollForRecording(sessionId, startTime);
    if (!recInfo) {
      // Fall back to constructed URL
      recInfo = { id: embeddedRecordingId, contentUri: null, ...callInfo };
    }
  } else {
    recInfo = await pollForRecording(sessionId, startTime);
  }

  if (!recInfo) {
    logger.warn(`Session ${sessionId}: no recording found, skipping`);
    return;
  }

  // Update callInfo with authoritative data from call log
  callInfo = {
    ...callInfo,
    from:      recInfo.from      || callInfo.from,
    to:        recInfo.to        || callInfo.to,
    direction: recInfo.direction || callInfo.direction,
    duration:  recInfo.duration  || callInfo.duration,
    startTime: recInfo.startTime || callInfo.startTime,
  };

  // Download recording
  let recordingPath;
  try {
    recordingPath = await downloadRecording(recInfo.id, recInfo.contentUri);
  } catch (e) {
    logger.error(`Session ${sessionId}: download failed:`, e.message);
    return;
  }

  // Transcribe
  let transcript;
  try {
    transcript = await transcribeRecording(recordingPath);
  } catch (e) {
    logger.error(`Session ${sessionId}: transcription failed:`, e.message);
    return;
  }

  // Pre-filter voicemail (fast heuristics, no LLM needed)
  const vmPre = preFilterVoicemail(transcript, callInfo.duration);
  if (vmPre.isVoicemail) {
    logger.info(`Session ${sessionId}: pre-filter voicemail → ${vmPre.reason}`);
    appendToJsonArray(CONFIG.data.analysesFile, {
      sessionId,
      timestamp:      new Date().toISOString(),
      isVoicemail:    true,
      voicemailReason: vmPre.reason,
      callInfo,
      transcriptSnippet: transcript.substring(0, 300),
    });
    return;
  }

  // Score with GPT-4o
  let scoring;
  try {
    scoring = await scoreCall(transcript, callInfo);
    logger.info(`Session ${sessionId}: scored avg=${scoring.averageScore}, flags=${JSON.stringify(scoring.flags)}`);
  } catch (e) {
    logger.error(`Session ${sessionId}: scoring failed:`, e.message);
    return;
  }

  // GPT-4o voicemail confirmation
  if (scoring.isVoicemail) {
    logger.info(`Session ${sessionId}: GPT-4o confirmed voicemail → ${scoring.voicemailReason}`);
    appendToJsonArray(CONFIG.data.analysesFile, {
      sessionId,
      timestamp:       new Date().toISOString(),
      isVoicemail:     true,
      voicemailReason: scoring.voicemailReason,
      callInfo,
      transcriptSnippet: transcript.substring(0, 300),
    });
    return;
  }

  // Recalculate averageScore in case GPT didn't do it right
  if (scoring.scores) {
    const vals = Object.values(scoring.scores).filter(v => typeof v === 'number');
    if (vals.length > 0) {
      scoring.averageScore = parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2));
    }
  }

  // Ensure flags include lowOverallScore if applicable
  scoring.flags = scoring.flags || [];
  if (scoring.averageScore < 5 && !scoring.flags.includes('lowOverallScore')) {
    scoring.flags.push('lowOverallScore');
  }
  if (scoring.scores?.pitchQuality < 4 && !scoring.flags.includes('poorPitch')) {
    scoring.flags.push('poorPitch');
  }

  // Build records
  const baseRecord = {
    sessionId,
    timestamp:   new Date().toISOString(),
    callerName:  scoring.callerName,
    company:     scoring.company,
    recruiter:   scoring.recruiter,
    callInfo: {
      from:      callInfo.from,
      to:        callInfo.to,
      direction: callInfo.direction,
      duration:  callInfo.duration,
      startTime: callInfo.startTime,
    },
    scores:       scoring.scores,
    averageScore: scoring.averageScore,
    flags:        scoring.flags,
  };

  appendToJsonArray(CONFIG.data.scoresFile, baseRecord);
  appendToJsonArray(CONFIG.data.analysesFile, {
    ...baseRecord,
    summary:          scoring.summary,
    nextSteps:        scoring.nextSteps,
    recordingId:      recInfo.id,
    recordingPath,
    transcriptSnippet: transcript.substring(0, 5000),
  });

  logger.info(`Session ${sessionId}: data saved. Flags: [${scoring.flags.join(', ')}]`);

  // Send Telegram alert if flagged
  if (scoring.flags.length > 0) {
    const msg = buildAlertMessage(scoring, callInfo);
    await sendTelegramMessage(msg);
  } else {
    logger.info(`Session ${sessionId}: no flags — silent update only`);
  }
}

// ============================================================
// SESSION TRACKER
// ============================================================

// Map<sessionId, { sessionId, startTime, parties, firstSeen }>
const activeSessions = new Map();

function onTelephonyEvent(event) {
  const body = event.body || event;

  // RC uses either sessionId or telephonySessionId depending on API version
  const sessionId = body.sessionId || body.telephonySessionId;
  if (!sessionId) {
    logger.debug('Event with no sessionId, ignoring');
    return;
  }

  const parties = body.parties || [];
  if (parties.length === 0) {
    logger.debug(`Session ${sessionId}: event has no parties`);
    return;
  }

  const allDisconnected = parties.every(p => p.status && p.status.code === 'Disconnected');
  const now = new Date().toISOString();

  if (!activeSessions.has(sessionId)) {
    if (allDisconnected) {
      // Session arrived already ended — might be replay on reconnect
      // Only process if not already seen
      if (!processedSessions.has(sessionId)) {
        logger.info(`Session ${sessionId}: arrived as already-ended, processing`);
        processCallEnd({
          sessionId,
          startTime: body.creationTime || now,
          endTime:   now,
          parties,
        }).catch(e => logger.error(`processCallEnd error for ${sessionId}:`, e.message));
      }
    } else {
      // New active session
      activeSessions.set(sessionId, {
        sessionId,
        startTime: body.creationTime || now,
        parties,
        firstSeen: Date.now(),
      });
      logger.info(`Session ${sessionId}: started (parties: ${parties.length})`);
    }
  } else {
    // Update existing session
    const sess = activeSessions.get(sessionId);
    sess.parties = parties;

    if (allDisconnected) {
      activeSessions.delete(sessionId);
      logger.info(`Session ${sessionId}: all parties disconnected → processing`);
      processCallEnd({
        sessionId,
        startTime: sess.startTime,
        endTime:   now,
        parties,
      }).catch(e => logger.error(`processCallEnd error for ${sessionId}:`, e.message));
    }
  }
}

// ============================================================
// WEBSOCKET MANAGER
// ============================================================

const wsManager = {
  ws:             null,
  reconnectDelay: CONFIG.wsReconnectInitialMs,
  reconnectTimer: null,
  isConnecting:   false,
  running:        true,
};

async function connectWebSocket() {
  if (!wsManager.running || wsManager.isConnecting) return;
  wsManager.isConnecting = true;

  try {
    logger.info('Creating RC subscription...');
    await rcCreateSubscription();

    const wsUrl = subscription.wsUrl;
    if (!wsUrl) throw new Error('No WebSocket URL in subscription response');

    logger.info(`Connecting WebSocket: ${wsUrl}`);
    const ws = new WebSocket(wsUrl, {
      handshakeTimeout: 30_000,
    });
    wsManager.ws = ws;

    ws.on('open', () => {
      logger.info('WebSocket connected and ready');
      wsManager.reconnectDelay = CONFIG.wsReconnectInitialMs; // reset backoff
      wsManager.isConnecting   = false;
    });

    ws.on('message', (data) => {
      try {
        const raw = data.toString();
        logger.debug(`WS message (${raw.length}b): ${raw.substring(0, 200)}`);
        const msg = JSON.parse(raw);

        // RC push notifications have an 'event' field with the filter path
        if (msg.event && msg.body) {
          const eventPath = msg.event || '';
          if (eventPath.includes('telephony/sessions')) {
            onTelephonyEvent(msg);
          }
        }
      } catch (e) {
        logger.warn('WS message parse error:', e.message);
      }
    });

    ws.on('ping', () => {
      try { ws.pong(); } catch {}
    });

    ws.on('close', (code, reason) => {
      const reasonStr = reason ? reason.toString() : 'none';
      logger.warn(`WebSocket closed: code=${code} reason=${reasonStr}`);
      wsManager.ws         = null;
      wsManager.isConnecting = false;
      subscription.id      = null; // subscription tied to this WS is gone

      if (wsManager.running) {
        scheduleReconnectWs();
      }
    });

    ws.on('error', (e) => {
      logger.error('WebSocket error:', e.message);
      // close event will follow, which triggers reconnect
    });

  } catch (e) {
    logger.error('Failed to create subscription/WebSocket:', e.message);
    wsManager.isConnecting = false;
    if (wsManager.running) {
      scheduleReconnectWs();
    }
  }
}

function scheduleReconnectWs() {
  const delay = wsManager.reconnectDelay;
  wsManager.reconnectDelay = Math.min(delay * 2, CONFIG.wsReconnectMaxMs);
  logger.info(`Reconnecting WebSocket in ${Math.round(delay / 1000)}s...`);
  wsManager.reconnectTimer = setTimeout(() => {
    connectWebSocket();
  }, delay);
  // wsManager.reconnectTimer kept ref'd — keeps process alive during WS backoff
}

// ============================================================
// POLLING MODE — check call log every 3 minutes
// ============================================================

const POLL_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes
const POLL_STATE_FILE  = path.join(path.dirname(CONFIG.data.scoresFile), '.poll-state.json');

function loadPollState() {
  try {
    if (fs.existsSync(POLL_STATE_FILE)) {
      return JSON.parse(fs.readFileSync(POLL_STATE_FILE, 'utf8'));
    }
  } catch (e) {
    logger.warn('Failed to load poll state:', e.message);
  }
  // Default: look back 10 minutes on first run
  return { lastPollTime: new Date(Date.now() - 10 * 60 * 1000).toISOString() };
}

function savePollState(state) {
  try {
    fs.writeFileSync(POLL_STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (e) {
    logger.warn('Failed to save poll state:', e.message);
  }
}

async function pollCallLog() {
  const state = loadPollState();
  const now = new Date();
  const since = state.lastPollTime;

  logger.info(`[POLL] Checking call log since ${since}...`);

  try {
    const qs = new URLSearchParams({
      dateFrom:      since,
      dateTo:        now.toISOString(),
      view:          'Detailed',
      recordingType: 'All',
      perPage:       '50',
      type:          'Voice',
    });
    const res = await rcApi('GET', `/restapi/v1.0/account/~/call-log?${qs}`);
    const records = res.body.records || [];

    // Filter to only completed calls with recordings
    const withRecording = records.filter(r => r.recording && r.recording.id);
    const withoutRecording = records.filter(r => !r.recording);

    logger.info(`[POLL] Found ${records.length} calls (${withRecording.length} with recordings, ${withoutRecording.length} without)`);

    let processed = 0;
    for (const record of withRecording) {
      const sessionId = record.sessionId || record.id;

      // Skip already processed
      if (processedSessions.has(sessionId)) {
        logger.debug(`[POLL] Session ${sessionId} already processed, skipping`);
        continue;
      }
      processedSessions.add(sessionId);

      // Quick duration check
      if (record.duration != null && record.duration < CONFIG.minCallDurationSecs) {
        logger.info(`[POLL] Session ${sessionId}: too short (${record.duration}s), skipping`);
        continue;
      }

      const callInfo = {
        sessionId,
        from:      record.from  || {},
        to:        record.to    || {},
        direction: record.direction || 'Unknown',
        duration:  record.duration,
        startTime: record.startTime,
      };

      logger.info(`[POLL] Processing: ${sessionId} | ${callInfo.direction} | ${formatDuration(callInfo.duration)} | ${callInfo.from.name || callInfo.from.phoneNumber || '?'} → ${callInfo.to.name || callInfo.to.phoneNumber || '?'}`);

      // Download recording
      let recordingPath;
      try {
        recordingPath = await downloadRecording(record.recording.id, record.recording.contentUri);
      } catch (e) {
        logger.error(`[POLL] Session ${sessionId}: download failed:`, e.message);
        continue;
      }

      // Transcribe
      let transcript;
      try {
        transcript = await transcribeRecording(recordingPath);
      } catch (e) {
        logger.error(`[POLL] Session ${sessionId}: transcription failed:`, e.message);
        continue;
      }

      // Pre-filter voicemail
      const vmPre = preFilterVoicemail(transcript, callInfo.duration);
      if (vmPre.isVoicemail) {
        logger.info(`[POLL] Session ${sessionId}: voicemail → ${vmPre.reason}`);
        appendToJsonArray(CONFIG.data.analysesFile, {
          sessionId,
          timestamp:       new Date().toISOString(),
          isVoicemail:     true,
          voicemailReason: vmPre.reason,
          callInfo,
          transcriptSnippet: transcript.substring(0, 300),
        });
        continue;
      }

      // Score with GPT-4o
      let scoring;
      try {
        scoring = await scoreCall(transcript, callInfo);
        logger.info(`[POLL] Session ${sessionId}: scored avg=${scoring.averageScore}, flags=${JSON.stringify(scoring.flags)}`);
      } catch (e) {
        logger.error(`[POLL] Session ${sessionId}: scoring failed:`, e.message);
        continue;
      }

      // GPT-4o voicemail confirmation
      if (scoring.isVoicemail) {
        logger.info(`[POLL] Session ${sessionId}: GPT confirmed voicemail → ${scoring.voicemailReason}`);
        appendToJsonArray(CONFIG.data.analysesFile, {
          sessionId,
          timestamp:       new Date().toISOString(),
          isVoicemail:     true,
          voicemailReason: scoring.voicemailReason,
          callInfo,
          transcriptSnippet: transcript.substring(0, 300),
        });
        continue;
      }

      // Recalculate averageScore
      if (scoring.scores) {
        const vals = Object.values(scoring.scores).filter(v => typeof v === 'number');
        if (vals.length > 0) {
          scoring.averageScore = parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2));
        }
      }

      // Ensure flags
      scoring.flags = scoring.flags || [];
      if (scoring.averageScore < 5 && !scoring.flags.includes('lowOverallScore')) {
        scoring.flags.push('lowOverallScore');
      }
      if (scoring.scores?.pitchQuality < 4 && !scoring.flags.includes('poorPitch')) {
        scoring.flags.push('poorPitch');
      }

      // Save records
      const baseRecord = {
        sessionId,
        timestamp:    new Date().toISOString(),
        callerName:   scoring.callerName,
        company:      scoring.company,
        recruiter:    scoring.recruiter,
        callInfo: {
          from:      callInfo.from,
          to:        callInfo.to,
          direction: callInfo.direction,
          duration:  callInfo.duration,
          startTime: callInfo.startTime,
        },
        scores:       scoring.scores,
        averageScore: scoring.averageScore,
        flags:        scoring.flags,
      };

      appendToJsonArray(CONFIG.data.scoresFile, baseRecord);
      appendToJsonArray(CONFIG.data.analysesFile, {
        ...baseRecord,
        summary:           scoring.summary,
        nextSteps:         scoring.nextSteps,
        recordingId:       record.recording.id,
        recordingPath,
        transcriptSnippet: transcript.substring(0, 5000),
      });

      // Telegram alert if flagged
      if (scoring.flags.length > 0) {
        const msg = buildAlertMessage(scoring, callInfo);
        await sendTelegramMessage(msg);
      } else {
        logger.info(`[POLL] Session ${sessionId}: clean — silent update`);
      }

      processed++;

      // Rate limit safety: pause between calls
      if (processed > 0 && processed % 5 === 0) {
        logger.info(`[POLL] Processed ${processed} calls, pausing 30s for rate limits...`);
        await sleep(30_000);
      }
    }

    logger.info(`[POLL] Done. Processed ${processed} new calls.`);

    // Save state — move forward to now
    savePollState({ lastPollTime: now.toISOString() });

  } catch (e) {
    logger.error('[POLL] Call log poll failed:', e.message);
    // Don't update state — retry same window next time
  }
}

let pollTimer = null;
let wsConnected = false;

function startPolling() {
  logger.info(`[POLL] Starting 3-minute polling mode...`);
  // Run immediately on start
  pollCallLog().catch(e => logger.error('[POLL] Initial poll error:', e.message));

  pollTimer = setInterval(() => {
    // Skip polling if WebSocket is connected and working
    if (wsConnected) {
      logger.debug('[POLL] WebSocket active, skipping poll');
      return;
    }
    pollCallLog().catch(e => logger.error('[POLL] Poll error:', e.message));
  }, POLL_INTERVAL_MS);
  // pollTimer kept ref'd — keeps process alive for regular polling
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  logger.info('');
  logger.info('========================================');
  logger.info(' RingCentral Call Monitor — Starting');
  logger.info(`  Node ${process.version}`);
  logger.info(`  PID  ${process.pid}`);
  logger.info('  Mode: Polling (3min) + WebSocket (auto-upgrade)');
  logger.info('========================================');

  // Ensure data directories
  ensureDir(CONFIG.data.recordingsDir);
  if (!fs.existsSync(CONFIG.data.scoresFile))   saveJson(CONFIG.data.scoresFile,   []);
  if (!fs.existsSync(CONFIG.data.analysesFile)) saveJson(CONFIG.data.analysesFile, []);

  // Initial RC authentication
  try {
    await rcRefreshToken();
    logger.info('RingCentral authentication OK');
  } catch (e) {
    logger.error('FATAL: RC auth failed:', e.message);
    process.exit(1);
  }

  // Start polling immediately — this is the reliable path
  startPolling();

  // Also try WebSocket in background — will auto-upgrade if it connects
  const origOnOpen = null;
  const origWsConnect = connectWebSocket;
  // Patch WS open handler to set wsConnected flag
  const patchedConnect = async () => {
    try {
      await origWsConnect();
      if (wsManager.ws) {
        const origOpenListeners = wsManager.ws.listeners('open');
        wsManager.ws.on('open', () => {
          wsConnected = true;
          logger.info('[WS] WebSocket connected — polling paused (WS takes priority)');
        });
        wsManager.ws.on('close', () => {
          wsConnected = false;
          logger.info('[WS] WebSocket disconnected — polling resumed');
        });
      }
    } catch (e) {
      logger.warn('[WS] WebSocket connect attempt failed (polling continues):', e.message);
    }
  };
  // Try WS but don't block — polling is primary
  patchedConnect();

  // Graceful shutdown
  const shutdown = async (signal) => {
    logger.info(`Received ${signal}, shutting down...`);
    wsManager.running = false;
    if (pollTimer) clearInterval(pollTimer);
    if (wsManager.reconnectTimer) clearTimeout(wsManager.reconnectTimer);
    if (wsManager.ws) {
      try { wsManager.ws.close(); } catch {}
    }
    try { await rcDeleteSubscription(); } catch {}
    logger.info('Shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));

  // Catch-all — log but don't crash
  process.on('uncaughtException', (err) => {
    logger.error('UNCAUGHT EXCEPTION:', err.message, err.stack || '');
  });
  process.on('unhandledRejection', (reason) => {
    logger.error('UNHANDLED REJECTION:', reason instanceof Error ? reason.message : String(reason));
  });

  logger.info('Monitor running — polling every 3 minutes, WebSocket auto-upgrade in background...');
}

main();
