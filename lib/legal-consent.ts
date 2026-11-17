// What a student agreed to when their account was made, kept on the Clerk account (unsafeMetadata, which the
// student's own browser may write). The sign-up page stores it when the account is created. Accounts made any other
// way (Google from the login page, the join page's pop-up, accounts from before the notice) have none, so the
// dashboard asks once and stores it then.

export const LEGAL_NOTICE_VERSION = "2026-10-29"

export type ConsentSource = "signup" | "prompt"

export function consentMetadata(acceptedAt: string, source: ConsentSource): Record<string, string> {
  return {
    medikaryaLegalNoticeVersion: LEGAL_NOTICE_VERSION,
    medikaryaTermsAcceptedAt: acceptedAt,
    medikaryaPrivacyNoticeAcceptedAt: acceptedAt,
    medikaryaConsentSource: source,
  }
}

/** True once the account holds an agreement to the current notice. */
export function hasRecordedConsent(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object") return false
  const m = metadata as Record<string, unknown>
  return (
    m.medikaryaLegalNoticeVersion === LEGAL_NOTICE_VERSION &&
    typeof m.medikaryaTermsAcceptedAt === "string" &&
    m.medikaryaTermsAcceptedAt.length > 0 &&
    typeof m.medikaryaPrivacyNoticeAcceptedAt === "string" &&
    m.medikaryaPrivacyNoticeAcceptedAt.length > 0
  )
}
