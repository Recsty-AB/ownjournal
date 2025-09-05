#!/usr/bin/env node
/**
 * Verifies that assetlinks.json is live and correctly served at app.ownjournal.app.
 * Run after deploying to confirm Google Play domain verification can succeed.
 *
 * Usage: node scripts/verify-assetlinks.js
 * Or: npm run verify-assetlinks
 */
const url = 'https://app.ownjournal.app/.well-known/assetlinks.json';

async function main() {
  console.log('Checking', url, '...\n');
  let res;
  try {
    res = await fetch(url, { redirect: 'follow' });
  } catch (err) {
    console.error('Fetch failed:', err.message);
    process.exit(1);
  }

  const statusOk = res.ok;
  const contentType = res.headers.get('content-type') || '';
  const contentTypeOk = contentType.toLowerCase().includes('application/json');

  console.log('Status:', res.status, res.statusText, statusOk ? '✓' : '✗');
  console.log('Content-Type:', contentType || '(missing)', contentTypeOk ? '✓' : '✗');

  if (!statusOk) {
    console.error('\nExpected HTTP 200. Fix deployment so the URL returns the file.');
    process.exit(1);
  }
  if (!contentTypeOk) {
    console.error('\nExpected Content-Type: application/json. Configure your host to serve this path with that header (see vercel.json / Netlify _headers).');
    process.exit(1);
  }

  let body;
  try {
    body = await res.text();
    JSON.parse(body);
  } catch (err) {
    console.error('\nResponse is not valid JSON:', err.message);
    process.exit(1);
  }

  let data;
  try {
    data = JSON.parse(body);
  } catch {
    process.exit(1);
  }
  const hasTarget = Array.isArray(data) && data.some(
    (entry) => entry?.target?.package_name === 'app.ownjournal' && Array.isArray(entry?.target?.sha256_cert_fingerprints)
  );
  if (!hasTarget) {
    console.error("\nJSON does not contain expected target (package_name 'app.ownjournal' and sha256_cert_fingerprints).");
    process.exit(1);
  }

  console.log('\nassetlinks.json is reachable, valid JSON, and has the expected app target.');
  console.log('Ensure sha256_cert_fingerprints includes your Play Console App signing key certificate SHA-256.');
}

main();
