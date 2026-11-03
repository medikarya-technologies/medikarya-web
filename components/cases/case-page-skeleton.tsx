const block = "animate-pulse rounded bg-enc-console"

/** The case briefing and attempt history while the selected case is loading. */
export function CasePageSkeleton() {
  return (
    <main className="min-h-screen bg-enc-desk pb-20" aria-busy="true" aria-label="Loading case">
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <div className={`${block} mb-6 h-9 w-32 rounded-lg`} />
        <div className="mx-auto max-w-3xl space-y-6">
          <section className="overflow-hidden rounded-2xl border border-enc-line bg-enc-sheet">
            <div className="border-b border-enc-line p-6 sm:p-8">
              <div className={`${block} h-3 w-28`} />
              <div className={`${block} mt-3 h-7 w-2/3 max-w-md`} />
              <div className={`${block} mt-3 h-4 w-full max-w-xl`} />
            </div>
            <div className="grid gap-6 p-6 sm:grid-cols-[128px_minmax(0,1fr)] sm:p-8">
              <div className={`${block} mx-auto h-28 w-28 rounded-full sm:mx-0`} />
              <div className="space-y-3">
                <div className={`${block} h-4 w-2/5`} />
                <div className={`${block} h-4 w-4/5`} />
                <div className={`${block} h-4 w-3/5`} />
                <div className={`${block} mt-6 h-11 w-36 rounded-lg`} />
              </div>
            </div>
          </section>
          <section className="overflow-hidden rounded-xl border border-enc-line bg-enc-sheet" aria-hidden="true">
            <div className="border-b border-enc-line p-5">
              <div className={`${block} h-5 w-40`} />
            </div>
            {[0, 1].map((item) => (
              <div key={item} className="flex items-center gap-4 border-b border-enc-line px-5 py-4 last:border-0">
                <div className={`${block} h-9 w-9 rounded-full`} />
                <div className="flex-1 space-y-2">
                  <div className={`${block} h-3.5 w-2/5`} />
                  <div className={`${block} h-3 w-1/4`} />
                </div>
              </div>
            ))}
          </section>
        </div>
      </div>
    </main>
  )
}
