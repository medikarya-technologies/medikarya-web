import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { supabaseServer } from "@/lib/supabase/server"
import {
    Clock, ShieldCheck, Users,
    AlertCircle, ChevronRight, Activity, Calendar, Trophy, Timer, ChevronLeft
} from "lucide-react"

export const dynamic = "force-dynamic"

function formatDate(dateStr: string | null) {
    if (!dateStr) return "—"
    return new Date(dateStr).toLocaleDateString("en-IN", {
        day: "numeric", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit"
    })
}

function formatTime(seconds: number | null) {
    if (seconds === null) return "—"
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
}

function getInitials(name: string | null) {
    if (!name) return "?"
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
}

const AVATAR_COLORS = [
    { bg: "#dbeafe", text: "#1d4ed8" },
    { bg: "#ccfbf1", text: "#0f766e" },
    { bg: "#e0f2fe", text: "#0369a1" },
    { bg: "#d1fae5", text: "#065f46" },
    { bg: "#ede9fe", text: "#5b21b6" },
]

export default async function AdminAttemptsPage() {
    const { userId } = await auth()

    if (!userId || userId !== process.env.ADMIN_CLERK_USER_ID) {
        redirect("/")
    }

    // Fetch data in parallel
    const [attemptsRes, usersRes, casesRes] = await Promise.all([
        supabaseServer
            .from("case_attempts")
            .select("*")
            .order("created_at", { ascending: false }),
        supabaseServer
            .from("beta_users")
            .select("id, name, email, clerk_user_id"),
        supabaseServer
            .from("cases")
            .select("id, title")
    ])

    const attempts = attemptsRes.data || []
    const betaUsers = usersRes.data || []
    const casesData = casesRes.data || []

    // Helper maps for resolution
    const caseMap = new Map(casesData.map(c => [c.id, c.title]))
    const userMap = new Map(betaUsers.map(u => [u.clerk_user_id, u]))

    // Group attempts by user
    const groupedAttempts: Record<string, any[]> = {}
    attempts.forEach(attempt => {
        const uid = attempt.user_id || "anonymous"
        if (!groupedAttempts[uid]) groupedAttempts[uid] = []
        groupedAttempts[uid].push(attempt)
    })

    // Sort users by their most recent activity
    const sortedUserIds = Object.keys(groupedAttempts).sort((a, b) => {
        const lastA = new Date(groupedAttempts[a][0].created_at).getTime()
        const lastB = new Date(groupedAttempts[b][0].created_at).getTime()
        return lastB - lastA
    })

    const totalAttempts = attempts.length
    const uniqueUsers = sortedUserIds.length

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-8">

                {/* ── Header ── */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                        <a href="/admin" className="p-2 hover:bg-white/50 rounded-xl transition-colors md:-ml-2">
                           <ChevronLeft className="w-5 h-5 text-slate-400" />
                        </a>
                        <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm"
                            style={{ background: "linear-gradient(135deg, #0ea5e9, #14b8a6)" }}>
                            <Activity className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                                User Activity
                            </h1>
                            <p className="text-sm text-slate-500 mt-0.5">Clinical case attempts · global registry</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                         <div className="flex items-center gap-4 px-5 py-2.5 bg-white border border-slate-200 rounded-2xl shadow-sm">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Total Attempts</span>
                                <span className="text-xl font-black text-slate-900 tabular-nums leading-tight">{totalAttempts}</span>
                            </div>
                            <div className="w-px h-8 bg-slate-100" />
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Active Users</span>
                                <span className="text-xl font-black text-slate-900 tabular-nums leading-tight">{uniqueUsers}</span>
                            </div>
                         </div>
                    </div>
                </div>

                {/* ── Error Notification ── */}
                {(attemptsRes.error || usersRes.error) && (
                    <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
                        <span>Failed to sync data: <span className="font-semibold">{attemptsRes.error?.message || usersRes.error?.message}</span></span>
                    </div>
                )}

                {/* ── Grouped View ── */}
                <div className="space-y-6">
                    {sortedUserIds.length === 0 ? (
                        <div className="bg-white rounded-3xl border border-slate-200/80 p-20 text-center shadow-sm">
                            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
                                <Users className="w-8 h-8 text-slate-300" />
                            </div>
                            <p className="text-slate-400 font-medium tracking-tight">No case attempts recorded yet</p>
                        </div>
                    ) : (
                        sortedUserIds.map((uid, userIdx) => {
                            const user = userMap.get(uid)
                            const userAttempts = groupedAttempts[uid]
                            const avatarColor = AVATAR_COLORS[userIdx % AVATAR_COLORS.length]
                            const avgScore = Math.round(userAttempts.reduce((acc, curr) => acc + (curr.score || 0), 0) / userAttempts.length)

                            return (
                                <div key={uid} className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                                    {/* User Header Section */}
                                    <div className="px-6 py-5 bg-slate-50/60 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0 border border-white shadow-sm"
                                                style={{ background: avatarColor.bg, color: avatarColor.text }}>
                                                {getInitials(user?.name || "User")}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-slate-900 leading-none mb-1">
                                                    {user?.name || (uid.startsWith("user_") ? "Clerk User" : "Unknown User")}
                                                </h3>
                                                <p className="text-xs text-slate-500 font-medium truncate max-w-[200px] sm:max-w-none">
                                                    {user?.email || uid}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-6">
                                            <div className="text-center sm:text-right">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Avg Score</p>
                                                <p className="text-lg font-black text-emerald-600 tabular-nums leading-none">
                                                    {avgScore}<span className="text-[10px] font-bold ml-0.5">%</span>
                                                </p>
                                            </div>
                                            <div className="text-center sm:text-right">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Attempts</p>
                                                <p className="text-lg font-black text-sky-600 tabular-nums leading-none">
                                                    {userAttempts.length}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Table Section */}
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-sm">
                                            <thead>
                                                <tr className="border-b border-slate-50/50">
                                                    <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Date & Time</th>
                                                    <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Clinical Case</th>
                                                    <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-center">Score</th>
                                                    <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-center">Time Taken</th>
                                                    <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-center">XP</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50/80">
                                                {userAttempts.map((attempt) => (
                                                    <tr key={attempt.id} className="hover:bg-slate-50/50 transition-colors group">
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <div className="flex items-center gap-2.5 text-slate-500 font-medium uppercase text-[11px]">
                                                                <Calendar className="w-3.5 h-3.5 text-slate-300" />
                                                                {formatDate(attempt.created_at)}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className="font-bold text-slate-800">
                                                                {caseMap.get(attempt.case_id) || attempt.case_id}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-100 group-hover:scale-105 transition-transform">
                                                                <Trophy className="w-3 h-3" />
                                                                {attempt.score || 0}%
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <div className="flex items-center justify-center gap-1.5 text-slate-500 font-bold text-[11px]">
                                                                <Timer className="w-3.5 h-3.5 text-slate-300" />
                                                                {formatTime(attempt.time_taken)}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <span className="font-black text-sky-600 tabular-nums">+{attempt.xp_earned || 0}</span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>

                {/* ── Footer ── */}
                <div className="flex flex-col items-center gap-4 text-xs text-slate-400 text-center pb-8 pt-4">
                    <div className="w-8 h-px bg-slate-200" />
                    <p>Restricted to admin account · medikarya.in/admin/attempts</p>
                </div>

            </div>
        </div>
    )
}
