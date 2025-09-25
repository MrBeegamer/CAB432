import { spawn } from 'child_process';
import path from 'path';

// Simple wrapper that returns a Promise resolving when ffmpeg exits.
export function transcodeVideo(inputPath, outputPath, preset='720p') {
  const args = buildArgs(inputPath, outputPath, preset);
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', args);
    let stderr = '';
    ff.stderr.on('data', d => { stderr += d.toString(); });
    ff.on('close', code => {
      if (code === 0) resolve({ ok: true });
      else reject(new Error('ffmpeg failed: ' + stderr.slice(-1000)));
    });
  });
}

export function generateSampleVideo(outputPath, duration=60) {
  const args = [
    '-y',
    '-f', 'lavfi',
    '-i', 'testsrc=size=1280x720:rate=30',
    '-t', String(duration),
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    outputPath
  ];
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', args);
    let stderr = '';
    ff.stderr.on('data', d => { stderr += d.toString(); });
    ff.on('close', code => {
      if (code === 0) resolve({ ok: true });
      else reject(new Error('ffmpeg sample failed: ' + stderr.slice(-1000)));
    });
  });
}

function buildArgs(inputPath, outputPath, preset) {
  const map = {
    '360p': ['-vf', 'scale=-2:360', '-c:v', 'libx264', '-preset', 'slow', '-crf', '28', '-c:a', 'aac'],
    '480p': ['-vf', 'scale=-2:480', '-c:v', 'libx264', '-preset', 'slow', '-crf', '26', '-c:a', 'aac'],
    '720p': ['-vf', 'scale=-2:720', '-c:v', 'libx264', '-preset', 'slower', '-crf', '24', '-c:a', 'aac'],
    '1080p': ['-vf', 'scale=-2:1080', '-c:v', 'libx264', '-preset', 'veryslow', '-crf', '23', '-c:a', 'aac']
  };
  const common = map[preset] || map['720p'];
  return ['-y', '-i', inputPath, ...common, outputPath];
}
