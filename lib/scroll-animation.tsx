"use client"

// A section eases in the first time it scrolls into view, and stays. It is visible by default (in the server's HTML,
// without JavaScript, when printed, in a link preview): only a section still below the screen once the page has
// loaded is hidden, and then eased in as it arrives. One already on screen is never hidden, so nothing flickers.

import { useEffect, useRef, useState } from "react"

export function useScrollAnimation(threshold = 0.15) {
  const [isVisible, setIsVisible] = useState(true)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // A visitor with reduced-motion set sees content immediately, not a fade they didn't ask for.
    if (typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches) return
    if (typeof IntersectionObserver === "undefined" || el.getBoundingClientRect().top < window.innerHeight) return
    setIsVisible(false)
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect() // once: it does not fade out again on the way past
        }
      },
      { threshold, rootMargin: "0px 0px -80px 0px" }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold])

  return { ref, isVisible }
}
