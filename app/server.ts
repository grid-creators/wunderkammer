import express from 'express';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json());

const PORT = parseInt(process.env.PORT || '3000', 10);
const DATA_DIR = join(__dirname, '..', 'data');
const CONFIG_PATH = join(DATA_DIR, 'admin-config.json');
const USERS_PATH = join(DATA_DIR, 'admin-users.json');
const POIS_PATH = join(__dirname, 'src', 'data', 'pois.ts');
const BCRYPT_ROUNDS = 12;

// --- Password hashing (bcrypt) ---
async function createUser(username: string, password: string): Promise<StoredUser> {
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  return { username, passwordHash };
}

async function verifyPassword(password: string, user: StoredUser): Promise<boolean> {
  return bcrypt.compare(password, user.passwordHash);
}

// --- User persistence ---
interface StoredUser {
  username: string;
  passwordHash: string;
  salt?: string; // legacy field, ignored with bcrypt
}

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readUsers(): StoredUser[] {
  try {
    if (existsSync(USERS_PATH)) {
      return JSON.parse(readFileSync(USERS_PATH, 'utf-8')) as StoredUser[];
    }
  } catch { /* ignore */ }
  return [];
}

function writeUsers(users: StoredUser[]): void {
  ensureDataDir();
  writeFileSync(USERS_PATH, JSON.stringify(users, null, 2));
}

// Seed default admin if no users exist
if (readUsers().length === 0) {
  createUser('admin', 'admin').then((user) => {
    writeUsers([user]);
    console.log('Created default admin user: admin');
  });
}

// --- Session store (in-memory) ---
const sessions = new Map<string, { username: string; expiresAt: number }>();
const SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours

function createSession(username: string): string {
  const token = randomBytes(32).toString('hex');
  sessions.set(token, { username, expiresAt: Date.now() + SESSION_TTL });
  return token;
}

function validateToken(token: string | undefined): { valid: boolean; username?: string } {
  if (!token) return { valid: false };
  const session = sessions.get(token);
  if (!session) return { valid: false };
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return { valid: false };
  }
  return { valid: true, username: session.username };
}

function extractToken(req: express.Request): string | undefined {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  return undefined;
}

// --- Config persistence ---
function readConfig(): object {
  try {
    if (existsSync(CONFIG_PATH)) {
      return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    }
  } catch { /* ignore */ }
  return { pois: {} };
}

function writeConfig(config: object): void {
  ensureDataDir();
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

if (!existsSync(CONFIG_PATH)) {
  writeConfig({ pois: {} });
}

// --- API Routes ---

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    res.status(400).json({ error: 'Username and password required' });
    return;
  }
  const users = readUsers();
  const user = users.find((u) => u.username === username);
  if (!user || !(await verifyPassword(password, user))) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  const token = createSession(username);
  res.json({ token, username });
});

app.post('/api/auth/logout', (req, res) => {
  const token = extractToken(req);
  if (token) sessions.delete(token);
  res.json({ ok: true });
});

app.get('/api/auth/check', (req, res) => {
  const token = extractToken(req);
  const { valid, username } = validateToken(token);
  res.json({ authenticated: valid, username: username ?? null });
});

app.put('/api/auth/password', async (req, res) => {
  const token = extractToken(req);
  const { valid, username } = validateToken(token);
  if (!valid || !username) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: 'Current and new password required' });
    return;
  }
  if (newPassword.length < 4) {
    res.status(400).json({ error: 'Password must be at least 4 characters' });
    return;
  }
  const users = readUsers();
  const user = users.find((u) => u.username === username);
  if (!user || !(await verifyPassword(currentPassword, user))) {
    res.status(401).json({ error: 'Current password is incorrect' });
    return;
  }
  const updated = await createUser(username, newPassword);
  const newUsers = users.map((u) => u.username === username ? updated : u);
  writeUsers(newUsers);
  res.json({ ok: true });
});

// Public: anyone can read the config
app.get('/api/config', (_req, res) => {
  res.json(readConfig());
});

// Protected: only admin can write
app.put('/api/config', (req, res) => {
  const token = extractToken(req);
  if (!validateToken(token).valid) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  writeConfig(req.body);
  res.json({ ok: true });
});

// --- Serve app ---
async function start() {
  if (process.env.NODE_ENV === 'production') {
    const distPath = join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(join(distPath, 'index.html'));
    });
  } else {
    // Register PATCH route before Vite middleware (Vite intercepts unmatched requests)
    app.patch('/api/pois/:id/factgrid', (req, res) => {
      const token = extractToken(req);
      if (!validateToken(token).valid) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const poiId = parseInt(req.params.id, 10);
      if (isNaN(poiId)) {
        res.status(400).json({ error: 'Invalid POI id' });
        return;
      }
      const body = req.body as { factgridId?: string | null } | undefined;
      const factgridId = body?.factgridId ?? null;
      if (factgridId !== null && (typeof factgridId !== 'string' || !/^[A-Za-z0-9_-]+$/.test(factgridId))) {
        res.status(400).json({ error: 'Invalid factgridId' });
        return;
      }
      try {
        if (!existsSync(POIS_PATH)) {
          res.status(404).json({ error: 'pois.ts not found' });
          return;
        }
        const source = readFileSync(POIS_PATH, 'utf-8');
        const newValue = factgridId ? `'${factgridId}'` : 'null';
        const idRegex = new RegExp(`\\bid:\\s*${poiId}\\s*,`);
        const idMatch = idRegex.exec(source);
        if (!idMatch) {
          res.status(404).json({ error: 'POI not found in pois.ts' });
          return;
        }
        const after = source.slice(idMatch.index + idMatch[0].length);
        const fgMatch = /\bfactgrid_id:\s*[^\n,]+,?/.exec(after);
        if (!fgMatch) {
          res.status(404).json({ error: 'factgrid_id field not found' });
          return;
        }
        const fgStart = idMatch.index + idMatch[0].length + fgMatch.index;
        const fgEnd = fgStart + fgMatch[0].length;
        const updated = source.slice(0, fgStart) + `factgrid_id: ${newValue},` + source.slice(fgEnd);
        writeFileSync(POIS_PATH, updated, 'utf-8');
        res.json({ ok: true });
      } catch (err) {
        res.status(500).json({ error: String(err) });
      }
    });

    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

start();
