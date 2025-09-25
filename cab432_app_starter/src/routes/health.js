import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

function mandelbrot(width=1500, height=1000, iter=1000) {
  let count = 0;
  for (let y=0; y<height; y++) {
    for (let x=0; x<width; x++) {
      let cr = (x - width/2.0) * 4.0 / width;
      let ci = (y - height/2.0) * 4.0 / width;
      let zr = 0, zi = 0;
      let i=0;
      while (zr*zr + zi*zi <= 4 && i < iter) {
        const tmp = zr*zr - zi*zi + cr;
        zi = 2*zr*zi + ci;
        zr = tmp;
        i++;
      }
      if (i === iter) count++;
    }
  }
  return count;
}

router.get('/cpu', requireAuth, async (req, res) => {
  const result = mandelbrot(1100, 800, 1200);
  res.json({ ok: true, result });
});

export default router;
