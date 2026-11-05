"use client"

import type { ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"

type Tier = "intern" | "resident"
type Period = "monthly" | "yearly"

interface SubscribeButtonProps {
  tier: Tier
  period: Period
  className?: string
  children: ReactNode
  /** Closes an in-app upgrade dialog before navigating to the full checkout page. */
  onCheckoutNavigate?: () => void
}

export function SubscribeButton({ tier, period, className, children, onCheckoutNavigate }: SubscribeButtonProps) {
  const { isLoaded, isSignedIn } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  const handleClick = () => {
    if (!isLoaded) return
    if (!isSignedIn) {
      router.push("/login")
      return
    }

    const backTo = pathname === "/" ? "/#pricing" : pathname || "/"
    const returnTo = pathname?.startsWith("/dashboard") ? pathname : "/dashboard"
    const params = new URLSearchParams({ tier, period, backTo, returnTo })
    onCheckoutNavigate?.()
    router.push(`/checkout?${params.toString()}`)
  }

  return (
    <Button type="button" onClick={handleClick} className={className}>
      {children}
    </Button>
  )
}
