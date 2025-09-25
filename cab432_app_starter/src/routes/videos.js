import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { nanoid } from 'nanoid';
import { requireAuth } from '../middleware/auth.js';
import { readDB, writeDB } from '../utils/fsdb.js';
import { transcodeVideo, generateSampleVideo } from '../services/ffmpeg.js';

const router = Router();

const uploadDir = path.join(process.cwd(), 'uploads');
const outputDir = path.join(process.cwd(), 'outputs');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const id = nanoid(10);
    const ext = path.extname(file.originalname) || '.bin';
    cb(null, `${id}${ext}`);
  }
});
const upload = multer({ storage });

// Upload a video (unstructured data)
router.post('/upload', requireAuth, upload.single('file'), (req, res) => {
  const db = readDB();
  const fileRec = {
    id: path.parse(req.file.filename).name,
    owner: req.user.sub,
    originalName: req.file.originalname,
    path: req.file.path,
    size: req.file.size,
    createdAt: new Date().toISOString()
  };
  db.files.push(fileRec);
  writeDB(db);
  res.json({ ok: true, file: fileRec });
});

// Generate a sample video server-side (to avoid client upload bottleneck)
router.post('/generate-sample', requireAuth, async (req, res) => {
  const id = nanoid(10);
  const outPath = path.join(uploadDir, `${id}.mp4`);
  try {
    await generateSampleVideo(outPath, 60);
    const db = readDB();
    const fileRec = {
      id,
      owner: req.user.sub,
      originalName: 'sample_generated.mp4',
      path: outPath,
      size: fs.statSync(outPath).size,
      createdAt: new Date().toISOString()
    };
    db.files.push(fileRec);
    writeDB(db);
    res.json({ ok: true, file: fileRec });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Create a transcode job (structured metadata + CPU task)
router.post('/transcode', requireAuth, async (req, res) => {
  const { fileId, preset='720p' } = req.body || {};
  const db = readDB();
  const fileRec = db.files.find(f => f.id === fileId);
  if (!fileRec) return res.status(404).json({ error: 'file not found' });

  const jobId = nanoid(12);
  const outPath = path.join(outputDir, `${jobId}.mp4`);
  const job = {
    id: jobId,
    owner: req.user.sub,
    fileId,
    preset,
    status: 'running',
    output: outPath,
    createdAt: new Date().toISOString(),
    finishedAt: null,
    error: null
  };
  db.jobs.push(job);
  writeDB(db);

  // Fire-and-forget CPU-intensive task
  transcodeVideo(fileRec.path, outPath, preset)
    .then(() => {
      const db2 = readDB();
      const j = db2.jobs.find(j => j.id === jobId);
      if (j) {
        j.status = 'finished';
        j.finishedAt = new Date().toISOString();
        writeDB(db2);
      }
    })
    .catch(err => {
      const db2 = readDB();
      const j = db2.jobs.find(j => j.id === jobId);
      if (j) {
        j.status = 'error';
        j.error = err.message;
        writeDB(db2);
      }
    });

  res.status(202).json({ ok: true, job });
});

router.get('/jobs', requireAuth, (req, res) => {
  const db = readDB();
  const mine = db.jobs.filter(j => j.owner === req.user.sub).sort((a,b)=> (b.createdAt||'').localeCompare(a.createdAt||''));
  res.json({ ok: true, jobs: mine });
});

router.get('/job/:id', requireAuth, (req, res) => {
  const db = readDB();
  const job = db.jobs.find(j => j.id === req.params.id && j.owner === req.user.sub);
  if (!job) return res.status(404).json({ error: 'job not found' });
  res.json({ ok: true, job });
});

// Serve finished outputs (authorization: owner only)
router.get('/download/:jobId', requireAuth, (req, res) => {
  const db = readDB();
  const job = db.jobs.find(j => j.id === req.params.jobId && j.owner === req.user.sub);
  if (!job) return res.status(404).json({ error: 'job not found' });
  if (job.status !== 'finished') return res.status(409).json({ error: 'job not finished' });
  res.download(job.output, path.basename(job.output));
});

// List my files
router.get('/files', requireAuth, (req, res) => {
  const db = readDB();
  const mine = db.files.filter(f => f.owner === req.user.sub).sort((a,b)=> (b.createdAt||'').localeCompare(a.createdAt||''));
  res.json({ ok: true, files: mine });
});

export default router;
