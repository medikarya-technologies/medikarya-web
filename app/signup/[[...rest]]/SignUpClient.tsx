"use client"

import { SignUp } from "@clerk/nextjs"
import { useMounted } from "@/hooks/use-mounted"
import { cn } from "@/lib/utils"
import { useScrollAnimation } from "@/lib/scroll-animation"

export default function SignUpClient() {
  const { ref, isVisible } = useScrollAnimation()
  // Clerk's box is drawn once the page has loaded, so the server and the first browser render match (hooks/use-mounted.ts)
  const mounted = useMounted()


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

      <div className="relative mx-auto max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl">
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
            <p className="text-sm sm:text-base text-slate-600">Start your journey in AI-powered medical education</p>
          </div>

          {/* Clerk SignUp Component */}
          {mounted ? (
            <SignUp
              signInUrl="/login"
              afterSignUpUrl="/dashboard"
              appearance={{
                elements: {
                  formButtonPrimary: "w-full rounded-xl py-4 sm:py-6 text-sm sm:text-base font-medium bg-gradient-to-r from-brand-600 to-accent-600 hover:from-brand-700 hover:to-accent-700 text-white shadow-lg hover:shadow-xl transition-all duration-200",
                  card: "shadow-none bg-transparent border-none",
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
              redirectUrl="/dashboard"
            />
          ) : (
            <div aria-hidden className="min-h-[420px]" />
          )}
        </div>
      </div>
    </main>
  )
}
