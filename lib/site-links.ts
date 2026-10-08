// Addresses of MediKarya's other site, in one place.

/**
 * The Case Studio: where students write case sheets and doctors review them (a separate site). People who want to
 * write or review cases are sent straight there to sign up; there is no form on this site in between.
 * NEXT_PUBLIC_STUDIO_URL overrides it (say, to point a preview deployment at a test studio).
 */
export const CASE_STUDIO_URL = (process.env.NEXT_PUBLIC_STUDIO_URL || "https://casestudio.medikarya.in").replace(/\/+$/, "")

export const studioLinks = {
  home: CASE_STUDIO_URL,
  /** Create an account and start a case sheet. */
  writeACase: `${CASE_STUDIO_URL}/sign-up`,
  /** The reviewer application (verified against the medical register). */
  becomeAReviewer: `${CASE_STUDIO_URL}/join/reviewer`,
  /** What writers and reviewers get at each milestone: pay, free months of MediKarya, titles and certificates. */
  rewards: `${CASE_STUDIO_URL}/rewards`,
  /** Everyone who has written or reviewed a published case. */
  contributors: `${CASE_STUDIO_URL}/contributors`,
} as const
