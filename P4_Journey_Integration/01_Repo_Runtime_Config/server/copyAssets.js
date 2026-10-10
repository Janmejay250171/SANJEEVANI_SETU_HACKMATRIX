import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcMl = path.join(__dirname, 'src', 'ml');
const distMl = path.join(__dirname, 'dist', 'ml');

if (fs.existsSync(srcMl)) {
  if (!fs.existsSync(distMl)) {
    fs.mkdirSync(distMl, { recursive: true });
  }
  const files = fs.readdirSync(srcMl);
  for (const f of files) {
    fs.copyFileSync(path.join(srcMl, f), path.join(distMl, f));
  }
  console.log('[Build] Copied ML model artifacts to dist/ml');
}
