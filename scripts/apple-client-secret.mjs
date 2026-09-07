/**
 * Generate (and optionally push to Supabase) the Sign in with Apple client secret.
 *
 * Apple's OAuth client secret is a short-lived ES256 JWT signed with the .p8 key
 * from Apple Developer -> Keys. Apple caps its lifetime at 6 months, so it must be
 * regenerated and re-entered in Supabase (Authentication -> Providers -> Apple)
 * before it expires. This script does both steps without any dependencies.
 *
 * Required environment (shell env or .env in the repo root):
 *   APPLE_TEAM_ID        10-char Team ID (top-right of developer.apple.com/account)
 *   APPLE_KEY_ID         10-char Key ID of the Sign in with Apple key (Keys list)
 *   APPLE_SERVICES_ID    Services ID used as the OAuth client_id (e.g. app.ownjournal.service)
 *   APPLE_SIGNIN_P8      Contents of the AuthKey_<KEY_ID>.p8 file (multi-line PEM), OR
 *   APPLE_SIGNIN_P8_PATH Path to that .p8 file
 *
 * Required only with --push:
 *   SUPABASE_ACCESS_TOKEN  Personal access token from supabase.com/dashboard/account/tokens
 *   VITE_SUPABASE_PROJECT_ID  Project ref (already used by the app build)
 *
 * Usage:
 *   node scripts/apple-client-secret.mjs            # print the JWT to stdout
 *   node scripts/apple-client-secret.mjs --push     # generate and update Supabase auth config
 *   node scripts/apple-client-secret.mjs --days 150 # custom lifetime (max 180)
 */

import { createPrivateKey, sign } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MAX_DAYS = 180; // Apple's hard limit is 15777000 s (~182.6 days); stay under it.

// ---------- args ----------
const args = process.argv.slice(2);
const push = args.includes('--push');
const daysIdx = args.indexOf('--days');
const days = daysIdx !== -1 ? Number(args[daysIdx + 1]) : MAX_DAYS;
if (!Number.isFinite(days) || days <= 0 || days > MAX_DAYS) {
  fail(`--days must be between 1 and ${MAX_DAYS}`);
}

// ---------- env (shell first, then .env) ----------
const dotenv = loadDotEnv();
const env = (name, { required = true } = {}) => {
  const v = process.env[name] ?? dotenv[name];
  if (required && !v) fail(`Missing required environment variable ${name}`);
  return v;
};

const teamId = env('APPLE_TEAM_ID');
const keyId = env('APPLE_KEY_ID');
const servicesId = env('APPLE_SERVICES_ID');
const p8 = loadP8();

if (!/^[A-Z0-9]{10}$/.test(teamId)) fail('APPLE_TEAM_ID should be 10 uppercase alphanumerics');
if (!/^[A-Z0-9]{10}$/.test(keyId)) fail('APPLE_KEY_ID should be 10 uppercase alphanumerics');

// ---------- build + sign ----------
const now = Math.floor(Date.now() / 1000);
const exp = now + days * 24 * 60 * 60;

const header = { alg: 'ES256', kid: keyId, typ: 'JWT' };
const payload = {
  iss: teamId,
  iat: now,
  exp,
  aud: 'https://appleid.apple.com',
  sub: servicesId,
};

const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
const privateKey = createPrivateKey(p8);
if (privateKey.asymmetricKeyType !== 'ec') fail('The .p8 key is not an EC key; Apple Sign in keys are P-256.');
// JWS requires the raw r||s signature, not DER.
const signature = sign('sha256', Buffer.from(signingInput), { key: privateKey, dsaEncoding: 'ieee-p1363' });
const jwt = `${signingInput}.${b64url(signature)}`;

const expiresAt = new Date(exp * 1000).toISOString().slice(0, 10);
log(`Generated Apple client secret for ${servicesId} (kid ${keyId}), valid until ${expiresAt}.`);

if (!push) {
  process.stdout.write(jwt + '\n');
  log('Paste this into Supabase -> Authentication -> Providers -> Apple -> Secret Key, or re-run with --push.');
  process.exit(0);
}

// ---------- push to Supabase ----------
const accessToken = env('SUPABASE_ACCESS_TOKEN');
const projectRef = env('VITE_SUPABASE_PROJECT_ID');

const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/config/auth`, {
  method: 'PATCH',
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    external_apple_enabled: true,
    external_apple_client_id: servicesId,
    external_apple_secret: jwt,
  }),
});

if (!res.ok) {
  const body = await res.text().catch(() => '');
  fail(`Supabase Management API returned ${res.status}: ${body}`);
}

log(`Updated Supabase project ${projectRef}: Apple secret rotated, expires ${expiresAt}.`);
// Expose for GitHub Actions summaries; never print the JWT itself in --push mode.
if (process.env.GITHUB_OUTPUT) {
  const { appendFileSync } = await import('node:fs');
  appendFileSync(process.env.GITHUB_OUTPUT, `expires_at=${expiresAt}\n`);
}

// ---------- helpers ----------
function b64url(input) {
  return Buffer.from(input).toString('base64url');
}

function loadDotEnv() {
  const envPath = join(ROOT, '.env');
  if (!existsSync(envPath)) return {};
  const out = {};
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let value = m[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[m[1]] = value.replace(/\\n/g, '\n');
  }
  return out;
}

function loadP8() {
  const inline = env('APPLE_SIGNIN_P8', { required: false });
  if (inline) return inline.replace(/\\n/g, '\n');
  const path = env('APPLE_SIGNIN_P8_PATH', { required: false });
  if (path) {
    const abs = path.startsWith('/') ? path : join(ROOT, path);
    if (!existsSync(abs)) fail(`APPLE_SIGNIN_P8_PATH points to a missing file: ${abs}`);
    return readFileSync(abs, 'utf8');
  }
  fail('Provide the key via APPLE_SIGNIN_P8 (PEM contents) or APPLE_SIGNIN_P8_PATH (file path).');
}

function log(msg) {
  process.stderr.write(msg + '\n');
}

function fail(msg) {
  process.stderr.write(`Error: ${msg}\n`);
  process.exit(1);
}
