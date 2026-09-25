"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, LayoutDashboard, Menu, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth, UserButton } from "@clerk/nextjs"

// Brief: Logo + 4 links maximum + Log in + Try a case. No more About, Features, Blog, Contribute.
// Full-width, sticky, edge-to-edge — same as before.
//
// Now "use client" (was an async server component reading Clerk's server-side `auth()`) so it can hold the
// mobile menu's own open/closed state — a server component can't hold state at all, and splitting this into a
// server shell + a client sub-component just for one boolean was more machinery than switching the whole file to
// Clerk's client hook (`useAuth()`, already used the same way in components/dashboard/dashboard-layout.tsx).
// Same signed-in fact either way, just read client-side now instead of resolved before the first paint — an
// acceptable trade for a marketing page, and the same one hero.tsx's own new auth-aware CTAs already make.
//
// The middle link list (Cases/How it works/Pricing) was `hidden md:flex` with no mobile equivalent at all — a
// phone visitor had no way to reach Pricing except scrolling the whole page or the footer. Added a hamburger
// toggle, `md:hidden`, opening a simple dropdown with the same links (plus Log in / Dashboard, whichever applies)
// stacked — no new navigation model, just the existing links made reachable below the breakpoint that already
// hides them.
export function Navbar() {
  const { userId } = useAuth()
  const [open, setOpen] = useState(false)
  return (
    <header className="sticky top-0 z-50 border-b border-enc-line bg-enc-sheet/90 backdrop-blur-md">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6" aria-label="Primary">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center">
            <img src="/medikarya.svg" alt="MediKarya Logo" className="h-full w-full object-contain" />
          </div>
          <span className="font-semibold text-enc-ink">MediKarya</span>
        </div>

        <ul className="hidden items-center gap-6 text-sm text-enc-ink-2 md:flex">
          <li>
            <Link href="/try" className="transition-colors hover:text-enc-ink">
              Cases
            </Link>
          </li>
          <li>
            <Link href="#story" className="transition-colors hover:text-enc-ink">
              How it works
            </Link>
          </li>
          <li>
            <Link href="#pricing" className="transition-colors hover:text-enc-ink">
              Pricing
            </Link>
          </li>
        </ul>

        <div className="flex items-center gap-2">
          {userId ? (
            <div className="flex items-center gap-3">
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="hidden sm:flex rounded-full text-enc-ink-2 hover:text-enc-ink border border-enc-line-strong"
              >
                <Link href="/dashboard">
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  Dashboard
                </Link>
              </Button>
              <UserButton afterSignOutUrl="/" />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login" className="hidden text-sm text-enc-ink-2 transition-colors hover:text-enc-ink sm:block">
                Log in
              </Link>
              <Button
                asChild
                size="sm"
                className={cn(
                  "group rounded-full px-4 h-auto py-2",
                  "bg-brand-600 hover:bg-brand-700 text-white",
                  "shadow-sm transition-colors duration-200",
                )}
              >
                <Link href="/try" aria-label="Try a case free" className="flex items-center justify-center">
                  <span className="mr-1">Try a case</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="flex h-9 w-9 items-center justify-center rounded-full text-enc-ink-2 hover:bg-enc-desk md:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {open && (
        <div className="border-t border-enc-line bg-enc-sheet px-4 py-3 md:hidden">
          <ul className="space-y-1 text-[15px] text-enc-ink-2">
            <li>
              <Link href="/try" onClick={() => setOpen(false)} className="block rounded-lg px-2 py-2.5 hover:bg-enc-desk hover:text-enc-ink">
                Cases
              </Link>
            </li>
            <li>
              <Link href="#story" onClick={() => setOpen(false)} className="block rounded-lg px-2 py-2.5 hover:bg-enc-desk hover:text-enc-ink">
                How it works
              </Link>
            </li>
            <li>
              <Link href="#pricing" onClick={() => setOpen(false)} className="block rounded-lg px-2 py-2.5 hover:bg-enc-desk hover:text-enc-ink">
                Pricing
              </Link>
            </li>
            {!userId && (
              <li className="border-t border-enc-line pt-1">
                <Link href="/login" onClick={() => setOpen(false)} className="block rounded-lg px-2 py-2.5 hover:bg-enc-desk hover:text-enc-ink">
                  Log in
                </Link>
              </li>
            )}
            {userId && (
              <li className="border-t border-enc-line pt-1">
                <Link href="/dashboard" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-2 py-2.5 hover:bg-enc-desk hover:text-enc-ink">
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </Link>
              </li>
            )}
          </ul>
        </div>
      )}
    </header>
  )
}
