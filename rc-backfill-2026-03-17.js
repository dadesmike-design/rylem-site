#!/usr/bin/env node
/**
 * RC Recording Backfill — 2026-03-17
 * Downloads remaining recordings for the date, skipping existing files.
 * Rate-limit safe: 2s delay between downloads, 60s wait on 429.
 */

'use strict';

const https = require('https');
const fs    = require('fs');
const path  = require('path');

// ── Config ────────────────────────────────────────────────────────────────────
const CLIENT_ID     = '2EFMLlxMDZ2eJRIQhQOGjy';
const CLIENT_SECRET = '6fN1Ks1rYtfalnUT2e5QY4cEHF2UyRMTYbbIzmz4UunM';
const JWT_TOKEN     = [
  'eyJraWQiOiI4NzYyZjU5OGQwNTk0NGRiODZiZjVjYTk3ODA0NzYwOCIsInR5cCI6IkpXVCIsImFsZyI6IlJTMjU2In0',
  'eyJhdWQiOiJodHRwczovL3BsYXRmb3JtLnJpbmdjZW50cmFsLmNvbS9yZXN0YXBpL29hdXRoL3Rva2VuIiwic3ViIjoiNTM1ODQ2MDQxIiwiaXNzIjoiaHR0cHM6Ly9wbGF0Zm9ybS5yaW5nY2VudHJhbC5jb20iLCJleHAiOjM5MjA2NjIxMjAsImlhdCI6MTc3MzE3ODQ3MywianRpIjoiVlp1aWN4dVNRNHVvY0RCNk5sU1Y5USJ9',
  'UHFrIsUTqAohf_cshZ7TJBkDRrdDEcJTyWRQbZ6KJs7ae_Hk-oRoF0jdRMbbm38DQ526ZOXS25L6ac4wyXj4egFKgHITT5BeIrqpza4gpB3zgY7FfeSUfBRMzrZdjKBWI3l5kGomGInzYS2LZX69RFZZV08w7kP5Yun77pcpgVenw-n0bM5JlgHKZ14TwQ1kNLwYUsfR-FI3mdlH8rANFwjSl4EfzFjzryxW87EejPEcBx8FuaLSZmj0DNCsHY6MuWCGFebysz_oDESJAfoJBSoJ8IAw2k2U6Fg75-T5EMzO4DX0pKP2s0vj_n2nx1YndbgPBdTgSFX7X2LBI8udeQ',
].join('.');

const OUT_DIR   = path.join(process.env.HOME, 'clawd', 'rc-recordings', '2026-03-17');
const TARGET_DATE = '2026-03-17'; // dateFrom / dateTo for API query

let accessToken = null;
let tokenExpiry = 0;

// ── Helpers ───────────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

function httpsRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks);
        resolve({ status: res.statusCode, headers: res.headers, body: raw });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function getToken() {
  if (accessToken && Date.now() < tokenExpiry) return accessToken;

  const creds = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const body  = `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${JWT_TOKEN}`;
  const res   = await httpsRequest({
    hostname: 'platform.ringcentral.com',
    path:     '/restapi/oauth/token',
    method:   'POST',
    headers: {
      'Authorization': `Basic ${creds}`,
      'Content-Type':  'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body),
    },
  }, body);

  if (res.status !== 200) {
    throw new Error(`Auth failed: ${res.status} — ${res.body.toString()}`);
  }
  const json = JSON.parse(res.body.toString());
  accessToken = json.access_token;
  tokenExpiry = Date.now() + (json.expires_in - 120) * 1000;
  console.log('✅ Token obtained');
  return accessToken;
}

async function fetchRecordingsList(token, page = 1, perPage = 100) {
  const qs = new URLSearchParams({
    dateFrom:      `${TARGET_DATE}T00:00:00Z`,
    dateTo:        `${TARGET_DATE}T23:59:59Z`,
    type:          'Voice',
    view:          'Simple',
    withRecording: 'true',
    perPage:       String(perPage),
    page:          String(page),
  });
  const path = `/restapi/v1.0/account/~/call-log?${qs}`;
  const res  = await httpsRequest({
    hostname: 'platform.ringcentral.com',
    path,
    method:   'GET',
    headers:  { 'Authorization': `Bearer ${token}` },
  });

  if (res.status === 429) return { status: 429 };
  if (res.status !== 200) throw new Error(`Call-log ${page} failed: ${res.status} — ${res.body.slice(0, 200)}`);
  return { status: 200, data: JSON.parse(res.body.toString()) };
}

async function downloadFile(url, dest, token) {
  const fullUrl = `${url}?access_token=${token}`;
  const parsed  = new URL(fullUrl);
  const options = {
    hostname: parsed.hostname,
    path:     parsed.pathname + parsed.search,
    method:   'GET',
    headers:  { 'Authorization': `Bearer ${token}` },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        // Follow redirect
        const redirUrl = new URL(res.headers.location);
        const redirOpts = {
          hostname: redirUrl.hostname,
          path:     redirUrl.pathname + redirUrl.search,
          method:   'GET',
        };
        const req2 = https.request(redirOpts, res2 => {
          if (res2.statusCode === 429) { resolve(429); return; }
          if (res2.statusCode !== 200) { resolve(res2.statusCode); return; }
          const out = fs.createWriteStream(dest);
          res2.pipe(out);
          out.on('finish', () => resolve(200));
          out.on('error', reject);
        });
        req2.on('error', reject);
        req2.end();
        return;
      }
      if (res.statusCode === 429) { resolve(429); return; }
      if (res.statusCode !== 200) { resolve(res.statusCode); return; }
      const out = fs.createWriteStream(dest);
      res.pipe(out);
      out.on('finish', () => resolve(200));
      out.on('error', reject);
    });
    req.on('error', reject);
    req.end();
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Collect all recording entries across pages
  console.log(`📋 Fetching call-log pages for ${TARGET_DATE}...`);
  const allRecordings = [];
  let page = 1;

  while (true) {
    const token = await getToken();
    const result = await fetchRecordingsList(token, page, 100);
    if (result.status === 429) {
      console.log('⏳ 429 on listing — waiting 60s...');
      await sleep(60_000);
      continue;
    }
    const { data } = result;
    const records = data.records || [];
    console.log(`  Page ${page}: ${records.length} records`);

    for (const r of records) {
      if (r.recording && r.recording.contentUri) {
        allRecordings.push({
          id:         r.recording.id,
          contentUri: r.recording.contentUri,
        });
      }
    }

    // Pagination
    const nav = data.navigation || {};
    if (nav.nextPage && records.length === 100) {
      page++;
      await sleep(1000); // small pause between page fetches
    } else {
      break;
    }
  }

  console.log(`\n📊 Total recordings found on API: ${allRecordings.length}`);

  // Filter out already-downloaded
  const existing = new Set(
    fs.readdirSync(OUT_DIR)
      .filter(f => f.endsWith('.mp3'))
      .map(f => f.replace('.mp3', ''))
  );
  console.log(`📁 Already on disk: ${existing.size}`);

  const toDownload = allRecordings.filter(r => !existing.has(String(r.id)));
  console.log(`⬇️  Need to download: ${toDownload.length}\n`);

  if (toDownload.length === 0) {
    console.log('Nothing to do — all recordings already present.');
    process.exit(0);
  }

  let downloaded = 0;
  let skipped    = 0;
  let errors     = 0;

  for (let i = 0; i < toDownload.length; i++) {
    const rec  = toDownload[i];
    const dest = path.join(OUT_DIR, `${rec.id}.mp3`);

    // Double-check (in case a previous loop iteration created it)
    if (fs.existsSync(dest)) {
      skipped++;
      continue;
    }

    const token = await getToken();
    console.log(`[${i + 1}/${toDownload.length}] Downloading ${rec.id}...`);

    let attempts = 0;
    let ok = false;
    while (attempts < 5) {
      const status = await downloadFile(rec.contentUri, dest, token);
      if (status === 200) {
        downloaded++;
        ok = true;
        break;
      } else if (status === 429) {
        // Clean up partial file
        if (fs.existsSync(dest)) fs.unlinkSync(dest);
        console.log(`  ⏳ 429 — waiting 60s (attempt ${attempts + 1})...`);
        await sleep(60_000);
        attempts++;
      } else {
        console.log(`  ⚠️  Status ${status} for ${rec.id} — skipping`);
        if (fs.existsSync(dest)) fs.unlinkSync(dest);
        errors++;
        ok = true; // don't retry non-429
        break;
      }
    }
    if (!ok) {
      console.log(`  ❌ Giving up on ${rec.id} after 5 attempts`);
      errors++;
    }

    // 2s delay between downloads (rate-limit safety)
    if (i < toDownload.length - 1) await sleep(2000);
  }

  const finalCount = fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.mp3')).length;

  console.log('\n════════════════════════════════════');
  console.log(`✅ Done!`);
  console.log(`   Downloaded this run : ${downloaded}`);
  console.log(`   Skipped (existed)   : ${existing.size + skipped}`);
  console.log(`   Errors              : ${errors}`);
  console.log(`   Total on disk now   : ${finalCount}`);
  console.log('════════════════════════════════════');

  // Write result to a temp file so the orchestrator can pick it up
  fs.writeFileSync('/tmp/rc-backfill-result.json', JSON.stringify({
    downloaded, skipped: existing.size + skipped, errors, totalOnDisk: finalCount,
  }));
})().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
