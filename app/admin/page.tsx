import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { supabaseServer } from "@/lib/supabase/server"
import { approveUser, revokeUser } from "./actions"
import {
    CheckCircle2, Clock, ShieldCheck, Users,
    AlertCircle, UserCheck, XCircle, TrendingUp
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

// Subtle blue/teal palette matching the site brand
const AVATAR_COLORS = [
    { bg: "#dbeafe", text: "#1d4ed8" },   // blue
    { bg: "#ccfbf1", text: "#0f766e" },   // teal
    { bg: "#e0f2fe", text: "#0369a1" },   // sky
    { bg: "#d1fae5", text: "#065f46" },   // emerald
    { bg: "#ede9fe", text: "#5b21b6" },   // violet
]

export default async function AdminPage() {
    const { userId } = await auth()

    if (!userId || userId !== process.env.ADMIN_CLERK_USER_ID) {
        redirect("/")
    }

    const { data: users, error } = await supabaseServer
        .from("beta_users")
        .select("id, name, email, approved, created_at, clerk_user_id")
        .order("created_at", { ascending: false })

    const total = users?.length ?? 0
    const approved = users?.filter(u => u.approved).length ?? 0
    const pending = users?.filter(u => !u.approved).length ?? 0
    const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0

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
                            <p className="text-sm text-slate-500 mt-0.5">Beta access management · medikarya.in</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <a href="/admin/attempts"
                            className="bg-white border border-slate-200 text-slate-700 font-semibold px-4 py-2 rounded-xl text-sm shadow-sm hover:shadow-md hover:bg-slate-50 transition-all flex items-center gap-2">
                            <Clock className="w-4 h-4 text-sky-500" />
                            View User Activity
                        </a>
                        {/* Live badge */}
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
                        <p className="text-xs text-slate-400 mt-1.5 font-medium">Registrations</p>
                    </div>

                    {/* Approved */}
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-50 border border-emerald-100">
                                <UserCheck className="w-4 h-4 text-emerald-600" />
                            </div>
                            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Active</span>
                        </div>
                        <p className="text-4xl font-black text-emerald-600 tabular-nums">{approved}</p>
                        <p className="text-xs text-slate-400 mt-1.5 font-medium">Approved</p>
                    </div>

                    {/* Pending */}
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-amber-50 border border-amber-100">
                                <Clock className="w-4 h-4 text-amber-600" />
                            </div>
                            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Pending</span>
                        </div>
                        <p className="text-4xl font-black text-amber-600 tabular-nums">{pending}</p>
                        <p className="text-xs text-slate-400 mt-1.5 font-medium">Awaiting review</p>
                    </div>

                    {/* Rate */}
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-sky-50 border border-sky-100">
                                <TrendingUp className="w-4 h-4 text-sky-600" />
                            </div>
                            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Rate</span>
                        </div>
                        <p className="text-4xl font-black text-sky-600 tabular-nums">
                            {approvalRate}<span className="text-xl font-bold">%</span>
                        </p>
                        <div className="mt-2 w-full h-1 rounded-full bg-slate-100 overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-teal-400 transition-all duration-700"
                                style={{ width: `${approvalRate}%` }} />
                        </div>
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
                    {/* Table header bar */}
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
                                    <th className="text-left px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</th>
                                    <th className="text-right px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {!users?.length && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-20 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-slate-50 border border-slate-100">
                                                    <Users className="w-6 h-6 text-slate-300" />
                                                </div>
                                                <p className="text-slate-400 text-sm">No beta registrations yet</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                                {users?.map((user, i) => {
                                    const avatarColor = AVATAR_COLORS[i % AVATAR_COLORS.length]
                                    return (
                                        <tr key={user.id} className="hover:bg-slate-50/70 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 border group-hover:scale-105 transition-transform"
                                                        style={{ background: avatarColor.bg, color: avatarColor.text, borderColor: avatarColor.bg }}>
                                                        {getInitials(user.name)}
                                                    </div>
                                                    <span className="font-semibold text-slate-800">{user.name || "—"}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-500">{user.email || "—"}</td>
                                            <td className="px-6 py-4 text-slate-400 text-xs font-medium">{formatDate(user.created_at)}</td>
                                            <td className="px-6 py-4">
                                                {user.approved ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                        <UserCheck className="w-3 h-3" /> Approved
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                                        <Clock className="w-3 h-3" /> Pending
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {user.approved ? (
                                                    <form action={revokeUser.bind(null, user.id)}>
                                                        <button type="submit"
                                                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors border border-red-200 bg-red-50 text-red-600 hover:bg-red-100">
                                                            <XCircle className="w-3.5 h-3.5" /> Revoke
                                                        </button>
                                                    </form>
                                                ) : (
                                                    <form action={approveUser.bind(null, user.id)}>
                                                        <button type="submit"
                                                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all text-white shadow-sm hover:shadow"
                                                            style={{ background: "linear-gradient(135deg, #0ea5e9, #14b8a6)" }}>
                                                            <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                                                        </button>
                                                    </form>
                                                )}
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
                            <p className="text-slate-400 text-sm">No beta registrations yet</p>
                        </div>
                    )}

                    {users?.map((user, i) => {
                        const avatarColor = AVATAR_COLORS[i % AVATAR_COLORS.length]
                        return (
                            <div key={user.id}
                                className="bg-white rounded-2xl border border-slate-200/80 p-4 space-y-3.5 shadow-sm">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0"
                                            style={{ background: avatarColor.bg, color: avatarColor.text }}>
                                            {getInitials(user.name)}
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800 text-sm leading-tight">{user.name || "—"}</p>
                                            <p className="text-xs text-slate-400 mt-0.5">{formatDate(user.created_at)}</p>
                                        </div>
                                    </div>
                                    {user.approved ? (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex-shrink-0">
                                            <UserCheck className="w-3 h-3" /> OK
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 flex-shrink-0">
                                            <Clock className="w-3 h-3" /> Pending
                                        </span>
                                    )}
                                </div>

                                <p className="text-xs text-slate-400 truncate px-0.5">{user.email || "—"}</p>

                                <div className="pt-1 border-t border-slate-100">
                                    {user.approved ? (
                                        <form action={revokeUser.bind(null, user.id)}>
                                            <button type="submit"
                                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors border border-red-200 bg-red-50 text-red-600 hover:bg-red-100">
                                                <XCircle className="w-3.5 h-3.5" /> Revoke Access
                                            </button>
                                        </form>
                                    ) : (
                                        <form action={approveUser.bind(null, user.id)}>
                                            <button type="submit"
                                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer text-white shadow-sm"
                                                style={{ background: "linear-gradient(135deg, #0ea5e9, #14b8a6)" }}>
                                                <CheckCircle2 className="w-3.5 h-3.5" /> Approve Access
                                            </button>
                                        </form>
                                    )}
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
