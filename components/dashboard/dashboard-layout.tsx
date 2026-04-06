"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useUser, useAuth } from "@clerk/nextjs"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  LayoutDashboard,
  Stethoscope,
  HelpCircle,
  LogOut,
  Menu,
  X,
  User
} from "lucide-react"

interface DashboardLayoutProps {
  children: React.ReactNode
}

const sidebarItems = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    description: "Overview and statistics"
  },
  {
    title: "Practice Cases",
    href: "/dashboard/cases",
    icon: Stethoscope,
    description: "AI-powered test cases"
  },

  {
    title: "Profile",
    href: "/dashboard/profile",
    icon: User,
    description: "Account settings"
  },
  {
    title: "Support",
    href: "/dashboard/support",
    icon: HelpCircle,
    description: "Help and assistance"
  }
]

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const { user, isLoaded } = useUser()
  const { signOut } = useAuth()

  // Handle sign out
  const handleSignOut = () => {
    signOut({ redirectUrl: "/" })
  }

  // Helper function to get display name
  const getDisplayName = () => {
    if (!isLoaded) return "Loading..."

    if (!user) return "User"

    if (user.firstName || user.lastName) {
      return `${user.firstName || ""} ${user.lastName || ""}`.trim()
    }

    // Extract name from email for Gmail signups
    if (user.primaryEmailAddress?.emailAddress) {
      const email = user.primaryEmailAddress.emailAddress
      const username = email.split("@")[0]
      // Convert email username to a more readable format
      return username
        .split(/[._-]/)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(" ")
    }

    return "User"
  }

  // Helper function to get user initials for avatar
  const getUserInitials = () => {
    const displayName = getDisplayName()
    if (displayName === "Loading..." || displayName === "User") return "U"

    return displayName
      .split(" ")
      .map(name => name.charAt(0).toUpperCase())
      .slice(0, 2)
      .join("")
  }

  // Get user role/title (default to Medical Student if not set)
  const getUserTitle = () => {
    // You can extend this later to pull from user metadata or database
    return "Medical Student"
  }

  // We no longer block the whole dashboard with a loading screen.
  // The server-rendered children (stats, cases) should be visible immediately.
  // We handle the "Loading..." states inside the individual sidebar elements if needed.

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-accent-50 flex">
      {/* Background decorative elements */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute top-20 left-20 w-72 h-72 bg-brand-200/20 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-accent-200/20 rounded-full blur-3xl" />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className="relative bg-white/95 backdrop-blur-xl shadow-lg transition-all duration-300 ease-out border-r border-slate-200/60 w-64 hidden lg:block">
        {/* Header */}
        <div className="flex h-16 items-center justify-between px-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center">
              <img src="https://www.medikarya.in/medikarya.svg" alt="MediKarya Logo" className="h-full w-full object-contain" />
            </div>
            <span className="font-semibold text-slate-800 text-lg">MediKarya</span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden h-8 w-8 rounded-lg hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* User profile section */}
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 ring-2 ring-slate-200/50 shadow-sm">
              <AvatarImage src={user?.imageUrl} alt={getDisplayName()} />
              <AvatarFallback className="bg-gradient-to-br from-brand-50 to-accent-50 text-slate-700 font-medium">
                {getUserInitials()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-slate-900 truncate">{getDisplayName()}</div>
              <div className="text-sm text-slate-500 truncate">{getUserTitle()}</div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-6">
          <div className="space-y-1">
            {sidebarItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all duration-200 ease-out",
                    isActive
                      ? "bg-gradient-to-r from-brand-600 to-accent-600 text-white shadow-sm"
                      : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  <item.icon className={cn(
                    "h-5 w-5 transition-all duration-200 flex-shrink-0",
                    isActive ? "text-white" : "text-slate-400 group-hover:text-slate-600"
                  )} />
                  <div className="flex-1">
                    <div className="font-medium">{item.title}</div>
                    <div className={cn(
                      "text-xs transition-all duration-200",
                      isActive ? "text-brand-100" : "text-slate-500"
                    )}>
                      {item.description}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </nav>

        {/* Footer actions */}
        <div className="border-t border-slate-100 p-6">
          <Button
            variant="ghost"
            onClick={handleSignOut}
            className="w-full justify-start text-slate-700 hover:text-slate-900 hover:bg-slate-50 rounded-xl"
          >
            <LogOut className="h-4 w-4 mr-3" />
            Sign Out
          </Button>
        </div>
      </div>

      {/* Mobile Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-white/90 backdrop-blur-md shadow-xl transform transition-transform duration-300 ease-in-out lg:hidden",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Header */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-slate-200/50">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center">
              <img src="https://www.medikarya.in/medikarya.svg" alt="MediKarya Logo" className="h-full w-full object-contain" />
            </div>
            <span className="font-bold text-slate-900">MediKarya</span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* User profile section */}
        <div className="p-4 border-b border-slate-200/50">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 ring-2 ring-brand-200">
              <AvatarImage src={user?.imageUrl} alt={getDisplayName()} />
              <AvatarFallback className="bg-gradient-to-br from-brand-100 to-accent-100 text-slate-600">
                {getUserInitials()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-slate-900 truncate">{getDisplayName()}</div>
              <div className="text-xs text-slate-500 truncate">{getUserTitle()}</div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-4 space-y-1">
          {sidebarItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-gradient-to-r from-brand-600 to-accent-600 text-white shadow-lg"
                    : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                <item.icon className={cn(
                  "h-5 w-5 transition-all duration-200",
                  isActive ? "text-white" : "text-slate-400 group-hover:text-slate-600"
                )} />
                <div className="flex-1">
                  <div>{item.title}</div>
                  <div className={cn(
                    "text-xs transition-all duration-200",
                    isActive ? "text-brand-100" : "text-slate-500"
                  )}>
                    {item.description}
                  </div>
                </div>
              </Link>
            )
          })}
        </nav>

        {/* Footer actions */}
        <div className="p-4 border-t border-slate-200/50">
          <Button
            variant="ghost"
            onClick={handleSignOut}
            className="w-full justify-start text-slate-700 hover:text-slate-900 hover:bg-slate-100"
          >
            <LogOut className="mr-3 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar for mobile and tablet */}
        <div className="sticky top-0 z-30 flex h-14 sm:h-16 items-center gap-3 sm:gap-4 border-b border-slate-200/50 bg-white/90 backdrop-blur-md px-3 sm:px-4 lg:hidden">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(true)}
            className="h-8 w-8 sm:h-10 sm:w-10 p-0"
          >
            <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center">
              <img src="https://www.medikarya.in/medikarya.svg" alt="MediKarya Logo" className="h-full w-full object-contain" />
            </div>
            <span className="font-semibold text-slate-900 text-sm sm:text-base">MediKarya</span>
          </div>

          {/* User info on mobile */}
          <div className="ml-auto flex items-center gap-2">
            <div className="h-6 w-6 sm:h-8 sm:w-8 rounded-full bg-gradient-to-br from-brand-100 to-accent-100 flex items-center justify-center">
              <span className="text-xs font-medium text-slate-600">{getUserInitials()}</span>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <div className="min-h-full lg:pl-0">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
