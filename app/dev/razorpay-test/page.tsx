import { notFound } from "next/navigation"
import RazorpayTestClient from "./client"

// Dev-only sandbox for the Razorpay Standard Checkout integration: a ₹1 test order end to end.
// Returns 404 in production builds, so it can never be reached on a deployed site.
export default function RazorpayTestPage() {
  if (process.env.NODE_ENV === "production") notFound()
  return <RazorpayTestClient />
}
