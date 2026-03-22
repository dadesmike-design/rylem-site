const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const WORKSPACE = '/Users/mikedades/.openclaw/workspace';
const SCORES_FILE = path.join(WORKSPACE, 'data/call-scores.json');
const RECORDINGS_DIR = path.join(WORKSPACE, 'data/recordings');
const OPENAI_KEY = process.env.OPENAI_API_KEY || '';

if (!OPENAI_KEY) {
  console.error('ERROR: OPENAI_API_KEY not set');
  process.exit(1);
}

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }

// Transcribe audio file using OpenAI Whisper API
async function transcribe(filePath) {
  const fileName = path.basename(filePath);
  const fileSize = fs.statSync(filePath).size;
  log(`  Transcribing ${fileName} (${(fileSize/1024/1024).toFixed(1)}MB)...`);
  
  const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
  const fileData = fs.readFileSync(filePath);
  
  const parts = [];
  // file part
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: audio/mpeg\r\n\r\n`));
  parts.push(fileData);
  parts.push(Buffer.from('\r\n'));
  // model part
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-1\r\n`));
  // language part
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\nen\r\n`));
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  
  const body = Buffer.concat(parts);
  
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.openai.com',
      path: '/v1/audio/transcriptions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_KEY}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length
      },
      timeout: 120000
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`Whisper API ${res.statusCode}: ${data.slice(0,200)}`));
          return;
        }
        try { resolve(JSON.parse(data).text || ''); }
        catch(e) { reject(new Error('Failed to parse Whisper response')); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Whisper API timeout')); });
    req.write(body);
    req.end();
  });
}

// Score a transcript using GPT-4o
async function scoreCall(call, transcript) {
  const payload = JSON.stringify({
    model: 'gpt-4o',
    messages: [{
      role: 'system',
      content: `You are an AI call quality analyst for a staffing/recruiting company (Rylem Staffing).
Score this call on these criteria (1-10 each):
- Professionalism
- Pitch Quality  
- Information Gathering
- Follow-up Commitment
- Compliance

Also determine:
- Is this a voicemail/automated system? (true/false)
- Overall score (1-10, weighted average)
- Brief summary (1-2 sentences)
- Flags: array of relevant flags from: "Angry caller", "Compliance concern", "No next steps", "Missed follow-up", "Poor pitch", "Client escalation", "Candidate complaint", "Great rapport"
- Severity: "high", "medium", "low", or null
- Should this be flagged for manager review? (true/false)

IMPORTANT: A voicemail is ONLY when someone reaches an automated voicemail greeting or there is no human conversation. If two humans are talking, it is NOT a voicemail regardless of call quality.

Respond in JSON only: {"voicemail":bool,"score":number|null,"summary":"...","flags":[],"flagged":bool,"severity":"..."|null}`
    },{
      role: 'user',
      content: `Call details:
- Caller: ${call.caller || 'Unknown'}
- Prospect: ${call.prospect || 'Unknown'}  
- Direction: ${call.direction || 'Unknown'}
- Duration: ${call.duration || 0} seconds

Transcript:
${transcript.slice(0, 4000)}`
    }],
    temperature: 0.3,
    max_tokens: 500
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 60000
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`GPT API ${res.statusCode}: ${data.slice(0,200)}`));
          return;
        }
        try {
          const content = JSON.parse(data).choices[0].message.content;
          // Extract JSON from response
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) resolve(JSON.parse(jsonMatch[0]));
          else reject(new Error('No JSON in GPT response'));
        } catch(e) { reject(new Error('Failed to parse GPT response: ' + e.message)); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('GPT API timeout')); });
    req.write(payload);
    req.end();
  });
}

async function main() {
  log('=== RE-SCORING LONG CALLS ===');
  
  const scores = JSON.parse(fs.readFileSync(SCORES_FILE, 'utf8'));
  const calls = scores.scoredCalls || [];
  
  // Find long calls with null scores or marked as voicemail incorrectly
  const toRescore = calls.filter(c => {
    const dur = c.duration || 0;
    const hasRecording = c.recordingFile && fs.existsSync(path.join(WORKSPACE, 'data', c.recordingFile));
    return dur > 120 && hasRecording && (c.score === null || c.voicemail === true);
  });
  
  log(`Found ${toRescore.length} long calls to re-score`);
  
  let rescored = 0;
  let errors = 0;
  
  for (const call of toRescore) {
    const recPath = path.join(WORKSPACE, 'data', call.recordingFile);
    const dur = call.duration || 0;
    log(`\nProcessing: ${call.caller} (${Math.floor(dur/60)}m ${dur%60}s)`);
    
    try {
      // Step 1: Transcribe
      const transcript = await transcribe(recPath);
      if (!transcript || transcript.length < 20) {
        log(`  Transcript too short (${transcript.length} chars), skipping`);
        continue;
      }
      log(`  Transcript: ${transcript.length} chars`);
      
      // Step 2: Score
      const result = await scoreCall(call, transcript);
      log(`  Score: ${result.score}/10 | VM: ${result.voicemail} | Flagged: ${result.flagged}`);
      log(`  Summary: ${result.summary}`);
      
      // Step 3: Update the call in scores
      const idx = calls.findIndex(c => c.recordingId === call.recordingId);
      if (idx >= 0) {
        calls[idx].transcript = transcript;
        calls[idx].score = result.score;
        calls[idx].voicemail = result.voicemail;
        calls[idx].summary = result.summary;
        calls[idx].flags = result.flags || [];
        calls[idx].flagged = result.flagged || false;
        calls[idx].severity = result.severity || null;
        rescored++;
      }
      
      // Rate limit: wait 2s between calls
      await new Promise(r => setTimeout(r, 2000));
      
    } catch(e) {
      log(`  ERROR: ${e.message}`);
      errors++;
      // Wait longer on errors (rate limit)
      await new Promise(r => setTimeout(r, 5000));
    }
  }
  
  // Update summary stats
  const realCalls = calls.filter(c => !c.voicemail && c.score !== null);
  scores.summary = {
    totalScored: calls.length,
    realConversations: realCalls.length,
    voicemails: calls.filter(c => c.voicemail).length,
    avgScore: realCalls.length ? Math.round(realCalls.reduce((a,c) => a + (c.score||0), 0) / realCalls.length * 10) / 10 : 0,
    flaggedCount: realCalls.filter(c => c.flagged).length
  };
  scores.lastUpdated = new Date().toISOString();
  
  // Save
  fs.writeFileSync(SCORES_FILE, JSON.stringify(scores, null, 2));
  
  log(`\n=== DONE ===`);
  log(`Re-scored: ${rescored} | Errors: ${errors}`);
  log(`Real conversations: ${scores.summary.realConversations}`);
  log(`Avg score: ${scores.summary.avgScore}/10`);
  log(`Flagged: ${scores.summary.flaggedCount}`);
}

main().catch(e => { log(`FATAL: ${e.message}`); process.exit(1); });
