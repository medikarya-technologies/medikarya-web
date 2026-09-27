"use client"

// Written to match how billing actually works (app/api/payments/*, components/plans/billing.tsx): Razorpay
// subscriptions, monthly or yearly, cancel any time from Plan & billing, access to the end of the paid period.
// Keep it true when any of that changes. The refund cases are the owner's decision; see section 4.

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { PLAN_OFFERS, rupees } from "@/lib/plans/catalog"

export default function RefundPolicyClient() {
    const { intern, resident } = PLAN_OFFERS
    return (
        <div className="min-h-screen bg-studio-50 font-sans text-slate-600 selection:bg-brand-100 selection:text-brand-900">
            <header className="sticky top-0 z-40 w-full border-b bg-white/80 backdrop-blur-xl">
                <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2 font-bold text-slate-800 text-lg">
                        <div className="flex h-8 w-8 items-center justify-center">
                            <img src="https://www.medikarya.in/medikarya.svg" alt="MediKarya Logo" className="h-full w-full object-contain" />
                        </div>
                        MediKarya
                    </Link>
                    <Button asChild variant="ghost" size="sm" className="text-slate-500 hover:text-brand-600">
                        <Link href="/" className="flex items-center gap-2"><ArrowLeft className="h-4 w-4" />Back to Home</Link>
                    </Button>
                </div>
            </header>
            <main className="container mx-auto px-4 py-12 max-w-4xl">
                <div className="mb-10 text-center">
                    <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl mb-4">Refund &amp; Cancellation Policy</h1>
                    <p className="text-lg text-slate-600">Last updated: September 27, 2026</p>
                </div>
                <div className="prose prose-slate prose-lg max-w-none bg-white rounded-3xl p-8 sm:p-12 shadow-sm border border-slate-100">
                    <h3>1. What you pay for</h3>
                    <p>
                        MediKarya is free on the Student plan. The paid plans are subscriptions: <strong>Intern</strong> at {rupees(intern.monthly)} a month
                        or {rupees(intern.yearly)} a year, and <strong>Resident</strong> at {rupees(resident.monthly)} a month or {rupees(resident.yearly)} a
                        year. Prices include applicable taxes unless the checkout says otherwise. Payments are processed by Razorpay; we never see or store
                        your card or UPI details.
                    </p>

                    <h3>2. Delivery</h3>
                    <p>
                        MediKarya is an online service; nothing is shipped. Your plan starts as soon as the payment is confirmed, usually within seconds, and
                        you can see it under <strong>Plan &amp; billing</strong> in your dashboard. Razorpay emails you a receipt for every payment.
                    </p>

                    <h3>3. Renewal and cancellation</h3>
                    <ul>
                        <li><strong>Renewal:</strong> a subscription renews automatically at the end of each month or year, using the card or UPI mandate you approved at checkout.</li>
                        <li><strong>Cancel any time</strong> from <strong>Plan &amp; billing → Cancel subscription</strong>. There is no cancellation fee.</li>
                        <li><strong>After you cancel</strong> you are not charged again, and you keep your plan until the end of the period you have already paid for. After that you move to the free Student plan.</li>
                        <li>Your attempts, scores and progress are kept whether or not you have a paid plan.</li>
                        <li>You can also cancel a UPI AutoPay mandate from your UPI app; please cancel in MediKarya as well so your plan page is up to date.</li>
                    </ul>

                    <h3>4. Refunds</h3>
                    <p>Because you can cancel at any time and keep what you paid for until the period ends, we do not refund the unused part of a month or year. We do refund in full when:</p>
                    <ul>
                        <li>you were charged twice for the same period, or charged after you cancelled;</li>
                        <li>you were charged but your plan was never activated, and we cannot fix it; or</li>
                        <li>a fault on our side kept you from using the service for a substantial part of a paid period.</li>
                    </ul>
                    <p>
                        To ask for a refund, write to <a href="mailto:contact@medikarya.in">contact@medikarya.in</a> within 30 days of the charge, from the
                        email on your account, with the Razorpay payment ID from your receipt. We reply within 3 working days. Approved refunds go back to the
                        original payment method; banks usually take 5–7 working days to show them.
                    </p>

                    <h3>5. Failed and pending payments</h3>
                    <p>
                        If money leaves your account but the payment fails, it is not a charge by us: your bank or Razorpay reverses it automatically, usually
                        within 5–7 working days. If a renewal payment fails, Razorpay retries it for a few days and your plan stays active meanwhile; if it
                        still fails, the plan ends and you move to the free Student plan.
                    </p>

                    <h3>6. Changes to this policy</h3>
                    <p>If we change this policy we will update this page. Changes never apply to a period you have already paid for.</p>

                    <Separator className="my-8" />
                    <div className="not-prose mt-8">
                        <h3 className="text-xl font-bold text-slate-900 mb-2">Contact Us</h3>
                        <p className="text-sm text-slate-600 mb-3">Billing questions, refunds and anything else:</p>
                        <div className="flex flex-wrap gap-2">
                            <Button variant="outline" asChild><a href="mailto:contact@medikarya.in">contact@medikarya.in</a></Button>
                            <Button variant="outline" asChild><a href="tel:+918796502901">+91 87965 02901</a></Button>
                        </div>
                    </div>
                </div>
            </main>
            <footer className="border-t py-8 bg-white">
                <div className="container mx-auto px-4 text-center text-sm text-slate-500">
                    &copy; {new Date().getFullYear()} MediKarya. All rights reserved.
                </div>
            </footer>
        </div>
    )
}
