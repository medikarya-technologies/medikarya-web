"use client"

import { useState } from "react"
import { RazorpayCheckoutButton } from "@/components/payments/razorpay-checkout-button"

export default function RazorpayTestClient() {
  const [lastVerified, setLastVerified] = useState<{ order_id: string; payment_id: string } | null>(null)

  return (
    <div className="mx-auto max-w-md space-y-6 p-10">
      <div>
        <h1 className="text-xl font-semibold">Razorpay checkout — test</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Test-mode order for ₹1. Use Razorpay&apos;s published test card 4111 1111 1111 1111, any future expiry, any
          CVV — or any UPI id ending in @razorpay on the UPI tab.
        </p>
      </div>

      <RazorpayCheckoutButton
        amountRupees={1}
        label="Pay ₹1 (test)"
        description="MediKarya Razorpay integration test"
        onVerified={setLastVerified}
      />

      {lastVerified && (
        <div className="rounded-md border bg-muted/50 p-4 text-sm">
          <p className="font-medium">Last verified payment</p>
          <p className="mt-1 font-mono text-xs">order_id: {lastVerified.order_id}</p>
          <p className="font-mono text-xs">payment_id: {lastVerified.payment_id}</p>
        </div>
      )}
    </div>
  )
}
