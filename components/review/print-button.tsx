"use client"

// "Save as PDF": the browser's own print dialog, which saves the report as a PDF. The page hides everything but the
// report when printing (anything marked `no-print`).

import { Printer } from "lucide-react"

export function PrintButton({ label = "Print or save as PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-[14px] font-semibold text-slate-800 hover:bg-slate-50"
    >
      <Printer className="h-4 w-4" /> {label}
    </button>
  )
}
