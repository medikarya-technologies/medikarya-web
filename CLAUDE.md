# MediKarya

MediKarya (medikarya.in) is clinical case practice for MBBS students in India. A student meets a patient at a live
bedside: takes the history from an AI patient, examines, orders tests, gives a ranked differential and a plan, and
gets a debrief that scores both the reasoning and the bedside care. Cases are written by students and checked by
doctors in the Case Studio.

**Read `CLAUDE.local.md` first** (same folder, not in git): our goals, where we are, what is next and what is waiting
on the user. Detailed notes per feature live in the auto-memory folder (index `MEMORY.md`).

## Two codebases

- **This folder**: the main site. Next.js 15 (Turbopack in dev), Clerk, Supabase (project `srsqsl…`), Razorpay
  subscriptions, Gemini.
- **`../medikarya case studio`**: casestudio.medikarya.in, where writers submit case sheets and reviewers check
  them. Next.js 16, its own Clerk instance and its own Supabase project (`azvkho…`).
- A case's path: written in the studio → converted by an admin in main `/admin/studio` (Gemini; static or live case)
  → one review (a queue reviewer or a private link) → published → the writer's rewards and their name on
  `/contributors`.

**Both GitHub repos are public.** Never commit secrets, business details (money, people, deals, outreach),
`marketing/` (gitignored) or `CLAUDE.local.md`.

## Commands

- `npm run dev`: the user's own dev server (scripts/dev.mjs, port 3000). Never stop or restart it.
- `npm run test:sim`: every unit test (node:test). Must stay green; add tests for pure logic.
- `npx tsc --noEmit -p .`: the build does not type-check. There is a baseline of about 18 old errors; add none in
  files you touch.
- `npm run check:cases`: checks the case JSON.
- Scripts that need secrets: `node --env-file=.env.local <script>`.
- **Test mode** (to use signed-in screens without Clerk): launch config `main-test` (`npm run dev:test`, port 3200).
  Dummy users: `node --env-file=.env.local scripts/test-users.mjs create|list|clean` (`dev_admin`, `dev_student`).
  Sign in as one with `/dev/as?user=dev_admin&next=/admin`. **It writes the real database**: always run `clean`
  afterwards, snapshot and restore any real case you change, and `git checkout -- tsconfig.json` (Next rewrites
  it). The studio has the same thing on port 3100 (`studio-test`).
- The browser pane is often hidden, and then pages do not hydrate. Use headless Edge screenshots, or puppeteer-core
  installed in the scratchpad.

## Where things are

- `engine/`: the AI patient (`chatEngine.ts`; `chatHistory.ts`: the browser sends the conversation, the server
  keeps none) and evaluation.
- `lib/plans/`: `limits.ts` (Student free / Intern / Resident), `server.ts` (a student's plan), `grants.ts` (free
  plan time: case-writer rewards and workshop passes), `passes.ts`, `access.ts` (rate limits, `isAdmin`).
- `lib/studio/`: reading and writing the studio's database from the main site.
- `lib/ai/case-model.ts`: the converter's model (Gemini; `CASE_AI=claude` switch kept).
- `app/admin/`: attempts, studio (convert, review, publish), records, advisors, live, passes.
- `scripts/*.sql`: schema changes, run by the user in Supabase.

## Working rules

- The user types secrets (Razorpay, Supabase, Clerk, Gemini, Claude keys) into `.env.local` or Vercel. Never ask for
  them in chat.
- Never sign in with the user's accounts or enter passwords. In the user's own Chrome, only read (e.g. billing pages)
  and change nothing.
- Schema changes are SQL scripts the user runs. Always say which project (main `srsqsl…` or studio `azvkho…`). No temp
  tables.
- The user commits and pushes. End with the list of files to commit.
- Never reset `certificate_number_seq`, and never issue real certificates while testing.
- `lib/cases/renamed-ids.ts` is never imported in client code.
- No npm package upgrades while the user's dev servers are running.
- Clinical images: lossless only.
- Clinical content needs a clinician's review. Never invent clinical facts.
- Public site copy: sounds like a person wrote it, no em dashes, no rupee amounts on the main site's marketing pages,
  and no detail of how cases are built with AI (it is our moat). The studio's rewards and terms pages do show pay.
- Studio: no second Google font (it breaks the Turbopack dev server).
- Write like the code around you; comments say why, in plain English.
