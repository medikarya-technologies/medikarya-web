"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useUser } from "@clerk/nextjs"
import Link from "next/link"
import {
  Star,
  Play,
  Clock,
  CheckCircle2,
  Activity,
  ArrowRight
} from "lucide-react"

import { useState, useEffect } from "react"
import { getDashboardStats } from "@/app/actions/dashboard"

export function DashboardOverview() {
  const { user, isLoaded } = useUser()

  // Helper function to get display name
  const getDisplayName = () => {
    if (!isLoaded || !user) return "Doctor"

    if (user.firstName || user.lastName) {
      return `${user.firstName || ""} ${user.lastName || ""}`.trim()
    }

    if (user.primaryEmailAddress?.emailAddress) {
      const email = user.primaryEmailAddress.emailAddress
      const username = email.split("@")[0]
      return username
        .split(/[._-]/)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(" ")
    }

    return "Doctor"
  }

  const [isLoadingStats, setIsLoadingStats] = useState(true)
  const [userStats, setUserStats] = useState({
    totalXP: 0,
    casesSolved: 0,
    streakDays: 0,
  })

  const [recentCases, setRecentCases] = useState<{
    id: number
    title: string
    score: number
    xpEarned: number
    timeTaken: string
  }[]>([])

  useEffect(() => {
    async function fetchStats() {
      if (!isLoaded || !user) return

      try {
        const stats = await getDashboardStats()
        setUserStats({
          totalXP: stats.totalXP,
          casesSolved: stats.casesSolved,
          streakDays: stats.streakDays,
        })
        setRecentCases(stats.recentCases)
      } catch (err) {
        console.error("Failed to load stats", err)
      } finally {
        setIsLoadingStats(false)
      }
    }

    fetchStats()
  }, [isLoaded, user])

  return (
    <div className="p-3 sm:p-4 md:p-6 lg:p-8 space-y-4 sm:space-y-6 md:space-y-8 bg-gradient-to-br from-slate-50/50 via-white to-brand-50/30 min-h-full">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:gap-4 md:flex-row md:items-center md:justify-between">
        <div className="text-center md:text-left">
          <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl md:text-3xl lg:text-4xl tracking-tight">
            Welcome back, {getDisplayName()}!
          </h1>
          <p className="text-slate-600 mt-1 sm:mt-2 text-sm sm:text-base leading-relaxed">
            Ready to continue your medical education journey?
          </p>
        </div>
        <Button
          asChild
          className="bg-gradient-to-r from-brand-600 to-accent-600 hover:from-brand-700 hover:to-accent-700 text-white shadow-sm hover:shadow-md transition-all duration-200 w-full sm:w-auto h-10 sm:h-11"
        >
          <Link href="/dashboard/cases">
            <Play className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Start New Case</span>
            <span className="sm:hidden">Start Case</span>
          </Link>
        </Button>
      </div>



      {/* Stats Grid */}
      <div className="grid gap-3 sm:gap-4 md:gap-6 grid-cols-1 sm:grid-cols-3">
        {isLoadingStats ? (
          // Skeleton shimmer for stat cards
          ["amber", "brand", "green"].map((color) => (
            <Card key={color} className="bg-white/90 backdrop-blur-sm border border-slate-200/50 shadow-sm">
              <CardContent className="p-4 sm:p-5 md:p-6">
                <div className="flex items-center justify-between gap-4 animate-pulse">
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-16 bg-slate-200 rounded-md" />
                    <div className="h-8 w-24 bg-slate-200 rounded-md" />
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-slate-200 flex-shrink-0" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            {/* Total XP */}
            <Card className="bg-white/90 backdrop-blur-sm border border-slate-200/50 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 touch-manipulation">
              <CardContent className="p-4 sm:p-5 md:p-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-slate-600 mb-1">Total XP</p>
                    <p className="text-2xl md:text-3xl font-bold text-slate-900">{userStats.totalXP.toLocaleString()}</p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-100 to-orange-200 flex items-center justify-center flex-shrink-0 shadow-sm">
                    <Star className="h-6 w-6 text-amber-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Cases Solved */}
            <Card className="bg-white/90 backdrop-blur-sm border border-slate-200/50 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 touch-manipulation">
              <CardContent className="p-4 sm:p-5 md:p-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-slate-600 mb-1">Cases Solved</p>
                    <p className="text-2xl md:text-3xl font-bold text-slate-900">{userStats.casesSolved}</p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-brand-100 to-brand-200 flex items-center justify-center flex-shrink-0 shadow-sm">
                    <CheckCircle2 className="h-6 w-6 text-brand-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Current Streak */}
            <Card className="bg-white/90 backdrop-blur-sm border border-slate-200/50 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 touch-manipulation">
              <CardContent className="p-4 sm:p-5 md:p-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-slate-600 mb-1">Current Streak</p>
                    <p className="text-2xl md:text-3xl font-bold text-slate-900">{userStats.streakDays} days</p>
                    {userStats.streakDays > 0 && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                        <span className="text-xs text-green-600 font-medium">Active</span>
                      </div>
                    )}
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-green-100 to-emerald-200 flex items-center justify-center flex-shrink-0 shadow-sm">
                    <Activity className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Recent Cases */}
      <Card className="bg-white/90 backdrop-blur-sm border border-slate-200/50 shadow-sm hover:shadow-md transition-all duration-200 touch-manipulation">
        <CardHeader className="pb-3 sm:pb-4">
          <CardTitle className="flex items-center gap-2 sm:gap-3 text-slate-900 text-base sm:text-lg font-semibold">
            <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
              <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-slate-600" />
            </div>
            Recent Cases
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingStats ? (
            // Skeleton shimmer for recent cases rows
            <div className="space-y-2 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 items-center p-3 sm:p-4 rounded-xl bg-slate-50">
                  <div className="col-span-2 space-y-1.5">
                    <div className="h-4 w-3/4 bg-slate-200 rounded-md" />
                    <div className="h-3 w-1/3 bg-slate-200 rounded-md" />
                  </div>
                  <div className="flex justify-center">
                    <div className="h-6 w-12 bg-slate-200 rounded-full" />
                  </div>
                  <div className="flex justify-center">
                    <div className="h-4 w-16 bg-slate-200 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          ) : recentCases.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
              <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                <Clock className="h-7 w-7 text-slate-400" />
              </div>
              <p className="text-slate-500 text-sm">No cases completed yet. Start your first case!</p>
              <Button asChild className="bg-gradient-to-r from-brand-600 to-accent-600 hover:from-brand-700 hover:to-accent-700 text-white mt-1">
                <Link href="/dashboard/cases">
                  <Play className="mr-2 h-4 w-4" />
                  Start a Case
                </Link>
              </Button>
            </div>
          ) : (
            <>
              {/* Table header */}
              <div className="hidden sm:grid grid-cols-4 gap-4 px-3 pb-2 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                <span className="col-span-2">Case</span>
                <span className="text-center">Score</span>
                <span className="text-center">XP Earned</span>
              </div>
              <div className="space-y-2">
                {recentCases.map((case_) => (
                  <div
                    key={case_.id}
                    className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 items-center p-3 sm:p-4 rounded-xl bg-slate-50/80 hover:bg-slate-100/50 transition-all duration-200 touch-manipulation"
                  >
                    {/* Case name */}
                    <div className="col-span-2 sm:col-span-2 min-w-0">
                      <h4 className="font-medium text-slate-900 text-sm sm:text-base leading-tight truncate">
                        {case_.title}
                      </h4>
                      <span className="text-xs text-slate-400">{case_.timeTaken}</span>
                    </div>
                    {/* Score */}
                    <div className="text-center">
                      <Badge
                        variant="outline"
                        className={
                          case_.score >= 90
                            ? "border-green-200 text-green-700 bg-green-50"
                            : case_.score >= 70
                              ? "border-amber-200 text-amber-700 bg-amber-50"
                              : "border-red-200 text-red-700 bg-red-50"
                        }
                      >
                        {case_.score}%
                      </Badge>
                    </div>
                    {/* XP */}
                    <div className="text-center font-semibold text-green-600 text-sm sm:text-base">
                      +{case_.xpEarned} XP
                    </div>
                  </div>
                ))}
              </div>
              <Button
                asChild
                variant="outline"
                className="w-full mt-4 border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 h-9 sm:h-10 text-sm touch-manipulation"
              >
                <Link href="/dashboard/cases">
                  View All Cases
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Start New Case CTA */}
      <Card className="bg-gradient-to-r from-brand-600 to-accent-600 text-white border-0 shadow-lg overflow-hidden touch-manipulation">
        <CardContent className="p-5 sm:p-6 md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="text-center md:text-left">
              <h3 className="font-bold text-lg sm:text-xl md:text-2xl mb-1 tracking-tight">
                Ready for your next challenge?
              </h3>
              <p className="text-brand-100 text-sm sm:text-base leading-relaxed opacity-90">
                Build your clinical expertise with AI-powered patient cases.
              </p>
            </div>
            <Button
              asChild
              className="bg-white text-brand-600 hover:bg-brand-50 shadow-sm hover:shadow-md transition-all duration-200 w-full md:w-auto h-11 sm:h-12 text-sm sm:text-base font-semibold touch-manipulation"
            >
              <Link href="/dashboard/cases">
                <Play className="mr-2 h-4 w-4" />
                Start New Case
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
