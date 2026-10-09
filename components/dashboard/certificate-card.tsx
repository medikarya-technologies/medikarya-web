"use client"

// A workshop certificate on the dashboard: what it is for, a link to the printable certificate (it opens on the Case
// Studio, where every MediKarya certificate lives), and what to type into LinkedIn. Only shown to students who have one.

import { Award, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Eyebrow, Paper } from "@/components/cases/encounter-ui"
import { PRIMARY_BUTTON } from "./button-styles"
import { cn } from "@/lib/utils"

export interface MyCertificate {
  credentialId: string
  title: string
  issuedAt: string
  /** The printable certificate. */
  url: string
  /** Its public verification page, the "credential URL" for LinkedIn. */
  verifyUrl: string
}

const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" })

export function CertificateCard({ certificates }: { certificates: MyCertificate[] }) {
  if (certificates.length === 0) return null
  return (
    <Paper className="h-fit p-5">
      <Eyebrow>{certificates.length === 1 ? "Your certificate" : "Your certificates"}</Eyebrow>
      <ul className="mt-3 space-y-4">
        {certificates.map((c) => (
          <li key={c.credentialId}>
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-enc-ok-soft text-enc-ok">
                <Award className="h-4.5 w-4.5" strokeWidth={1.9} aria-hidden />
              </span>
              <div className="min-w-0">
                <h2 className="text-[15px] leading-snug font-semibold text-enc-ink">{c.title}</h2>
                <p className="mt-0.5 text-[12.5px] text-enc-ink-3">Issued {day(c.issuedAt)}</p>
              </div>
            </div>
            <Button asChild className={cn(PRIMARY_BUTTON, "mt-3 w-full")}>
              <a href={c.url} target="_blank" rel="noreferrer">
                View and download <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
            </Button>
            <div className="mt-2 text-[12px] leading-relaxed text-enc-ink-3">
              <p>For LinkedIn (Licences &amp; certifications):</p>
              <p>
                Credential ID <span className="font-mono text-enc-ink-2">{c.credentialId}</span>
              </p>
              <p>
                URL <span className="font-mono text-enc-ink-2">{c.verifyUrl.replace(/^https:\/\/(www\.)?/, "")}</span>
              </p>
            </div>
          </li>
        ))}
      </ul>
    </Paper>
  )
}
