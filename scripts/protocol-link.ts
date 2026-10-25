// Makes a private link to the fluid protocol decision package for one professor, or lists what has been answered.
//
//   node --env-file=.env.local node_modules/ts-node/dist/bin.js --project scripts/tsconfig.migrate.json scripts/protocol-link.ts new "Dr Sharma"
//   node --env-file=.env.local node_modules/ts-node/dist/bin.js --project scripts/tsconfig.migrate.json scripts/protocol-link.ts new-short "Dr Sharma"
//   node --env-file=.env.local node_modules/ts-node/dist/bin.js --project scripts/tsconfig.migrate.json scripts/protocol-link.ts answers
//
// `new-short` makes a link to the short follow-up (lib/protocol-review/short.ts), with the name, designation and
// institution copied from that person's answers to the full package, so they only tick.
// `new` prints the link (it is shown once: only a hash is stored). `answers` prints every link's answers as text.
// Needs scripts/create_protocol_reviews.sql to have been run in the main project.
import { createHash, randomBytes } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { PROTOCOL_CARDS, PROTOCOL_PACKAGE } from "../lib/protocol-review/decisions";
import { SHORT_CARDS, SHORT_PACKAGE } from "../lib/protocol-review/short";

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
  if (cmd === "new-short") {
    const { data: prev, error: e1 } = await db
      .from("protocol_reviews")
      .select("reviewer_name, reviewer_designation, reviewer_institution")
      .eq("package", PROTOCOL_PACKAGE)
      .ilike("reviewer_name", label)
      .order("updated_at", { ascending: false })
      .limit(1);
    if (e1) throw e1;
    const token = randomBytes(24).toString("base64url");
    const { error } = await db.from("protocol_reviews").insert({
      package: SHORT_PACKAGE,
      token_hash: createHash("sha256").update(token).digest("hex"),
      created_by: label,
      expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      ...(prev?.[0] ?? {}),
    });
    if (error) throw error;
    console.log(prev?.[0] ? `(details copied from ${prev[0].reviewer_name}'s first answers)` : "(no earlier answers under that name: they will type their details)");
    console.log(`${SITE}/protocol-review/${token}`);
    return;
  }
  if (cmd === "answers-short") {
    const { data, error } = await db.from("protocol_reviews").select("*").eq("package", SHORT_PACKAGE).order("created_at");
    if (error) throw error;
    for (const r of data ?? []) {
      console.log(`
=== ${r.reviewer_name ?? "(no name yet)"} | link for "${r.created_by}" | ${r.submitted_at ? "SENT " + r.submitted_at : "not sent yet"}`);
      for (const c of SHORT_CARDS) {
        const a = (r.answers ?? {})[c.id];
        const picked = (a?.choice ?? "").split(",").filter(Boolean).map((id: string) => c.options.find((o) => o.id === id)?.label ?? id);
        console.log(`${c.id}  ${c.question}
     ${picked.length ? picked.join(" | ") : "(blank)"}${a?.note ? `
     note: ${a.note}` : ""}`);
      }
    }
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
  console.log("Use: new <label> | new-short <label> | answers | answers-short");
}
main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
