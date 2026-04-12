"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Download, Share, PlusSquare } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isInstallable, setIsInstallable] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [showIOSDialog, setShowIOSDialog] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    // Check if app is already running in standalone (installed) mode
    const checkStandalone = () => {
      const isWindowStandalone = window.matchMedia('(display-mode: standalone)').matches
      const isIOSStandalone = (window.navigator as any).standalone === true
      setIsStandalone(isWindowStandalone || isIOSStandalone)
    }

    checkStandalone()

    // iOS Detection
    const userAgent = window.navigator.userAgent.toLowerCase()
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent)
    setIsIOS(isIOSDevice)

    // Android / Desktop Chrome PWA Prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setIsInstallable(true)
    }

    if (!isIOSDevice) {
      window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    } else {
      // If it's iOS and not standalone, we can offer the manual install dialog
      if (!isStandalone) {
         setIsInstallable(true)
      }
    }

    // Hide if installed successfully
    const handleAppInstalled = () => {
      setIsInstallable(false)
      setIsStandalone(true)
      setDeferredPrompt(null)
    }
    window.addEventListener("appinstalled", handleAppInstalled)

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
      window.removeEventListener("appinstalled", handleAppInstalled)
    }
  }, [isStandalone])

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSDialog(true)
      return
    }

    if (!deferredPrompt) return
    
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    
    if (outcome === "accepted") {
      setIsInstallable(false)
      setDeferredPrompt(null)
    }
  }

  // Do not render if already installed, or if the device doesn't support the logic right now
  if (isStandalone || !isInstallable) return null

  return (
    <>
      <Button 
        onClick={handleInstallClick} 
        variant="outline" 
        className="w-full justify-start text-brand-700 border-brand-200 bg-brand-50 hover:bg-brand-100 hover:text-brand-800 rounded-xl"
      >
        <Download className="mr-3 h-4 w-4" />
        Install App
      </Button>

      <Dialog open={showIOSDialog} onOpenChange={setShowIOSDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-xl">Install MediKarya</DialogTitle>
            <DialogDescription className="text-center pt-2 text-base">
              Progressive Web Apps on iOS must be added manually. Follow these steps:
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col items-center justify-center space-y-6 py-4">
            <div className="flex items-center space-x-4 bg-slate-50 p-4 rounded-xl w-full border border-slate-100">
              <div className="bg-white p-2 rounded-lg shadow-sm border border-slate-200">
                <Share className="h-6 w-6 text-blue-500" />
              </div>
              <div className="text-slate-700">
                <span className="font-semibold block">Step 1</span>
                Tap the **Share** button at the bottom of your screen.
              </div>
            </div>
            
            <div className="flex items-center space-x-4 bg-slate-50 p-4 rounded-xl w-full border border-slate-100">
               <div className="bg-white p-2 rounded-lg shadow-sm border border-slate-200">
                <PlusSquare className="h-6 w-6 text-slate-700" />
              </div>
              <div className="text-slate-700">
                <span className="font-semibold block">Step 2</span>
                Scroll down and tap **Add to Home Screen**.
              </div>
            </div>
          </div>

          <Button onClick={() => setShowIOSDialog(false)} className="w-full rounded-xl">
            Got it
          </Button>
        </DialogContent>
      </Dialog>
    </>
  )
}
