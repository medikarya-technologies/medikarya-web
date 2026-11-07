import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Writes a case from the database to data/cases/<id>.json (not in git), so it can be edited and saved back with
// scripts/add-case.ts, or used as the starting point for a new case. The case files live only in the database and on
// the machines that export them: the repository is public and a case file holds its answers.
//
//   npx ts-node --project scripts/tsconfig.migrate.json scripts/export-case.ts <case id>              one case
//   npx ts-node --project scripts/tsconfig.migrate.json scripts/export-case.ts --all                  every case
//   npx ts-node --project scripts/tsconfig.migrate.json scripts/export-case.ts <case id> --out <dir>  somewhere else
//
// An existing file is kept as <id>.json.bak before it is replaced.

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const args = process.argv.slice(2);
const all = args.includes('--all');
const outAt = args.indexOf('--out');
const outDir = path.resolve(outAt >= 0 ? args[outAt + 1] : path.join(__dirname, '../data/cases'));
const id = args.find((a, i) => !a.startsWith('--') && (outAt < 0 || i !== outAt + 1));

async function main() {
  if (!all && !id) throw new Error('Give a case id, or --all.');
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase credentials in .env.local');
  const db = createClient(url, key);

  const query = db.from('cases').select('id, status, case_json').order('id');
  const { data, error } = all ? await query : await query.eq('id', id!);
  if (error) throw error;
  if (!data?.length) throw new Error(`No case "${id}".`);

  fs.mkdirSync(outDir, { recursive: true });
  for (const row of data) {
    const file = path.join(outDir, `${row.id}.json`);
    if (fs.existsSync(file)) fs.copyFileSync(file, `${file}.bak`);
    fs.writeFileSync(file, JSON.stringify(row.case_json, null, 2) + '\n');
    console.log(`  ${row.status.padEnd(9)} ${path.relative(process.cwd(), file)}`);
  }
  console.log(`Wrote ${data.length} case${data.length === 1 ? '' : 's'}.`);
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
