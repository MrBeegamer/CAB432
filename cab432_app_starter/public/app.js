let token = localStorage.getItem('token') || '';

function setToken(t, user){
  token = t || '';
  if (t) localStorage.setItem('token', t); else localStorage.removeItem('token');
  const info = document.getElementById('userInfo');
  info.textContent = token ? `Logged in as ${user.username} (${user.role})` : 'Not logged in';
}
setToken(token, { username: 'cached', role: '' });

async function api(path, opts={}){
  opts.headers = opts.headers || {};
  if (token) opts.headers['Authorization'] = 'Bearer ' + token;
  const r = await fetch(path, opts);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function login(){
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const res = await api('/api/auth/login', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ username, password })
  });
  setToken(res.token, res.user);
  alert('Logged in');
}
function logout(){ setToken('', {username:'', role:''}); alert('Logged out'); }

async function upload(){
  const f = document.getElementById('fileInput').files[0];
  if(!f) return alert('Choose a file');
  const fd = new FormData();
  fd.append('file', f);
  const r = await fetch('/api/videos/upload', { method:'POST', headers: token ? {'Authorization':'Bearer '+token} : {}, body: fd });
  const j = await r.json();
  if (!r.ok) return alert(JSON.stringify(j));
  alert('Uploaded with id ' + j.file.id);
  listFiles();
  document.getElementById('fileId').value = j.file.id;
}
async function generateSample(){
  const j = await api('/api/videos/generate-sample', { method:'POST' });
  alert('Sample generated id ' + j.file.id);
  listFiles();
  document.getElementById('fileId').value = j.file.id;
}
async function listFiles(){
  const j = await api('/api/videos/files');
  const el = document.getElementById('files');
  el.innerHTML = '<ul>' + j.files.map(f=> `<li><code>${f.id}</code> — ${f.originalName} — ${(f.size/1024/1024).toFixed(2)} MB</li>`).join('') + '</ul>';
}
async function transcode(){
  const fileId = document.getElementById('fileId').value.trim();
  const preset = document.getElementById('preset').value;
  const j = await api('/api/videos/transcode', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ fileId, preset }) });
  alert('Job started: ' + j.job.id);
  listJobs();
}
async function listJobs(){
  const j = await api('/api/videos/jobs');
  const el = document.getElementById('jobs');
  el.innerHTML = '<ul>' + j.jobs.map(job => {
    const dl = job.status === 'finished' ? ` — <a href="/api/videos/download/${job.id}">download</a>` : '';
    return `<li><code>${job.id}</code> [${job.status}] ${job.preset}${dl}</li>`;
  }).join('') + '</ul>';
}
async function cpu(){
  const j = await api('/api/health/cpu');
  document.getElementById('cpuOut').textContent = JSON.stringify(j);
}
