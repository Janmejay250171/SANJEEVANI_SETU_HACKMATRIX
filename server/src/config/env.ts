import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Always look up relative to file location
dotenv.config({ path: path.resolve(__dirname, '../../.env') });     // server/.env
if (!process.env.GEMINI_API_KEY || !process.env.GEMINI_API_KEY.trim()) {
  dotenv.config({ path: path.resolve(__dirname, '../../../.env'), override: true });   // root/.env
}
dotenv.config(); // fallback to current working directory

function resolveMongoUri(): string {
  let uri = (process.env.MONGODB_URI || process.env.MONGODB_URL || '').trim();
  const dbName = (process.env.DATABASE_NAME || 'sehatsure').trim();

  // 1. Strip surrounding quotes: "..." or '...'
  if ((uri.startsWith('"') && uri.endsWith('"')) || (uri.startsWith("'") && uri.endsWith("'"))) {
    uri = uri.slice(1, -1).trim();
  }

  // 2. Strip accidental duplicate key prefixes or leading equals: e.g. '=mongodb+srv://' or 'MONGODB_URI=...'
  const mongoIndex = uri.indexOf('mongodb');
  if (mongoIndex > 0) {
    uri = uri.slice(mongoIndex).trim();
  } else {
    uri = uri.replace(/^(?:MONGODB_URI|MONGODB_URL)?\s*=\s*/i, '').trim();
  }

  // Strip quotes again if they were inside MONGODB_URI="..."
  if ((uri.startsWith('"') && uri.endsWith('"')) || (uri.startsWith("'") && uri.endsWith("'"))) {
    uri = uri.slice(1, -1).trim();
  }

  // 3. Strip accidental placeholder angle brackets: <user>:<pass>
  if (uri.includes('<') || uri.includes('>')) {
    uri = uri.replace(/[<>]/g, '');
  }

  if (!uri) {
    return 'mongodb://localhost:27017/sehatsure';
  }

  // 4. Fix password containing unencoded '@' if multiple '@' signs exist before query/slash
  if (uri.startsWith('mongodb+srv://') || uri.startsWith('mongodb://')) {
    const scheme = uri.startsWith('mongodb+srv://') ? 'mongodb+srv://' : 'mongodb://';
    const rest = uri.slice(scheme.length);
    const [beforeQuery, ...queryParts] = rest.split('?');
    const queryPart = queryParts.join('?');

    const firstSlash = beforeQuery.indexOf('/');
    const authAndHost = firstSlash === -1 ? beforeQuery : beforeQuery.slice(0, firstSlash);
    const pathPart = firstSlash === -1 ? '' : beforeQuery.slice(firstSlash);

    const atParts = authAndHost.split('@');
    if (atParts.length > 2) {
      const host = atParts.pop();
      const userAndPass = atParts.join('%40');
      uri = `${scheme}${userAndPass}@${host}${pathPart}${queryPart ? '?' + queryPart : ''}`;
    }
  }

  // 5. If URI has no database name specified, insert dbName
  if (uri.startsWith('mongodb+srv://') || uri.startsWith('mongodb://')) {
    const [mainPart, queryPart] = uri.split('?');
    const scheme = uri.startsWith('mongodb+srv://') ? 'mongodb+srv://' : 'mongodb://';
    const withoutScheme = mainPart.replace(/^mongodb(\+srv)?:\/\//, '');
    const slashIndex = withoutScheme.indexOf('/');

    if (slashIndex === -1 || slashIndex === withoutScheme.length - 1) {
      const hostPart = slashIndex === -1 ? withoutScheme : withoutScheme.slice(0, -1);
      const query = queryPart ? `?${queryPart}` : '?retryWrites=true&w=majority';
      return `${scheme}${hostPart}/${dbName}${query.startsWith('?') ? query : '?' + query}`;
    }
  }

  return uri;
}

export const config = {
  mongodbUri: resolveMongoUri(),
  geminiApiKey: (process.env.GEMINI_API_KEY || '').trim(),
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
  port: parseInt(process.env.PORT || '5000', 10),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173'
};
