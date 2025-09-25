// Load test script: assumes you've logged in and have a token, and you've generated a sample file ID.
// Usage:
//   1) Start server
//   2) curl -X POST http://localhost:8080/api/auth/login -H 'Content-Type: application/json' -d '{"username":"angus","password":"pass123"}'
//   3) Copy token into TOKEN below, or set process.env.TOKEN
//   4) (optional) POST /api/videos/generate-sample to get FILE_ID, or set an existing one
//   5) node scripts/load_test.js

import fetch from 'node-fetch';

const BASE = process.env.BASE || 'http://localhost:8080';
const TOKEN = process.env.TOKEN || '';
const FILE_ID = process.env.FILE_ID || ''; // set via env or modify below
const PRESET = process.env.PRESET || '720p';
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '6', 10);
const DURATION_SEC = parseInt(process.env.DURATION_SEC || '300', 10); // 5 minutes

if (!TOKEN) {
  console.error('Set TOKEN env var with a valid JWT from /api/auth/login');
  process.exit(1);
}

async function transcodeOnce() {
  const r = await fetch(`${BASE}/api/videos/transcode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + TOKEN },
    body: JSON.stringify({ fileId: FILE_ID, preset: PRESET })
  });
  const j = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(j));
  return j.job.id;
}

async function worker(stopAt) {
  let count = 0;
  while (Date.now() < stopAt) {
    try {
      await transcodeOnce();
      count++;
    } catch (e) {
      console.error('Error:', e.message);
    }
  }
  return count;
}

(async () => {
  console.log('Starting load test...', { BASE, PRESET, CONCURRENCY, DURATION_SEC, FILE_ID});
  const stopAt = Date.now() + DURATION_SEC * 1000;
  const promises = [];
  for (let i=0;i<CONCURRENCY;i++) promises.push(worker(stopAt));
  const done = await Promise.all(promises);
  const total = done.reduce((a,b)=>a+b,0);
  console.log('Load test complete. Jobs started:', total);
  process.exit(0);
})();
