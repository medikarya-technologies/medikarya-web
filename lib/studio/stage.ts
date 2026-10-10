// Where a studio case stands on /admin/studio, worked out once so the row (its badges and buttons) and the page (which
// tab it sits in) always agree. Pure: the page passes in the studio sheet, its converted MediKarya case and the time.

export type StudioTab = "todo" | "review" | "author" | "live";

export const STUDIO_TABS: Array<{ key: StudioTab; label: string; empty: string }> = [
  { key: "todo", label: "Needs you", empty: "Nothing to do: every case is with a reviewer, with its author, or live." },
  { key: "review", label: "With reviewers", empty: "No case is waiting for a review." },
  { key: "author", label: "With the author", empty: "No case is with its author for changes." },
  { key: "live", label: "On MediKarya", empty: "No studio case is live yet." },
];

export interface StageSheet {
  status: string;
  addedToPlatform: boolean;
  sentBackAt: string | null;
}

export interface StageConverted {
  status: string;
  inQueue: boolean;
  review: { expiresAt: string; decision: "approved" | "changes_requested" | null; decidedAt: string | null } | null;
}

export interface StudioStage {
  live: boolean;
  draft: boolean;
  approved: boolean;
  changes: boolean;
  /** A review is under way (claimed in the queue, or a private link not yet used) and has not run out. */
  waiting: boolean;
  /** The claim or link ran out without a decision. */
  expired: boolean;
  /** Marked "added to platform" in the studio but not made by the converter: added to MediKarya by hand before. */
  addedByHand: boolean;
  /** The raw sheet is with its author (studio status changes_requested). */
  sentBack: boolean;
  /** The reviewer's changes were sent on to the author after the review. */
  toAuthor: boolean;
  /** ...and the author has not resubmitted yet. */
  withAuthor: boolean;
  /** ...and the author fixed the sheet and resubmitted: ready to rebuild. */
  resubmitted: boolean;
  tab: StudioTab;
}

export function studioStage(c: StageSheet, converted: StageConverted | null, now: number = Date.now()): StudioStage {
  const live = converted?.status === "published";
  const draft = !!converted && !live;
  const review = converted?.review ?? null;
  const approved = review?.decision === "approved";
  const changes = review?.decision === "changes_requested";
  const waiting = !!review && !review.decision && Date.parse(review.expiresAt) > now;
  const expired = !!review && !review.decision && !waiting;
  const addedByHand = c.addedToPlatform && !converted;
  const sentBack = c.status === "changes_requested";
  const toAuthor = changes && !!c.sentBackAt && !!review?.decidedAt && c.sentBackAt > review.decidedAt;
  const withAuthor = toAuthor && sentBack;
  const resubmitted = toAuthor && c.status === "submitted";

  let tab: StudioTab;
  if (live || addedByHand || (!converted && c.status === "approved")) tab = "live";
  else if (!converted) tab = sentBack ? "author" : "todo";
  else if (withAuthor) tab = "author";
  else if (approved || changes) tab = "todo"; // publish, send to the author, or rebuild
  else if (waiting) tab = "review";
  // not reviewed, or a review that ran out: a reviewer can pick it up only if this version is in the queue
  else tab = converted.inQueue ? "review" : "todo";

  return { live, draft, approved, changes, waiting, expired, addedByHand, sentBack, toAuthor, withAuthor, resubmitted, tab };
}

/** The tab to open when none is asked for: the first with something in it, starting with what needs the admin. */
export function defaultStudioTab(counts: Record<StudioTab, number>): StudioTab {
  return STUDIO_TABS.find((t) => counts[t.key] > 0)?.key ?? "todo";
}
