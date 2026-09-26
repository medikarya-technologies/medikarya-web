"use client"

// Razorpay Standard Checkout: create-order → open the modal → verify the signature server-side.
// One-time payment only (Razorpay's Orders API) — a recurring subscription (matching the ₹/mo pricing
// this app actually sells) is Razorpay's separate Subscriptions API and isn't what this wires up.

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => {
      open: () => void
      on: (event: "payment.failed", handler: (response: { error: { description: string } }) => void) => void
    }
  }
}

const CHECKOUT_SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js"

function loadCheckoutScript(): Promise<void> {
  if (typeof window !== "undefined" && window.Razorpay) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${CHECKOUT_SCRIPT_SRC}"]`)
    if (existing) {
      existing.addEventListener("load", () => resolve())
      existing.addEventListener("error", () => reject(new Error("Failed to load Razorpay checkout script")))
      return
    }
    const script = document.createElement("script")
    script.src = CHECKOUT_SCRIPT_SRC
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("Failed to load Razorpay checkout script"))
    document.body.appendChild(script)
  })
}

interface RazorpayCheckoutButtonProps {
  /** Amount in whole rupees (converted to paise for the order). */
  amountRupees: number
  label: string
  description?: string
  className?: string
  onVerified?: (result: { order_id: string; payment_id: string }) => void
}

export function RazorpayCheckoutButton({ amountRupees, label, description, className, onVerified }: RazorpayCheckoutButtonProps) {
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const handleClick = async () => {
    setLoading(true)
    try {
      await loadCheckoutScript()

      const orderRes = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Math.round(amountRupees * 100), currency: "INR" }),
      })
      const order = await orderRes.json()
      if (!orderRes.ok) throw new Error(order.error ?? "Could not create order")

      const razorpay = new window.Razorpay({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        order_id: order.order_id,
        name: "MediKarya",
        description,
        handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            const verifyRes = await fetch("/api/payments/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(response),
            })
            const result = await verifyRes.json()
            if (!verifyRes.ok || !result.verified) {
              toast({ title: "Payment could not be verified", description: "Contact support with your payment id if this persists.", variant: "destructive" })
              return
            }
            toast({ title: "Payment successful", description: `Payment ID: ${response.razorpay_payment_id}` })
            onVerified?.({ order_id: response.razorpay_order_id, payment_id: response.razorpay_payment_id })
          } catch {
            toast({ title: "Payment could not be verified", description: "Contact support with your payment id if this persists.", variant: "destructive" })
          }
        },
        modal: {
          ondismiss: () => {
            toast({ title: "Payment cancelled" })
          },
        },
        theme: { color: "#0891b2" },
      })

      razorpay.on("payment.failed", (response) => {
        toast({ title: "Payment failed", description: response.error.description, variant: "destructive" })
      })

      razorpay.open()
    } catch (error) {
      toast({ title: "Something went wrong", description: error instanceof Error ? error.message : "Could not start checkout.", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button onClick={handleClick} disabled={loading} className={cn(className)}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {label}
    </Button>
  )
}
