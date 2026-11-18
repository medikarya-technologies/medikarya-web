export type PathwayAnswer = {
  id: string
  text: string
  points: number
  nextNodeId: string | null
}

export type PathwayNode = {
  id: string
  prompt: string
  answers: PathwayAnswer[]
}

export type EventPathway = {
  id: string
  title: string
  position: number
  startNodeId: string
  nodes: PathwayNode[]
  published: boolean
}

export type PathwayStep = {
  pathwayId: string
  nodeId: string
  answerId: string
  points: number
  at: string
}

export type RoundOneState = {
  currentPathwayId: string | null
  currentNodeId: string | null
  completedPathwayIds: string[]
  steps: PathwayStep[]
}

export const emptyRoundOneState = (): RoundOneState => ({ currentPathwayId: null, currentNodeId: null, completedPathwayIds: [], steps: [] })

const clean = (value: unknown) => typeof value === "string" ? value.trim() : ""
const int = (value: unknown) => typeof value === "number" && Number.isFinite(value) && Number.isInteger(value)

/**
 * Rejects broken pathways before an organiser can publish them to a room. An answer may lead back to an earlier
 * decision (a loop), as long as every decision a student can reach still has some way to finish the pathway, so
 * nobody can be sent round for ever. Decisions are named as the editor numbers them ("Decision 3").
 */
export function pathwayProblem(pathway: Pick<EventPathway, "title" | "startNodeId" | "nodes">): string | null {
  if (!clean(pathway.title)) return "Give the pathway a title."
  if (!Array.isArray(pathway.nodes) || pathway.nodes.length === 0) return "Add at least one decision."
  const ids = new Set<string>()
  const name = new Map<string, string>()
  for (const [index, node] of pathway.nodes.entries()) {
    const label = `Decision ${index + 1}`
    if (!clean(node.id) || ids.has(node.id)) return "Every decision needs a unique id. Refresh the page and try again."
    ids.add(node.id)
    name.set(node.id, label)
    if (!clean(node.prompt)) return `Write the question for ${label}.`
    if (!Array.isArray(node.answers) || node.answers.length < 2) return `${label} needs at least two answers.`
    const answerIds = new Set<string>()
    for (const answer of node.answers) {
      if (!clean(answer.id) || answerIds.has(answer.id)) return `Every answer in ${label} needs a unique id. Refresh the page and try again.`
      answerIds.add(answer.id)
      if (!clean(answer.text)) return `Write every answer in ${label}.`
      if (!int(answer.points)) return `Every answer in ${label} needs a whole-number point value.`
    }
  }
  if (!ids.has(pathway.startNodeId)) return "Choose which decision the pathway starts at."
  for (const node of pathway.nodes) for (const answer of node.answers) {
    if (answer.nextNodeId !== null && !ids.has(answer.nextNodeId)) return `${name.get(node.id)} points to a decision that no longer exists.`
  }
  // Every decision a student can reach must be able to reach a "Finish pathway" answer.
  const finishes = new Set(pathway.nodes.filter((node) => node.answers.some((answer) => answer.nextNodeId === null)).map((node) => node.id))
  let grew = true
  while (grew) {
    grew = false
    for (const node of pathway.nodes) {
      if (!finishes.has(node.id) && node.answers.some((answer) => answer.nextNodeId !== null && finishes.has(answer.nextNodeId))) {
        finishes.add(node.id)
        grew = true
      }
    }
  }
  for (const id of reachableFrom(pathway)) {
    if (!finishes.has(id)) return `From ${name.get(id)}, every answer keeps going round without ever finishing. Give one answer a way to "Finish pathway", or to a decision that does.`
  }
  return null
}

function reachableFrom(pathway: Pick<EventPathway, "startNodeId" | "nodes">): Set<string> {
  const byId = new Map(pathway.nodes.map((node) => [node.id, node]))
  const seen = new Set<string>()
  const queue = [pathway.startNodeId]
  while (queue.length) {
    const id = queue.pop()!
    if (seen.has(id) || !byId.has(id)) continue
    seen.add(id)
    for (const answer of byId.get(id)!.answers) if (answer.nextNodeId) queue.push(answer.nextNodeId)
  }
  return seen
}

/** True when some answer leads, directly or not, back to a decision the student has already passed. */
export function pathwayHasLoop(pathway: Pick<EventPathway, "startNodeId" | "nodes">): boolean {
  const byId = new Map(pathway.nodes.map((node) => [node.id, node]))
  const state = new Map<string, "open" | "done">()
  const visit = (id: string): boolean => {
    if (state.get(id) === "open") return true
    if (state.get(id) === "done" || !byId.has(id)) return false
    state.set(id, "open")
    const loops = byId.get(id)!.answers.some((answer) => answer.nextNodeId !== null && visit(answer.nextNodeId))
    state.set(id, "done")
    return loops
  }
  return visit(pathway.startNodeId)
}

/**
 * The points a student scores for an answer: only their FIRST answer at each decision counts. When a loop brings
 * them back to a decision they have already answered, they answer again to move on, but it scores nothing, so going
 * round a loop can never add (or take away) points.
 */
export function pointsForAnswer(steps: readonly PathwayStep[], pathwayId: string, nodeId: string, answerPoints: number): number {
  return steps.some((step) => step.pathwayId === pathwayId && step.nodeId === nodeId) ? 0 : answerPoints
}

/** States explored before the loop search gives up and uses a safe upper bound instead. */
const LOOP_SEARCH_LIMIT = 200_000

/**
 * The most points one pathway can give: the best route from the start to a finish, scoring each decision once
 * (pointsForAnswer). Without loops that is the best branch at every step. With loops, a route may pass through an
 * answered decision again (scoring nothing there) to reach new ones, so the search remembers which decisions are
 * already answered.
 */
export function pathwayMaximum(pathway: Pick<EventPathway, "startNodeId" | "nodes">): number {
  const byId = new Map(pathway.nodes.map((node) => [node.id, node]))
  if (!byId.has(pathway.startNodeId)) return 0

  if (!pathwayHasLoop(pathway)) {
    const memo = new Map<string, number>()
    const bestFrom = (nodeId: string): number => {
      const known = memo.get(nodeId)
      if (known !== undefined) return known
      const node = byId.get(nodeId)
      const best = node ? Math.max(...node.answers.map((answer) => answer.points + (answer.nextNodeId ? bestFrom(answer.nextNodeId) : 0))) : 0
      memo.set(nodeId, best)
      return best
    }
    return Math.max(0, bestFrom(pathway.startNodeId))
  }

  const index = new Map(pathway.nodes.map((node, i) => [node.id, BigInt(1) << BigInt(i)]))
  const memo = new Map<string, number>()
  let explored = 0
  // best(id, answered): the student is about to answer `id` for the first time; `answered` holds the ones done before.
  const best = (id: string, answered: bigint): number => {
    const key = `${id}|${answered}`
    const known = memo.get(key)
    if (known !== undefined) return known
    if (++explored > LOOP_SEARCH_LIMIT) throw new Error("search limit")
    const now = answered | index.get(id)!
    const result = Math.max(...byId.get(id)!.answers.map((answer) => answer.points + onward(answer.nextNodeId, now)))
    memo.set(key, result)
    return result
  }
  // From `start`, walking only through decisions already answered (they score nothing), the best way out: a finish
  // (0) or the first new decision reached.
  const onward = (start: string | null, answered: bigint): number => {
    if (start === null) return 0
    if (!(answered & index.get(start)!)) return best(start, answered)
    let result = Number.NEGATIVE_INFINITY
    const seen = new Set<string>()
    const queue = [start]
    while (queue.length) {
      const id = queue.pop()!
      if (seen.has(id)) continue
      seen.add(id)
      for (const answer of byId.get(id)!.answers) {
        if (answer.nextNodeId === null) result = Math.max(result, 0)
        else if (answered & index.get(answer.nextNodeId)!) queue.push(answer.nextNodeId)
        else result = Math.max(result, best(answer.nextNodeId, answered))
      }
    }
    return result
  }
  try {
    return Math.max(0, best(pathway.startNodeId, BigInt(0)))
  } catch {
    // Too many routes to try them all: every decision's best answer, once each. Never below what a student can reach.
    return Math.max(0, [...reachableFrom(pathway)].reduce((sum, id) => sum + Math.max(0, ...byId.get(id)!.answers.map((answer) => answer.points)), 0))
  }
}

export function roundOneMaximum(pathways: readonly Pick<EventPathway, "startNodeId" | "nodes">[]): number {
  return pathways.reduce((total, pathway) => total + pathwayMaximum(pathway), 0)
}

export function stateFrom(value: unknown): RoundOneState {
  if (!value || typeof value !== "object") return emptyRoundOneState()
  const row = value as Partial<RoundOneState>
  return {
    currentPathwayId: typeof row.currentPathwayId === "string" ? row.currentPathwayId : null,
    currentNodeId: typeof row.currentNodeId === "string" ? row.currentNodeId : null,
    completedPathwayIds: Array.isArray(row.completedPathwayIds) ? row.completedPathwayIds.filter((id): id is string => typeof id === "string") : [],
    steps: Array.isArray(row.steps) ? row.steps.filter((step): step is PathwayStep => !!step && typeof step === "object" && typeof (step as PathwayStep).pathwayId === "string" && typeof (step as PathwayStep).nodeId === "string" && typeof (step as PathwayStep).answerId === "string" && int((step as PathwayStep).points)) : [],
  }
}

export function currentPathwayState(pathways: readonly EventPathway[], persisted: RoundOneState): RoundOneState {
  const open = pathways.find((pathway) => !persisted.completedPathwayIds.includes(pathway.id))
  if (!open) return { ...persisted, currentPathwayId: null, currentNodeId: null }
  if (persisted.currentPathwayId === open.id && persisted.currentNodeId && open.nodes.some((node) => node.id === persisted.currentNodeId)) return persisted
  return { ...persisted, currentPathwayId: open.id, currentNodeId: open.startNodeId }
}
