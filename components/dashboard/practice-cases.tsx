"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Search,
  Clock,
  Users,
  Play,
  BookOpen,
  Heart,
  Brain,
  Stethoscope,
  Activity,
  Loader2
} from "lucide-react"
import { cn } from "@/lib/utils"
import { CaseMetadata } from "@/data/cases"
import { trackEvent } from "@/lib/clarity"

export function PracticeCases() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [selectedDifficulty, setSelectedDifficulty] = useState("all")
  const [cases, setCases] = useState<CaseMetadata[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loadingCaseId, setLoadingCaseId] = useState<string | null>(null)


  // Map case categories to their display names and icons
  const categoryMap = {
    'Gastroenterology': { id: 'gastroenterology', icon: Stethoscope, description: 'Digestive system and liver disorders' },
    'Cardiology': { id: 'cardiology', icon: Heart, description: 'Heart and cardiovascular system' },
    'Neurology': { id: 'neurology', icon: Brain, description: 'Nervous system and brain disorders' },
    'Pulmonology': { id: 'pulmonology', icon: Activity, description: 'Respiratory system and lungs' },
    'Emergency Medicine': { id: 'emergency', icon: Stethoscope, description: 'Acute medical conditions' },
    'General Medicine': { id: 'general', icon: BookOpen, description: 'Common medical conditions' },
    'Pediatrics': { id: 'pediatrics', icon: Users, description: 'Medical care of infants, children, and adolescents' }
  } as const

  // Enhance case data with UI-specific properties
  const enhanceCaseData = (caseData: CaseMetadata[]): CaseMetadata[] => {
    return caseData.map(caseItem => ({
      ...caseItem,
      xpReward: caseItem.estimatedTime * 5,
      description: caseItem.description || `Practice your skills with this ${caseItem.difficulty.toLowerCase()} case in ${caseItem.category}.`
    }));
  };

  // Fetch cases from API
  useEffect(() => {
    const fetchCases = async () => {
      try {
        const response = await fetch('/api/cases');
        if (!response.ok) {
          throw new Error('Failed to fetch cases');
        }
        const data = await response.json();
        setCases(enhanceCaseData(data));
      } catch (err) {
        console.error('Error fetching cases:', err);
        setError('Failed to load cases. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchCases();
  }, []);

  const filteredCases = cases.filter(case_ => {
    const matchesSearch = case_.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      case_.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    const matchesCategory = selectedCategory === "all" ||
      (case_.category && categoryMap[case_.category as keyof typeof categoryMap]?.id === selectedCategory)
    const matchesDifficulty = selectedDifficulty === "all" ||
      case_.difficulty.toLowerCase() === selectedDifficulty.toLowerCase()

    return matchesSearch && matchesCategory && matchesDifficulty
  })

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "beginner": return "bg-green-100 text-green-700 border-green-200"
      case "intermediate": return "bg-brand-100 text-brand-700 border-brand-200"
      case "advanced": return "bg-purple-100 text-purple-700 border-purple-200"
      default: return "bg-slate-100 text-slate-700 border-slate-200"
    }
  }

  const getCategoryIcon = (categoryName: string) => {
    if (!categoryName) return BookOpen
    const category = categoryMap[categoryName as keyof typeof categoryMap]
    return category?.icon || BookOpen
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-brand-500 mx-auto" />
          <p className="text-slate-600">Loading cases...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4 p-6 bg-red-50 rounded-lg max-w-md mx-auto">
          <div className="text-red-500 font-medium">Error loading cases</div>
          <p className="text-slate-700">{error}</p>
          <Button
            onClick={() => window.location.reload()}
            variant="outline"
            className="mt-2"
          >
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 lg:p-8 space-y-6 sm:space-y-8 min-h-full">
      {/* Header */}
      <div className="text-center space-y-3 sm:space-y-4">
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl md:text-3xl">Practice Cases</h1>
        <p className="text-slate-600 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed px-4">
          Choose from our extensive library of AI-powered medical cases to enhance your clinical reasoning and diagnostic skills.
        </p>
      </div>

      {/* Search and Filters */}
      <Card className="bg-white/90 backdrop-blur-sm border border-slate-200/50 shadow-sm">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search cases by title, symptoms, or keywords..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white/70 border-slate-200 h-10 sm:h-11"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="cursor-pointer px-3 py-2 rounded-lg border border-slate-200 bg-white/70 text-sm h-10 sm:h-11 min-w-[160px]"
              >
                <option value="all">All Categories</option>
                {Object.entries(categoryMap).map(([name, { id }]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                className="cursor-pointer px-3 py-2 rounded-lg border border-slate-200 bg-white/70 text-sm h-10 sm:h-11 min-w-[140px]"
              >
                <option value="all">All Difficulties</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Category Tabs */}
      <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="w-full">
        <div className="overflow-x-auto pb-2">
          <TabsList className="inline-flex h-auto p-1 bg-white/70 backdrop-blur-sm border border-slate-200/50 rounded-xl min-w-max">
            <TabsTrigger value="all" className="px-3 py-2 text-xs sm:text-sm whitespace-nowrap data-[state=active]:bg-white data-[state=active]:shadow-sm">
              All Cases
            </TabsTrigger>
            {Object.entries(categoryMap).map(([name, { id, icon: Icon }]) => (
              <TabsTrigger
                key={id}
                value={id}
                className="flex items-center gap-1 sm:gap-2 px-3 py-2 text-xs sm:text-sm whitespace-nowrap data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                <Icon className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">{name}</span>
                <span className="sm:hidden">{name.split(' ')[0]}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value={selectedCategory} className="mt-6">
          {/* Cases Grid */}
          <div className="grid gap-4 sm:gap-5 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-2">
            {filteredCases.map((case_) => {
              const CategoryIcon = getCategoryIcon(case_.category)
              return (
                <Card key={case_.id} className="group bg-white/90 backdrop-blur-sm border border-slate-200/50 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 touch-manipulation">
                  <CardHeader className="pb-3 sm:pb-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-gradient-to-br from-brand-100 to-accent-100 flex items-center justify-center flex-shrink-0">
                          <CategoryIcon className="h-4 w-4 sm:h-5 sm:w-5 text-brand-600" />
                        </div>
                        <Badge className={cn("text-xs font-medium", getDifficultyColor(case_.difficulty.toLowerCase()))}>
                          {case_.difficulty}
                        </Badge>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm font-semibold text-green-600">+{case_.estimatedTime * 5} XP</div>
                        <div className="text-xs text-slate-500">{case_.estimatedTime} min</div>
                      </div>
                    </div>
                    <CardTitle className="text-base sm:text-lg text-slate-900 group-hover:text-brand-600 transition-colors leading-tight line-clamp-2">
                      {case_.title}
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="space-y-3 sm:space-y-4">
                    <p className="text-sm text-slate-600 leading-relaxed line-clamp-2">
                      {case_.description || 'No description available for this case.'}
                    </p>

                    <div className="flex flex-wrap gap-1">
                      {case_.tags?.slice(0, 2).map((tag: string) => (
                        <Badge key={tag} variant="outline" className="text-xs bg-slate-50">
                          {tag}
                        </Badge>
                      ))}
                      {case_.tags?.length > 2 && (
                        <Badge variant="outline" className="text-xs bg-slate-50">
                          +{case_.tags.length - 2}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-3 sm:gap-4 text-xs text-slate-500">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{case_.estimatedTime} min</span>
                        </div>
                      </div>

                      <Button
                        disabled={loadingCaseId !== null}
                        onClick={() => {
                          setLoadingCaseId(case_.id)
                          trackEvent("Case_Started")
                          router.push(`/dashboard/cases/${case_.id}`)
                        }}
                        className="bg-gradient-to-r from-brand-600 to-accent-600 hover:from-brand-700 hover:to-accent-700 text-white shadow-sm hover:shadow-md transition-all duration-200 h-9 sm:h-10 px-2 sm:px-3 text-xs sm:text-sm min-w-0"
                      >
                        {loadingCaseId === case_.id ? (
                          <>
                            <Loader2 className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin flex-shrink-0" />
                            <span className="hidden sm:inline">Starting...</span>
                            <span className="sm:hidden">...</span>
                          </>
                        ) : (
                          <>
                            <Play className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                            <span className="hidden sm:inline truncate">Start Case</span>
                            <span className="sm:hidden truncate">Start</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {filteredCases.length === 0 && (
            <div className="text-center py-8 sm:py-12">
              <BookOpen className="h-10 w-10 sm:h-12 sm:w-12 text-slate-400 mx-auto mb-3 sm:mb-4" />
              <h3 className="text-base sm:text-lg font-medium text-slate-900 mb-2">No cases found</h3>
              <p className="text-sm sm:text-base text-slate-600">Try adjusting your search or filter criteria.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Quick Stats */}
      <div className="grid gap-3 sm:gap-4 md:gap-6 grid-cols-2 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-brand-50 to-brand-100 border border-brand-200/50 shadow-sm hover:shadow-md transition-all duration-200">
          <CardContent className="p-3 sm:p-4 text-center">
            <div className="text-xl sm:text-2xl font-bold text-brand-600 mb-1">{cases.length}</div>
            <div className="text-xs sm:text-sm text-brand-700 font-medium">Total Cases</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200/50 shadow-sm hover:shadow-md transition-all duration-200">
          <CardContent className="p-3 sm:p-4 text-center">
            <div className="text-xl sm:text-2xl font-bold text-green-600 mb-1">
              {cases.length > 0 ? Math.round(cases.reduce((acc, c) => acc + c.estimatedTime, 0) / cases.length) : 0} min
            </div>
            <div className="text-xs sm:text-sm text-green-700 font-medium">Avg Duration</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200/50 shadow-sm hover:shadow-md transition-all duration-200">
          <CardContent className="p-3 sm:p-4 text-center">
            <div className="text-xl sm:text-2xl font-bold text-purple-600 mb-1">
              {cases.length > 0 ? Math.round(cases.reduce((acc, c) => acc + c.xpReward, 0) / cases.length) : 0}
            </div>
            <div className="text-xs sm:text-sm text-purple-700 font-medium">Avg XP Reward</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-orange-100 border border-amber-200/50 shadow-sm hover:shadow-md transition-all duration-200">
          <CardContent className="p-3 sm:p-4 text-center">
            <div className="text-xl sm:text-2xl font-bold text-amber-600 mb-1">{Object.keys(categoryMap).length}</div>
            <div className="text-xs sm:text-sm text-amber-700 font-medium">Categories</div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
