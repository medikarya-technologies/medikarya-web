import test from "node:test"
import assert from "node:assert/strict"
import { currentPathwayState, pathwayMaximum, pathwayProblem, roundOneMaximum, type EventPathway } from "../pathways"
import { roundOnePoints } from "../medventure-scoring"

const first: EventPathway = {
  id: "first", title: "A pathway", position: 1, startNodeId: "one", published: true,
  nodes: [
    { id: "one", prompt: "First?", answers: [{ id: "good", text: "Good", points: 2, nextNodeId: "two" }, { id: "bad", text: "Bad", points: -1, nextNodeId: null }] },
    { id: "two", prompt: "Second?", answers: [{ id: "best", text: "Best", points: 3, nextNodeId: null }, { id: "okay", text: "Okay", points: 1, nextNodeId: null }] },
  ],
}

test("a Medventure pathway cannot publish with a loop or a missing target", () => {
  assert.equal(pathwayProblem(first), null)
  const missing = { ...first, nodes: [{ ...first.nodes[0], answers: [{ ...first.nodes[0].answers[0], nextNodeId: "gone" }, first.nodes[0].answers[1]] }, first.nodes[1]] }
  const loop = { ...first, nodes: [{ ...first.nodes[0], answers: [{ ...first.nodes[0].answers[0], nextNodeId: "one" }, first.nodes[0].answers[1]] }, first.nodes[1]] }
  assert.match(pathwayProblem(missing) ?? "", /does not exist/)
  assert.match(pathwayProblem(loop) ?? "", /cannot loop/)
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
