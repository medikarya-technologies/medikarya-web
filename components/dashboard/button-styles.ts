// The dashboard's two button looks, as plain text. This is not a client file on purpose: a server component that
// imports a constant from a "use client" file receives a client reference, not the value, so anything server-rendered
// (the not-found page) must take these from here. dashboard-ui.tsx re-exports them for the client components.

export const PRIMARY_BUTTON =
  "h-10 gap-2 rounded-lg bg-brand-600 px-4 text-[14px] font-semibold text-white shadow-none transition-colors hover:bg-brand-700 focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2 focus-visible:ring-offset-enc-desk"
export const SECONDARY_BUTTON =
  "h-10 gap-2 rounded-lg border-enc-line-strong bg-enc-sheet px-4 text-[14px] font-medium text-enc-ink-2 shadow-none transition-colors hover:bg-enc-console hover:text-enc-ink"
