import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { ChallengePlayer } from "./challenge-player"
import { currentPathwayState, stateFrom } from "@/lib/events/pathways"
import { medventureParticipant, medventurePathways, medventureRoom, medventureRoundOneAttempt } from "@/lib/events/medventure"

export const dynamic = "force-dynamic"
export const metadata = { title: "Medventure challenge" }

export default async function MedventureChallengePage() {
  const { userId } = await auth()
  if (!userId) redirect("/medventure/join")
  const [participant, roomData, pathwaysData] = await Promise.all([medventureParticipant(userId), medventureRoom(), medventurePathways({ publishedOnly: true })])
  if (!participant) redirect("/medventure/join")
  if (!roomData.available || !roomData.room || roomData.room.status !== "live") return <main className="grid min-h-screen place-items-center bg-[#f7faf8] p-5 text-center"><div><h1 className="text-2xl font-semibold text-[#173c2d]">The challenge room is not open.</h1><p className="mt-2 text-sm text-[#5a6c61]">Your organisers will open it at the venue.</p></div></main>
  const attemptData = await medventureRoundOneAttempt(participant.userId)
  const rawState = stateFrom(attemptData.attempt?.state)
  const state = currentPathwayState(pathwaysData.pathways, rawState)
  return <ChallengePlayer pathways={pathwaysData.pathways} initialState={state} initialScore={attemptData.attempt?.score ?? 0} roundOneComplete={!!attemptData.attempt?.completedAt} roundTwoCaseId={roomData.room.roundTwoCaseId} />
}
