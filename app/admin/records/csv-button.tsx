"use client"

import { Download } from "lucide-react"

/** Downloads rows as a spreadsheet (CSV, opens in Excel or Google Sheets). */
export function CsvButton({ filename, header, rows }: { filename: string; header: string[]; rows: Array<Array<string | number | null>> }) {
  const download = () => {
    const cell = (v: string | number | null) => `"${String(v ?? "").replace(/"/g, '""')}"`
    const text = [header, ...rows].map((r) => r.map(cell).join(",")).join("\n")
    // The BOM makes Excel read the file as UTF-8 (names, the rupee sign).
    const url = URL.createObjectURL(new Blob(["﻿", text], { type: "text/csv;charset=utf-8" }))
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }
  return (
    <button
      type="button"
      onClick={download}
      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
    >
      <Download className="h-4 w-4" /> Download spreadsheet
    </button>
  )
}
