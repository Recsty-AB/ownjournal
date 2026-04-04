/**
 * Post-build script: injects VITE_APPLE_TEAM_ID into the built
 * apple-app-site-association file so the real Team ID is never
 * committed to source (the repo is open-source).
 *
 * Usage:
 *   VITE_APPLE_TEAM_ID=ABC123 node scripts/inject-team-id.js
 *
 * If VITE_APPLE_TEAM_ID is not set, the script warns but does not fail
 * the build (the AASA file will still contain the "TEAM_ID" placeholder).
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const AASA_PATH = join(ROOT, 'dist', '.well-known', 'apple-app-site-association');

// Node doesn't load .env files automatically (Vite does, but this runs after Vite).
// Read from the shell environment first, then fall back to parsing .env.
function loadTeamId() {
  if (process.env.VITE_APPLE_TEAM_ID) return process.env.VITE_APPLE_TEAM_ID;

  const envPath = join(ROOT, '.env');
  if (existsSync(envPath)) {
    const lines = readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*VITE_APPLE_TEAM_ID\s*=\s*(.+?)\s*$/);
      if (match) return match[1];
    }
  }
  return null;
}

const TEAM_ID = loadTeamId();

if (!TEAM_ID) {
  console.warn('⚠️  VITE_APPLE_TEAM_ID is not set — apple-app-site-association will contain placeholder "TEAM_ID".');
  console.warn('   Set this env var for iOS Universal Links to work.');
  process.exit(0);
}

if (!existsSync(AASA_PATH)) {
  console.warn('⚠️  apple-app-site-association not found at', AASA_PATH);
  process.exit(0);
}

const content = readFileSync(AASA_PATH, 'utf8');
const updated = content.replace(/TEAM_ID/g, TEAM_ID);
writeFileSync(AASA_PATH, updated, 'utf8');

console.log(`✅ Injected Apple Team ID "${TEAM_ID}" into apple-app-site-association`);
