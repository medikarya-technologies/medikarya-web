"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatPatientAge } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  User,
  Calendar,
  Activity,
  Heart,
  Thermometer,
  Wind,
  Droplets,
  AlertCircle,
  Pill,
  Play,
  FileText
} from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface PatientCardProps {
  patient: {
    name: string
    age: number
    gender: string
    mrn: string
    admissionDate: string
    chiefComplaint: string
    vitalSigns?: {
      bloodPressure?: { systolic?: number; diastolic?: number; unit?: string }
      heartRate?: { value?: number; unit?: string }
      temperature?: { value?: number; unit?: string }
      respiratoryRate?: { value?: number; unit?: string }
      oxygenSaturation?: { value?: number; unit?: string }
    }
    allergies: string[]
    currentMedications: string[]
  }
  caseTitle: string
  onStartCase: () => void
}

export function PatientCard({ patient, caseTitle, onStartCase }: PatientCardProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="text-center space-y-3">
        <Badge className="bg-brand-100 text-brand-700 border-brand-200 px-4 py-1">
          Case Study
        </Badge>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight">{caseTitle}</h1>
        <p className="text-slate-600">
          Review the patient information below and start the case when ready
        </p>
      </div>

      {/* Patient Information Card */}
      <Card className="bg-white/90 backdrop-blur-sm border-2 border-slate-200 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-brand-50 to-accent-50 border-b border-slate-200 px-4 py-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="h-12 w-12 sm:h-16 sm:w-16 rounded-full bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center flex-shrink-0">
                <User className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-lg sm:text-2xl text-slate-900 truncate">{patient.name}</CardTitle>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1 text-xs sm:text-sm text-slate-600">
                  <span className="whitespace-nowrap">{formatPatientAge(patient.age)}</span>
                  <span className="hidden sm:inline">•</span>
                  <span className="whitespace-nowrap">{patient.gender}</span>
                  <span className="hidden sm:inline">•</span>
                  <span className="font-mono text-[10px] sm:text-xs bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{patient.mrn}</span>
                </div>
              </div>
            </div>
            <Badge variant="outline" className="bg-white w-fit self-start sm:self-auto text-xs sm:text-sm py-1">
              <Calendar className="mr-1.5 sm:mr-2 h-3 w-3" />
              {formatDate(patient.admissionDate)}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* Chief Complaint */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-amber-900 mb-1">Chief Complaint</h3>
                <p className="text-amber-800">{patient.chiefComplaint}</p>
              </div>
            </div>
          </div>

          {/* Vital Signs */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2 text-sm sm:text-base">
              <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-brand-600" />
              Vital Signs
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                <div className="flex items-center gap-2 mb-1">
                  <Heart className="h-4 w-4 text-red-500" />
                  <span className="text-xs text-slate-600 font-medium">Blood Pressure</span>
                </div>
                <p className="text-sm font-semibold text-slate-900">
                  {patient.vitalSigns?.bloodPressure?.systolic ? `${patient.vitalSigns.bloodPressure.systolic}/${patient.vitalSigns.bloodPressure.diastolic} ${patient.vitalSigns.bloodPressure.unit || 'mmHg'}` : 'Not recorded'}
                </p>
              </div>

              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                <div className="flex items-center gap-2 mb-1">
                  <Activity className="h-4 w-4 text-pink-500" />
                  <span className="text-xs text-slate-600 font-medium">Heart Rate</span>
                </div>
                <p className="text-sm font-semibold text-slate-900">
                  {patient.vitalSigns?.heartRate?.value ? `${patient.vitalSigns.heartRate.value} ${patient.vitalSigns.heartRate.unit || 'bpm'}` : 'Not recorded'}
                </p>
              </div>

              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                <div className="flex items-center gap-2 mb-1">
                  <Thermometer className="h-4 w-4 text-orange-500" />
                  <span className="text-xs text-slate-600 font-medium">Temperature</span>
                </div>
                <p className="text-sm font-semibold text-slate-900">
                  {patient.vitalSigns?.temperature?.value ? `${patient.vitalSigns.temperature.value} ${patient.vitalSigns.temperature.unit || '°C'}` : 'Not recorded'}
                </p>
              </div>

              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                <div className="flex items-center gap-2 mb-1">
                  <Wind className="h-4 w-4 text-brand-500" />
                  <span className="text-xs text-slate-600 font-medium">Respiratory Rate</span>
                </div>
                <p className="text-sm font-semibold text-slate-900">
                  {patient.vitalSigns?.respiratoryRate?.value ? `${patient.vitalSigns.respiratoryRate.value} ${patient.vitalSigns.respiratoryRate.unit || 'breaths/min'}` : 'Not recorded'}
                </p>
              </div>

              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                <div className="flex items-center gap-2 mb-1">
                  <Droplets className="h-4 w-4 text-accent-500" />
                  <span className="text-xs text-slate-600 font-medium">O₂ Saturation</span>
                </div>
                <p className="text-sm font-semibold text-slate-900">
                  {patient.vitalSigns?.oxygenSaturation?.value ? `${patient.vitalSigns.oxygenSaturation.value}${patient.vitalSigns.oxygenSaturation.unit === '%' ? '%' : ` ${patient.vitalSigns.oxygenSaturation.unit || '%'}`}` : 'Not recorded'}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Allergies */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              Allergies
            </h3>
            <div className="flex flex-wrap gap-2">
              {patient.allergies.length > 0 ? (
                patient.allergies.map((allergy, index) => (
                  <Badge key={index} variant="destructive" className="bg-red-100 text-red-700 border-red-200">
                    {allergy}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-slate-600">No known allergies</span>
              )}
            </div>
          </div>

          {/* Current Medications */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Pill className="h-5 w-5 text-green-600" />
              Current Medications
            </h3>
            <div className="space-y-2">
              {patient.currentMedications.length > 0 ? (
                patient.currentMedications.map((medication, index) => (
                  <div key={index} className="bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                    <p className="text-sm text-green-900">{medication}</p>
                  </div>
                ))
              ) : (
                <span className="text-sm text-slate-600">No current medications</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>


      {/* Action Buttons */}
      <div className="flex flex-col-reverse sm:flex-row justify-center gap-3 sm:gap-4 pt-2">
        <Dialog>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="lg"
              className="w-full sm:w-auto min-w-[150px]"
            >
              <FileText className="mr-2 h-4 w-4" />
              View Guidelines
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Clinical Guidelines</DialogTitle>
              <DialogDescription>
                Standard evaluation and management protocols.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 text-sm text-slate-700">
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <h4 className="font-semibold text-slate-900 mb-2">General Assessment</h4>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Assess airway, breathing, and circulation immediately upon presentation.</li>
                  <li>Obtain a detailed history including onset, duration, and progression of symptoms.</li>
                  <li>Perform a comprehensive physical examination with focus on the affected systems.</li>
                </ul>
              </div>

              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <h4 className="font-semibold text-slate-900 mb-2">Diagnostic Approach</h4>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Order investigations based on clinical suspicion and pre-test probability.</li>
                  <li>Avoid unnecessary testing to reduce cost and patient discomfort.</li>
                  <li>Review vital signs and red flags before ruling out serious pathology.</li>
                </ul>
              </div>

              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <h4 className="font-semibold text-slate-900 mb-2">Management Principles</h4>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Prioritize stabilization of unstable patients.</li>
                  <li>Provide symptomatic relief while awaiting confirmatory diagnosis.</li>
                  <li>Involve specialists early for complex or rapidly deteriorating cases.</li>
                </ul>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Button
          size="lg"
          onClick={onStartCase}
          className="w-full sm:w-auto min-w-[200px] bg-gradient-to-r from-brand-600 to-accent-600 hover:from-brand-700 hover:to-accent-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
        >
          <Play className="mr-2 h-5 w-5" />
          Start Case
        </Button>
      </div>
    </div>
  )
}
