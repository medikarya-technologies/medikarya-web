"use client"

// The part of a join page that changes: sign in (or sign up) and come back here, tap Join, and then a way into the
// cases. Signing in happens in a pop-up, so the student never loses the page they scanned.

import { useState, useTransition } from "react"
import Link from "next/link"
import { SignInButton, SignUpButton, useClerk } from "@clerk/nextjs"
import { ArrowRight, CircleCheck, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PRIMARY_BUTTON } from "@/components/dashboard/button-styles"
import { cn } from "@/lib/utils"
import { joinWorkshopAction } from "./actions"

interface Props {
  code: string
  joined: boolean
  signedIn?: boolean
  email: string | null
  plan: string
  until: string
  /** When the pass starts, if that is after today. */
  startsOn: string | null
}

const BIG = cn(PRIMARY_BUTTON, "h-12 w-full text-[15.5px]")

export function JoinPanel({ code, joined: joinedAtFirst, signedIn = true, email, plan, until, startsOn }: Props) {
  const [joined, setJoined] = useState(joinedAtFirst)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const { signOut } = useClerk()
  const here = `/join/${code}`

  if (joined) {
    return (
      <div>
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <p className="text-[15px] leading-relaxed text-emerald-950">
            <strong>You are in.</strong> {plan} is on your account until {until}
            {startsOn ? `, starting on ${startsOn}` : ""}.
          </p>
        </div>
        <Button asChild className={cn(BIG, "mt-4")}>
          <Link href="/dashboard/cases">
            Start your first case <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        {email && <p className="mt-3 text-center text-[13px] text-slate-500">Signed in as {email}</p>}
      </div>
    )
  }

  if (!signedIn) {
    return (
      <div>
        <SignInButton mode="modal" forceRedirectUrl={here} signUpForceRedirectUrl={here}>
          <Button className={BIG}>Sign in to join</Button>
        </SignInButton>
        <div className="mt-3 text-center text-[14px] text-slate-600">
          New to MediKarya?{" "}
          <SignUpButton mode="modal" forceRedirectUrl={here} signInForceRedirectUrl={here}>
            <button type="button" className="font-semibold text-brand-700 hover:underline">
              Create a free account
            </button>
          </SignUpButton>
        </div>
        <p className="mt-4 text-center text-[13px] leading-relaxed text-slate-500">Any account works, including Google. You come straight back here.</p>
      </div>
    )
  }

  const join = () =>
    start(async () => {
      setError(null)
      const r = await joinWorkshopAction(code)
      if (r.ok) setJoined(true)
      else setError(r.error)
    })

  return (
    <div>
      <Button className={BIG} disabled={pending} onClick={join}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Join and get {plan}
      </Button>
      {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-[14px] text-red-900">{error}</p>}
      <p className="mt-3 text-center text-[13px] text-slate-500">
        {email ? `Joining as ${email}. ` : ""}
        <button type="button" className="font-medium text-slate-700 underline-offset-2 hover:underline" onClick={() => void signOut({ redirectUrl: here })}>
          Use a different account
        </button>
      </p>
    </div>
  )
}
