import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { CheckoutClient } from "./checkout-client"

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
}

type CheckoutParams = {
  tier?: string
  period?: string
  backTo?: string
  returnTo?: string
}

function safeInternalPath(value: string | undefined, fallback: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback
  return value
}

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<CheckoutParams> }) {
  const params = await searchParams
  if ((params.tier !== "intern" && params.tier !== "resident") || (params.period !== "monthly" && params.period !== "yearly")) {
    redirect("/#pricing")
  }

  return (
    <CheckoutClient
      tier={params.tier}
      period={params.period}
      backTo={safeInternalPath(params.backTo, "/#pricing")}
      returnTo={safeInternalPath(params.returnTo, "/dashboard")}
    />
  )
}
