import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_PATH = path.join(__dirname, '..', '..', 'data', 'db.json');

export function readDB() {
  try {
    const raw = fs.readFileSync(DATA_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { jobs: [], files: [] };
  }
}

export function writeDB(db) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(db, null, 2));
}
