// =========================
// lib/simulation/image-credits.ts
// =========================
// The credit line shown under an investigation image whose licence asks for one. CC BY and CC BY-SA images must
// be credited wherever they are shown; CC0 and public-domain images need nothing, so they are not listed. Keep this
// in step with public/investigation-images/CREDITS.md when an image is added.

const CREDITS: Readonly<Record<string, string>> = {
  "/investigation-images/mri-brain-normal.jpg": "Image: Novaksean, CC BY-SA 4.0, via Wikimedia Commons",
  "/investigation-images/cxr-right-pneumothorax.png": "Image: Hellerhoff, CC BY-SA 3.0, via Wikimedia Commons",
  "/investigation-images/xray-abdomen-normal.jpg":
    "Image: Alotaibi AA, Alghamdi MA, Wazzan QR, Alzahrani AA, Banjar AT. Cureus 2026. doi:10.7759/cureus.106530. CC BY 4.0",
};

/** The credit to show under this image, or null when its licence needs none. */
export function imageCredit(url: string | null | undefined): string | null {
  if (!url) return null;
  // the same file can be referenced with a query string or as an absolute URL on our own domain
  const path = url.replace(/^https?:\/\/[^/]+/, "").split(/[?#]/)[0];
  return CREDITS[path] ?? null;
}
