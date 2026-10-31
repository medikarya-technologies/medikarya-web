// The case study guides still waiting for a doctor's check (pendingCheck in lib/seo/case-guides.ts), printed as one
// Markdown sheet a doctor can read and mark up. Needs no secrets and touches nothing.
//   node --experimental-strip-types scripts/case-guides-review.mjs > guides-for-review.md
// When a guide has been read and corrected, delete its `pendingCheck: true` line and it goes live on the next deploy.
const { GUIDES_AWAITING_CHECK } = await import("../lib/seo/case-guides.ts");

const list = (items) => items.map((i) => `- ${i}`).join("\n");
const out = [
  "# Case study guides awaiting a doctor's check",
  "",
  `${Object.keys(GUIDES_AWAITING_CHECK).length} guides. Each is a revision guide to the patient's presenting complaint, written for MBBS students.`,
  "By design none of them names or ranks the case's diagnosis: the differential is grouped and unordered. Please check",
  "that every statement is correct and current, and mark anything to change. Nothing here is live until it is checked.",
];
for (const [id, g] of Object.entries(GUIDES_AWAITING_CHECK)) {
  out.push(
    "", "---", "", `## ${g.h1}`, "", `Case: \`${id}\``, "", `**Why it matters.** ${g.why}`, "",
    "**What to ask in the history**", "", list(g.history), "",
    "**Red flags**", "", list(g.redFlags), "",
    "**What to examine**", "", list(g.examination), "",
    "**First investigations**", "", list(g.investigations), "",
    `**Differential diagnosis of ${g.complaint}** (grouped, not ranked)`, "",
    ...g.differential.map((d) => `- ${d.group}: ${d.items.join(", ")}`), "",
    "**Common mistakes**", "", list(g.pitfalls), "",
    "Checked by: ________________  Date: __________  Changes: ________________",
  );
}
console.log(out.join("\n"));
