import test from "node:test"
import assert from "node:assert/strict"
import { currentPathwayState, pathwayHasLoop, pathwayMaximum, pathwayProblem, pointsForAnswer, roundOneMaximum, type EventPathway } from "../pathways"
import { roundOnePoints } from "../medventure-scoring"

const first: EventPathway = {
  id: "first", title: "A pathway", position: 1, startNodeId: "one", published: true,
  nodes: [
    { id: "one", prompt: "First?", answers: [{ id: "good", text: "Good", points: 2, nextNodeId: "two" }, { id: "bad", text: "Bad", points: -1, nextNodeId: null }] },
    { id: "two", prompt: "Second?", answers: [{ id: "best", text: "Best", points: 3, nextNodeId: null }, { id: "okay", text: "Okay", points: 1, nextNodeId: null }] },
  ],
}

test("a Medventure pathway cannot publish with a missing target, and names decisions as the editor does", () => {
  assert.equal(pathwayProblem(first), null)
  const missing = { ...first, nodes: [{ ...first.nodes[0], answers: [{ ...first.nodes[0].answers[0], nextNodeId: "gone" }, first.nodes[0].answers[1]] }, first.nodes[1]] }
  assert.equal(pathwayProblem(missing), "Decision 1 points to a decision that no longer exists.")
  const noQuestion = { ...first, nodes: [first.nodes[0], { ...first.nodes[1], prompt: " " }] }
  assert.equal(pathwayProblem(noQuestion), "Write the question for Decision 2.")
})

// Decision 1 → 2 → 3, and Decision 3 can send the student back to Decision 2 (a loop).
const looped: EventPathway = {
  id: "looped", title: "Back to an earlier decision", position: 1, startNodeId: "d1", published: true,
  nodes: [
    { id: "d1", prompt: "One?", answers: [{ id: "a", text: "A", points: 2, nextNodeId: "d2" }, { id: "b", text: "B", points: 0, nextNodeId: "d2" }] },
    { id: "d2", prompt: "Two?", answers: [{ id: "a", text: "A", points: 3, nextNodeId: "d3" }, { id: "b", text: "B", points: -1, nextNodeId: "d3" }] },
    { id: "d3", prompt: "Three?", answers: [{ id: "back", text: "Reassess", points: -2, nextNodeId: "d2" }, { id: "done", text: "Treat", points: 4, nextNodeId: null }] },
  ],
}

test("an answer may go back to an earlier decision when the loop has a way out", () => {
  assert.equal(pathwayProblem(looped), null)
  // Decision 3 can only go back to Decision 2, and Decision 2 only forward to 3: no way to finish (Decision 1 is the
  // first stuck decision a student meets, so it is the one named)
  const trapped = { ...looped, nodes: [looped.nodes[0], looped.nodes[1], { ...looped.nodes[2], answers: [looped.nodes[2].answers[0], { ...looped.nodes[2].answers[1], nextNodeId: "d2" }] }] }
  assert.match(pathwayProblem(trapped) ?? "", /^From Decision 1, every answer keeps going round/)
  // A loop that is only a detour is fine even when it is not the last step: 3 → back to 2 or finish
  const unreachableTrap = { ...looped, nodes: [...looped.nodes, { id: "d4", prompt: "Four?", answers: [{ id: "a", text: "A", points: 0, nextNodeId: "d4" }, { id: "b", text: "B", points: 0, nextNodeId: "d4" }] }] }
  assert.equal(pathwayProblem(unreachableTrap), null)
})

test("only the first answer at a decision scores, so a loop cannot farm points", () => {
  const steps = [{ pathwayId: "looped", nodeId: "d2", answerId: "a", points: 3, at: "" }]
  assert.equal(pointsForAnswer(steps, "looped", "d2", 3), 0)
  assert.equal(pointsForAnswer(steps, "looped", "d3", 4), 4)
  assert.equal(pointsForAnswer(steps, "other", "d2", 3), 3)
})

test("the maximum of a looped pathway counts each decision once", () => {
  assert.equal(pathwayHasLoop(looped), true)
  assert.equal(pathwayHasLoop(first), false)
  // 2 + 3 + 4: going back to Decision 2 can only cost (-2) and never re-earns its 3
  assert.equal(pathwayMaximum(looped), 9)
  // A loop that leads on to a decision only reachable the second time round: 1 → 2 (+5) → back to 1 → 3 (+5)
  const detour: EventPathway = {
    id: "detour", title: "Detour", position: 1, startNodeId: "d1", published: true,
    nodes: [
      { id: "d1", prompt: "1", answers: [{ id: "a", text: "a", points: 0, nextNodeId: "d2" }, { id: "b", text: "b", points: 0, nextNodeId: "d3" }] },
      { id: "d2", prompt: "2", answers: [{ id: "a", text: "a", points: 5, nextNodeId: "d1" }, { id: "b", text: "b", points: 0, nextNodeId: null }] },
      { id: "d3", prompt: "3", answers: [{ id: "a", text: "a", points: 5, nextNodeId: null }, { id: "b", text: "b", points: 0, nextNodeId: null }] },
    ],
  }
  assert.equal(pathwayProblem(detour), null)
  assert.equal(pathwayMaximum(detour), 10)
})

test("pathway maximum follows the best branch and normalises the custom round to ten", () => {
  assert.equal(pathwayMaximum(first), 5)
  assert.equal(roundOneMaximum([first]), 5)
  assert.equal(roundOnePoints(5, roundOneMaximum([first])), 10)
  assert.equal(roundOnePoints(2, roundOneMaximum([first])), 4)
})

test("the next incomplete pathway is selected and starts at its configured node", () => {
  const second = { ...first, id: "second", position: 2, startNodeId: "two" }
  const state = currentPathwayState([first, second], { currentPathwayId: null, currentNodeId: null, completedPathwayIds: ["first"], steps: [] })
  assert.equal(state.currentPathwayId, "second")
  assert.equal(state.currentNodeId, "two")
})
