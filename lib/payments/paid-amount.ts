/**
 * What a Razorpay payment actually collected, in rupees, for the Meta Purchase event: after any coupon, and only for
 * a payment that has gone through. Razorpay counts in paise. null when there is nothing real to report.
 */
export function paidAmount(payment: { amount?: unknown; currency?: unknown; status?: unknown } | null | undefined): { amount: number; currency: string } | null {
  if (!payment) return null
  // "authorized" is a successful subscription charge that Razorpay has not captured yet (it does so automatically).
  if (payment.status !== "captured" && payment.status !== "authorized") return null
  if (typeof payment.amount !== "number" || !Number.isFinite(payment.amount) || payment.amount <= 0) return null
  if (typeof payment.currency !== "string" || !payment.currency) return null
  return { amount: Math.round(payment.amount) / 100, currency: payment.currency }
}
