"use client"

// Debrief section — picks the numbered "moment" sequence story-section.tsx started (01 History, 02 Investigate)
// back up as 03/04, after deterioration-section.tsx's dark, un-numbered interruption. The numbering is
// deliberately NOT continuous end-to-end through Deterioration — Deterioration is the dramatic break in the
// otherwise-structured walkthrough, and 03/04 resuming afterwards ("the learning doesn't stop when the case
// does") mirrors that on purpose. Story and Debrief already shared the same brand-50 background before this
// change; only the heading/layout device needed to match for the two to read as one continuous system with
// Deterioration sitting between them as the interruption, not a plain content divider.
//
// Moment now lives in components/flowai/moment.tsx (shared with story-section.tsx). Colour sequence continues
// 01 blue / 02 green / 03 blue / 04 green.
//
// Rebuilt this round: the hand-built DebriefPanel/ReinforcementCard mock cards (illustrative EXAMPLE numbers,
// explicitly labelled as such) are gone, replaced with two real screenshots the user captured from an actual
// case attempt (public/screens/debrief-performance-real.png, reinforcement-quiz-real.png) — "make these cards
// more realistic" turned out to have a better answer than tuning the mock further: stop mocking it.
//
// This changed the honest copy, not just the visual: the real result is a genuinely low score (5/100, mostly
// zeros), not the "strong except management" story the old illustrative numbers told. The 03 subtext no longer
// claims strength anywhere, since this real result doesn't have any to show — the section's point shifted from
// "see your strengths and weaknesses" to "see an unsoftened score, however the case actually went," which is
// both more honest and a better fit for what's now shown.
// The two images are genuinely connected, not just adjacent: the real debrief shows "Investigation accuracy: 0
// hit / 1 miss," and the real reinforcement question is specifically about the stool-routine test that miss
// refers to (its own explanation text says so) — so 04's copy ("pulled from exactly what you missed") was
// already accurate and needed no rewrite once the real images made it literally true instead of illustrative.
// Changed in round 4 of the design review (2026-10-31): the 5/100 image was swapped for the best real attempt on the
// same case (77/100, from the MAMC pilot in May 2026, rendered in the current debrief component from its saved
// result), because a near-zero score undersold what the debrief shows. Choosing the best attempt is a choice, so the
// caption now says what it is ("a real attempt from the pilot") instead of "not curated"; and as that attempt is not
// the one whose missed stool test produced the 04 question, 04's caption no longer says "that exact miss".
// Captions under each image are the "anchor" this section was missing — a plain, honest line that pins each
// screenshot to being a real, specific moment rather than a floating example, the same fix that already worked
// for reviews-section.tsx's real submission timestamps this session. No date is claimed for either capture (no
// evidence of one, unlike the pilot survey's own real timestamps) — anchored by being explicitly real instead.

import { useScrollAnimation } from "@/lib/scroll-animation"
import { Moment } from "@/components/flowai/moment"
import { Screenshot } from "@/components/flowai/screenshot"

export default function DebriefSection() {
  const { ref, isVisible } = useScrollAnimation(0.15)

  return (
    <section className="bg-brand-50 py-20 sm:py-24" ref={ref}>
      <div className="mx-auto max-w-6xl space-y-16 px-4 sm:space-y-20">
        <Moment
          n="03"
          label="Debrief"
          title="When the case ends, the learning doesn't."
          text="You see exactly where the case caught you out. Every time, not just when it's flattering."
          reverse={false}
          visible={isVisible}
          delay={0}
          accentClassName="text-brand-600"
        >
          <Screenshot src="/screens/debrief-performance-pilot.png" alt="Performance summary of a real attempt from the MAMC pilot: 77 out of 100, scored across five clinical skill areas" caption="A real attempt from the MAMC pilot, May 2026, as it was scored." />
        </Moment>

        <Moment
          n="04"
          label="Reinforce"
          title="Your mistakes become the next things you practise."
          text="One real question, pulled from exactly what you missed."
          reverse
          visible={isVisible}
          delay={120}
          accentClassName="text-[#4b8f74]"
        >
          <Screenshot src="/screens/reinforcement-quiz-real.png" alt="Real reinforcement question generated from a missed investigation, with the answer revealed and explained" caption="A real question from the same case, drawn from what an attempt missed." />
        </Moment>
      </div>
    </section>
  )
}
