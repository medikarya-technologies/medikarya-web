"use client"

// The same idea for everything outside the dashboard (the marketing pages, and a dashboard layout that fails),
// in the look of the site's own not-found page.

import { useEffect } from "react"
import Link from "next/link"
import { RotateCcw, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-brand-50 shadow-sm">
        <TriangleAlert className="h-10 w-10 text-brand-600" />
      </div>
      <h1 className="mb-4 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">Something went wrong</h1>
      <p className="mb-8 max-w-md text-lg text-muted-foreground">This page could not load. Please try again, and if it keeps happening write to support@medikarya.in.</p>
      <div className="flex flex-col gap-4 sm:flex-row">
        <Button size="lg" onClick={reset} className="gap-2">
          <RotateCcw className="h-4 w-4" />
          Try again
        </Button>
        <Button asChild size="lg" variant="outline" className="gap-2">
          <Link href="/">Back to Home</Link>
        </Button>
      </div>
      {error.digest && <p className="mt-8 font-mono text-xs text-muted-foreground">Reference {error.digest}</p>}
    </div>
  )
}
