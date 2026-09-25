"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Twitter, Linkedin, Instagram, Mail, Phone, MapPin, Youtube } from "lucide-react"

import { useScrollAnimation } from "@/lib/scroll-animation"
import { cn } from "@/lib/utils"

export function Footer() {
  const { ref, isVisible } = useScrollAnimation()

  return (
    <footer
      ref={ref}
      className={cn(
        "bg-enc-console border-t border-enc-line-strong transition-all duration-1000 ease-out",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      )}
    >
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {/* Company Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center">
                <img src="/medikarya.svg" alt="MediKarya Logo" className="h-full w-full object-contain" />
              </div>
              <span className="text-xl font-bold text-enc-ink">MediKarya</span>
            </div>
            <p className="text-sm text-enc-ink-2 max-w-xs">
              AI patient cases for MBBS students — ask questions, order tests, and see exactly where your reasoning held up.
            </p>
            <div className="flex space-x-4">
              <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-brand-50 hover:text-brand-400 transition-colors" asChild>
                <a href="https://x.com/Medikaryain" target="_blank" rel="noopener noreferrer" aria-label="Follow MediKarya on X (Twitter)">
                  <Twitter className="h-4 w-4" />
                </a>
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-brand-50 hover:text-brand-700 transition-colors" asChild>
                <a href="https://www.linkedin.com/company/medikarya" target="_blank" rel="noopener noreferrer" aria-label="Follow MediKarya on LinkedIn">
                  <Linkedin className="h-4 w-4" />
                </a>
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-pink-50 hover:text-pink-600 transition-colors" asChild>
                <a href="https://www.instagram.com/medikarya.in/" target="_blank" rel="noopener noreferrer" aria-label="Follow MediKarya on Instagram">
                  <Instagram className="h-4 w-4" />
                </a>
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-red-50 hover:text-red-600 transition-colors" asChild>
                <a href="https://www.youtube.com/channel/UCyH4fMcICK2ghsKZqM6wOBg" target="_blank" rel="noopener noreferrer" aria-label="Subscribe to MediKarya on YouTube">
                  <Youtube className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-enc-ink">Platform</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/about" className="text-enc-ink-2 hover:text-enc-ink transition-colors">
                  About
                </Link>
              </li>
              <li>
                <Link href="/features" className="text-enc-ink-2 hover:text-enc-ink transition-colors">
                  Features
                </Link>
              </li>
              <li>
                <Link href="/how-it-works" className="text-enc-ink-2 hover:text-enc-ink transition-colors">
                  How It Works
                </Link>
              </li>
              <li>
                <Link href="/#pricing" className="text-enc-ink-2 hover:text-enc-ink transition-colors">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/try" className="text-enc-ink-2 hover:text-enc-ink transition-colors">
                  Try a case, free
                </Link>
              </li>
              <li>
                <Link href="/contribute" className="text-enc-ink-2 hover:text-enc-ink transition-colors">
                  Become a Contributor
                </Link>
              </li>
              <li>
                <Link href="/early-contributors" className="text-enc-ink-2 hover:text-enc-ink transition-colors">
                  Early Contributors
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-enc-ink">Resources</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/blog" className="text-enc-ink-2 hover:text-enc-ink transition-colors">
                  Medical Blog
                </Link>
              </li>
              <li>
                <Link href="/case-studies" className="text-enc-ink-2 hover:text-enc-ink transition-colors">
                  Case Studies
                </Link>
              </li>
              <li>
                <Link href="/tutorials" className="text-enc-ink-2 hover:text-enc-ink transition-colors">
                  Tutorials
                </Link>
              </li>
              <li>
                <Link href="/api-docs" className="text-enc-ink-2 hover:text-enc-ink transition-colors">
                  API Documentation
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-enc-ink">Get in touch</h3>
            <div className="space-y-2">
              <a href="mailto:contact@medikarya.in" className="flex items-center gap-2 text-sm text-enc-ink-2 hover:text-enc-ink transition-colors">
                <Mail className="h-4 w-4" />
                <span>contact@medikarya.in</span>
              </a>
              <a href="tel:+918796502901" className="flex items-center gap-2 text-sm text-enc-ink-2 hover:text-enc-ink transition-colors">
                <Phone className="h-4 w-4" />
                <span>+91 8796502901</span>
              </a>
              <div className="flex items-center gap-2 text-sm text-enc-ink-2">
                <MapPin className="h-4 w-4" />
                <span>Delhi, NCR</span>
              </div>
            </div>
            <Link href="/contact" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-800 transition-colors">
              Send us a message →
            </Link>
          </div>
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-enc-ink-2">
            © {new Date().getFullYear()} MediKarya. All rights reserved.
          </div>
          <div className="flex gap-6 text-sm text-enc-ink-2">
            <Link href="/privacy" className="hover:text-enc-ink transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-enc-ink transition-colors">
              Terms of Service
            </Link>
            <Link href="/cookies" className="hover:text-enc-ink transition-colors">
              Cookie Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
