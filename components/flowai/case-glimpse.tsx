// The hero and features-bento sections both need to describe a case without pulling in the full case-library
// types — this shape is the common ground. (The dark "device panel" that used to render here was replaced by a
// real screenshot in hero.tsx; this file now only carries the type both callers still import.)

export interface GlimpseCase {
  id: string
  displayTitle: string
  category: string
  estimatedTime: number
  patientAge?: number
  patientGender?: string
}
