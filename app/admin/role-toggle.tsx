"use client"

import { useState, useTransition } from "react"
import { Crown, GraduationCap, AlertTriangle, X } from "lucide-react"
import { setUserRole } from "./actions"

interface Props {
    clerkUserId: string
    currentRole: "student" | "admin"
    isSelf: boolean
}

export function RoleToggleButton({ clerkUserId, currentRole, isSelf }: Props) {
    const [showConfirm, setShowConfirm] = useState(false)
    const [isPending, startTransition] = useTransition()

    const isAdmin = currentRole === "admin"
    const newRole = isAdmin ? "student" : "admin"

    function handleClick() {
        // Only show confirmation modal when an admin is about to demote themselves
        if (isSelf && isAdmin) {
            setShowConfirm(true)
            return
        }
        // All other role changes go through immediately
        submit()
    }

    function submit() {
        startTransition(async () => {
            await setUserRole(clerkUserId, newRole)
            setShowConfirm(false)
        })
    }

    return (
        <>
            {/* ── Toggle Button ── */}
            {isAdmin ? (
                <button
                    onClick={handleClick}
                    disabled={isPending}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    <GraduationCap className="w-3.5 h-3.5" />
                    {isPending ? "Saving…" : "Make Student"}
                </button>
            ) : (
                <button
                    onClick={handleClick}
                    disabled={isPending}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all text-white shadow-sm hover:shadow disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}
                >
                    <Crown className="w-3.5 h-3.5" />
                    {isPending ? "Saving…" : "Make Admin"}
                </button>
            )}

            {/* ── Self-Demotion Confirmation Modal ── */}
            {showConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    style={{ background: "rgba(15,23,42,0.45)", backdropFilter: "blur(4px)" }}>
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-sm p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">

                        {/* Header */}
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center flex-shrink-0">
                                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-900 text-sm leading-tight">Remove your own admin role?</p>
                                    <p className="text-xs text-slate-500 mt-0.5">This will log you out of the admin panel</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowConfirm(false)}
                                className="text-slate-400 hover:text-slate-600 transition-colors mt-0.5 flex-shrink-0"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Warning text */}
                        <p className="text-sm text-slate-600 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 leading-relaxed">
                            You're about to demote <span className="font-semibold text-slate-800">yourself</span> to student. 
                            You won't be able to access <code className="text-xs bg-amber-100 px-1.5 py-0.5 rounded">/admin</code> until another admin restores your role.
                        </p>

                        {/* Actions */}
                        <div className="flex gap-3 pt-1">
                            <button
                                onClick={() => setShowConfirm(false)}
                                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={submit}
                                disabled={isPending}
                                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-50"
                                style={{ background: "linear-gradient(135deg, #ef4444, #dc2626)" }}
                            >
                                {isPending ? "Saving…" : "Yes, demote me"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
