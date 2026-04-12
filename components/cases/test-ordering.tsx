"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  Heart,
  Brain,
  Droplets,
  Activity,
  Eye,
  AlertCircle,
  Lightbulb
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

interface TestOrderingProps {
  orderedTests: any[]
  testResults: any[]
  onOrderTest: (test: any) => void
  caseData: any
  hasLimitedHistory?: boolean
}

export function TestOrdering({ orderedTests, testResults, onOrderTest, caseData, hasLimitedHistory }: TestOrderingProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [selectedTest, setSelectedTest] = useState<any>(null)
  const [selectedResult, setSelectedResult] = useState<any>(null)
  const [isResultModalOpen, setIsResultModalOpen] = useState(false)
  const [availableTests, setAvailableTests] = useState<any[]>([])
  const { toast } = useToast()

  useEffect(() => {
    if (!caseData?.patient?.investigations) return

    const tests: any[] = []
    const investigations = caseData.patient.investigations

    // Map explicit tests list
    const sourceTests = (investigations.tests && investigations.tests.length > 0)
      ? investigations.tests
      : (investigations.allowed_tests || []);

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

        // Determine category and icon based on name
        let category = "laboratory"
        let icon = FlaskConical
        let cost = 100
        let duration = "2-4 hours"

        if (testName.toLowerCase().includes("microscopy") || testName.toLowerCase().includes("iem")) {
          icon = Scan
          cost = 150
        } else if (testName.toLowerCase().includes("elisa")) {
          icon = Droplets
          cost = 80
        } else if (testName.toLowerCase().includes("x-ray") || testName.toLowerCase().includes("ct ") || testName.toLowerCase().includes("ultrasound")) {
          category = "imaging"
          icon = Scan
          cost = 200
        }

        tests.push({
          id: `inv-${index}`,
          name: testName,
          category,
          icon,
          cost,
          duration,
          description: testName,
          ...extraProps
        })
      })
    }

    setAvailableTests(tests)
  }, [caseData])

  const handleViewResult = (test: any, result: any) => {
    setSelectedTest(test)
    setSelectedResult(result)
    setIsResultModalOpen(true)
  }

  // const availableTests = []

  const filteredTests = availableTests.filter(test => {
    const matchesSearch = test.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      test.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = selectedCategory === "all" || test.category === selectedCategory
    const notOrdered = !orderedTests.some(ordered => ordered.id === test.id)

    return matchesSearch && matchesCategory && notOrdered
  })

  const getTestStatus = (testId: string) => {
    const ordered = orderedTests.find(t => t.id === testId)
    if (!ordered) return null
    return ordered.status
  }

  const getTestResult = (testId: string) => {
    return testResults.find(r => r.testId === testId)
  }

  return (
    <div className="h-[500px] sm:h-[550px] md:h-[600px] flex flex-col min-h-0">
      {/* Soft warning for limited history */}
      {hasLimitedHistory && (
        <div className="mx-2 sm:mx-3 md:mx-4 mt-2 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-900">Limited history taken</p>
            <p className="text-xs text-amber-700 mt-0.5">You're ordering tests before thorough history. Your test choices will be scored against clinical appropriateness.</p>
          </div>
        </div>
      )}
      {caseData?.patient?.investigations?.tips?.map((tip: any, index: number) => (
        <div key={index} className="mb-2 mx-2 sm:mx-3 md:mx-4 mt-2 p-3 bg-purple-50 border border-purple-200 rounded-xl flex items-start gap-3">
          <Lightbulb className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-purple-800">{tip.text}</p>
        </div>
      ))}

      <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="flex-1 flex flex-col min-h-0">

        <div className="border-b border-slate-200 bg-slate-50/50 px-2 sm:px-3 md:px-4 py-2 sm:py-3 flex-shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400" />
              <Input
                placeholder="Search tests..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 sm:pl-10 h-8 sm:h-9 text-xs sm:text-sm"
              />
            </div>
          </div>

          <div className="overflow-x-auto scrollbar-hide">
            <TabsList className="w-full justify-start h-auto p-0 bg-transparent inline-flex">
              <TabsTrigger value="all" className="text-[10px] sm:text-xs px-2 sm:px-3 py-1.5 sm:py-2 whitespace-nowrap">All Tests</TabsTrigger>
              <TabsTrigger value="laboratory" className="text-[10px] sm:text-xs px-2 sm:px-3 py-1.5 sm:py-2 whitespace-nowrap">Laboratory</TabsTrigger>
              <TabsTrigger value="imaging" className="text-[10px] sm:text-xs px-2 sm:px-3 py-1.5 sm:py-2 whitespace-nowrap">Imaging</TabsTrigger>
              <TabsTrigger value="ordered" className="text-[10px] sm:text-xs px-2 sm:px-3 py-1.5 sm:py-2 whitespace-nowrap">
                Ordered ({orderedTests.length})
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="all" className="flex-1 m-0 min-h-0 w-full overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent hover:scrollbar-thumb-gray-400"
          style={{ scrollbarWidth: 'thin' }}
          data-lenis-prevent
        >
          <div className="p-2 sm:p-3 md:p-4 space-y-2">
            {filteredTests.map((test) => {
              const TestIcon = test.icon
              return (
                <Card
                  key={test.id}
                  className="hover:shadow-md transition-all cursor-pointer border border-slate-200"
                  onClick={() => setSelectedTest(test)}
                >
                  <CardContent className="p-2 sm:p-3">
                    <div className="flex items-start justify-between gap-3 sm:gap-4">
                      <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
                        <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
                          <TestIcon className="h-5 w-5 sm:h-6 sm:w-6 text-brand-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm sm:text-base text-slate-900 mb-1 line-clamp-1">{test.name}</h4>
                          <p className="text-xs sm:text-sm text-slate-600 line-clamp-2">{test.description}</p>
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-2">
                            <Badge variant="outline" className="text-xs py-0.5 px-2 bg-white">
                              <Clock className="h-3 w-3 mr-1" />
                              {test.duration}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        disabled={orderedTests.some((t: any) => t.id === test.id || t.name === test.name)}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (orderedTests.some((t: any) => t.id === test.id || t.name === test.name)) return
                          onOrderTest(test)
                          toast({
                            title: "Test Ordered",
                            description: `${test.name} has been requested. Check the Ordered tab for results.`,
                            duration: 3000,
                          })
                        }}
                        className={cn(
                          "h-9 sm:h-10 px-3 sm:px-4 text-xs sm:text-sm shadow-sm flex-shrink-0",
                          orderedTests.some((t: any) => t.id === test.id || t.name === test.name)
                            ? "bg-slate-100 text-slate-400 hover:bg-slate-100"
                            : "bg-brand-600 hover:bg-brand-700"
                        )}
                      >
                        {orderedTests.some((t: any) => t.id === test.id || t.name === test.name) ? (
                          <CheckCircle2 className="h-3.5 w-3.5 sm:mr-1.5" />
                        ) : (
                          <Plus className="h-3.5 w-3.5 sm:mr-1.5" />
                        )}
                        <span className="hidden sm:inline">{orderedTests.some((t: any) => t.id === test.id || t.name === test.name) ? "Ordered" : "Order"}</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}

            {filteredTests.length === 0 && (
              <div className="text-center py-12">
                <FlaskConical className="h-12 w-12 text-slate-400 mx-auto mb-3" />
                <p className="text-sm text-slate-600">No tests found</p>
              </div>
            )}
          </div>
        </TabsContent >

        <TabsContent value="laboratory" className="flex-1 m-0 min-h-0 w-full overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent hover:scrollbar-thumb-gray-400"
          style={{ scrollbarWidth: 'thin' }}
          data-lenis-prevent
        >
          <div className="p-4 space-y-2">
            {filteredTests.filter(t => t.category === "laboratory").map((test) => {
              const TestIcon = test.icon
              return (
                <Card
                  key={test.id}
                  className="hover:shadow-md transition-all cursor-pointer border border-slate-200"
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="h-10 w-10 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0">
                          <TestIcon className="h-5 w-5 text-brand-600" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-sm text-slate-900 mb-1">{test.name}</h4>
                          <p className="text-xs text-slate-600">{test.description}</p>
                          <div className="flex items-center gap-3 mt-2">
                            <Badge variant="outline" className="text-xs">
                              <Clock className="h-3 w-3 mr-1" />
                              {test.duration}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => {
                          onOrderTest(test)
                          toast({
                            title: "Test Ordered",
                            description: `${test.name} has been requested. Check the Ordered tab for results.`,
                            duration: 3000,
                          })
                        }}
                        className="bg-brand-600 hover:bg-brand-700 h-9 sm:h-10 px-3 sm:px-4 text-xs sm:text-sm shadow-sm flex-shrink-0"
                      >
                        <Plus className="h-3.5 w-3.5 sm:mr-1.5" />
                        <span className="hidden sm:inline">Order</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent >

        <TabsContent value="imaging" className="flex-1 m-0 min-h-0 w-full overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent hover:scrollbar-thumb-gray-400"
          style={{ scrollbarWidth: 'thin' }}
          data-lenis-prevent
        >
          <div className="p-4 space-y-2">
            {filteredTests.filter(t => t.category === "imaging").map((test) => {
              const TestIcon = test.icon
              return (
                <Card
                  key={test.id}
                  className="hover:shadow-md transition-all cursor-pointer border border-slate-200"
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-3 sm:gap-4">
                      <div className="flex items-start gap-3 sm:gap-4 flex-1">
                        <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
                          <TestIcon className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-sm sm:text-base text-slate-900 mb-1">{test.name}</h4>
                          <p className="text-xs sm:text-sm text-slate-600 line-clamp-2">{test.description}</p>
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-2">
                            <Badge variant="outline" className="text-xs py-0.5 px-2 bg-white">
                              <Clock className="h-3 w-3 mr-1" />
                              {test.duration}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => {
                          onOrderTest(test)
                          toast({
                            title: "Test Ordered",
                            description: `${test.name} has been requested. Check the Ordered tab for results.`,
                            duration: 3000,
                          })
                        }}
                        className="bg-purple-600 hover:bg-purple-700 h-9 sm:h-10 px-3 sm:px-4 text-xs sm:text-sm shadow-sm flex-shrink-0"
                      >
                        <Plus className="h-3.5 w-3.5 sm:mr-1.5" />
                        Order
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div >
        </TabsContent >

        <TabsContent value="ordered" className="flex-1 m-0 min-h-0 w-full overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent hover:scrollbar-thumb-gray-400"
          style={{ scrollbarWidth: 'thin' }}
          data-lenis-prevent
        >
          <div className="p-2 sm:p-3 md:p-4 space-y-2 sm:space-y-3">
            {orderedTests.length === 0 ? (
              <div className="text-center py-12">
                <FlaskConical className="h-12 w-12 text-slate-400 mx-auto mb-3" />
                <p className="text-sm text-slate-600">No tests ordered yet</p>
                <p className="text-xs text-slate-500 mt-1">Order tests to begin investigation</p>
              </div>
            ) : (
              orderedTests.map((test) => {
                const result = getTestResult(test.id)
                // Try to find the original test definition to get the icon, or fallback
                const originalTest = availableTests.find(t => t.name === test.name)
                const TestIcon = test.icon || (originalTest ? originalTest.icon : FlaskConical)

                return (
                  <Card key={test.id} className="border border-slate-200">
                    <CardContent className="p-2 sm:p-3">
                      <div className="flex items-start gap-3 sm:gap-4">
                        <div className={cn(
                          "h-10 w-10 sm:h-12 sm:w-12 rounded-xl flex items-center justify-center flex-shrink-0",
                          test.status === "completed" ? "bg-green-50" : "bg-slate-50"
                        )}>
                          <TestIcon className={cn(
                            "h-5 w-5 sm:h-6 sm:w-6",
                            test.status === "completed" ? "text-green-600" : "text-slate-600"
                          )} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <h4 className="font-medium text-sm sm:text-base text-slate-900 line-clamp-1">{test.name}</h4>
                            {test.status === "processing" && (
                              <Badge className="bg-brand-100 text-brand-700 border-brand-200 text-xs px-2 py-0.5 flex-shrink-0">
                                <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                                Processing
                              </Badge>
                            )}
                            {test.status === "completed" && (
                              <Badge className="bg-green-100 text-green-700 border-green-200 text-xs px-2 py-0.5 flex-shrink-0">
                                <CheckCircle2 className="h-3 w-3 mr-1.5" />
                                Completed
                              </Badge>
                            )}
                            {test.status === "failed" && (
                              <Badge variant="destructive" className="text-xs px-2 py-0.5 flex-shrink-0">
                                <XCircle className="h-3 w-3 mr-1.5" />
                                Failed
                              </Badge>
                            )}
                          </div>

                          {result && (
                            <div className="bg-slate-50 rounded-xl p-3 sm:p-4 mt-2 border border-slate-200">
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
                                <div className="flex items-center gap-2">
                                  <FileText className="h-4 w-4 text-slate-600 flex-shrink-0" />
                                  <span className="text-sm font-medium text-slate-900">Results Available</span>
                                </div>
                                <Button
                                  size="sm"
                                  onClick={() => handleViewResult(test, result)}
                                  className="h-8 sm:h-9 text-xs sm:text-sm px-3 w-full sm:w-auto hover:bg-white hover:text-brand-600"
                                >
                                  <Eye className="h-3.5 w-3.5 mr-1.5" />
                                  View Report
                                </Button>
                              </div>
                              <p className="text-xs sm:text-sm text-slate-700 mb-2 leading-relaxed line-clamp-2">{result.summary || result.results?.summary || "Results pending..."}</p>
                              <p className="text-xs text-slate-600 line-clamp-1 italic">{result.interpretation || result.results?.interpretation}</p>
                              {(result.criticalFindings?.length > 0 || result.results?.criticalFindings?.length > 0) && (
                                <div className="mt-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 animate-pulse">
                                  <p className="text-xs font-medium text-red-900 flex items-center gap-1.5">
                                    <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                                    <span className="line-clamp-1">Critical Findings - Click to view</span>
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>

        </TabsContent>
      </Tabs>

      <TestResultModal
        isOpen={isResultModalOpen}
        onClose={() => setIsResultModalOpen(false)}
        test={selectedTest}
        result={selectedResult}
      />
    </div>
  )
}
