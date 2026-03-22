"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Trophy,
  Medal,
  Award,
  TrendingUp,
  TrendingDown,
  Minus,
  Crown,
  Star,
  Target,
  Calendar,
  Users,
  Zap
} from "lucide-react"
import { cn } from "@/lib/utils"

export function Rankings() {
  const [selectedPeriod, setSelectedPeriod] = useState("weekly")

  // Mock leaderboard data
  const globalLeaderboard = [
    {
      rank: 1,
      name: "Dr. Sarah Chen",
      avatar: "/placeholder-user.jpg",
      xp: 15420,
      casesSolved: 89,
      streak: 23,
      change: "up",
      changeAmount: 2,
      badge: "Expert"
    },
    {
      rank: 2,
      name: "Dr. Michael Rodriguez",
      avatar: "/placeholder-user.jpg",
      xp: 14890,
      casesSolved: 85,
      streak: 19,
      change: "up",
      changeAmount: 1,
      badge: "Advanced"
    },
    {
      rank: 3,
      name: "Dr. Emily Watson",
      avatar: "/placeholder-user.jpg",
      xp: 14560,
      casesSolved: 82,
      streak: 15,
      change: "down",
      changeAmount: 1,
      badge: "Advanced"
    },
    {
      rank: 4,
      name: "Dr. James Park",
      avatar: "/placeholder-user.jpg",
      xp: 13920,
      casesSolved: 78,
      streak: 12,
      change: "up",
      changeAmount: 3,
      badge: "Intermediate"
    },
    {
      rank: 5,
      name: "Dr. Lisa Thompson",
      avatar: "/placeholder-user.jpg",
      xp: 13580,
      casesSolved: 75,
      streak: 8,
      change: "same",
      changeAmount: 0,
      badge: "Intermediate"
    },
    {
      rank: 23,
      name: "Dr. Jane Doe (You)",
      avatar: "/placeholder-user.jpg",
      xp: 2840,
      casesSolved: 47,
      streak: 7,
      change: "up",
      changeAmount: 5,
      badge: "Beginner",
      isCurrentUser: true
    }
  ]

  const weeklyLeaderboard = [
    { rank: 1, name: "Dr. Alex Kumar", xp: 1250, casesSolved: 8, streak: 7, badge: "Expert" },
    { rank: 2, name: "Dr. Maria Santos", xp: 1180, casesSolved: 7, streak: 5, badge: "Advanced" },
    { rank: 3, name: "Dr. David Wilson", xp: 1120, casesSolved: 7, streak: 4, badge: "Advanced" },
    { rank: 4, name: "Dr. Jane Doe (You)", xp: 890, casesSolved: 5, streak: 7, badge: "Beginner", isCurrentUser: true },
    { rank: 5, name: "Dr. Robert Chen", xp: 850, casesSolved: 5, streak: 3, badge: "Beginner" }
  ]

  const monthlyLeaderboard = [
    { rank: 1, name: "Dr. Sarah Chen", xp: 4850, casesSolved: 28, streak: 23, badge: "Expert" },
    { rank: 2, name: "Dr. Michael Rodriguez", xp: 4720, casesSolved: 26, streak: 19, badge: "Advanced" },
    { rank: 3, name: "Dr. Emily Watson", xp: 4580, casesSolved: 25, streak: 15, badge: "Advanced" },
    { rank: 4, name: "Dr. James Park", xp: 4350, casesSolved: 24, streak: 12, badge: "Intermediate" },
    { rank: 5, name: "Dr. Jane Doe (You)", xp: 2840, casesSolved: 15, streak: 7, badge: "Beginner", isCurrentUser: true }
  ]

  const getCurrentLeaderboard = () => {
    switch (selectedPeriod) {
      case "weekly": return weeklyLeaderboard
      case "monthly": return monthlyLeaderboard
      default: return globalLeaderboard
    }
  }

  const getBadgeColor = (badge: string) => {
    switch (badge) {
      case "Expert": return "bg-purple-100 text-purple-700 border-purple-200"
      case "Advanced": return "bg-brand-100 text-brand-700 border-brand-200"
      case "Intermediate": return "bg-green-100 text-green-700 border-green-200"
      case "Beginner": return "bg-amber-100 text-amber-700 border-amber-200"
      default: return "bg-slate-100 text-slate-700 border-slate-200"
    }
  }

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Crown className="h-5 w-5 text-yellow-500" />
      case 2: return <Medal className="h-5 w-5 text-slate-400" />
      case 3: return <Award className="h-5 w-5 text-amber-600" />
      default: return <span className="text-lg font-bold text-slate-600">#{rank}</span>
    }
  }

  const getChangeIcon = (change: string, amount: number) => {
    switch (change) {
      case "up": return <TrendingUp className="h-4 w-4 text-green-600" />
      case "down": return <TrendingDown className="h-4 w-4 text-red-600" />
      default: return <Minus className="h-4 w-4 text-slate-400" />
    }
  }

  const currentUser = globalLeaderboard.find(user => user.isCurrentUser)

  return (
    <div className="p-4 lg:p-8 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Rankings & Leaderboard</h1>
        <p className="text-slate-600 max-w-2xl mx-auto">
          See how you stack up against medical professionals worldwide and track your progress over time.
        </p>
      </div>

      {/* Current User Stats */}
      {currentUser && (
        <Card className="bg-gradient-to-r from-brand-600 to-accent-600 text-white border-0 shadow-xl">
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Avatar className="h-16 w-16 ring-4 ring-white/30">
                    <AvatarImage src={currentUser.avatar} alt={currentUser.name} />
                    <AvatarFallback className="bg-white/20 text-white text-lg font-semibold">
                      {currentUser.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-green-400 ring-2 ring-white flex items-center justify-center">
                    <span className="text-xs font-bold text-white">{currentUser.rank}</span>
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-xl mb-1">{currentUser.name}</h3>
                  <div className="flex items-center gap-4 text-brand-100">
                    <span>{currentUser.xp.toLocaleString()} XP</span>
                    <span>{currentUser.casesSolved} Cases</span>
                    <span>{currentUser.streak} Day Streak</span>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-sm text-brand-100 mb-1">Global Ranking</div>
                <div className="text-3xl font-bold">#{currentUser.rank}</div>
                <div className="flex items-center gap-1 mt-2">
                  {getChangeIcon(currentUser.change, currentUser.changeAmount)}
                  <span className="text-sm text-brand-100">
                    {currentUser.changeAmount > 0 ? `+${currentUser.changeAmount}` : currentUser.changeAmount} this week
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Period Tabs */}
      <Tabs value={selectedPeriod} onValueChange={setSelectedPeriod} className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-white/50 backdrop-blur-sm">
          <TabsTrigger value="weekly">This Week</TabsTrigger>
          <TabsTrigger value="monthly">This Month</TabsTrigger>
          <TabsTrigger value="alltime">All Time</TabsTrigger>
        </TabsList>

        <TabsContent value={selectedPeriod} className="mt-6">
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-600" />
                {selectedPeriod === "weekly" ? "Weekly" : selectedPeriod === "monthly" ? "Monthly" : "All-Time"} Leaderboard
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="space-y-1">
                {getCurrentLeaderboard().map((user, index) => (
                  <div
                    key={user.rank}
                    className={cn(
                      "flex items-center gap-4 p-4 hover:bg-slate-50/80 transition-colors",
                      user.isCurrentUser && "bg-brand-50/50 border-l-4 border-brand-600"
                    )}
                  >
                    <div className="flex items-center justify-center w-12">
                      {user.isCurrentUser ? (
                        <div className="h-8 w-8 rounded-full bg-brand-600 flex items-center justify-center">
                          <span className="text-white font-bold text-sm">You</span>
                        </div>
                      ) : (
                        getRankIcon(user.rank)
                      )}
                    </div>

                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600">
                        {user.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-900 truncate">
                        {user.name} {user.isCurrentUser && "(You)"}
                      </div>
                      <div className="text-sm text-slate-500">
                        {user.casesSolved} cases • {user.streak} day streak
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-bold text-slate-900">
                        {user.xp.toLocaleString()} XP
                      </div>
                      <Badge className={cn("text-xs mt-1", getBadgeColor(user.badge || "Beginner"))}>
                        {user.badge || "Beginner"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:gap-6 grid-cols-2 lg:grid-cols-4">
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardContent className="p-6 text-center">
            <Users className="h-8 w-8 text-brand-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-slate-900 mb-1">1,247</div>
            <div className="text-sm text-slate-600">Total Users</div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardContent className="p-6 text-center">
            <Target className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-slate-900 mb-1">15,420</div>
            <div className="text-sm text-slate-600">Avg XP This Week</div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardContent className="p-6 text-center">
            <Zap className="h-8 w-8 text-amber-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-slate-900 mb-1">89</div>
            <div className="text-sm text-slate-600">Top Score</div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardContent className="p-6 text-center">
            <Star className="h-8 w-8 text-purple-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-slate-900 mb-1">4.8</div>
            <div className="text-sm text-slate-600">Avg Rating</div>
          </CardContent>
        </Card>
      </div>

      {/* Call to Action */}
      <Card className="bg-gradient-to-r from-slate-50 to-slate-100 border-0">
        <CardContent className="p-6 text-center">
          <Trophy className="h-12 w-12 text-slate-400 mx-auto mb-4" />
          <h3 className="font-bold text-lg text-slate-900 mb-2">Ready to climb the rankings?</h3>
          <p className="text-slate-600 mb-4">
            Complete more cases and maintain your streak to improve your position on the leaderboard.
          </p>
          <Button className="bg-gradient-to-r from-brand-600 to-accent-600 hover:from-brand-700 hover:to-accent-700 text-white shadow-lg">
            Start Practicing
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
