import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { supabaseServer } from "@/lib/supabase/server"
import { isAdminUser } from "./actions"
import { RoleToggleButton } from "./role-toggle"
import {
    ShieldCheck, Users, Crown, GraduationCap,
    AlertCircle, Activity, Clock
} from "lucide-react"

export const dynamic = "force-dynamic"

function formatDate(dateStr: string | null) {
    if (!dateStr) return "—"
    return new Date(dateStr).toLocaleDateString("en-IN", {
        day: "numeric", month: "short", year: "numeric",
    })
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

export default async function AdminPage() {
    const { userId } = await auth()

    if (!(await isAdminUser(userId))) {
        redirect("/")
    }

    // Pass the current user's ID down so RoleToggleButton knows who "self" is
    const currentUserId = userId!

    const { data: users, error } = await supabaseServer
        .from("user_profiles")
        .select("clerk_user_id, full_name, email, role, current_streak, longest_streak, last_active_date, created_at")
        .order("created_at", { ascending: false })

    const total = users?.length ?? 0
    const admins = users?.filter(u => u.role === "admin").length ?? 0
    const students = users?.filter(u => u.role === "student").length ?? 0
    const activeToday = users?.filter(u => {
        if (!u.last_active_date) return false
        const today = new Date().toISOString().split("T")[0]
        return u.last_active_date === today
    }).length ?? 0

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-8">

                {/* ── Header ── */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm"
                            style={{ background: "linear-gradient(135deg, #0ea5e9, #14b8a6)" }}>
                            <ShieldCheck className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                                Admin Panel
                            </h1>
                            <p className="text-sm text-slate-500 mt-0.5">User management · medikarya.in</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <a href="/admin/attempts"
                            className="bg-white border border-slate-200 text-slate-700 font-semibold px-4 py-2 rounded-xl text-sm shadow-sm hover:shadow-md hover:bg-slate-50 transition-all flex items-center gap-2">
                            <Activity className="w-4 h-4 text-sky-500" />
                            User Activity
                        </a>
                        <div className="flex items-center gap-2 text-xs font-medium text-slate-500 bg-white border border-slate-200 rounded-full px-4 py-2 shadow-sm w-fit">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                            Live · updates on action
                        </div>
                    </div>
                </div>

                {/* ── Stat Cards ── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

                    {/* Total */}
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-50 border border-blue-100">
                                <Users className="w-4 h-4 text-blue-600" />
                            </div>
                            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Total</span>
                        </div>
                        <p className="text-4xl font-black text-slate-900 tabular-nums">{total}</p>
                        <p className="text-xs text-slate-400 mt-1.5 font-medium">Registered users</p>
                    </div>

                    {/* Students */}
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-teal-50 border border-teal-100">
                                <GraduationCap className="w-4 h-4 text-teal-600" />
                            </div>
                            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Students</span>
                        </div>
                        <p className="text-4xl font-black text-teal-600 tabular-nums">{students}</p>
                        <p className="text-xs text-slate-400 mt-1.5 font-medium">Active learners</p>
                    </div>

                    {/* Admins */}
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-amber-50 border border-amber-100">
                                <Crown className="w-4 h-4 text-amber-600" />
                            </div>
                            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Admins</span>
                        </div>
                        <p className="text-4xl font-black text-amber-600 tabular-nums">{admins}</p>
                        <p className="text-xs text-slate-400 mt-1.5 font-medium">With admin role</p>
                    </div>

                    {/* Active Today */}
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-sky-50 border border-sky-100">
                                <Clock className="w-4 h-4 text-sky-600" />
                            </div>
                            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Today</span>
                        </div>
                        <p className="text-4xl font-black text-sky-600 tabular-nums">{activeToday}</p>
                        <p className="text-xs text-slate-400 mt-1.5 font-medium">Active today</p>
                    </div>
                </div>

                {/* ── Error State ── */}
                {error && (
                    <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
                        <span>Failed to load users: <span className="font-semibold">{error.message}</span></span>
                    </div>
                )}

                {/* ── Desktop Table ── */}
                <div className="hidden md:block bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
                        <div className="flex items-center gap-2.5">
                            <div className="w-1 h-5 rounded-full bg-gradient-to-b from-sky-500 to-teal-500" />
                            <h2 className="text-sm font-bold text-slate-700">User Registry</h2>
                        </div>
                        <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 rounded-full px-3 py-1">
                            {total} record{total !== 1 ? "s" : ""}
                        </span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-100">
                                    <th className="text-left px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">User</th>
                                    <th className="text-left px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Email</th>
                                    <th className="text-left px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Joined</th>
                                    <th className="text-left px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Streak</th>
                                    <th className="text-left px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Role</th>
                                    <th className="text-right px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {!users?.length && (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-20 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-slate-50 border border-slate-100">
                                                    <Users className="w-6 h-6 text-slate-300" />
                                                </div>
                                                <p className="text-slate-400 text-sm">No users yet — sign-ups will appear here instantly</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                                {users?.map((user, i) => {
                                    const avatarColor = AVATAR_COLORS[i % AVATAR_COLORS.length]
                                    const isAdminUser = user.role === "admin"
                                    const isPrimaryAdmin = user.clerk_user_id === process.env.NEXT_PUBLIC_ADMIN_CLERK_USER_ID
                                    return (
                                        <tr key={user.clerk_user_id} className="hover:bg-slate-50/70 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 border group-hover:scale-105 transition-transform"
                                                        style={{ background: avatarColor.bg, color: avatarColor.text, borderColor: avatarColor.bg }}>
                                                        {getInitials(user.full_name)}
                                                    </div>
                                                    <span className="font-semibold text-slate-800">{user.full_name || "—"}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-500">{user.email || "—"}</td>
                                            <td className="px-6 py-4 text-slate-400 text-xs font-medium">{formatDate(user.created_at)}</td>
                                            <td className="px-6 py-4">
                                                <span className="text-xs font-bold text-slate-700 tabular-nums">
                                                    🔥 {user.current_streak ?? 0}
                                                    <span className="text-slate-400 font-normal ml-1">days</span>
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                {isAdminUser ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                                        <Crown className="w-3 h-3" /> Admin
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200">
                                                        <GraduationCap className="w-3 h-3" /> Student
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <RoleToggleButton
                                                    clerkUserId={user.clerk_user_id}
                                                    currentRole={user.role as "student" | "admin"}
                                                    isSelf={user.clerk_user_id === currentUserId}
                                                />
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* ── Mobile Cards ── */}
                <div className="md:hidden space-y-3">
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                            <div className="w-1 h-4 rounded-full bg-gradient-to-b from-sky-500 to-teal-500" />
                            <h2 className="text-sm font-bold text-slate-700">User Registry</h2>
                        </div>
                        <span className="text-xs text-slate-400">{total} record{total !== 1 ? "s" : ""}</span>
                    </div>

                    {!users?.length && (
                        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-sm">
                            <Users className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                            <p className="text-slate-400 text-sm">No users yet</p>
                        </div>
                    )}

                    {users?.map((user, i) => {
                        const avatarColor = AVATAR_COLORS[i % AVATAR_COLORS.length]
                        const isAdminUser = user.role === "admin"
                        const isPrimaryAdmin = user.clerk_user_id === process.env.NEXT_PUBLIC_ADMIN_CLERK_USER_ID
                        return (
                            <div key={user.clerk_user_id}
                                className="bg-white rounded-2xl border border-slate-200/80 p-4 space-y-3.5 shadow-sm">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0"
                                            style={{ background: avatarColor.bg, color: avatarColor.text }}>
                                            {getInitials(user.full_name)}
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800 text-sm leading-tight">{user.full_name || "—"}</p>
                                            <p className="text-xs text-slate-400 mt-0.5">{formatDate(user.created_at)}</p>
                                        </div>
                                    </div>
                                    {isAdminUser ? (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 flex-shrink-0">
                                            <Crown className="w-3 h-3" /> Admin
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200 flex-shrink-0">
                                            <GraduationCap className="w-3 h-3" /> Student
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-center justify-between px-0.5">
                                    <p className="text-xs text-slate-400 truncate max-w-[180px]">{user.email || "—"}</p>
                                    <p className="text-xs font-bold text-slate-600">🔥 {user.current_streak ?? 0} days</p>
                                </div>

                                <div className="pt-1 border-t border-slate-100 flex">
                                    <RoleToggleButton
                                        clerkUserId={user.clerk_user_id}
                                        currentRole={user.role as "student" | "admin"}
                                        isSelf={user.clerk_user_id === currentUserId}
                                    />
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* ── Footer ── */}
                <p className="text-xs text-slate-400 text-center pb-2">
                    Restricted to admin account · medikarya.in/admin
                </p>

            </div>
        </div>
    )
}
