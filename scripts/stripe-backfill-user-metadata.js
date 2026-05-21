#!/usr/bin/env node
/**
 * Stamps metadata.user_id on every Stripe customer referenced by
 * public.subscriptions.stripe_customer_id. Must run BEFORE deploying the
 * tightened create-checkout adoption check; otherwise legitimate users with
 * existing Stripe customers fail the metadata match and get a new customer
 * record on their next checkout (losing continuity).
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... STRIPE_SECRET_KEY=... \
 *     node scripts/stripe-backfill-user-metadata.js          # dry-run (default)
 *
 *   ... node scripts/stripe-backfill-user-metadata.js --apply
 *
 * Behavior:
 *   - Matches (metadata.user_id === db.user_id)       → no-op
 *   - Missing  (no metadata.user_id on customer)      → stamps it (in --apply)
 *   - Mismatch (metadata.user_id !== db.user_id)      → flags for human review,
 *                                                       never overwritten
 *   - Customer not found / deleted                    → logged, skipped
 */
import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');
const STRIPE_API = 'https://api.stripe.com/v1';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !STRIPE_SECRET_KEY) {
  console.error('Missing one of SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY');
  process.exit(1);
}

async function stripeRequest(method, path, formBody) {
  const init = {
    method,
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
  };
  if (formBody) {
    init.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    init.body = formBody;
  }
  const res = await fetch(`${STRIPE_API}${path}`, init);
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { raw: text }; }
  return { status: res.status, ok: res.ok, body };
}

async function main() {
  console.log(APPLY ? 'MODE: --apply (will write to Stripe)' : 'MODE: dry-run (no writes)');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: rows, error } = await supabase
    .from('subscriptions')
    .select('user_id, stripe_customer_id')
    .not('stripe_customer_id', 'is', null);

  if (error) {
    console.error('Failed to read subscriptions:', error);
    process.exit(1);
  }

  console.log(`Scanning ${rows.length} customer(s)…\n`);

  const counts = { match: 0, missing: 0, mismatch: 0, notFound: 0, error: 0, written: 0 };

  for (const { user_id, stripe_customer_id } of rows) {
    const { status, ok, body } = await stripeRequest('GET', `/customers/${stripe_customer_id}`);

    if (!ok) {
      if (status === 404 || body?.error?.code === 'resource_missing') {
        console.log(`NOT_FOUND  ${stripe_customer_id}  (user ${user_id})`);
        counts.notFound++;
      } else {
        console.error(`ERROR      ${stripe_customer_id}  status=${status} ${JSON.stringify(body)}`);
        counts.error++;
      }
      continue;
    }

    if (body.deleted) {
      console.log(`DELETED    ${stripe_customer_id}  (user ${user_id})`);
      counts.notFound++;
      continue;
    }

    const existing = body.metadata?.user_id;
    if (existing === user_id) {
      counts.match++;
      continue;
    }

    if (existing && existing !== user_id) {
      console.log(`MISMATCH   ${stripe_customer_id}  db_user=${user_id}  stripe_user=${existing}  (needs human review)`);
      counts.mismatch++;
      continue;
    }

    // Missing — safe to stamp.
    counts.missing++;
    if (!APPLY) {
      console.log(`MISSING    ${stripe_customer_id}  user=${user_id}  (would stamp)`);
      continue;
    }

    const form = new URLSearchParams();
    form.set('metadata[user_id]', user_id);
    const writeRes = await stripeRequest('POST', `/customers/${stripe_customer_id}`, form.toString());
    if (writeRes.ok) {
      console.log(`STAMPED    ${stripe_customer_id}  user=${user_id}`);
      counts.written++;
    } else {
      console.error(`WRITE_FAIL ${stripe_customer_id}  status=${writeRes.status} ${JSON.stringify(writeRes.body)}`);
      counts.error++;
    }
  }

  console.log('\nSummary:');
  for (const [k, v] of Object.entries(counts)) console.log(`  ${k.padEnd(10)} ${v}`);

  if (counts.mismatch > 0 || counts.error > 0) {
    console.log('\nNon-zero MISMATCH or ERROR — review before re-running with --apply.');
    process.exit(2);
  }
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
