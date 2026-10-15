// Makes a private link to the fluid protocol decision package for one professor, or lists what has been answered.
//
//   node --env-file=.env.local node_modules/ts-node/dist/bin.js --project scripts/tsconfig.migrate.json scripts/protocol-link.ts new "Dr Sharma"
//   node --env-file=.env.local node_modules/ts-node/dist/bin.js --project scripts/tsconfig.migrate.json scripts/protocol-link.ts answers
//
// `new` prints the link (it is shown once: only a hash is stored). `answers` prints every link's answers as text.
// Needs scripts/create_protocol_reviews.sql to have been run in the main project.
import { createHash, randomBytes } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { PROTOCOL_CARDS, PROTOCOL_PACKAGE } from "../lib/protocol-review/decisions";

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://medikarya.in";

async function main() {
  const [cmd, label = "unnamed"] = process.argv.slice(2);
  if (cmd === "new") {
    const token = randomBytes(24).toString("base64url");
    const { error } = await db.from("protocol_reviews").insert({
      package: PROTOCOL_PACKAGE,
      token_hash: createHash("sha256").update(token).digest("hex"),
      created_by: label,
      expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    });
    if (error) throw error;
    console.log(`${SITE}/protocol-review/${token}`);
    return;
  }
  if (cmd === "answers") {
    const { data, error } = await db.from("protocol_reviews").select("*").eq("package", PROTOCOL_PACKAGE).order("created_at");
    if (error) throw error;
    for (const r of data ?? []) {
      console.log(`\n=== ${r.reviewer_name ?? "(no name yet)"} | ${r.reviewer_designation ?? ""} | ${r.reviewer_institution ?? ""} | link for "${r.created_by}" | ${r.submitted_at ? "SENT " + r.submitted_at : "not sent yet"}`);
      for (const c of PROTOCOL_CARDS) {
        const a = (r.answers ?? {})[c.id];
        const opt = c.options?.find((o) => o.id === a?.choice);
        console.log(`${c.id}  ${c.title}\n     ${a ? [opt ? `${opt.id}. ${opt.label}` : "", a.other ? `[${a.other}]` : "", a.note ? `note: ${a.note}` : ""].filter(Boolean).join("  ") : "(blank)"}`);
      }
    }
    return;
  }
  console.log("Use: new <label> | answers");
}
main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
