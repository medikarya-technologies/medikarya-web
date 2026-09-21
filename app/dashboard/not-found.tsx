import Link from "next/link"
import { Compass } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/dashboard/button-styles"
import { StatePanel } from "@/components/dashboard/dashboard-ui"

export default function DashboardNotFound() {
  return (
    <DashboardLayout>
      <StatePanel
        icon={<Compass className="h-6 w-6" strokeWidth={1.6} />}
        title="That page is not here"
        actions={
          <>
            <Button asChild className={PRIMARY_BUTTON}>
              <Link href="/dashboard/cases">Open the case library</Link>
            </Button>
            <Button asChild variant="outline" className={SECONDARY_BUTTON}>
              <Link href="/dashboard">Back to dashboard</Link>
            </Button>
          </>
        }
      >
        The link may be old, or the case may have been taken down.
      </StatePanel>
    </DashboardLayout>
  )
}
