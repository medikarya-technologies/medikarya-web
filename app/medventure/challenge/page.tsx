import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { ChallengePlayer } from "./challenge-player"
import { currentPathwayState } from "@/lib/events/pathways"
import { medventureParticipant, medventurePathways, medventureRoom } from "@/lib/events/medventure"
import { roundOneAttemptInRoom } from "@/lib/events/medventure-attempts"

export const dynamic = "force-dynamic"
export const metadata = { title: "MedVenture × MediKarya challenge" }

export default async function MedventureChallengePage() {
  const { userId } = await auth()
  if (!userId) redirect("/medventure/join")
  const [participant, roomData, pathwaysData] = await Promise.all([medventureParticipant(userId), medventureRoom(), medventurePathways({ publishedOnly: true })])
  if (!participant) redirect("/medventure/join")
  if (!roomData.available || !roomData.room || roomData.room.status !== "live") return <main className="grid min-h-screen place-items-center bg-[#f7faf8] p-5 text-center"><div><h1 className="text-2xl font-semibold text-[#173c2d]">The challenge room is not open.</h1><p className="mt-2 text-sm text-[#5a6c61]">Your organisers will open it at the venue.</p></div></main>
  // Made (or replaced, if it is from the preflight) as the first question appears, so Round 1 time counts from here
  const attempt = await roundOneAttemptInRoom(participant.userId, participant.email, roomData.room.startedAt)
  const state = currentPathwayState(pathwaysData.pathways, attempt.state)
  return <ChallengePlayer pathways={pathwaysData.pathways} initialState={state} initialScore={attempt.score} roundOneComplete={!!attempt.completedAt} roundTwoCaseId={roomData.room.roundTwoCaseId} />
}
