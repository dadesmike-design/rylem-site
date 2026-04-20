// Instant lead notifications — Telegram + Email
import { readFileSync } from 'fs';

// --- Load credentials ---
function loadEnv(filePath) {
  try {
    const raw = readFileSync(filePath, 'utf8');
    const env = {};
    for (const line of raw.split('\n')) {
      if (line.startsWith('#') || !line.includes('=')) continue;
      const [key, ...rest] = line.split('=');
      env[key.trim()] = rest.join('=').trim();
    }
    return env;
  } catch { return {}; }
}

const mainEnv = loadEnv('/Users/mikedades/clawd/.env');
const msEnv = loadEnv('/Users/mikedades/clawd/.env.microsoft');

// Telegram config
const TG_BOT_TOKEN = (() => {
  try {
    const raw = readFileSync('/Users/mikedades/.openclaw/openclaw.json', 'utf8');
    const match = raw.match(/"botToken"\s*:\s*"([^"]+)"/);
    return match ? match[1] : '';
  } catch { return ''; }
})();
const TG_GROUP_ID = '-1003796555808';

// Microsoft Graph config
const MS_TENANT = msEnv.MICROSOFT_TENANT_ID;
const MS_CLIENT_ID = msEnv.MICROSOFT_CLIENT_ID;
const MS_CLIENT_SECRET = msEnv.MICROSOFT_CLIENT_SECRET;

// --- Telegram Notification ---
export async function sendTelegramAlert(lead) {
  if (!TG_BOT_TOKEN) {
    console.error('No Telegram bot token found');
    return false;
  }

  const typeEmoji = lead.type === 'client' ? '🔥' : '👤';
  const typeLabel = lead.type === 'client' ? 'SALES LEAD' : 'CANDIDATE';
  const route = lead.type === 'client' ? '→ Julia' : '→ Liza';

  let msg = `${typeEmoji} NEW ${typeLabel} FROM WEBSITE ${typeEmoji}\n\n`;
  msg += `**Name:** ${lead.name || 'Not provided'}\n`;
  if (lead.company) msg += `**Company:** ${lead.company}\n`;
  if (lead.email) msg += `**Email:** ${lead.email}\n`;
  if (lead.phone) msg += `**Phone:** ${lead.phone}\n`;
  if (lead.role) msg += `**Looking for:** ${lead.role}\n`;
  msg += `\n**Contact preference:** ${lead.contactPref || 'Not specified'}\n`;
  msg += `**Route:** ${route}\n`;
  msg += `\n**Chat summary:**\n${lead.chatSummary || 'No summary available'}`;
  msg += `\n\n⚡ Visitor requested IMMEDIATE follow-up`;

  try {
    const res = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TG_GROUP_ID,
        text: msg,
        parse_mode: 'Markdown',
        message_thread_id: 5, // Topic 5 in RYLEM HQ
      }),
    });
    const data = await res.json();
    if (!data.ok) console.error('Telegram error:', data.description);
    return data.ok;
  } catch (err) {
    console.error('Telegram send failed:', err.message);
    return false;
  }
}

// --- Microsoft Graph: Get Access Token ---
async function getMsToken() {
  const url = `https://login.microsoftonline.com/${MS_TENANT}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: MS_CLIENT_ID,
    client_secret: MS_CLIENT_SECRET,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  const res = await fetch(url, { method: 'POST', body });
  const data = await res.json();
  return data.access_token;
}

// --- Email Notification via Microsoft Graph ---
export async function sendEmailAlert(lead) {
  if (!MS_TENANT || !MS_CLIENT_ID || !MS_CLIENT_SECRET) {
    console.error('Microsoft Graph credentials missing');
    return false;
  }

  try {
    const token = await getMsToken();
    const typeLabel = lead.type === 'client' ? '🔥 New Sales Lead' : '👤 New Candidate';
    const route = lead.type === 'client' ? 'Julia' : 'Liza';

    const recipients = [
      { emailAddress: { address: 'miked@rylem.com' } },
    ];

    // TODO: When ready to expand, add Julia/April for sales, Liza for candidates

    const emailBody = `
<h2>${typeLabel} from Rylem.com</h2>
<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px;">
  <tr><td style="padding:6px 12px;font-weight:bold;">Name:</td><td style="padding:6px 12px;">${lead.name || 'Not provided'}</td></tr>
  ${lead.company ? `<tr><td style="padding:6px 12px;font-weight:bold;">Company:</td><td style="padding:6px 12px;">${lead.company}</td></tr>` : ''}
  ${lead.email ? `<tr><td style="padding:6px 12px;font-weight:bold;">Email:</td><td style="padding:6px 12px;">${lead.email}</td></tr>` : ''}
  ${lead.phone ? `<tr><td style="padding:6px 12px;font-weight:bold;">Phone:</td><td style="padding:6px 12px;">${lead.phone}</td></tr>` : ''}
  ${lead.role ? `<tr><td style="padding:6px 12px;font-weight:bold;">Looking for:</td><td style="padding:6px 12px;">${lead.role}</td></tr>` : ''}
  <tr><td style="padding:6px 12px;font-weight:bold;">Contact Pref:</td><td style="padding:6px 12px;">${lead.contactPref || 'Not specified'}</td></tr>
  <tr><td style="padding:6px 12px;font-weight:bold;">Route to:</td><td style="padding:6px 12px;">${route}</td></tr>
</table>

<h3>Chat Transcript</h3>
<pre style="background:#f5f5f5;padding:16px;border-radius:8px;font-size:13px;white-space:pre-wrap;">${lead.chatSummary || 'No transcript available'}</pre>

<p style="color:#888;font-size:12px;margin-top:20px;">⚡ This lead requested immediate follow-up via the Rylem.com AI Assistant</p>
`;

    const res = await fetch('https://graph.microsoft.com/v1.0/users/miked@rylem.com/sendMail', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          subject: `${typeLabel}: ${lead.name || 'Website Visitor'} — ${lead.company || 'Immediate Follow-up'}`,
          body: { contentType: 'HTML', content: emailBody },
          toRecipients: recipients,
          importance: 'high',
        },
      }),
    });

    if (res.status === 202) {
      console.log('Email alert sent successfully');
      return true;
    } else {
      const err = await res.text();
      console.error('Email send failed:', res.status, err);
      return false;
    }
  } catch (err) {
    console.error('Email alert error:', err.message);
    return false;
  }
}

// --- Send all notifications ---
// Hiring managers: Telegram alert (urgent) + email to Mike & sales
// Candidates: email to Liza (recruiting) only, no Telegram noise
// Other (payroll, vendors, etc): Telegram alert + email to Mike (potential business)
export async function notifyTeam(lead) {
  const isHiringManager = lead.type === 'client';
  const isCandidate = lead.type === 'candidate';

  if (isCandidate) {
    // Candidates: quiet email to Liza only
    const results = await Promise.allSettled([
      sendCandidateEmail(lead),
    ]);
    return {
      telegram: false,
      email: results[0].status === 'fulfilled' && results[0].value,
      route: 'Liza (recruiting)',
    };
  } else {
    // Hiring managers & other inquiries: urgent Telegram + email to Mike
    const results = await Promise.allSettled([
      sendTelegramAlert(lead),
      sendEmailAlert(lead),
    ]);
    return {
      telegram: results[0].status === 'fulfilled' && results[0].value,
      email: results[1].status === 'fulfilled' && results[1].value,
      route: isHiringManager ? 'Julia (sales)' : 'Mike (potential business)',
    };
  }
}

// --- Candidate-specific email to Liza ---
async function sendCandidateEmail(lead) {
  if (!MS_TENANT || !MS_CLIENT_ID || !MS_CLIENT_SECRET) return false;

  try {
    const token = await getMsToken();

    const emailBody = `
<h2>👤 New Candidate from Rylem.com</h2>
<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px;">
  <tr><td style="padding:6px 12px;font-weight:bold;">Name:</td><td style="padding:6px 12px;">${lead.name || 'Not provided'}</td></tr>
  ${lead.email ? `<tr><td style="padding:6px 12px;font-weight:bold;">Email:</td><td style="padding:6px 12px;">${lead.email}</td></tr>` : ''}
  ${lead.phone ? `<tr><td style="padding:6px 12px;font-weight:bold;">Phone:</td><td style="padding:6px 12px;">${lead.phone}</td></tr>` : ''}
  ${lead.role ? `<tr><td style="padding:6px 12px;font-weight:bold;">Looking for:</td><td style="padding:6px 12px;">${lead.role}</td></tr>` : ''}
  <tr><td style="padding:6px 12px;font-weight:bold;">Contact Pref:</td><td style="padding:6px 12px;">${lead.contactPref || 'Not specified'}</td></tr>
</table>

<h3>Chat Transcript</h3>
<pre style="background:#f5f5f5;padding:16px;border-radius:8px;font-size:13px;white-space:pre-wrap;">${lead.chatSummary || 'No transcript available'}</pre>

<p style="color:#888;font-size:12px;margin-top:20px;">Candidate inquiry via Rylem.com AI Assistant</p>
`;

    const res = await fetch('https://graph.microsoft.com/v1.0/users/miked@rylem.com/sendMail', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          subject: `👤 New Candidate: ${lead.name || 'Website Visitor'} — ${lead.role || 'General Inquiry'}`,
          body: { contentType: 'HTML', content: emailBody },
          toRecipients: [{ emailAddress: { address: 'liza@rylem.com' } }],
          ccRecipients: [{ emailAddress: { address: 'sheila@rylem.com' } }],
        },
      }),
    });

    if (res.status === 202) {
      console.log('Candidate email sent to Liza + Sheila');
      return true;
    } else {
      const err = await res.text();
      console.error('Candidate email failed:', res.status, err);
      return false;
    }
  } catch (err) {
    console.error('Candidate email error:', err.message);
    return false;
  }
}
