// The full case as students meet it, for the professor's review page. The walkthrough is the case's own Markdown;
// only headings, bullets and **bold** are used in it, so a small renderer is enough.

import type { ReactNode } from "react"
import type { CaseView } from "@/lib/protocol-review/case-view"

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong> : <span key={i}>{part}</span>
  )
}

function Walkthrough({ text }: { text: string }) {
  const out: ReactNode[] = []
  let bullets: string[] = []
  const flush = () => {
    if (!bullets.length) return
    out.push(
      <ul key={out.length} className="ml-5 list-disc space-y-1">
        {bullets.map((b, i) => <li key={i}>{inline(b)}</li>)}
      </ul>
    )
    bullets = []
  }
  for (const raw of text.split("\n")) {
    const line = raw.trim()
    if (!line) { flush(); continue }
    const bullet = line.match(/^[*-]\s+(.*)$/)
    if (bullet) { bullets.push(bullet[1]); continue }
    flush()
    if (line.startsWith("#")) out.push(<h4 key={out.length} className="pt-1 text-[15.5px] font-bold text-slate-900">{line.replace(/^#+\s*/, "")}</h4>)
    else out.push(<p key={out.length}>{inline(line)}</p>)
  }
  flush()
  return <div className="space-y-2 text-[14.5px] leading-relaxed text-slate-700">{out}</div>
}

function Part({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-t border-slate-200 pt-4">
      <h3 className="mb-2 text-[16px] font-bold text-slate-900">{title}</h3>
      {children}
    </div>
  )
}

export function CasePanel({ view }: { view: CaseView }) {
  return (
    <div className="space-y-4">
      {view.sections.map((s) => (
        <Part key={s.title} title={s.title}>
          <dl className="space-y-1.5 text-[14.5px] leading-relaxed">
            {s.rows.map((r, i) => (
              <div key={i} className="sm:flex sm:gap-3">
                {r.label && <dt className="shrink-0 font-semibold text-slate-900 sm:w-44">{r.label}</dt>}
                <dd className="text-slate-700">{r.value}</dd>
              </div>
            ))}
          </dl>
        </Part>
      ))}
      <Part title="Test results (what the student gets when they order each test)">
        <div className="space-y-2.5">
          {view.tests.map((t) => (
            <div key={t.name} className="text-[14.5px] leading-relaxed">
              <p className="font-semibold text-slate-900">{t.name}</p>
              {t.lines.map((l, i) => <p key={i} className="text-slate-700">{l}</p>)}
            </div>
          ))}
        </div>
      </Part>
      {view.walkthrough && (
        <Part title="Expert walkthrough (shown to the student after the case)">
          <Walkthrough text={view.walkthrough} />
        </Part>
      )}
      {view.keyPoints.length > 0 && (
        <Part title="Teaching points">
          <ul className="ml-5 list-disc space-y-1.5 text-[14.5px] leading-relaxed text-slate-700">
            {view.keyPoints.map((k, i) => <li key={i}>{k}</li>)}
          </ul>
        </Part>
      )}
    </div>
  )
}
