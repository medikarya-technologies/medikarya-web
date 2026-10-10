import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { checkDraft } from '../lib/studio/validate';
import { CATALOG_TEST_IDS } from '../lib/clinical-catalog';
import { upgradeReport } from '../lib/simulation/upgrade-report';

// Adds one case the admin wrote (not from the Case Studio, so no reviewer queue) straight to the library.
//
//   npx ts-node --project scripts/tsconfig.migrate.json scripts/add-case.ts data/cases/<id>.json            check + publish
//   npx ts-node --project scripts/tsconfig.migrate.json scripts/add-case.ts data/cases/<id>.json --draft    check + save hidden
//   npx ts-node --project scripts/tsconfig.migrate.json scripts/add-case.ts data/cases/<id>.json --dry-run  check only
//
// The case is checked the same way as a converted studio case (lib/studio/validate.ts) and must open at the bedside.
// It never overwrites a case it did not add itself (case_json.source.kind "admin"), so a typo in the id cannot
// replace a studio or founding case. The library caches its list for up to a minute.

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const DRY_RUN = args.includes('--dry-run');
const status = args.includes('--draft') ? 'draft' : 'published';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function main() {
  if (!file) throw new Error('Give the case file: scripts/add-case.ts data/cases/<id>.json');
  const caseJson = JSON.parse(fs.readFileSync(path.resolve(file), 'utf-8'));

  // the URL names the patient, never the disease (the validator checks displayTitle does not give it away)
  if (typeof caseJson.id !== 'string' || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(caseJson.id)) throw new Error('id must be a lowercase hyphenated slug.');

  const check = checkDraft(caseJson, { catalogIds: new Set(CATALOG_TEST_IDS), identifiers: { names: [], places: [] } });
  for (const w of check.warnings) console.log(`  warning: ${w}`);
  if (check.errors.length) {
    for (const e of check.errors) console.log(`  ERROR: ${e}`);
    throw new Error(`${check.errors.length} problem(s): nothing was saved.`);
  }
  const report = upgradeReport(caseJson);
  console.log(`  ${report.bedside ? '→' : '⚠'} ${report.headline}`);
  for (const note of report.notes) console.log(`    · ${note}`);
  if (!report.bedside) throw new Error('It would not open at the bedside: nothing was saved.');
  if (DRY_RUN) return console.log(`Checked ${caseJson.id}: ready to add.`);

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase credentials in .env.local');
  const db = createClient(url, key);

  const { data: existing, error: readError } = await db.from('cases').select('id, status, kind:case_json->source->>kind').eq('id', caseJson.id).maybeSingle();
  if (readError) throw readError;
  if (existing && existing.kind !== 'admin') throw new Error(`"${caseJson.id}" is already a different case (${existing.status}). Choose another id.`);

  const now = new Date().toISOString();
  const full = { ...caseJson, status, source: { kind: 'admin', added_at: caseJson.source?.added_at ?? now, updated_at: now } };
  const { error } = await db.from('cases').upsert(
    {
      id: full.id,
      title: full.title,
      category: full.category,
      difficulty: full.difficulty,
      estimated_time: full.estimatedTime,
      status,
      case_json: full,
      updated_at: now,
    },
    { onConflict: 'id' }
  );
  if (error) throw error;
  console.log(`${existing ? 'Updated' : 'Added'} ${full.id} as ${status}. In the library within a minute: /dashboard/cases/${full.id}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
