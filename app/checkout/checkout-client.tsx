"use client"

import { useId, useState, type FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth, useUser } from "@clerk/nextjs"
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { loadCheckoutScript } from "@/components/payments/razorpay-checkout-button"
import { refreshPlan } from "@/components/plans/use-plan"
import { trackEvent } from "@/lib/clarity"
import { PLAN_OFFERS, rupees } from "@/lib/plans/catalog"
import { CHECKOUT_COLOR, CHECKOUT_NAME, checkoutLogo } from "@/lib/payments/checkout-brand"

type Tier = "intern" | "resident"
type Period = "monthly" | "yearly"

const TIER_NAME: Record<Tier, string> = { intern: "Intern", resident: "Resident" }

export function CheckoutClient({ tier, period, backTo, returnTo }: {
  tier: Tier
  period: Period
  backTo: string
  returnTo: string
}) {
  const { isLoaded, isSignedIn } = useAuth()
  const { user } = useUser()
  const router = useRouter()
  const { toast } = useToast()
  const [couponCode, setCouponCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const couponInputId = useId()

  const offer = PLAN_OFFERS[tier]
  const amount = period === "yearly" ? offer.yearly : offer.monthly
  const checkoutPlan = `${tier}_${period}`

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isLoaded || loading) return
    if (!isSignedIn) {
      router.push("/login")
      return
    }

    setLoading(true)
    setErrorMessage("")
    try {
      await loadCheckoutScript()

      const res = await fetch("/api/payments/create-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, period, couponCode }),
      })
      const created = await res.json()
      if (!res.ok) {
        setErrorMessage(created.error ?? "Please check the details and try again.")
        return
      }

      const checkout = new window.Razorpay({
        key: created.key_id,
        subscription_id: created.subscription_id,
        name: CHECKOUT_NAME,
        image: checkoutLogo(),
        prefill: { name: user?.fullName ?? undefined, email: user?.primaryEmailAddress?.emailAddress ?? undefined },
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
            trackEvent("Subscribed", { checkout_plan: checkoutPlan })
            await refreshPlan()
            toast({ title: `You're now a ${TIER_NAME[tier]}`, description: "Your plan is active." })
            router.push(returnTo)
            router.refresh()
          } catch {
            toast({
              title: "Payment could not be verified",
              description: `Contact support with this payment id: ${response.razorpay_payment_id}`,
              variant: "destructive",
            })
          }
        },
        modal: {
          ondismiss: () => {
            trackEvent("Checkout_Closed", { checkout_plan: checkoutPlan })
            toast({ title: "Checkout closed", description: "You have not been charged." })
          },
        },
        theme: { color: CHECKOUT_COLOR },
      })

      checkout.on("payment.failed", (response) => {
        trackEvent("Payment_Failed", { checkout_plan: checkoutPlan })
        toast({ title: "Payment failed", description: response.error.description, variant: "destructive" })
      })
      trackEvent("Checkout_Opened", { checkout_plan: checkoutPlan })
      checkout.open()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Please try again in a moment.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="relative isolate min-h-dvh overflow-hidden bg-brand-950 px-4 py-8 text-white sm:py-14">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage: "linear-gradient(to right, var(--brand-300) 1px, transparent 1px), linear-gradient(to bottom, var(--brand-300) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black 45%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black 45%, transparent 100%)",
        }}
      />
      <div className="relative mx-auto max-w-lg">
        <header className="mb-8 flex items-center justify-between">
          <Link href={backTo} className="inline-flex items-center gap-2 rounded-md text-sm font-medium text-white/70 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300">
            <ArrowLeft aria-hidden="true" className="size-4" />
            Back
          </Link>
          <div className="inline-flex items-center gap-1.5 text-xs font-medium text-white/60">
            <ShieldCheck aria-hidden="true" className="size-4 text-brand-300" />
            Secure checkout
          </div>
        </header>

        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-lg shadow-black/20 sm:p-7">
          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-white">Checkout</h1>
            <p className="mt-2 text-sm text-white/65">Review your plan and enter a coupon code if you have one.</p>
          </div>

          <div className="mb-6 flex items-center justify-between gap-4 border-y border-white/10 py-4">
            <div>
              <p className="font-semibold text-white">{TIER_NAME[tier]} plan</p>
              <p className="mt-0.5 text-sm text-white/55">Billed {period}</p>
            </div>
            <p className="text-right text-lg font-bold text-white">
              {rupees(amount)}<span className="ml-1 text-sm font-normal text-white/55">/{period === "yearly" ? "yr" : "mo"}</span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor={couponInputId} className="text-sm font-medium text-white">Coupon code <span className="font-normal text-white/55">(optional)</span></label>
              <Input
                id={couponInputId}
                value={couponCode}
                onChange={(event) => {
                  setCouponCode(event.target.value)
                  setErrorMessage("")
                }}
                placeholder="Enter coupon code"
                autoCapitalize="characters"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                disabled={loading}
                aria-invalid={Boolean(errorMessage)}
                aria-describedby={errorMessage ? `${couponInputId}-error` : `${couponInputId}-hint`}
                className="h-11 border-white/20 bg-white/[0.06] text-white placeholder:text-white/40 focus-visible:border-brand-300 focus-visible:ring-brand-300"
              />
              <p id={`${couponInputId}-hint`} className="text-xs text-white/55">Leave blank to continue at the regular price.</p>
              {errorMessage && <p id={`${couponInputId}-error`} role="alert" className="text-sm font-medium text-destructive">{errorMessage}</p>}
            </div>

            <Button type="submit" disabled={loading} className="h-11 w-full rounded-lg bg-brand-500 text-sm font-semibold text-white hover:bg-brand-400 focus-visible:ring-brand-300">
              {loading && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
              Continue to secure payment
            </Button>
          </form>

          <p className="mt-5 text-center text-xs leading-relaxed text-white/50">
            Payment is processed securely by Razorpay. The plan renews automatically; you can cancel any time.
          </p>
        </section>
      </div>
    </main>
  )
}
