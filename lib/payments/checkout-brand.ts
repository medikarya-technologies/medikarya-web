// How MediKarya appears in Razorpay's checkout window: name, logo and colour, shared by every checkout (subscriptions
// and the one-time test payment). Razorpay's own dashboard branding (Account & Settings → Branding) covers its
// emails, receipts and hosted pages; keep the two the same.

export const CHECKOUT_NAME = "MediKarya"

/** The brand blue (--brand-600 in app/globals.css) as hex, which Razorpay needs. */
export const CHECKOUT_COLOR = "#0069bd"

/**
 * The logo (public/medikarya.png, 500×500). Razorpay fetches it from its own servers, which cannot reach localhost
 * or a preview deployment, so it is always the live site's copy.
 */
export function checkoutLogo(): string {
  return "https://www.medikarya.in/medikarya.png"
}
