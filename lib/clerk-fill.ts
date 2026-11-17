// Clerk's sign-in and sign-up boxes pick their own width (up to 25rem) and draw their own card, logo and shadow.
// Inside our card on a phone that box came out wider than the room left for it, so our card's overflow-hidden cut
// its right edge off (screens 393-639px wide), and it showed a second card and a second logo inside ours.
// These make Clerk fill whatever width our card gives it and drop the frame and logo that ours already provides.
// They are style objects, not Tailwind classes, because Clerk's own styles win over class names here.
// Clerk draws the border of its inputs and buttons as a shadow just outside them, and its cardBox clips what lies
// outside. With the side padding gone those borders sat on the clip line and their left and right edges were cut,
// so the cardBox lets them show (our own card still has room around it).
export const clerkFillElements = {
  rootBox: { width: "100%" },
  cardBox: { width: "100%", maxWidth: "none", boxShadow: "none", border: "none", borderRadius: 0, background: "transparent", overflow: "visible" },
  card: { width: "100%", boxShadow: "none", border: "none", background: "transparent", paddingLeft: 0, paddingRight: 0 },
  // Our page already shows the logo and heading; Clerk's header (logo, title, subtitle) would only leave a blank gap.
  header: { display: "none" },
  footer: { background: "transparent" },
  // Clerk pads "Already have an account? Sign in" by 32px a side; on a 320px phone that left 190px and the line broke
  // into two cramped columns. Full width, centred, and wrapping as a whole line if it ever has to.
  footerAction: { paddingLeft: 0, paddingRight: 0, flexWrap: "wrap", justifyContent: "center", columnGap: "0.25rem" },
}
