import Link from "next/link"
import { redirect } from "next/navigation"
import { auth } from "@clerk/nextjs/server"
import { ArrowLeft, CreditCard } from "lucide-react"
import { supabaseServer } from "@/lib/supabase/server"
import { isAdmin } from "@/lib/plans/access"
import { periodOfPlan } from "@/lib/payments/subscriptions"

export const dynamic = "force-dynamic"
export const metadata = { title: "Payments" }

interface AttemptRow {
  clerk_user_id: string
  razorpay_subscription_id: string
  tier: string
  billing_period: "monthly" | "yearly"
  coupon_code: string | null
  outcome: "started" | "failed" | "abandoned" | "paid"
  failure_code: string | null
  failure_description: string | null
  payment_id: string | null
  created_at: string
  updated_at: string
}

interface SubscriptionRow {
  clerk_user_id: string
  razorpay_subscription_id: string
  razorpay_plan_id: string
  tier: string
  status: string
  current_start: string | null
  current_end: string | null
  created_at: string
  updated_at: string
}

interface ProfileRow {
  clerk_user_id: string
  full_name: string | null
  email: string | null
}

interface PaymentRow {
  clerkUserId: string
  subscriptionId: string
  tier: string
  period: "monthly" | "yearly" | null
  couponCode: string | null
  outcome: AttemptRow["outcome"] | null
  failureCode: string | null
  failureDescription: string | null
  paymentId: string | null
  subscriptionStatus: string | null
  createdAt: string | null
  updatedAt: string | null
  name: string | null
  email: string | null
}

const LABEL = "text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500"

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return "—"
  return new Date(dateStr).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  })
}

function latestTimestamp(...values: Array<string | null | undefined>) {
  return values
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null
}

function isMissingAttemptsTable(error: { code?: string; message: string } | null) {
  if (!error) return false
  return error.code === "42P01" || error.code === "PGRST205" ||
    (/subscription_checkout_attempts/i.test(error.message) && /(does not exist|could not find|schema cache)/i.test(error.message))
}

function tierName(tier: string) {
  return tier === "resident" ? "Resident" : tier === "intern" ? "Intern" : tier
}

function outcomeFor(row: PaymentRow) {
  if (row.subscriptionStatus === "pending" || row.subscriptionStatus === "halted") return "Payment issue"
  if (row.outcome === "paid" || row.subscriptionStatus === "active") return "Paid"
  if (row.outcome === "failed") return "Payment failed"
  if (row.outcome === "abandoned") return "Closed before payment"
  if (row.outcome === "started") return "Checkout started"
  return row.subscriptionStatus ? `Subscription ${row.subscriptionStatus}` : "Status unavailable"
}

function outcomeClass(label: string) {
  if (label === "Paid") return "bg-emerald-100 text-emerald-800"
  if (label === "Payment failed" || label === "Payment issue") return "bg-rose-100 text-rose-800"
  if (label === "Closed before payment") return "bg-amber-100 text-amber-900"
  if (label === "Checkout started") return "bg-sky-100 text-sky-800"
  return "bg-slate-100 text-slate-700"
}

export default async function AdminPaymentsPage() {
  const { userId } = await auth()
  if (!(await isAdmin(userId ?? null))) redirect("/")

  const [attemptsResult, subscriptionsResult] = await Promise.all([
    supabaseServer
      .from("subscription_checkout_attempts")
      .select("clerk_user_id, razorpay_subscription_id, tier, billing_period, coupon_code, outcome, failure_code, failure_description, payment_id, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(200),
    supabaseServer
      .from("subscriptions")
      .select("clerk_user_id, razorpay_subscription_id, razorpay_plan_id, tier, status, current_start, current_end, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(200),
  ])

  const attemptsTableMissing = isMissingAttemptsTable(attemptsResult.error)
  const attempts = (attemptsResult.data ?? []) as AttemptRow[]
  const subscriptions = (subscriptionsResult.data ?? []) as SubscriptionRow[]
  const userIds = [...new Set([...attempts.map((row) => row.clerk_user_id), ...subscriptions.map((row) => row.clerk_user_id)])]
  const profilesResult = userIds.length
    ? await supabaseServer.from("user_profiles").select("clerk_user_id, full_name, email").in("clerk_user_id", userIds)
    : null
  const profiles = (profilesResult?.data ?? []) as ProfileRow[]
  const profileById = new Map(profiles.map((profile) => [profile.clerk_user_id, profile]))
  const attemptBySubscription = new Map(attempts.map((row) => [row.razorpay_subscription_id, row]))
  const subscriptionById = new Map(subscriptions.map((row) => [row.razorpay_subscription_id, row]))
  const subscriptionIds = [...new Set([...attemptBySubscription.keys(), ...subscriptionById.keys()])]

  const rows: PaymentRow[] = subscriptionIds.map((subscriptionId) => {
    const attempt = attemptBySubscription.get(subscriptionId)
    const subscription = subscriptionById.get(subscriptionId)
    const clerkUserId = attempt?.clerk_user_id ?? subscription?.clerk_user_id ?? ""
    const profile = profileById.get(clerkUserId)
    return {
      clerkUserId,
      subscriptionId,
      tier: attempt?.tier ?? subscription?.tier ?? "unknown",
      period: attempt?.billing_period ?? (subscription ? periodOfPlan(subscription.razorpay_plan_id) : null),
      couponCode: attempt?.coupon_code ?? null,
      outcome: attempt?.outcome ?? null,
      failureCode: attempt?.failure_code ?? null,
      failureDescription: attempt?.failure_description ?? null,
      paymentId: attempt?.payment_id ?? null,
      subscriptionStatus: subscription?.status ?? null,
      createdAt: attempt?.created_at ?? subscription?.created_at ?? null,
      updatedAt: latestTimestamp(attempt?.updated_at, subscription?.updated_at) ?? attempt?.created_at ?? subscription?.created_at ?? null,
      name: profile?.full_name ?? null,
      email: profile?.email ?? null,
    }
  }).sort((a, b) => (b.updatedAt ?? b.createdAt ?? "").localeCompare(a.updatedAt ?? a.createdAt ?? ""))

  const outcomes = rows.map((row) => outcomeFor(row))
  const paid = outcomes.filter((outcome) => outcome === "Paid").length
  const failed = outcomes.filter((outcome) => outcome === "Payment failed" || outcome === "Payment issue").length
  const closed = outcomes.filter((outcome) => outcome === "Closed before payment").length
  const started = outcomes.filter((outcome) => outcome === "Checkout started").length
  const loadErrors = [
    !attemptsTableMissing ? attemptsResult.error?.message : null,
    subscriptionsResult.error?.message,
    profilesResult?.error?.message,
  ].filter(Boolean)

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-10 sm:px-6 sm:py-14">
        <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" /> Admin
        </Link>

        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Payments</h1>
            <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-slate-600">
              See who completed a subscription checkout, who had a payment issue, and which checkouts were closed or left unfinished.
              Razorpay remains the source of truth for subscription state; payment credentials are not stored here.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 shadow-sm">
            <CreditCard className="h-4 w-4 text-sky-600" /> Subscription activity
          </div>
        </header>

        <section aria-label="Payment activity totals" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Paid / active", paid],
            ["Failed / needs attention", failed],
            ["Closed before payment", closed],
            ["Checkout started", started],
          ].map(([label, count]) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className={LABEL}>{label}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{count}</p>
            </div>
          ))}
        </section>

        {attemptsTableMissing && (
          <aside className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-[14px] leading-relaxed text-amber-950">
            <p className="font-semibold">Checkout outcome tracking needs its database table.</p>
            <p className="mt-1">
              Run <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[13px]">scripts/create_subscription_checkout_attempts.sql</code> in the main site&apos;s Supabase project.
              Existing subscription records still appear below; new failed and closed checkouts will be recorded after setup.
            </p>
          </aside>
        )}

        {loadErrors.length > 0 && (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-800">
            Could not load all payment activity: {loadErrors.join(" · ")}
          </div>
        )}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-4">
            <h2 className="text-sm font-bold text-slate-800">Recent subscription activity</h2>
            <p className="mt-1 text-xs text-slate-500">Latest 200 checkout attempts and 200 subscription records · times shown in India Standard Time</p>
          </div>

          {rows.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="font-medium text-slate-700">No subscription activity recorded yet</p>
              <p className="mt-1 text-sm text-slate-500">A row appears when someone starts a paid-plan checkout.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[980px] w-full text-left text-sm">
                <caption className="sr-only">Recent MediKarya subscription checkouts and their payment outcomes</caption>
                <thead className="border-b border-slate-100 bg-white">
                  <tr>
                    <th scope="col" className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Student</th>
                    <th scope="col" className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Plan</th>
                    <th scope="col" className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Outcome</th>
                    <th scope="col" className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Razorpay state</th>
                    <th scope="col" className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Last activity</th>
                    <th scope="col" className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => {
                    const outcome = outcomeFor(row)
                    const details = [
                      row.couponCode ? `Coupon ${row.couponCode}` : null,
                      row.paymentId ? `Payment ${row.paymentId}` : null,
                      row.failureCode,
                      row.failureDescription,
                    ].filter(Boolean)
                    return (
                      <tr key={row.subscriptionId} className="align-top hover:bg-slate-50/70">
                        <td className="px-5 py-4">
                          <p className="font-semibold text-slate-900">{row.name || "Name unavailable"}</p>
                          <p className="mt-0.5 text-xs text-slate-500">{row.email || row.clerkUserId}</p>
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-semibold text-slate-800">{tierName(row.tier)}</p>
                          <p className="mt-0.5 text-xs text-slate-500">{row.period === "yearly" ? "Yearly" : row.period === "monthly" ? "Monthly" : "Billing period unavailable"}</p>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${outcomeClass(outcome)}`}>{outcome}</span>
                        </td>
                        <td className="px-5 py-4 font-mono text-xs text-slate-600">{row.subscriptionStatus ?? "Not received"}</td>
                        <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-600">{formatDateTime(row.updatedAt ?? row.createdAt)}</td>
                        <td className="max-w-xs px-5 py-4 text-xs leading-relaxed text-slate-600">
                          {details.length ? details.join(" · ") : <span className="text-slate-400">No extra details</span>}
                          <p className="mt-1 break-all font-mono text-[10px] text-slate-400">{row.subscriptionId}</p>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {attemptsTableMissing && (
          <p className="text-xs leading-relaxed text-slate-500">
            Failed and abandoned checkouts from before this tracking table is installed cannot be recovered here. For billing disputes or settled amounts, use the matching payment record in Razorpay.
          </p>
        )}
      </div>
    </main>
  )
}
