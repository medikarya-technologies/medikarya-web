"use client"

// The frame around every dashboard page. On a wide screen: a slim console rail on the left (where you
// are, who you are, how to leave) and the desk on the right, where the page's own sheets lie. On a
// phone: a top bar and a drawer holding the same rail. It is drawn from the same surfaces as the
// bedside encounter (console, desk, sheet), so stepping into a case does not feel like another app.

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth } from "@clerk/nextjs"
import { LayoutDashboard, LifeBuoy, LogOut, Menu, Stethoscope, TrendingUp, UserRound, X, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Eyebrow } from "@/components/cases/encounter-ui"
import { ThemeToggle } from "@/components/theme-toggle"
import { InstallPrompt } from "./install-prompt"
import { useDisplayName } from "./use-display-name"

interface DashboardLayoutProps {
  children: React.ReactNode
  /** Which item to mark as the current page, when the address does not say (the dev preview pages). */
  activeHref?: string
  /** The name to show instead of the signed-in user's (the dev preview pages). */
  userName?: string
}

interface NavItem {
  title: string
  href: string
  icon: LucideIcon
}

const NAV: Array<{ group: string; items: NavItem[] }> = [
  {
    group: "Practice",
    items: [
      { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { title: "Case library", href: "/dashboard/cases", icon: Stethoscope },
      { title: "Progress", href: "/dashboard/progress", icon: TrendingUp },
    ],
  },
  {
    group: "Account",
    items: [
      { title: "Profile", href: "/dashboard/profile", icon: UserRound },
      { title: "Support", href: "/dashboard/support", icon: LifeBuoy },
    ],
  },
]

const isCurrent = (current: string, href: string) => (href === "/dashboard" ? current === href : current === href || current.startsWith(`${href}/`))

function Brand({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link href="/dashboard" onClick={onNavigate} className="flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-brand-300">
      <img src="/medikarya.svg" alt="" className="h-8 w-8 object-contain" />
      <span className="text-[16px] font-semibold tracking-[-0.01em] text-enc-ink">MediKarya</span>
    </Link>
  )
}

function NavList({ current, onNavigate }: { current: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="Dashboard" className="space-y-6">
      {NAV.map(({ group, items }) => (
        <div key={group}>
          <Eyebrow className="px-2.5">{group}</Eyebrow>
          <ul className="mt-2 space-y-0.5">
            {items.map(({ title, href, icon: Icon }) => {
              const active = isCurrent(current, href)
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[14px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-300",
                      active ? "bg-enc-sheet font-medium text-enc-ink shadow-enc-sheet ring-1 ring-enc-line" : "text-enc-ink-2 hover:bg-enc-console-hover hover:text-enc-ink"
                    )}
                  >
                    <Icon className={cn("h-4 w-4 shrink-0", active ? "text-brand-600" : "text-enc-ink-3")} strokeWidth={1.9} />
                    {title}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}

function Person({ userName }: { userName?: string }) {
  const { signOut } = useAuth()
  const me = useDisplayName(userName)
  return (
    <div className="flex items-center gap-2.5 border-t border-enc-line-strong px-3 py-3">
      <Avatar className="h-8 w-8 ring-1 ring-enc-line-strong">
        <AvatarImage src={me.imageUrl} alt={me.name} />
        <AvatarFallback className="bg-enc-sheet text-[12px] font-semibold text-enc-ink-2">{me.initials}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] leading-tight font-medium text-enc-ink">{me.name || (me.isLoaded ? "Signed in" : " ")}</p>
        <p className="truncate text-[12px] leading-tight text-enc-ink-3">Medical student</p>
      </div>
      <ThemeToggle />
      <button
        type="button"
        onClick={() => signOut({ redirectUrl: "/" })}
        title="Sign out"
        aria-label="Sign out"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-enc-ink-3 outline-none transition-colors hover:bg-enc-console-hover hover:text-enc-ink focus-visible:ring-2 focus-visible:ring-brand-300"
      >
        <LogOut className="h-4 w-4" strokeWidth={1.9} />
      </button>
    </div>
  )
}

export function DashboardLayout({ children, activeHref, userName }: DashboardLayoutProps) {
  const pathname = usePathname()
  const current = activeHref ?? pathname
  const [open, setOpen] = useState(false)
  const me = useDisplayName(userName)

  // The drawer closes when you go somewhere, and on Escape.
  useEffect(() => setOpen(false), [pathname])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  return (
    <div className="flex min-h-screen bg-enc-desk text-enc-ink">
      {/* The rail (wide screens) */}
      <aside className="sticky top-0 hidden h-screen w-[236px] shrink-0 flex-col border-r border-enc-line-strong bg-enc-console lg:flex">
        <div className="px-4 pt-5 pb-6">
          <Brand />
        </div>
        <div className="flex-1 overflow-y-auto px-3">
          <NavList current={current} />
        </div>
        <div className="px-3 pb-3">
          <InstallPrompt />
        </div>
        <Person userName={userName} />
      </aside>

      {/* The top bar and the drawer (phones and tablets) */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-enc-line-strong bg-enc-console px-3 lg:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            aria-expanded={open}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-enc-ink-2 outline-none hover:bg-enc-console-hover focus-visible:ring-2 focus-visible:ring-brand-300"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Brand />
          <div className="flex-1" />
          <ThemeToggle />
          <Avatar className="h-8 w-8 ring-1 ring-enc-line-strong">
            <AvatarImage src={me.imageUrl} alt={me.name} />
            <AvatarFallback className="bg-enc-sheet text-[12px] font-semibold text-enc-ink-2">{me.initials}</AvatarFallback>
          </Avatar>
        </div>

        {open && <div className="fixed inset-0 z-40 bg-enc-scrim/40 lg:hidden" onClick={() => setOpen(false)} aria-hidden />}
        <aside
          aria-label="Menu"
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col border-r border-enc-line-strong bg-enc-console shadow-xl transition-transform duration-200 ease-out lg:hidden",
            open ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex items-center justify-between px-4 pt-4 pb-5">
            <Brand onNavigate={() => setOpen(false)} />
            <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="flex h-9 w-9 items-center justify-center rounded-lg text-enc-ink-2 outline-none hover:bg-enc-console-hover focus-visible:ring-2 focus-visible:ring-brand-300">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-3">
            <NavList current={current} onNavigate={() => setOpen(false)} />
          </div>
          <div className="px-3 pb-3">
            <InstallPrompt />
          </div>
          <Person userName={userName} />
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}
