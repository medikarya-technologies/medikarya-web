"use client"

// Asks once, on the dashboard, for the agreement the sign-up page asks for, when the account does not hold it yet:
// accounts made with Google from the login page, from the join page's pop-up, or before the notice existed. The
// agreement is stored on the Clerk account (lib/legal-consent.ts), so it is asked once per account, not per browser.

import { useState } from "react"
import Link from "next/link"
import { useUser } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { consentMetadata, hasRecordedConsent } from "@/lib/legal-consent"

export function AccountConsentCheck() {
  const { isLoaded, isSignedIn, user } = useUser()
  const [agreed, setAgreed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const [done, setDone] = useState(false)

  // Test mode's stand-in user has no update(); there is no Clerk account to store anything on.
  const canStore = !!user && typeof (user as { update?: unknown }).update === "function"
  const open = isLoaded && !!isSignedIn && canStore && !done && !hasRecordedConsent(user?.unsafeMetadata)

  async function save() {
    if (!user || !agreed) return
    setSaving(true)
    setFailed(false)
    try {
      // unsafeMetadata is replaced as a whole, so keep whatever else is already on it
      await user.update({ unsafeMetadata: { ...user.unsafeMetadata, ...consentMetadata(new Date().toISOString(), "prompt") } })
      setDone(true)
    } catch (err) {
      console.error("[AccountConsentCheck] Could not save the agreement:", err)
      setFailed(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open}>
      <DialogContent showCloseButton={false} onEscapeKeyDown={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()} className="gap-0 p-0 sm:max-w-sm">
        <DialogHeader className="gap-1.5 px-5 pt-5 pb-0 text-left">
          <DialogTitle className="text-[15.5px] font-semibold text-enc-ink">One thing before you continue</DialogTitle>
          <DialogDescription className="text-[13.5px] leading-relaxed text-enc-ink-2">
            We need your agreement to our Terms and Privacy Policy on your account. You only do this once.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-3 px-5 pt-4 pb-5 sm:flex-col">
          <label className="flex items-start gap-2 text-left text-[12px] leading-relaxed text-enc-ink-2">
            <input type="checkbox" className="mt-0.5 accent-blue-600" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            <span>
              I confirm I am at least 18 years old. I have read and agree to the{" "}
              <Link href="/terms" target="_blank" className="underline underline-offset-2">Terms of Service</Link> and{" "}
              <Link href="/privacy" target="_blank" className="underline underline-offset-2">Privacy Policy</Link>. I agree that MediKarya
              may use the account information I provide to create and secure my account, and store my learning activity as
              explained in the Privacy Policy.
            </span>
          </label>
          {failed && <p className="text-[12px] text-red-600">That did not save. Check your connection and try again.</p>}
          <Button type="button" disabled={!agreed || saving} onClick={save} className="h-10 w-full rounded-lg bg-brand-600 text-[14px] font-semibold text-white shadow-none hover:bg-brand-700">
            {saving ? "Saving..." : "Continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
