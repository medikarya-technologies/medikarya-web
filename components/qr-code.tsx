import QRCode from "qrcode"

// A QR code drawn as plain SVG on the server (no image file, no script in the browser), so it stays sharp at any size,
// from a phone screen to a projector. The same approach as the Case Studio's certificates.

export function QrCode({ value, className, label }: { value: string; className?: string; label: string }) {
  // "M" recovers from about 15% damage: enough for a code photographed off a screen at an angle.
  const { modules } = QRCode.create(value, { errorCorrectionLevel: "M" })
  const size = modules.size
  const quiet = 2 // the blank margin scanners need around the code
  let path = ""
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (modules.get(x, y)) path += `M${x + quiet},${y + quiet}h1v1h-1z`
    }
  }
  const box = size + quiet * 2
  return (
    <svg viewBox={`0 0 ${box} ${box}`} className={className} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={box} height={box} fill="#ffffff" />
      <path d={path} fill="#0f172a" />
    </svg>
  )
}
