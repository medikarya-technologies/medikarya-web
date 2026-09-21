"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Download,
  Printer,
  X
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ECGStrip } from "./ecg-strip"
import dynamic from "next/dynamic"
import type { InvestigationOrder } from "@/lib/simulation/case-resolvers"

// Loaded on demand: only simulation cases open the interpret → reveal viewer.
const SimulationResultView = dynamic(() => import("./simulation-result-view").then((m) => m.SimulationResultView), {
  ssr: false,
})

interface TestResultModalProps {
  isOpen: boolean
  onClose: () => void
  test: any
  result: any
  /**
   * Simulation cases pass the order instead of a pre-baked result: the viewer
   * resolves the result from the case + event log, and runs the interpret →
   * reveal workflow. Must be rendered inside <ClinicalEventProvider>.
   */
  simulationOrder?: InvestigationOrder | null
}

export function TestResultModal({ isOpen, onClose, test, result, simulationOrder }: TestResultModalProps) {
  if (simulationOrder !== undefined) {
    return <SimulationResultView order={simulationOrder} open={isOpen} onClose={onClose} />
  }
  if (!result) return null

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "normal":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />
      case "high":
      case "low":
        return <AlertTriangle className="h-4 w-4 text-amber-600" />
      case "critical":
        return <AlertCircle className="h-4 w-4 text-red-600" />
      default:
        return <Minus className="h-4 w-4 text-slate-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "normal":
        return "text-green-700 bg-green-50 border-green-200"
      case "high":
      case "low":
        return "text-amber-700 bg-amber-50 border-amber-200"
      case "critical":
        return "text-red-700 bg-red-50 border-red-200"
      default:
        return "text-slate-700 bg-slate-50 border-slate-200"
    }
  }

  const getTrendIcon = (status: string) => {
    if (status === "high") return <TrendingUp className="h-3 w-3" />
    if (status === "low") return <TrendingDown className="h-3 w-3" />
    return null
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-3xl md:max-w-4xl max-h-[90vh] p-0 flex flex-col">
        <DialogHeader className="px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-200 flex-shrink-0 pr-12 sm:pr-16">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base sm:text-lg md:text-2xl font-bold text-slate-900 mb-1 sm:mb-2 line-clamp-2">
                {test.name}
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-slate-600">
                {new Date(result.completedAt).toLocaleDateString()}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              <Button variant="outline" size="sm" className="h-7 sm:h-8 w-7 sm:w-auto px-1.5 sm:px-3">
                <Download className="h-3 w-3 sm:mr-1.5" />
                <span className="hidden sm:inline">Download</span>
              </Button>
              <Button variant="outline" size="sm" className="h-7 sm:h-8 w-7 sm:w-auto px-1.5 sm:px-3">
                <Printer className="h-3 w-3 sm:mr-1.5" />
                <span className="hidden sm:inline">Print</span>
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent hover:scrollbar-thumb-gray-400"
          style={{ scrollbarWidth: 'thin' }}
          data-lenis-prevent
        >
          <div className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 space-y-4 sm:space-y-5 md:space-y-6">
            {/* Summary */}
            <div className="bg-brand-50 border border-brand-200 rounded-lg p-3 sm:p-4">
              <h3 className="font-semibold text-brand-900 mb-1.5 sm:mb-2 flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base">
                <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" />
                Summary
              </h3>
              <p className="text-brand-800 text-xs sm:text-sm leading-relaxed">{result.summary || result.results?.summary || "Results pending..."}</p>
            </div>

            {/* ECG Strip — rendered only when ecg_parameters are present */}
            {(result.ecg_parameters || result.results?.ecg_parameters) && (
              <ECGStrip
                params={result.ecg_parameters ?? result.results?.ecg_parameters}
                criticalFindings={result.criticalFindings ?? result.results?.criticalFindings}
              />
            )}

            {/* Test Image / Visual Findings */}
            {Boolean(
              test?.imageUrl ||
              test?.image ||
              result?.imageUrl ||
              result?.image ||
              result?.results?.imageUrl ||
              result?.results?.image ||
              result?._meta?.imageUrl
            ) && (
              <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-900/5">
                <div className="p-2 sm:p-3 border-b border-slate-200 bg-white">
                  <h3 className="font-semibold text-slate-900 text-xs sm:text-sm flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-brand-600" />
                    Microscopy / Imaging Findings
                  </h3>
                </div>
                <div className="relative aspect-video w-full bg-black/90 flex items-center justify-center p-2">
                  <img
                    src={
                      test?.imageUrl ||
                      test?.image ||
                      result?.imageUrl ||
                      result?.image ||
                      result?.results?.imageUrl ||
                      result?.results?.image ||
                      result?._meta?.imageUrl
                    }
                    alt={result?.imageAlt || test?.name || "Medical Imaging"}
                    className="max-h-[380px] w-auto max-w-full rounded object-contain shadow"
                  />
                </div>
              </div>
            )}

            {/* Test Values */}
            {(result.values?.length > 0 || result.results?.values?.length > 0) && (
              <div>
                <h3 className="font-semibold text-slate-900 mb-2 sm:mb-3 text-base sm:text-lg">Test Results</h3>
                <div className="space-y-2">
                  {(result.values || result.results?.values || []).map((value: any, index: number) => (
                    <div
                      key={index}
                      className={cn(
                        "border rounded-lg p-2.5 sm:p-3 md:p-4 transition-all hover:shadow-sm",
                        getStatusColor(value.status)
                      )}
                    >
                      <div className="flex items-start justify-between gap-2 sm:gap-3 md:gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 sm:gap-2 mb-1 flex-wrap">
                            {getStatusIcon(value.status)}
                            <h4 className="font-medium text-xs sm:text-sm line-clamp-1">{value.parameter}</h4>
                            {getTrendIcon(value.status)}
                          </div>
                          <div className="flex flex-wrap items-baseline gap-x-2 sm:gap-x-3 gap-y-1 mt-1.5 sm:mt-2">
                            <div className="text-xl sm:text-2xl font-bold">
                              {value.value} <span className="text-xs sm:text-sm font-normal text-slate-600">{value.unit}</span>
                            </div>
                            <div className="text-[10px] sm:text-xs text-slate-600">
                              Normal: {value.normalRange}
                            </div>
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "capitalize whitespace-nowrap text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 flex-shrink-0",
                            value.status === "normal" && "bg-green-100 text-green-700 border-green-300",
                            (value.status === "high" || value.status === "low") && "bg-amber-100 text-amber-700 border-amber-300",
                            value.status === "critical" && "bg-red-100 text-red-700 border-red-300"
                          )}
                        >
                          {value.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Clinical Interpretation */}
            <div>
              <h3 className="font-semibold text-slate-900 mb-2 sm:mb-3 text-base sm:text-lg flex items-center gap-1.5 sm:gap-2">
                <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-brand-600" />
                Clinical Interpretation
              </h3>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 sm:p-4">
                <p className="text-slate-700 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">
                  {result.interpretation || result.results?.interpretation || "No interpretation available."}
                </p>
              </div>
            </div>

            {/* Critical Findings */}
            {(result.criticalFindings?.length > 0 || result.results?.criticalFindings?.length > 0) && (
              <div className="bg-red-50 border-2 border-red-300 rounded-lg p-3 sm:p-4">
                <h3 className="font-semibold text-red-900 mb-2 sm:mb-3 text-base sm:text-lg flex items-center gap-1.5 sm:gap-2">
                  <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600" />
                  Critical Findings
                </h3>
                <ul className="space-y-1.5 sm:space-y-2">
                  {(result.criticalFindings || result.results?.criticalFindings || []).map((finding: string, index: number) => (
                    <li key={index} className="flex items-start gap-1.5 sm:gap-2 text-xs sm:text-sm text-red-800">
                      <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4 mt-0.5 flex-shrink-0" />
                      <span>{finding}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Additional Information */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 sm:p-4">
              <h4 className="font-medium text-slate-900 mb-1.5 sm:mb-2 text-xs sm:text-sm">Test Information</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-[10px] sm:text-xs text-slate-600">
                <div>
                  <span className="font-medium">Test ID:</span> {result.testId}
                </div>
                <div>
                  <span className="font-medium">Category:</span> {result.category}
                </div>
                <div>
                  <span className="font-medium">Ordered:</span> {new Date(test.orderedAt).toLocaleString()}
                </div>
                <div>
                  <span className="font-medium">Completed:</span> {new Date(result.completedAt).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Disclaimer */}
            <div className="text-[10px] sm:text-xs text-slate-500 italic border-t border-slate-200 pt-3 sm:pt-4">
              <p>
                This is a simulated case for educational purposes. Results help practice clinical reasoning.
              </p>
            </div>
          </div>
        </div>

        <div className="px-4 py-3 sm:px-6 sm:py-4 border-t border-slate-200 bg-slate-50 flex-shrink-0">
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
            <Button variant="outline" onClick={onClose} className="w-full sm:w-auto h-10 sm:h-9 text-sm">
              Close
            </Button>
            <Button onClick={onClose} className="bg-brand-600 hover:bg-brand-700 w-full sm:w-auto h-10 sm:h-9 text-sm">
              Continue Case
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog >
  )
}
