"use client"

import { SignIn } from "@clerk/nextjs"

export default function LoginClient() {
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
          className="relative overflow-hidden rounded-2xl sm:rounded-3xl border bg-white/80 shadow-xl backdrop-blur-md p-4 sm:p-6 md:p-8 lg:p-10 mx-auto my-auto animate-fade-in-up"
        >
          {/* Header */}
          <div className="text-center mb-6 sm:mb-8">
            <div className="mx-auto mb-4 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center">
              <img src="/medikarya.svg" alt="MediKarya Logo" className="h-full w-full object-contain" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">Welcome back</h1>
            <p className="text-sm sm:text-base text-slate-600">Sign in to continue your medical education journey</p>
          </div>

          {/* Clerk SignIn Component */}
          <SignIn
            signUpUrl="/signup"
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
                footerActionText: "hidden",
                footerActionLink: "font-medium text-brand-600 hover:text-brand-700 transition-colors",
              },
            }}
            redirectUrl="/dashboard"
          />
        </div>
      </div>
    </main>
  )
}
