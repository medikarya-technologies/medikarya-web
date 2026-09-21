"use client"

// The frame around the work. Three levels, each with one job:
//
//   top bar        WHERE you are: the case, and the two global actions (intervene, exit)
//   patient rail   WHO you are treating: portrait, monitor, clock, support (its own file)
//   workspace      WHAT you are doing: a brief, then the four tabs (this file's header)
//
// Tabs are an underlined strip attached to the sheet they control, not pills in
// the top bar, so it is obvious which content belongs to which tab.

import type { ElementType, ReactNode } from "react"
import { CircleHelp, Ellipsis, Flag, Moon, Siren, Sun, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { setThemePreference, useIsDark } from "@/components/theme-controller"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { Eyebrow, StatusPill, type Tone } from "./encounter-ui"

export type TabId = "history" | "exam" | "tests" | "diagnose"

export interface TabDef {
  id: TabId
  label: string
  short?: string
  icon: ElementType
  badge?: { count: number; tone: Tone; title: string }
}

// ── Top bar ─────────────────────────────────────────────────────────────────

interface TopBarProps {
  title: string
  subtitle: string
  portrait: ReactNode
  showIntervene: boolean
  critical: boolean
  disabled: boolean
  onIntervene: () => void
  onExit: () => void
  /** Replays the walkthrough of this screen. */
  onTour?: () => void
  /** Opens "report a problem with this case". */
  onReport?: () => void
}

/** On a phone the small controls fold into one menu, so the case's title keeps its room. */
function TopBarMenu({ onTour, onReport }: { onTour?: () => void; onReport?: () => void }) {
  const dark = useIsDark()
  return (
    <div className="sm:hidden">
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon" aria-label="More" className="h-8 w-8 rounded-lg text-enc-ink-3 hover:bg-enc-console-hover hover:text-enc-ink">
            <Ellipsis className="h-[18px] w-[18px]" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-52">
          {onTour && (
            <DropdownMenuItem onSelect={onTour}>
              <CircleHelp className="h-4 w-4" /> Take a tour
            </DropdownMenuItem>
          )}
          {onReport && (
            <DropdownMenuItem onSelect={onReport}>
              <Flag className="h-4 w-4" /> Report a problem
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => setThemePreference(dark ? "light" : "dark")}>
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />} {dark ? "Light mode" : "Dark mode"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export function EncounterTopBar({ title, subtitle, portrait, showIntervene, critical, disabled, onIntervene, onExit, onTour, onReport }: TopBarProps) {
  return (
    <header className="z-40 flex h-14 shrink-0 items-center gap-3 border-b border-enc-line-strong bg-enc-console px-4">
      <div className="shrink-0">{portrait}</div>
      <div className="min-w-0">
        <h1 className="truncate text-[14px] leading-tight font-semibold text-enc-ink">{title}</h1>
        <p className="truncate text-[12px] leading-tight text-enc-ink-3">{subtitle}</p>
      </div>
      <div className="flex-1" />
      {showIntervene && (
        <Button
          type="button"
          onClick={onIntervene}
          data-tour="intervene"
          disabled={disabled}
          className={cn(
            "h-8 gap-1.5 rounded-lg bg-enc-crit px-3 text-[12px] font-semibold tracking-wide text-white hover:bg-enc-crit/90",
            critical && "ring-2 ring-enc-crit/30 ring-offset-2 ring-offset-enc-console"
          )}
        >
          <Siren className="h-3.5 w-3.5" /> Intervene
        </Button>
      )}
      <div className="hidden items-center gap-0.5 sm:flex">
        {onTour && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onTour}
            title="Take a tour of this screen"
            aria-label="Take a tour of this screen"
            className="h-8 w-8 rounded-lg text-enc-ink-3 hover:bg-enc-console-hover hover:text-enc-ink"
          >
            <CircleHelp className="h-[18px] w-[18px]" />
          </Button>
        )}
        {onReport && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onReport}
            title="Report a problem with this case"
            aria-label="Report a problem with this case"
            className="h-8 w-8 rounded-lg text-enc-ink-3 hover:bg-enc-console-hover hover:text-enc-ink"
          >
            <Flag className="h-[17px] w-[17px]" />
          </Button>
        )}
        <ThemeToggle className="hover:bg-enc-console-hover" />
      </div>
      <TopBarMenu onTour={onTour} onReport={onReport} />
      <Button variant="ghost" size="sm" onClick={onExit} className="h-8 gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-enc-ink-2 hover:bg-enc-console-hover hover:text-enc-ink">
        <X className="h-4 w-4" />
        <span className="hidden sm:inline">Exit</span>
      </Button>
    </header>
  )
}

// ── Workspace header: the brief, then the tabs ──────────────────────────────

interface WorkspaceHeaderProps {
  brief: string
  tabs: TabDef[]
  active: TabId
  onChange: (id: TabId) => void
  isExpired: boolean
}

export function WorkspaceHeader({ brief, tabs, active, onChange, isExpired }: WorkspaceHeaderProps) {
  return (
    <div className="hidden shrink-0 border-b border-enc-line-strong bg-enc-sheet md:block">
      <div className="flex items-baseline gap-3 px-6 pt-3">
        <Eyebrow className="shrink-0">Brief</Eyebrow>
        <p className="truncate text-[13px] text-enc-ink-2" title={brief}>
          {brief}
        </p>
      </div>
      <nav className="flex items-end gap-1 px-4" role="tablist" aria-label="Encounter sections">
        {tabs.map(({ id, label, icon: Icon, badge }) => {
          const selected = active === id
          return (
            <button
              key={id}
              type="button"
              role="tab"
              data-tour={`tab-${id}`}
              aria-selected={selected}
              onClick={() => onChange(id)}
              disabled={isExpired && id !== "diagnose"}
              className={cn(
                "relative inline-flex h-11 items-center gap-2 px-3 text-[14px] font-medium transition-colors outline-none focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-brand-300 disabled:opacity-40",
                selected ? "text-enc-ink" : "text-enc-ink-2 hover:text-enc-ink"
              )}
            >
              <Icon className={cn("h-4 w-4", selected ? "text-brand-600" : "text-enc-ink-3")} />
              {label}
              {badge && badge.count > 0 && (
                <StatusPill tone={badge.tone} className="min-w-5 justify-center px-1" >
                  <span title={badge.title}>{badge.count}</span>
                </StatusPill>
              )}
              {selected && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-600" />}
            </button>
          )
        })}
      </nav>
    </div>
  )
}

// ── Mobile tab bar ──────────────────────────────────────────────────────────

export function MobileTabBar({ tabs, active, onChange, isExpired }: { tabs: TabDef[]; active: TabId; onChange: (id: TabId) => void; isExpired: boolean }) {
  return (
    <nav
      className="z-40 shrink-0 border-t border-enc-line-strong bg-enc-sheet shadow-enc-dock md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Encounter sections"
    >
      <div className="flex h-14 items-stretch">
        {tabs.map(({ id, label, short, icon: Icon, badge }) => {
          const selected = active === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              disabled={isExpired && id !== "diagnose"}
              aria-current={selected ? "page" : undefined}
              data-tour={`tab-${id}`}
              className={cn("relative flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors disabled:opacity-40", selected ? "text-brand-700" : "text-enc-ink-3")}
            >
              {selected && <span className="absolute inset-x-5 top-0 h-0.5 rounded-b-full bg-brand-600" />}
              <span className="relative">
                <Icon className="h-[18px] w-[18px]" />
                {badge && badge.count > 0 && (
                  <span
                    className={cn(
                      "absolute -top-1.5 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white",
                      badge.tone === "ok" ? "bg-enc-ok" : "bg-enc-warn"
                    )}
                  >
                    {badge.count}
                  </span>
                )}
              </span>
              <span className="text-[10.5px] leading-none font-semibold">{short ?? label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
