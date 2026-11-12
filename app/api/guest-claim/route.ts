import { NextResponse } from "next/server"
import { claimGuestAttempts } from "@/lib/library/guest-claim-server"

// Moves this browser's guest plays (the free case on /try) onto the signed-in account. The dashboard does this on its
// own, but a new account does not always land there: Google sign-in can send it to the home page, and a student may
// sign up on one page and come back days later on another. components/library/guest-play-claim.tsx calls this once
// per browser session from any page. Without the guest cookie it returns at once, without touching the database.
export async function POST() {
  const moved = await claimGuestAttempts()
  return NextResponse.json({ moved })
}
