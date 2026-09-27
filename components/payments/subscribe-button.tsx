"use client"

// Starts a Razorpay subscription for a paid tier: create-subscription → Razorpay checkout (which takes the first
// payment and sets up the mandate for renewals) → verify-subscription, which checks the signature and saves it.
// Signed-out visitors are sent to sign in first, since a subscription has to belong to an account.

import { useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@clerk/nextjs"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { loadCheckoutScript } from "./razorpay-checkout-button"
import { refreshPlan } from "@/components/plans/use-plan"

type Tier = "intern" | "resident"
type Period = "monthly" | "yearly"

const TIER_NAME: Record<Tier, string> = { intern: "Intern", resident: "Resident" }

interface SubscribeButtonProps {
  tier: Tier
  period: Period
  className?: string
  children: ReactNode
  /** Called once the plan is active. Without it, the student is taken to the dashboard. */
  onSubscribed?: (tier: Tier) => void
  /** Called just before Razorpay's window opens: a modal dialog around this button must close first, or it
   *  blocks clicks on Razorpay's window (which is added outside it). */
  onCheckoutOpen?: () => void
}

export function SubscribeButton({ tier, period, className, children, onSubscribed, onCheckoutOpen }: SubscribeButtonProps) {
  const { isLoaded, isSignedIn } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  const fail = (description: string) => toast({ title: "Could not start your plan", description, variant: "destructive" })

  const handleClick = async () => {
    if (!isSignedIn) {
      router.push("/login")
      return
    }

    setLoading(true)
    try {
      await loadCheckoutScript()

      const res = await fetch("/api/payments/create-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, period }),
      })
      const created = await res.json()
      if (!res.ok) {
        fail(created.error ?? "Please try again in a moment.")
        return
      }

      const checkout = new window.Razorpay({
        key: created.key_id,
        subscription_id: created.subscription_id,
        name: "MediKarya",
        description: `${TIER_NAME[tier]} plan, billed ${period === "yearly" ? "yearly" : "monthly"}`,
        handler: async (response: { razorpay_payment_id: string; razorpay_subscription_id: string; razorpay_signature: string }) => {
          try {
            const verifyRes = await fetch("/api/payments/verify-subscription", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(response),
            })
            const result = await verifyRes.json()
            if (!verifyRes.ok || !result.verified) {
              toast({
                title: "Payment could not be verified",
                description: `Contact support with this payment id: ${response.razorpay_payment_id}`,
                variant: "destructive",
              })
              return
            }
            await refreshPlan()
            if (onSubscribed) {
              toast({ title: `You're now a ${TIER_NAME[tier]}`, description: "Your plan is active." })
              onSubscribed(tier)
            } else {
              toast({ title: `You're now a ${TIER_NAME[tier]}`, description: "Your plan is active. Taking you to your dashboard." })
              router.push("/dashboard")
            }
          } catch {
            toast({
              title: "Payment could not be verified",
              description: `Contact support with this payment id: ${response.razorpay_payment_id}`,
              variant: "destructive",
            })
          }
        },
        modal: { ondismiss: () => toast({ title: "Checkout closed", description: "You have not been charged." }) },
        theme: { color: "#0891b2" },
      })

      checkout.on("payment.failed", (response) => {
        toast({ title: "Payment failed", description: response.error.description, variant: "destructive" })
      })
      onCheckoutOpen?.()
      checkout.open()
    } catch (error) {
      fail(error instanceof Error ? error.message : "Please try again in a moment.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button type="button" onClick={handleClick} disabled={!isLoaded || loading} className={className}>
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {children}
    </Button>
  )
}
