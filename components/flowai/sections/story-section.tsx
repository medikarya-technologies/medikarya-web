"use client"

// Third build of this section. First was a connected vertical timeline (4 steps). Second was 3 lines of
// asymmetric type with nothing beside them, then a decorative dotted illustration added to fill the resulting
// empty side — which rendered wrong (oversized, scattered dots, not the intended fine outline) and, separately,
// was never actually what closed the gap: the user's own reference screenshot of rounds' site showed a SMALL
// REAL PRODUCT CARD beside short copy, not an abstract illustration. This is that pattern instead: two numbered
// "moments" (rounds' own 01/02/03/04 device, kept, since it's a plain structural convention, not a
// copyrightable asset), each real short copy beside one real UI fragment, sides alternating between the two.
// Absorbs what-it-is-section.tsx (deleted) — one section, less total content, not two half-empty ones.
//
// Moment now lives in components/flowai/moment.tsx — debrief-section.tsx picks the sequence back up as 03/04
// after deterioration-section.tsx's dramatic interruption, so both sections needed the identical component,
// not a lookalike copy.
//
// Fourth build, this round: the two hand-built mock cards (EncounterCard/InvestigationCard, byte-styled
// approximations of the real UI) replaced with the real thing — actual screenshots the user captured from a
// live playthrough (public/screens/encounter-mother-rohan.png, investigations-tabs.png), cropped/sized this
// same session. No case-name claim is made linking these specifically to the free case's own shorter paraphrase
// used in hero.tsx — both are real pediatric-GI encounters and the exact case identity was never confirmed, so
// the copy stays general ("the patient," not a specific claimed case) rather than asserting a link that isn't
// verified.
//
// Colours: brand blue for 01's numbering/accents, the logo's real green for 02's (continuing into 03 blue / 04
// green in debrief-section.tsx) — enc-ink/-2/-3 for all text, the same tokens the dashboard itself uses, nothing
// invented for this page specifically.

import { useScrollAnimation } from "@/lib/scroll-animation"
import { Moment } from "@/components/flowai/moment"
import { Screenshot } from "@/components/flowai/screenshot"

export default function StorySection() {
  const { ref, isVisible } = useScrollAnimation(0.15)

  return (
    <section id="story" className="bg-brand-50 py-24 sm:py-32" ref={ref}>
      <div className="mx-auto max-w-5xl space-y-20 px-4 sm:space-y-28">
        <Moment n="01" label="History" title="You don't get the diagnosis." text="You ask. The patient answers in their own words — and the story shifts with every question." reverse={false} visible={isVisible} delay={0} accentClassName="text-brand-600">
          <Screenshot src="/screens/encounter-mother-rohan.png" alt="Real encounter chat: a worried mother describing her son's three days of vomiting to the student doctor" />
        </Moment>

        <Moment
          n="02"
          label="Investigate"
          title="Nothing is flagged for you."
          text="Order what you need. Results return on their own clock, and you're the one who has to read them."
          reverse
          visible={isVisible}
          delay={120}
          accentClassName="text-[#4b8f74]"
        >
          <Screenshot src="/screens/investigations-tabs.png" alt="Real investigations screen: category tabs and two test rows, one ordered, one still pending" />
        </Moment>
      </div>
    </section>
  )
}
