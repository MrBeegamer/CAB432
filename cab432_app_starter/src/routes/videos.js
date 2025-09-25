// src/routes/videos.js
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { Readable } from 'stream';
import { nanoid } from 'nanoid';
import { requireAuth } from '../middleware/auth.js';
import { transcodeVideo, generateSampleVideo } from '../services/ffmpeg.js';
import { putObjectStream, getObjectStream } from '../services/storage_s3.js';
import {
  putFileRec,
  listFilesByOwner,
  getFileRec,
  putJobRec,
  listJobsByOwner,
  getJobRec,
  updateJobStatus
} from '../services/metadata_dynamo.js';

const router = Router();

// Multer in-memory storage so we can stream to S3 (no local disk)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 * 1024 } // 1 GB
});

// Upload a video -> stream to S3, record metadata in DynamoDB
router.post('/upload', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'missing file' });
    const id = nanoid(10);
    const ext = path.extname(req.file.originalname) || '.bin';
    const key = `uploads/${id}${ext}`;

    await putObjectStream(key, req.file.mimetype || 'application/octet-stream', readableFromBuffer(req.file.buffer));

    const fileRec = {
      fileId: id,
      owner: req.user.sub,
      s3Key: key,
      originalName: req.file.originalname,
      size: req.file.size,
      createdAt: new Date().toISOString()
    };
    await putFileRec(fileRec);

    res.json({ ok: true, file: fileRec });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// Generate a sample video -> upload to S3, record metadata in DynamoDB
router.post('/generate-sample', requireAuth, async (req, res) => {
  try {
    const id = nanoid(10);
    const tmpPath = path.join(os.tmpdir(), `${id}.mp4`);
    await generateSampleVideo(tmpPath, 60);

    const key = `uploads/${id}.mp4`;
    const buf = fs.readFileSync(tmpPath);
    await putObjectStream(key, 'video/mp4', readableFromBuffer(buf));
    safeUnlink(tmpPath);

    const fileRec = {
      fileId: id,
      owner: req.user.sub,
      s3Key: key,
      originalName: 'sample_generated.mp4',
      size: buf.length,
      createdAt: new Date().toISOString()
    };
    await putFileRec(fileRec);

    res.json({ ok: true, file: fileRec });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// Create a transcode job: S3 -> /tmp -> ffmpeg -> S3 (async)
router.post('/transcode', requireAuth, async (req, res) => {
  try {
    const { fileId, preset = '720p' } = req.body || {};
    const fileRec = await getFileRec(fileId);
    if (!fileRec || fileRec.owner !== req.user.sub) {
      return res.status(404).json({ error: 'file not found' });
    }

    const jobId = nanoid(12);
    const outKey = `outputs/${jobId}.mp4`;
    const createdAt = new Date().toISOString();

    const job = {
      jobId,
      owner: req.user.sub,
      fileId,
      preset,
      status: 'running',
      s3Key: outKey,
      createdAt,
      finishedAt: null,
      error: null
    };
    await putJobRec(job);

    // Fire-and-forget worker
    (async () => {
      const inTmp = path.join(os.tmpdir(), `${fileId}-${jobId}-in`);
      const outTmp = path.join(os.tmpdir(), `${jobId}.mp4`);
      try {
        // Download input from S3 to /tmp
        const { stream: inStream } = await getObjectStream(fileRec.s3Key);
        await streamToFile(inStream, inTmp);

        // Transcode with ffmpeg
        await transcodeVideo(inTmp, outTmp, preset);

        // Upload output to S3
        const outBuf = fs.readFileSync(outTmp);
        await putObjectStream(outKey, 'video/mp4', readableFromBuffer(outBuf));

        // Cleanup
        safeUnlink(inTmp);
        safeUnlink(outTmp);

        await updateJobStatus(jobId, { status: 'finished', finishedAt: new Date().toISOString() });
      } catch (err) {
        safeUnlink(inTmp);
        safeUnlink(outTmp);
        await updateJobStatus(jobId, { status: 'error', error: String(err.message || err) });
      }
    })();

    res.status(202).json({ ok: true, job });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// List my files (DynamoDB)
router.get('/files', requireAuth, async (req, res) => {
  try {
    const files = await listFilesByOwner(req.user.sub);
    res.json({ ok: true, files });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// List my jobs (DynamoDB)
router.get('/jobs', requireAuth, async (req, res) => {
  try {
    const jobs = await listJobsByOwner(req.user.sub);
    res.json({ ok: true, jobs });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// Job detail
router.get('/job/:id', requireAuth, async (req, res) => {
  try {
    const job = await getJobRec(req.params.id);
    if (!job || job.owner !== req.user.sub) return res.status(404).json({ error: 'job not found' });
    res.json({ ok: true, job });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// Download finished output -> stream from S3
router.get('/download/:jobId', requireAuth, async (req, res) => {
  try {
    const job = await getJobRec(req.params.jobId);
    if (!job || job.owner !== req.user.sub) return res.status(404).json({ error: 'job not found' });
    if (job.status !== 'finished') return res.status(409).json({ error: 'job not finished' });

    const { stream, contentType } = await getObjectStream(job.s3Key);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(job.s3Key)}"`);
    stream.pipe(res);
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

export default router;

/** Helpers **/
function readableFromBuffer(buf) {
  const r = new Readable();
  r.push(buf);
  r.push(null);
  return r;
}

function streamToFile(stream, filepath) {
  return new Promise((resolve, reject) => {
    const ws = fs.createWriteStream(filepath);
    stream.on('error', reject);
    ws.on('error', reject);
    ws.on('finish', resolve);
    stream.pipe(ws);
  });
}

function safeUnlink(p) {
  try { fs.unlinkSync(p); } catch {}
}