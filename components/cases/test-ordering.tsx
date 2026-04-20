"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { TestResultModal } from "./test-result-modal"
import {
  FlaskConical,
  Scan,
  Search,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  FileText,
  Droplets,
  AlertCircle,
  X,
  Eye,
  ArrowRight,
  Stethoscope,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

interface TestOrderingProps {
  orderedTests: any[]
  testResults: any[]
  onOrderTest: (test: any) => void
  onRemoveTest: (testId: string) => void
  onProceedToDiagnosis: () => void
  caseData: any
  hasLimitedHistory?: boolean
}

const CATEGORY_FILTERS = [
  { value: "all", label: "All Tests" },
  { value: "laboratory", label: "Laboratory" },
  { value: "imaging", label: "Imaging" },
  { value: "other", label: "Other" },
]

export function TestOrdering({
  orderedTests,
  testResults,
  onOrderTest,
  onRemoveTest,
  onProceedToDiagnosis,
  caseData,
  hasLimitedHistory,
}: TestOrderingProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [selectedTest, setSelectedTest] = useState<any>(null)
  const [selectedResult, setSelectedResult] = useState<any>(null)
  const [isResultModalOpen, setIsResultModalOpen] = useState(false)
  const [availableTests, setAvailableTests] = useState<any[]>([])
  const { toast } = useToast()

  // Preserve scroll position in the left column on re-render
  const browserScrollRef = useRef<HTMLDivElement>(null)
  const savedScrollRef = useRef<number>(0)

  useEffect(() => {
    const el = browserScrollRef.current
    if (!el) return
    // Restore scroll position after orderedTests update
    el.scrollTop = savedScrollRef.current
  }, [orderedTests])

  useEffect(() => {
    if (!caseData?.patient?.investigations) return

    const tests: any[] = []
    const investigations = caseData.patient.investigations

    const sourceTests =
      investigations.tests && investigations.tests.length > 0
        ? investigations.tests
        : investigations.allowed_tests || []

    if (Array.isArray(sourceTests)) {
      sourceTests.forEach((testItem: any, index: number) => {
        let testName = ""
        let extraProps: any = {}

        if (typeof testItem === "string") {
          testName = testItem
        } else {
          testName = testItem.name
          const { name, ...rest } = testItem
          extraProps = rest
        }

        let category = "laboratory"
        let icon = FlaskConical
        let duration = "2–4 hrs"

        if (testName.toLowerCase().includes("microscopy") || testName.toLowerCase().includes("iem")) {
          icon = Scan
        } else if (testName.toLowerCase().includes("elisa")) {
          icon = Droplets
        } else if (
          testName.toLowerCase().includes("x-ray") ||
          testName.toLowerCase().includes("ct ") ||
          testName.toLowerCase().includes("ultrasound")
        ) {
          category = "imaging"
          icon = Scan
        }

        tests.push({
          id: `inv-${index}`,
          name: testName,
          category,
          icon,
          duration,
          description: testName,
          ...extraProps,
        })
      })
    }

    setAvailableTests(tests)
  }, [caseData])

  const isOrdered = (test: any) =>
    orderedTests.some((t) => t.id === test.id || t.name === test.name)

  const filteredTests = availableTests.filter((test) => {
    const matchesSearch =
      test.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      test.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = selectedCategory === "all" || test.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const getTestResult = (testId: string) => testResults.find((r) => r.testId === testId)

  const handleViewResult = (test: any, result: any) => {
    setSelectedTest(test)
    setSelectedResult(result)
    setIsResultModalOpen(true)
  }

  // Max turnaround for cart summary
  const maxTurnaround = orderedTests.length > 0
    ? orderedTests.map((t) => t.duration || "—").join(", ")
    : null

  return (
    <div className="flex flex-col md:flex-row h-full min-h-0 overflow-hidden">

      {/* ── Left / top column: test browser ─────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden border-b md:border-b-0 md:border-r border-slate-100">

        {/* Search + filter */}
        <div className="flex-shrink-0 px-3 pt-3 pb-2 bg-white border-b border-slate-100 space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Search tests…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs bg-slate-50 border-slate-200"
            />
          </div>
          <div className="flex gap-1 overflow-x-auto scrollbar-hide">
            {CATEGORY_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setSelectedCategory(f.value)}
                className={cn(
                  "whitespace-nowrap px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors flex-shrink-0",
                  selectedCategory === f.value
                    ? "bg-brand-600 text-white border-transparent"
                    : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable test list — saves scroll pos on re-render */}
        <div
          ref={browserScrollRef}
          className="flex-1 overflow-y-auto px-3 py-2 space-y-2"
          style={{ scrollbarWidth: "thin" }}
          data-lenis-prevent
          onScroll={(e) => {
            savedScrollRef.current = (e.target as HTMLDivElement).scrollTop
          }}
        >
          {filteredTests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FlaskConical className="h-10 w-10 text-slate-300 mb-3" />
              <p className="text-sm text-slate-500">No tests match your search</p>
            </div>
          ) : (
            filteredTests.map((test) => {
              const TestIcon = test.icon
              const ordered = isOrdered(test)
              const result = getTestResult(test.id)
              const orderedTest = ordered ? orderedTests.find((t) => t.id === test.id || t.name === test.name) : null

              return (
                <Card
                  key={test.id}
                  className={cn(
                    "border transition-all duration-200",
                    ordered ? "border-slate-100 bg-slate-50/50" : "border-slate-200 hover:shadow-sm hover:border-brand-200"
                  )}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0",
                        test.category === "imaging" ? "bg-violet-50" : "bg-brand-50"
                      )}>
                        <TestIcon className={cn(
                          "h-4 w-4",
                          test.category === "imaging" ? "text-violet-600" : "text-brand-600"
                        )} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className={cn("font-medium text-sm leading-tight mb-0.5", ordered ? "text-slate-400" : "text-slate-900")}>
                          {test.name}
                        </h4>
                        <p className="text-[11px] text-slate-400 line-clamp-1">{test.description}</p>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <span className="flex items-center gap-1 text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                            <Clock className="h-2.5 w-2.5" />
                            {test.duration}
                          </span>
                          {result && (
                            <button
                              onClick={() => handleViewResult(test, result)}
                              className="flex items-center gap-1 text-[10px] text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded-full hover:bg-brand-100 transition-colors"
                            >
                              <Eye className="h-2.5 w-2.5" />
                              View result
                            </button>
                          )}
                          {orderedTest?.status === "processing" && (
                            <span className="flex items-center gap-1 text-[10px] text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded-full">
                              <Loader2 className="h-2.5 w-2.5 animate-spin" />
                              Processing
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        disabled={ordered}
                        onClick={() => {
                          if (ordered) return
                          savedScrollRef.current = browserScrollRef.current?.scrollTop ?? 0
                          onOrderTest(test)
                          toast({
                            title: "Test Ordered",
                            description: `${test.name} has been requested.`,
                            duration: 2500,
                          })
                        }}
                        className={cn(
                          "h-7 px-2.5 text-[11px] flex-shrink-0 rounded-full",
                          ordered
                            ? "bg-slate-100 text-slate-400 hover:bg-slate-100 border border-slate-200"
                            : "bg-brand-600 hover:bg-brand-700 text-white"
                        )}
                      >
                        {ordered ? (
                          <>
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Ordered
                          </>
                        ) : (
                          <>
                            <Plus className="h-3 w-3 mr-1" />
                            Order
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>
      </div>

      {/* ── Right column: cart (full on md+, slim strip on mobile) ──── */}
      <div className="md:w-[260px] flex-shrink-0 flex flex-col bg-slate-50/50 border-t md:border-t-0 md:border-l border-slate-100">

        {/* Cart header — hidden on mobile (info shown in footer strip) */}
        <div className="hidden md:block flex-shrink-0 px-3 pt-3 pb-2 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-700">
              Ordered
              <span className="ml-1.5 px-1.5 py-0.5 bg-brand-100 text-brand-700 rounded-full text-[10px] font-bold">
                {orderedTests.length}
              </span>
            </h3>
          </div>
        </div>

        {/* Cart items — only visible on md+ */}
        <div
          className="hidden md:block flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-0"
          style={{ scrollbarWidth: "thin" }}
          data-lenis-prevent
        >
        {/* Cart items list body */}
          {orderedTests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                <FlaskConical className="h-6 w-6 text-slate-300" />
              </div>
              <p className="text-xs font-medium text-slate-900 mb-1">No tests ordered</p>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Add investigations from the list on the left to confirm your diagnosis.
              </p>
            </div>
          ) : (
            orderedTests.map((test) => {
              const result = getTestResult(test.id)
              return (
                <div
                  key={test._uid ?? test.id}
                  className="flex items-start gap-2 p-2 bg-white rounded-lg border border-slate-200 group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-slate-800 leading-tight line-clamp-2">{test.name}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      {test.duration && (
                        <span className="flex items-center gap-0.5 text-[10px] text-slate-400">
                          <Clock className="h-2.5 w-2.5" />
                          {test.duration}
                        </span>
                      )}
                      {test.status === "processing" && (
                        <Loader2 className="h-2.5 w-2.5 text-brand-500 animate-spin" />
                      )}
                      {test.status === "completed" && (
                        <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500" />
                      )}
                      {test.status === "failed" && (
                        <XCircle className="h-2.5 w-2.5 text-rose-500" />
                      )}
                    </div>
                    {result && (
                      <button
                        onClick={() => handleViewResult(test, result)}
                        className="mt-1 flex items-center gap-1 text-[10px] text-brand-600 hover:text-brand-800 transition-colors"
                      >
                        <FileText className="h-2.5 w-2.5" />
                        View report
                      </button>
                    )}
                  </div>
                  {/* Remove button — derived from orderedTests, not local state */}
                  <button
                    onClick={() => {
                      savedScrollRef.current = browserScrollRef.current?.scrollTop ?? 0
                      onRemoveTest(test.id)
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-rose-500 flex-shrink-0 mt-0.5"
                    aria-label="Remove test"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )
            })
          )}
        </div>

        {/* Cart footer — desktop version */}
        <div className="hidden md:block flex-shrink-0 px-3 py-3 border-t border-slate-200 space-y-2">
          {orderedTests.length > 0 && (
            <div className="space-y-1 text-[10px] text-slate-500">
              <div className="flex justify-between">
                <span>Tests ordered</span>
                <span className="font-medium text-slate-700">{orderedTests.length}</span>
              </div>
              {maxTurnaround && (
                <div className="flex justify-between">
                  <span>Turnaround</span>
                  <span className="font-medium text-slate-700 text-right max-w-[120px] line-clamp-1">{maxTurnaround}</span>
                </div>
              )}
            </div>
          )}
          {orderedTests.length === 0 && (
            <div className="p-2 bg-amber-50 rounded-lg border border-amber-100 flex items-start gap-2">
              <AlertCircle className="h-3 w-3 text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-[9px] text-amber-700 leading-tight">
                Ordering tests helps validate your hypotheses and improves diagnostic accuracy.
              </p>
            </div>
          )}
          <Button
            onClick={() => {
              if (orderedTests.length === 0) {
                toast({
                  title: "No tests ordered",
                  description: "Proceeding without tests may affect your accuracy score. Are you sure?",
                  variant: "destructive",
                })
              }
              onProceedToDiagnosis()
            }}
            className="w-full h-8 text-[11px] bg-brand-600 hover:bg-brand-700 text-white rounded-lg gap-1.5"
          >
            <Stethoscope className="h-3.5 w-3.5" />
            Proceed to Diagnosis
            <ArrowRight className="h-3 w-3" />
          </Button>
        </div>

        {/* Cart footer — mobile: slim strip showing count + proceed */}
        <div className="md:hidden flex-shrink-0 px-3 py-2 border-t border-slate-200 flex items-center gap-2">
          <span className="text-[11px] text-slate-500 flex-1">
            {orderedTests.length === 0
              ? "No tests ordered yet"
              : `${orderedTests.length} test${orderedTests.length !== 1 ? "s" : ""} ordered`}
          </span>
          <Button
            onClick={onProceedToDiagnosis}
            className="h-8 px-3 text-[11px] bg-brand-600 hover:bg-brand-700 text-white rounded-lg gap-1"
          >
            Diagnose
            <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <TestResultModal
        isOpen={isResultModalOpen}
        onClose={() => setIsResultModalOpen(false)}
        test={selectedTest}
        result={selectedResult}
      />
    </div>
  )
}
