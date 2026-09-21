"use client"

// The last resort: what shows if the root layout itself fails. It replaces the whole document, so it carries its
// own <html> and <body> and plain inline styles (the site's stylesheet may be what failed).

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f8fafc", color: "#0f172a" }}>
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 16px", textAlign: "center" }}>
          <h1 style={{ fontSize: 28, margin: "0 0 12px" }}>Something went wrong</h1>
          <p style={{ maxWidth: 420, margin: "0 0 24px", color: "#475569", lineHeight: 1.5 }}>
            MediKarya could not load. Please try again, and if it keeps happening write to support@medikarya.in.
          </p>
          <button
            onClick={reset}
            style={{ padding: "10px 20px", borderRadius: 8, border: 0, background: "#1d4ed8", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer" }}
          >
            Try again
          </button>
          {error.digest && <p style={{ marginTop: 24, fontFamily: "monospace", fontSize: 12, color: "#64748b" }}>Reference {error.digest}</p>}
        </div>
      </body>
    </html>
  )
}
