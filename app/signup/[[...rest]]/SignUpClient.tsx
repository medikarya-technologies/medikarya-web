"use client"

import { SignUp } from "@clerk/nextjs"
import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useMounted } from "@/hooks/use-mounted"
import { consentMetadata } from "@/lib/legal-consent"
import { clerkFillElements } from "@/lib/clerk-fill"
import { cn } from "@/lib/utils"
import { useScrollAnimation } from "@/lib/scroll-animation"

const CONSENT_KEY = "mk_signup_consent_at"

export default function SignUpClient() {
  const [legalConsentAt, setLegalConsentAt] = useState("")
  const { ref, isVisible } = useScrollAnimation()
  // Clerk's box is drawn once the page has loaded, so the server and the first browser render match (hooks/use-mounted.ts)
  const mounted = useMounted()
  const pathname = usePathname()
  // Clerk finishes a sign-up on its own sub-pages: /signup/sso-callback when Google sends the student back,
  // /signup/continue when /login hands a new Google account over, /signup/verify-email-address. Those are fresh page
  // loads, so the tick above is gone. Its box must still be drawn there, or the Google sign-in never completes and
  // the student is left on this card with nothing under the checkbox.
  const onClerkStep = !!pathname && pathname.startsWith("/signup/")

  // Keep the tick for this tab, so a student who comes back to /signup itself does not have to agree again.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(CONSENT_KEY)
      if (saved) setLegalConsentAt(saved)
    } catch {}
  }, [])

  function onConsentChange(checked: boolean) {
    const at = checked ? new Date().toISOString() : ""
    setLegalConsentAt(at)
    try {
      if (at) sessionStorage.setItem(CONSENT_KEY, at)
      else sessionStorage.removeItem(CONSENT_KEY)
    } catch {}
  }

  const showSignUp = !!legalConsentAt || onClerkStep

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-brand-50 via-white to-accent-50">
      {/* Background decorative elements */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage: `
            radial-gradient(800px 600px at 20% 80%, rgba(59, 130, 246, 0.05) 0%, rgba(0,0,0,0) 50%),
            radial-gradient(600px 400px at 80% 20%, rgba(20, 184, 166, 0.05) 0%, rgba(0,0,0,0) 50%)
          `,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,0,0,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.02) 1px, transparent 1px)",
          backgroundSize: "60px 60px, 60px 60px",
          maskImage: "radial-gradient(100% 70% at 50% 50%, rgba(0,0,0,1), rgba(0,0,0,0.1))",
        }}
      />

      <div className="relative mx-auto w-full max-w-sm sm:max-w-md lg:max-w-lg">
        <div
          ref={ref}
          className={cn(
            "relative overflow-hidden rounded-2xl sm:rounded-3xl border bg-white/80 shadow-xl backdrop-blur-md p-4 sm:p-6 md:p-8 lg:p-10 transition-all duration-1000 ease-out mx-auto my-auto",
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          )}
        >
          {/* Header */}
          <div className="text-center mb-6 sm:mb-8">
            <div className="mx-auto mb-4 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center">
              <img src="https://www.medikarya.in/medikarya.svg" alt="MediKarya Logo" className="h-full w-full object-contain" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">Join MediKarya</h1>
            <p className="text-sm sm:text-base text-slate-600">Practise real cases before you meet real patients</p>
          </div>

          {onClerkStep ? (
            <p className="mb-5 text-center text-xs leading-relaxed text-slate-500">
              By continuing you confirm you are at least 18 and agree to the <Link href="/terms" className="underline">Terms of Service</Link> and <Link href="/privacy" className="underline">Privacy Policy</Link>.
            </p>
          ) : (
            <label className="mb-5 flex items-start gap-2.5 text-left text-xs leading-relaxed text-slate-600">
              <input type="checkbox" className="mt-0.5 accent-blue-600" checked={!!legalConsentAt} onChange={(e) => onConsentChange(e.target.checked)} />
              <span>I confirm I am at least 18 years old. I have read and agree to the <Link href="/terms" className="underline">Terms of Service</Link> and <Link href="/privacy" className="underline">Privacy Policy</Link>. I agree that MediKarya may use the account information I provide to create and secure my account, and store my learning activity as explained in the Privacy Policy.</span>
            </label>
          )}

          {/* On /signup itself, account fields only appear after the privacy notice and agreement have been acknowledged. */}
          {showSignUp ? (mounted ? (
            <SignUp
              signInUrl="/login"
              fallbackRedirectUrl="/dashboard"
              signInFallbackRedirectUrl="/dashboard"
              unsafeMetadata={legalConsentAt ? consentMetadata(legalConsentAt, "signup") : undefined}
              appearance={{
                elements: {
                  formButtonPrimary: "w-full rounded-xl py-4 sm:py-6 text-sm sm:text-base font-medium bg-gradient-to-r from-brand-600 to-accent-600 hover:from-brand-700 hover:to-accent-700 text-white shadow-lg hover:shadow-xl transition-all duration-200",
                  ...clerkFillElements,
                  headerTitle: "hidden",
                  headerSubtitle: "hidden",
                  socialButtons: "block",
                  dividerLine: "block",
                  dividerText: "block",
                  formFieldInput: "rounded-xl border-slate-200 bg-white/50 backdrop-blur-sm focus:bg-white focus:border-brand-400 transition-all duration-200 text-sm sm:text-base",
                  formFieldLabel: "text-sm font-medium text-slate-700",
                  footerActionText: "text-sm text-slate-600",
                  footerActionLink: "font-medium text-brand-600 hover:text-brand-700 transition-colors",
                },
              }}
            />
          ) : (
            <div aria-hidden className="min-h-[420px]" />
          )) : <p className="text-center text-xs text-slate-500">Check the box above to continue to account creation.</p>}
        </div>
      </div>
    </main>
  )
}
