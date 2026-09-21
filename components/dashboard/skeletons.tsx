// What a dashboard page looks like while its data is on the way: the same shapes in the same places, so the
// page does not jump when the numbers arrive. The frame (rail, top bar) is already on screen; only the page's
// own content waits. No state, no client code: these are just markup.

import { PageContainer } from "./dashboard-ui"

const block = "animate-pulse rounded bg-enc-console"

function Heading({ wide = false }: { wide?: boolean }) {
  return (
    <div className="space-y-3">
      <div className={`${block} h-3 w-28`} />
      <div className={`${block} h-8 ${wide ? "w-72" : "w-56"}`} />
      <div className={`${block} h-4 w-80 max-w-full`} />
    </div>
  )
}

function Row() {
  return (
    <div className="flex gap-4 border-b border-enc-line px-5 py-4 last:border-b-0">
      <div className="h-14 w-14 shrink-0 animate-pulse rounded-full bg-enc-console" />
      <div className="flex-1 space-y-2.5 pt-1">
        <div className={`${block} h-4 w-3/5`} />
        <div className={`${block} h-3 w-2/5`} />
        <div className={`${block} h-3 w-4/5`} />
      </div>
    </div>
  )
}

/** The training section's place: four cards (the first green, as it will be) and the ledger, as blocks from the first frame. */
function Panel() {
  return (
    <div className="@container space-y-3">
      <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-4">
        <div className="h-[188px] animate-pulse rounded-xl bg-enc-grow" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[188px] animate-pulse rounded-xl border border-enc-line bg-enc-sheet" />
        ))}
      </div>
      <div className="h-[228px] animate-pulse rounded-xl border border-enc-line bg-enc-sheet" />
    </div>
  )
}

export function LibrarySkeleton() {
  return (
    <PageContainer aria-busy>
      <Heading />
      <div className="mt-7 h-11 animate-pulse rounded-lg border border-enc-line-strong bg-enc-sheet" />
      <div className="mt-8 grid gap-7 xl:grid-cols-[204px_minmax(0,1fr)]">
        <div className="hidden space-y-2 xl:block">
          {Array.from({ length: 9 }, (_, i) => (
            <div key={i} className={`${block} h-8 w-full`} />
          ))}
        </div>
        <div className="@container">
          <div className="grid gap-4 @2xl:grid-cols-2 @5xl:grid-cols-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex h-[380px] flex-col items-center rounded-xl border border-enc-line bg-enc-sheet p-5">
                <div className="h-20 w-20 animate-pulse rounded-full bg-enc-console" />
                <div className={`${block} mt-4 h-4 w-4/5`} />
                <div className={`${block} mt-2 h-4 w-3/5`} />
                <div className={`${block} mt-3 h-3 w-2/5`} />
                <div className={`${block} mt-5 h-3 w-full`} />
                <div className={`${block} mt-2 h-3 w-11/12`} />
                <div className={`${block} mt-2 h-3 w-3/4`} />
                <div className="mt-auto flex w-full items-center justify-between border-t border-enc-line pt-4">
                  <div className={`${block} h-8 w-24`} />
                  <div className={`${block} h-9 w-28`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageContainer>
  )
}

export function HomeSkeleton() {
  return (
    <PageContainer aria-busy>
      <Heading wide />
      <div className="mt-8">
        <Panel />
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="overflow-hidden rounded-xl border border-enc-line bg-enc-sheet">
          {[0, 1, 2].map((i) => (
            <Row key={i} />
          ))}
        </div>
        <div className="h-56 animate-pulse rounded-xl border border-enc-line bg-enc-sheet" />
      </div>
    </PageContainer>
  )
}

export function ProfileSkeleton() {
  return (
    <PageContainer aria-busy>
      <Heading />
      <div className="mt-8 space-y-6">
        <div className="h-[300px] animate-pulse rounded-xl border border-enc-line bg-enc-sheet sm:h-[200px]" />
        <div className="grid gap-6 md:grid-cols-2">
          <div className="h-[189px] animate-pulse rounded-xl border border-enc-line bg-enc-sheet" />
          <div className="h-[189px] animate-pulse rounded-xl border border-enc-line bg-enc-sheet" />
        </div>
      </div>
    </PageContainer>
  )
}

/** The Progress page's place: the heading, the tab bar, and the Overview tab (the one it opens on) as blocks. */
export function ProgressSkeleton() {
  return (
    <PageContainer aria-busy>
      <Heading />
      <div className="mt-7 flex gap-1 border-b border-enc-line-strong">
        {[64, 44, 56].map((w, i) => (
          <div key={i} className="flex h-11 items-center px-3.5">
            <div className={`${block} h-3.5`} style={{ width: w }} />
          </div>
        ))}
      </div>
      <div className="mt-6">
        <Panel />
      </div>
    </PageContainer>
  )
}
