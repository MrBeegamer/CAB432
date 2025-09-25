import { Router } from 'express';
import jwt from 'jsonwebtoken';

const router = Router();

// Hard-coded users for Assessment 1 (OK per brief). Distinct roles for "meaningful differences".
const USERS = [
  { id: '1', username: 'admin', password: 'admin123', role: 'admin' },
  { id: '2', username: 'angus', password: 'pass123', role: 'user' }
];

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  const found = USERS.find(u => u.username === username && u.password === password);
  if (!found) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ sub: found.id, username: found.username, role: found.role }, process.env.JWT_SECRET, { expiresIn: '6h' });
  res.json({ token, user: { id: found.id, username: found.username, role: found.role } });
});

export default router;
