# CAB432 Assessment 1 — Video Processor (Functionality + Web Client)

**Focus for now:** functionality + web client. (AWS ECR/EC2 comes later.)

## What it does
- REST API (Express) with JWT login (hard-coded users for A1): `admin/admin123`, `angus/pass123`
- Unstructured data: video files (uploads/)
- Structured data: jobs and file metadata in `data/db.json`
- CPU-intensive task: FFmpeg transcode with slow presets to push CPU
- Web client: `/` — login, upload or generate sample, start transcodes, track jobs, download outputs
- Load test script: `node scripts/load_test.js` to drive CPU >80% for ~5 minutes

## Quickstart (local)
```bash
cp .env.sample .env
npm install
npm start
# open http://localhost:8080
```

## Endpoints (REST)
- `POST /api/auth/login` -> `{username, password}` -> `{token, user}`
- `POST /api/videos/upload` (auth, multipart `file`) -> store file
- `POST /api/videos/generate-sample` (auth) -> creates 60s sample video server-side
- `POST /api/videos/transcode` (auth, JSON `{fileId, preset}`) -> 202 + job
- `GET  /api/videos/jobs` (auth) -> list my jobs
- `GET  /api/videos/job/:id` (auth) -> job status
- `GET  /api/videos/download/:jobId` (auth) -> download finished output
- `GET  /api/health/cpu` (auth) -> optional synthetic CPU compute

## Load testing
1) Login to get a token:
```bash
curl -s -X POST http://localhost:8080/api/auth/login       -H 'Content-Type: application/json'       -d '{"username":"angus","password":"pass123"}' | jq -r .token
```
2) Generate a sample to avoid upload bottleneck:
```bash
export TOKEN=...the token...
curl -s -X POST http://localhost:8080/api/videos/generate-sample       -H "Authorization: Bearer $TOKEN" | jq -r .file.id
export FILE_ID=...the id...
```
3) Run parallel transcodes for 5 minutes:
```bash
export BASE=http://localhost:8080
export PRESET=720p
export CONCURRENCY=6
export DURATION_SEC=300
node scripts/load_test.js
```
Monitor CPU with system tools (e.g., `top`, Activity Monitor). Increase `CONCURRENCY` and/or `PRESET` to push CPU usage.

## Docker (local)
```bash
docker build -t cab432-app:dev .
docker run --rm -it -p 8080:8080 --name cab432 cab432-app:dev
# open http://localhost:8080
```

## Mapping to Assessment Criteria
- **CPU intensive task (3 marks):** `/api/videos/transcode` invokes FFmpeg using slow/slower/veryslow presets to maximize CPU work.
- **CPU load testing (2 marks):** `scripts/load_test.js` generates enough concurrent requests to push CPU >80% for >=5 minutes (network headroom ensured by server-side sample generation).
- **Data types (3 marks):** Unstructured video files (`uploads/`), structured job+file metadata (`data/db.json`). (User identity data excluded.)
- **Containerise the app (3 marks):** `Dockerfile` installs ffmpeg and runs the app in Node runtime.
- **REST API (3 marks):** Primary interface; endpoints above. Suitable for any client.
- **User login (3 marks):** JWT with hard-coded users; role field included for meaningful distinction.
- **Web client (2.5 marks, Additional):** `/public` SPA covers all API endpoints.

**Optionally for later (Additional):**
- Extended API features (pagination/filtering), external APIs, infrastructure-as-code, custom processing variations, etc.

## Notes
- Do not commit `.env` with secrets.
- This repo uses only a simple JSON file for structured data to keep A1 lightweight. In A2 you can switch to AWS-managed data services.
