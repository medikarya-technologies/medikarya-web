"use client"

// What a student sees when a dashboard page fails to load (a database hiccup, a bug): the frame is still there,
// with a way to try again and a reference to quote if it keeps happening. Without this the framework's bare
// default error page is shown.

import { useEffect } from "react"
import Link from "next/link"
import { RotateCcw, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { PRIMARY_BUTTON, SECONDARY_BUTTON, StatePanel } from "@/components/dashboard/dashboard-ui"

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <DashboardLayout>
      <StatePanel
        icon={<TriangleAlert className="h-6 w-6" strokeWidth={1.6} />}
        title="Something went wrong"
        reference={error.digest}
        actions={
          <>
            <Button onClick={reset} className={PRIMARY_BUTTON}>
              <RotateCcw className="h-4 w-4" strokeWidth={1.9} />
              Try again
            </Button>
            <Button asChild variant="outline" className={SECONDARY_BUTTON}>
              <Link href="/dashboard">Back to dashboard</Link>
            </Button>
          </>
        }
      >
        This page could not load. Nothing you have saved is affected. If it keeps happening, write to{" "}
        <a href="mailto:support@medikarya.in" className="font-medium text-brand-700 underline-offset-2 hover:underline">
          support@medikarya.in
        </a>{" "}
        and quote the reference below.
      </StatePanel>
    </DashboardLayout>
  )
}
