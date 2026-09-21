import { notFound } from "next/navigation"
import PortraitGallery from "./client"

// Dev-only: every portrait variant on one page, for checking the illustration.
// 404 in production builds. Delete the app/sim-preview folder when it is no longer wanted.
export default function PortraitGalleryPage() {
  if (process.env.NODE_ENV === "production") notFound()
  return <PortraitGallery />
}
