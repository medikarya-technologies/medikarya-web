"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  HelpCircle,
  MessageSquare,
  BookOpen,
  Video,
  Phone,
  Mail,
  Search,
  ExternalLink,
  Clock,
  CheckCircle,
  AlertCircle,
  Info,
  Zap,
  Users,
  FileText,
  Play,
  Download,
  Activity
} from "lucide-react"
import { cn } from "@/lib/utils"

export function Support() {
  const faqs = [
    {
      id: 1,
      question: "How do I start a new patient case?",
      answer: "Navigate to the Practice Cases section and click 'Start Case' on any available case. You can also use the 'Start Random Case' button for a surprise challenge.",
      category: "Getting Started"
    },
    {
      id: 2,
      question: "How is my XP calculated?",
      answer: "XP is awarded based on case difficulty, completion time, and accuracy. Bonus XP is given for maintaining streaks and achieving high scores.",
      category: "Scoring"
    },
    {
      id: 3,
      question: "Can I retake completed cases?",
      answer: "Yes! You can retake any completed case to improve your score and earn additional XP. Previous attempts are saved in your progress history.",
      category: "Practice"
    },
    {
      id: 4,
      question: "How do rankings work?",
      answer: "Rankings are calculated based on total XP earned. There are separate leaderboards for weekly, monthly, and all-time performance.",
      category: "Rankings"
    }
  ]

  const supportResources = [
    {
      id: 1,
      title: "Getting Started Guide",
      description: "Complete walkthrough of MediKarya features and best practices",
      type: "Guide",
      duration: "10 min read",
      icon: BookOpen
    },
    {
      id: 2,
      title: "Video Tutorial Series",
      description: "Step-by-step video guides for common tasks and features",
      type: "Videos",
      duration: "2h 30min",
      icon: Video
    },
    {
      id: 3,
      title: "Clinical Guidelines Reference",
      description: "Quick reference for medical guidelines and protocols",
      type: "Reference",
      duration: "Interactive",
      icon: FileText
    },
    {
      id: 4,
      title: "Live Q&A Sessions",
      description: "Join weekly live sessions with medical experts",
      type: "Live Events",
      duration: "Every Thursday 7PM EST",
      icon: Users
    }
  ]

  const quickActions = [
    { id: 1, title: "Contact Support", description: "Get help from our team", icon: MessageSquare, action: "contact" },
    { id: 2, title: "Report Bug", description: "Help us improve", icon: AlertCircle, action: "bug" },
    { id: 3, title: "Feature Request", description: "Suggest improvements", icon: Zap, action: "feature" },
    { id: 4, title: "Documentation", description: "Browse help articles", icon: BookOpen, action: "docs" }
  ]

  return (
    <div className="p-4 lg:p-8 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Help & Support</h1>
        <p className="text-slate-600 max-w-2xl mx-auto">
          Get help, find answers, and connect with our support team and community resources.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 sm:gap-6 grid-cols-2 lg:grid-cols-4">
        {quickActions.map((action) => (
          <Card key={action.id} className="group bg-white/80 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer">
            <CardContent className="p-6 text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-brand-100 to-accent-100 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform duration-300">
                <action.icon className="h-6 w-6 text-brand-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 group-hover:text-brand-600 transition-colors">
                  {action.title}
                </h3>
                <p className="text-xs text-slate-600 mt-1">{action.description}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* FAQ Section */}
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-900">
                <HelpCircle className="h-5 w-5 text-brand-600" />
                Frequently Asked Questions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {faqs.map((faq) => (
                <div key={faq.id} className="p-4 rounded-xl bg-slate-50/80 hover:bg-slate-100/80 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-brand-600">{faq.id}</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-slate-900 mb-2">{faq.question}</h3>
                      <p className="text-sm text-slate-600 leading-relaxed">{faq.answer}</p>
                      <Badge className="mt-2 bg-slate-200 text-slate-700 text-xs">
                        {faq.category}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Contact Support */}
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-900">
                <MessageSquare className="h-5 w-5 text-brand-600" />
                Contact Support
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    placeholder="Rahul Kumar"
                    className="bg-white/50 border-slate-200"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="yourname@gmail.com"
                    className="bg-white/50 border-slate-200"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <select className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white/50 text-sm">
                  <option>General Question</option>
                  <option>Technical Issue</option>
                  <option>Billing Question</option>
                  <option>Feature Request</option>
                  <option>Bug Report</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  placeholder="Describe your question or issue in detail..."
                  className="bg-white/50 border-slate-200 min-h-[120px]"
                />
              </div>

              <Button className="w-full bg-gradient-to-r from-brand-600 to-accent-600 hover:from-brand-700 hover:to-accent-700 text-white shadow-lg">
                Send Message
              </Button>

              <div className="flex items-center gap-4 pt-4 border-t border-slate-200 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  <span>support@medikarya.in</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  <span>+91 9711638511</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Support Resources */}
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-900">
                <BookOpen className="h-5 w-5 text-brand-600" />
                Support Resources
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {supportResources.map((resource) => (
                <div key={resource.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50/80 hover:bg-slate-100/80 transition-colors cursor-pointer group">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-brand-100 to-accent-100 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <resource.icon className="h-4 w-4 text-brand-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-slate-900 text-sm group-hover:text-brand-600 transition-colors">
                      {resource.title}
                    </h4>
                    <p className="text-xs text-slate-600">{resource.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className="bg-brand-100 text-brand-700 text-xs">
                        {resource.type}
                      </Badge>
                      <span className="text-xs text-slate-500">{resource.duration}</span>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Quick Tips */}
          <Card className="bg-gradient-to-r from-brand-50 to-accent-50 border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-900">
                <Zap className="h-5 w-5 text-brand-600" />
                Quick Tips
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-slate-700">
                  Complete cases daily to maintain your learning streak and earn bonus XP.
                </p>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-slate-700">
                  Use the search feature in Practice Cases to find specific medical scenarios.
                </p>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-slate-700">
                  Check the Achievements tab regularly to track your progress and unlock new badges.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* System Status */}
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-900">
                <Activity className="h-5 w-5 text-green-600" />
                System Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">API Status</span>
                <Badge className="bg-green-100 text-green-700">Operational</Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Case Engine</span>
                <Badge className="bg-green-100 text-green-700">Online</Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Database</span>
                <Badge className="bg-green-100 text-green-700">Healthy</Badge>
              </div>

              <div className="pt-3 border-t border-slate-200">
                <p className="text-xs text-slate-500">
                  Last updated: {new Date().toLocaleTimeString()}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
