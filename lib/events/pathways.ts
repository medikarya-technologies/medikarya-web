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

/** Rejects broken trees before an organiser can publish them to a room. */
export function pathwayProblem(pathway: Pick<EventPathway, "title" | "startNodeId" | "nodes">): string | null {
  if (!clean(pathway.title)) return "Give the pathway a title."
  if (!Array.isArray(pathway.nodes) || pathway.nodes.length === 0) return "Add at least one decision node."
  const ids = new Set<string>()
  for (const node of pathway.nodes) {
    if (!clean(node.id) || ids.has(node.id)) return "Every decision node needs a unique id."
    ids.add(node.id)
    if (!clean(node.prompt)) return `Write the question for node “${node.id}”.`
    if (!Array.isArray(node.answers) || node.answers.length < 2) return `Node “${node.id}” needs at least two answers.`
    const answerIds = new Set<string>()
    for (const answer of node.answers) {
      if (!clean(answer.id) || answerIds.has(answer.id)) return `Every answer in “${node.id}” needs a unique id.`
      answerIds.add(answer.id)
      if (!clean(answer.text)) return `Write every answer in “${node.id}”.`
      if (!int(answer.points)) return `Every answer in “${node.id}” needs a whole-number point value.`
    }
  }
  if (!ids.has(pathway.startNodeId)) return "Choose a valid starting node."
  for (const node of pathway.nodes) for (const answer of node.answers) {
    if (answer.nextNodeId !== null && !ids.has(answer.nextNodeId)) return `“${node.id}” points to a node that does not exist.`
  }
  const byId = new Map(pathway.nodes.map((node) => [node.id, node]))
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const walk = (nodeId: string): boolean => {
    if (visiting.has(nodeId)) return false
    if (visited.has(nodeId)) return true
    visiting.add(nodeId)
    const node = byId.get(nodeId)
    const valid = !!node && node.answers.every((answer) => answer.nextNodeId === null || walk(answer.nextNodeId))
    visiting.delete(nodeId)
    if (valid) visited.add(nodeId)
    return valid
  }
  if (!walk(pathway.startNodeId)) return "A pathway cannot loop back to an earlier node."
  return null
}

export function pathwayMaximum(pathway: Pick<EventPathway, "startNodeId" | "nodes">): number {
  const byId = new Map(pathway.nodes.map((node) => [node.id, node]))
  const bestFrom = (nodeId: string): number => {
    const node = byId.get(nodeId)
    if (!node) return 0
    return Math.max(...node.answers.map((answer) => answer.points + (answer.nextNodeId ? bestFrom(answer.nextNodeId) : 0)))
  }
  return Math.max(0, bestFrom(pathway.startNodeId))
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
