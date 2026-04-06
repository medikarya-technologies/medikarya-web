import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, LayoutDashboard } from "lucide-react"
import { cn } from "@/lib/utils"
import { auth } from "@clerk/nextjs/server"
import { UserButton } from "@clerk/nextjs"

export async function Navbar() {
  const { userId } = await auth()
  return (
    <header>
      <nav
        className={cn(
          "mx-auto mt-2 flex items-center justify-between gap-3",
          "rounded-full border bg-white/70 px-4 py-2 shadow-sm backdrop-blur-md",
          "dark:bg-black/30",
        )}
        aria-label="Primary"
      >
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center">
            <img src="https://www.medikarya.in/medikarya.svg" alt="MediKarya Logo" className="h-full w-full object-contain" />
          </div>
          <span className="font-semibold text-slate-800">MediKarya</span>
        </div>

        <ul className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <li>
            <Link href="/about" className="transition-colors hover:text-foreground">
              About
            </Link>
          </li>
          <li>
            <Link href="#features" className="transition-colors hover:text-foreground">
              Features
            </Link>
          </li>
          <li>
            <Link href="#video-demo" className="transition-colors hover:text-foreground">
              How it Works
            </Link>
          </li>
          <li>
            <Link href="/blog" className="transition-colors hover:text-foreground">
              Blog
            </Link>
          </li>
          <li>
            <Link href="/contribute" className="transition-colors hover:text-foreground">
              Contribute
            </Link>
          </li>
        </ul>

        <div className="flex items-center gap-2">
          {userId ? (
            <div className="flex items-center gap-3">
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="hidden sm:flex rounded-full text-slate-600 hover:text-slate-900 border border-slate-200"
              >
                <Link href="/dashboard">
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  Dashboard
                </Link>
              </Button>
              <UserButton afterSignOutUrl="/" />
            </div>
          ) : (
            <Button
              asChild
              size="sm"
              className={cn(
                "group rounded-full px-4 h-auto py-2",
                "bg-gradient-to-r from-brand-600 to-accent-600 hover:from-brand-700 hover:to-accent-700 text-white",
                "shadow-lg hover:shadow-brand-500/20 hover:scale-[1.005] transition-all duration-300 ease-out",
              )}
            >
              <Link href="/login" aria-label="Get started with MediKarya" className="flex items-center justify-center">
                <span className="mr-1">Get Started</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
          )}
        </div>
      </nav>
    </header>
  )
}
