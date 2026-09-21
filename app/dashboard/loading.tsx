export default function DashboardLoading() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-enc-desk">
            <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-enc-line-strong border-t-brand-600" />
            <p className="text-[14px] font-medium text-enc-ink-2">Loading…</p>
        </div>
    )
}
