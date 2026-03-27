"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Facebook, Twitter, Linkedin, Instagram, Mail, Phone, MapPin, Youtube } from "lucide-react"

import { useScrollAnimation } from "@/lib/scroll-animation"
import { cn } from "@/lib/utils"

export function Footer() {
  const { ref, isVisible } = useScrollAnimation()

  return (
    <footer
      ref={ref}
      className={cn(
        "bg-slate-50 border-t transition-all duration-1000 ease-out",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      )}
    >
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {/* Company Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center">
                <img src="https://www.medikarya.in/medikarya.svg" alt="MediKarya Logo" className="h-full w-full object-contain" />
              </div>
              <span className="text-xl font-bold text-slate-800">MediKarya</span>
            </div>
            <p className="text-sm text-muted-foreground max-w-xs">
              Empowering medical students with AI-powered patient simulation technology for better clinical training and education.
            </p>
            <div className="flex space-x-4">
              <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-brand-50 hover:text-brand-400 transition-colors" asChild>
                <a href="https://x.com/Medikaryain" target="_blank" rel="noopener noreferrer">
                  <Twitter className="h-4 w-4" />
                </a>
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-brand-50 hover:text-brand-700 transition-colors" asChild>
                <a href="https://www.linkedin.com/company/medikarya" target="_blank" rel="noopener noreferrer">
                  <Linkedin className="h-4 w-4" />
                </a>
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-pink-50 hover:text-pink-600 transition-colors" asChild>
                <a href="https://www.instagram.com/medikarya.in/" target="_blank" rel="noopener noreferrer">
                  <Instagram className="h-4 w-4" />
                </a>
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-red-50 hover:text-red-600 transition-colors" asChild>
                <a href="https://www.youtube.com/channel/UCyH4fMcICK2ghsKZqM6wOBg" target="_blank" rel="noopener noreferrer">
                  <Youtube className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Platform</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/about" className="text-muted-foreground hover:text-foreground transition-colors">
                  About
                </Link>
              </li>
              <li>
                <Link href="/#features" className="text-muted-foreground hover:text-foreground transition-colors">
                  Features
                </Link>
              </li>
              <li>
                <Link href="/#how-it-works" className="text-muted-foreground hover:text-foreground transition-colors">
                  How It Works
                </Link>
              </li>
              <li>
                <Link href="/#pricing" className="text-muted-foreground hover:text-foreground transition-colors">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link href="/contribute" className="text-muted-foreground hover:text-foreground transition-colors">
                  Become a Contributor
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Resources</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/blog" className="text-muted-foreground hover:text-foreground transition-colors">
                  Medical Blog
                </Link>
              </li>
              <li>
                <Link href="/case-studies" className="text-muted-foreground hover:text-foreground transition-colors">
                  Case Studies
                </Link>
              </li>
              <li>
                <Link href="/tutorials" className="text-muted-foreground hover:text-foreground transition-colors">
                  Tutorials
                </Link>
              </li>
              <li>
                <Link href="/api-docs" className="text-muted-foreground hover:text-foreground transition-colors">
                  API Documentation
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact & Newsletter */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Stay Updated</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" />
                <span>contact@medikarya.in</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4" />
                <span>+91 9711638511</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>Delhi, NCR</span>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Get the latest updates on new features and medical education insights.
              </p>
              <div className="flex gap-2">
                <Input placeholder="Enter your email" className="text-sm" />
                <Button size="sm" className="px-3 bg-gradient-to-r from-brand-600 to-accent-600 hover:from-brand-700 hover:to-accent-700 text-white shadow-lg hover:shadow-xl transition-all duration-200">
                  Subscribe
                </Button>
              </div>
            </div>
          </div>
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} MediKarya. All rights reserved.
          </div>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">
              Terms of Service
            </Link>
            <Link href="/cookies" className="hover:text-foreground transition-colors">
              Cookie Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
