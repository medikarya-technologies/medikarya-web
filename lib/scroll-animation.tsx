"use client"

// A section eases in the first time it scrolls into view, and stays. (This used to fake it: `isVisible` started
// true and a timeout flipped it to... true, so nothing was ever actually watched. IntersectionObserver here does
// what the name says.)

import { useEffect, useRef, useState } from "react"

export function useScrollAnimation(threshold = 0.15) {
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // A visitor with reduced-motion set sees content immediately, not a fade they didn't ask for.
    if (typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setIsVisible(true)
      return
    }
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
