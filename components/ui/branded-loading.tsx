// The app's own loading screen — small and quiet on purpose: a thin pulse-line, not a device on the
// page. The animation loop itself lives in app/globals.css (.enc-pulse-sweep) alongside the app's other
// small looping animations (enc-live, enc-breathe).

interface BrandedLoadingProps {
  label?: string
}

const UNIT = "M0,12 L14,12 L18,5 L22,19 L26,12 L60,12"

export function BrandedLoading({ label = "Loading…" }: BrandedLoadingProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2.5 bg-enc-desk">
      <svg width="120" height="24" viewBox="0 0 120 24" className="text-enc-ink-3">
        <g className="enc-pulse-sweep">
          <path d={UNIT} fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          <path d={UNIT} transform="translate(60 0)" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          <path d={UNIT} transform="translate(120 0)" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </svg>
      <p className="text-[12.5px] text-enc-ink-3">{label}</p>
    </div>
  )
}
