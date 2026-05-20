"use client"

import Link from "next/link"
import { ArrowRight, ArrowDown, CheckCircle, Stethoscope, Brain, FileText, Users } from "lucide-react"
import { useState } from "react"

// Colour tokens matching the original landing page
// bg-page   : #eef5fc  (light blue-cyan tint)
// bg-white  : #ffffff
// bg-subtle : #f8fafc  (slate-50)
// heading   : #0f172a  (slate-900)
// body      : #475569  (slate-600)
// muted     : #94a3b8  (slate-400)
// brand     : #2563eb  (blue-600, close to brand-600)
// brand-lt  : #eff6ff  (blue-50)
// border    : #e2e8f0  (slate-200)

export default function CheckLanding() {
  return (
    <div className="min-h-screen overflow-x-hidden" style={{ fontFamily:"'Inter',sans-serif", background:"#eef5fc" }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" />

      {/* NAV */}
      <nav className="flex items-center justify-between px-6 md:px-12 py-5 relative z-50">
        <div className="flex items-center gap-2">
          <img src="https://www.medikarya.in/medikarya.svg" alt="MediKarya" className="h-7 w-7" />
          <span className="font-bold text-base tracking-tight" style={{color:"#2563eb"}}>MediKarya</span>
        </div>
        <ul className="hidden md:flex items-center gap-8 text-sm" style={{color:"#64748b"}}>
          {["About /about","Features #features","How it Works #how","Blog /blog","Contribute /contribute"].map(item => {
            const [label, href] = item.split(" ")
            return <li key={label}><Link href={href} className="hover:text-slate-900 transition-colors">{label}</Link></li>
          })}
        </ul>
        <Link href="/login" className="flex items-center gap-1.5 text-sm font-semibold px-5 py-2 rounded-full text-white hover:opacity-90 transition-all" style={{background:"linear-gradient(135deg,#2563eb,#0891b2)"}}>
          Get Started <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </nav>

      {/* HERO */}
      <section className="relative px-6 md:px-12 pt-6 pb-0 min-h-[90vh] flex flex-col justify-between overflow-hidden">
        {/* Decorative dots */}
        <div className="absolute top-10 right-[38%] w-4 h-4 rounded-full opacity-60 animate-pulse" style={{background:"#2563eb"}} />
        <div className="absolute top-32 right-[30%] w-2.5 h-2.5 rounded-full opacity-30" style={{background:"#0891b2"}} />
        <div className="absolute top-20 left-[40%] w-3 h-3 rounded-full opacity-40" style={{background:"#2563eb"}} />
        <div className="absolute top-[45%] left-6 w-5 h-5 rounded-full border-2 opacity-25" style={{borderColor:"#2563eb"}} />
        <svg className="absolute top-16 right-[25%] w-24 h-24 opacity-15" viewBox="0 0 100 100" fill="none">
          <path d="M10 90 Q 50 10 90 50" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <div className="absolute top-0 left-0 w-[600px] h-[600px] rounded-full -translate-x-1/3 -translate-y-1/4 pointer-events-none" style={{background:"rgba(37,99,235,0.04)",filter:"blur(60px)"}} />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-start gap-8 lg:gap-0">
          {/* Left */}
          <div className="lg:w-[55%]">
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 mb-6 text-xs font-semibold uppercase tracking-widest border" style={{borderColor:"#bfdbfe",background:"#eff6ff",color:"#2563eb"}}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{background:"#2563eb"}} />
              AI-Powered Simulation
            </div>

            <h1 className="text-[clamp(2.8rem,7vw,5.5rem)] font-black leading-[1.0] tracking-tight uppercase mb-6" style={{color:"#0f172a"}}>
              Gain Clinical<br />Confidence<br />
              <span style={{color:"#2563eb"}}>Before The<br />First Patient</span>
            </h1>

            <p className="text-base md:text-lg max-w-md leading-relaxed mb-10" style={{color:"#64748b"}}>
              Simulate patient consults, order diagnostics, and interpret results in a risk-free environment.
              <strong style={{color:"#0f172a"}}> Bridge the gap between textbooks and the wards.</strong>
            </p>

            <div className="flex flex-wrap gap-3 mb-12">
              <Link href="/login" className="flex items-center gap-2 font-bold px-7 py-3.5 rounded-full text-sm uppercase tracking-wide text-white hover:opacity-90 hover:scale-[1.03] transition-all shadow-lg" style={{background:"#0f172a",boxShadow:"0 8px 24px rgba(15,23,42,0.15)"}}>
                Try Now
              </Link>
              <Link href="#features" className="flex items-center gap-2 font-semibold px-7 py-3.5 rounded-full text-sm uppercase tracking-wide border hover:bg-white transition-all" style={{borderColor:"#cbd5e1",color:"#334155",background:"rgba(255,255,255,0.6)"}}>
                Discover
              </Link>
            </div>

            <button onClick={() => window.scrollTo({top:window.innerHeight,behavior:"smooth"})} className="flex items-center gap-2 text-xs uppercase tracking-widest transition-colors" style={{color:"#94a3b8"}}>
              <span className="w-7 h-7 rounded-full border flex items-center justify-center" style={{borderColor:"#cbd5e1"}}>
                <ArrowDown className="w-3.5 h-3.5" />
              </span>
              Scroll
            </button>
          </div>

          {/* Right: circle image */}
          <div className="lg:w-[45%] flex items-start justify-center lg:justify-end">
            <div className="relative w-[300px] h-[300px] md:w-[380px] md:h-[380px] lg:w-[420px] lg:h-[420px]">
              <div className="absolute inset-0 rounded-full border" style={{borderColor:"rgba(37,99,235,0.2)"}} />
              <div className="absolute -inset-3 rounded-full border" style={{borderColor:"rgba(37,99,235,0.08)"}} />
              <div className="absolute inset-2 rounded-full overflow-hidden" style={{background:"#dbeafe"}}>
                <img src="https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600&q=80&fit=crop" alt="Medical student" className="w-full h-full object-cover mix-blend-multiply" style={{filter:"contrast(1.05) brightness(0.95)",opacity:0.85}} />
              </div>
              {/* Badge */}
              <div className="absolute -bottom-2 -left-6 rounded-2xl px-4 py-2.5 shadow-xl text-white" style={{background:"linear-gradient(135deg,#2563eb,#0891b2)"}}>
                <div className="text-xs font-black uppercase tracking-wider">Active Cases</div>
                <div className="text-2xl font-black leading-none">200+</div>
              </div>
              {/* Stat */}
              <div className="absolute -top-4 -right-2 rounded-2xl px-4 py-2.5 border bg-white shadow-md" style={{borderColor:"#bfdbfe"}}>
                <div className="text-[10px] uppercase tracking-wider" style={{color:"#94a3b8"}}>Accuracy Rate</div>
                <div className="text-xl font-black" style={{color:"#2563eb"}}>94.8%</div>
              </div>
            </div>
          </div>
        </div>

        {/* Wordmark */}
        <div className="relative mt-6 select-none overflow-hidden">
          <div className="text-[clamp(4rem,14vw,12rem)] font-black uppercase leading-none tracking-tighter text-transparent" style={{WebkitTextStroke:"1.5px rgba(37,99,235,0.12)",letterSpacing:"-0.02em"}}>
            MEDIKARYA
          </div>
        </div>
      </section>

      {/* MARQUEE STRIP */}
      <section className="py-4 overflow-hidden text-white" style={{background:"#0f172a"}}>
        <div className="flex gap-12 whitespace-nowrap" style={{animation:"marquee-strip 20s linear infinite"}}>
          {Array(4).fill(null).map((_,i) => (
            <span key={i} className="flex items-center gap-6 text-sm font-bold uppercase tracking-widest shrink-0">
              <span>Limited Clinical Exposure</span>
              <span style={{opacity:0.4}}>✦</span>
              <span>Fragmented Feedback</span>
              <span style={{opacity:0.4}}>✦</span>
              <span>Resource Constraints</span>
              <span style={{opacity:0.4}}>✦</span>
              <span>MediKarya Solves All Three</span>
              <span style={{opacity:0.4}}>✦</span>
            </span>
          ))}
        </div>
      </section>

      {/* PROBLEMS */}
      <section className="px-6 md:px-12 py-24" style={{background:"#ffffff"}}>
        <div className="max-w-6xl mx-auto">
          <div className="mb-16">
            <span className="text-xs font-bold uppercase tracking-widest" style={{color:"#2563eb"}}>The Problem</span>
            <h2 className="text-4xl md:text-6xl font-black uppercase mt-3 leading-tight" style={{color:"#0f172a"}}>
              The System<br /><span style={{color:"#cbd5e1"}}>Is Broken</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {num:"01",title:"Limited Clinical Exposure",desc:"You might see 50 diabetes cases but never encounter a rare cardiac condition until your first shift as a doctor.",label:"The Gap"},
              {num:"02",title:"Fragmented Feedback",desc:"In a busy hospital, doctors don't have time to grade every interaction. Mistakes go unnoticed, bad habits form silently.",label:"The Risk"},
              {num:"03",title:"Resource Constraints",desc:"Simulation labs are expensive and booked months in advance. Most students get under 10 hours of practice per semester.",label:"The Variable"},
            ].map((item,i) => (
              <div key={i} className="group relative rounded-3xl p-8 border hover:shadow-lg transition-all duration-300" style={{borderColor:"#e2e8f0",background:"#f8fafc"}}>
                <div className="text-6xl font-black leading-none mb-6 transition-colors" style={{color:"rgba(37,99,235,0.1)"}}>
                  {item.num}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{color:"#2563eb"}}>{item.label}</div>
                <h3 className="text-xl font-black uppercase mb-3 leading-tight" style={{color:"#0f172a"}}>{item.title}</h3>
                <p className="text-sm leading-relaxed" style={{color:"#64748b"}}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="px-6 md:px-12 py-24" style={{background:"#f8fafc"}}>
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest" style={{color:"#2563eb"}}>Platform</span>
              <h2 className="text-4xl md:text-6xl font-black uppercase mt-3 leading-tight" style={{color:"#0f172a"}}>
                Inside The<br /><span style={{color:"#2563eb"}}>Clinical Engine</span>
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-relaxed" style={{color:"#64748b"}}>A unified operating system for medical education. Precision-engineered for clinical fidelity.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Big card */}
            <div className="lg:col-span-2 rounded-3xl p-8 relative overflow-hidden border hover:shadow-xl transition-all duration-300" style={{background:"#ffffff",borderColor:"#e2e8f0"}}>
              <div className="absolute top-0 right-0 w-64 h-64 rounded-full pointer-events-none" style={{background:"rgba(37,99,235,0.04)",filter:"blur(40px)"}} />
              <Brain className="w-8 h-8 mb-6" style={{color:"#2563eb"}} />
              <h3 className="text-2xl font-black uppercase mb-3" style={{color:"#0f172a"}}>AI Patient Engine</h3>
              <p className="text-sm leading-relaxed max-w-md mb-8" style={{color:"#64748b"}}>Talk to realistic virtual patients. Take a history, examine, order tests — dynamic NLP that responds like a real consult.</p>
              <div className="rounded-2xl p-4 space-y-3 border" style={{background:"#f8fafc",borderColor:"#e2e8f0"}}>
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-full shrink-0 overflow-hidden" style={{background:"#dbeafe"}}>
                    <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="" className="w-full h-full" />
                  </div>
                  <div className="rounded-2xl rounded-tl-sm px-4 py-2.5 text-xs leading-relaxed max-w-[85%]" style={{background:"#f1f5f9",color:"#475569"}}>
                    Doctor, the pain gets worse when I lie flat… it feels heavy, like someone sitting on my chest.
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="rounded-2xl rounded-tr-sm px-4 py-2.5 text-xs text-white max-w-[80%]" style={{background:"#2563eb"}}>
                    Does the pain radiate to your arm or jaw?
                  </div>
                </div>
                <div className="flex gap-2 items-center">
                  <div className="w-2 h-2 rounded-full animate-pulse" style={{background:"#2563eb"}} />
                  <span className="text-[10px] uppercase tracking-widest" style={{color:"#2563eb"}}>Clinical Insight Unlocked</span>
                </div>
              </div>
            </div>

            {/* Feedback card */}
            <div className="rounded-3xl p-8 border hover:shadow-lg transition-all duration-300" style={{background:"#ffffff",borderColor:"#e2e8f0"}}>
              <CheckCircle className="w-8 h-8 mb-6" style={{color:"#2563eb"}} />
              <h3 className="text-xl font-black uppercase mb-3" style={{color:"#0f172a"}}>Precision Feedback</h3>
              <p className="text-sm leading-relaxed mb-6" style={{color:"#64748b"}}>Forget generic grades. Get a breakdown of your clinical reasoning, missed checks, and diagnostic accuracy.</p>
              <div className="space-y-2">
                {[{label:"Differential",val:95},{label:"Testing",val:88},{label:"Empathy",val:92}].map(s => (
                  <div key={s.label}>
                    <div className="flex justify-between text-[10px] mb-1" style={{color:"#94a3b8"}}>
                      <span>{s.label}</span><span style={{color:"#2563eb"}}>{s.val}%</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{background:"#e2e8f0"}}>
                      <div className="h-full rounded-full" style={{width:`${s.val}%`,background:"linear-gradient(90deg,#2563eb,#0891b2)"}} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {[
              {icon:<Stethoscope className="w-8 h-8 mb-6" style={{color:"#2563eb"}} />,title:"200+ Cases",desc:"From viral gastroenteritis to rare cardiac emergencies — a growing library of clinically accurate scenarios."},
              {icon:<FileText className="w-8 h-8 mb-6" style={{color:"#2563eb"}} />,title:"OSCE Ready",desc:"Cases aligned with MBBS clinical exam formats. Practice the exact stations your exams will test."},
              {icon:<Users className="w-8 h-8 mb-6" style={{color:"#2563eb"}} />,title:"Community Built",desc:"Cases contributed by medical professionals and educators. Every scenario is peer-reviewed and validated."},
            ].map((card,i) => (
              <div key={i} className="rounded-3xl p-8 border hover:shadow-lg transition-all duration-300" style={{background:"#ffffff",borderColor:"#e2e8f0"}}>
                {card.icon}
                <h3 className="text-xl font-black uppercase mb-3" style={{color:"#0f172a"}}>{card.title}</h3>
                <p className="text-sm leading-relaxed" style={{color:"#64748b"}}>{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* STATS BAND */}
      <section className="px-6 md:px-12 py-20 text-white" style={{background:"#0f172a"}}>
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {[{val:"200+",label:"Patient Cases"},{val:"94.8%",label:"Diagnostic Accuracy"},{val:"10hrs",label:"Avg Weekly Practice"},{val:"India",label:"MBBS Focused"}].map(s => (
            <div key={s.label} className="text-center">
              <div className="text-4xl md:text-5xl font-black mb-1">{s.val}</div>
              <div className="text-xs font-bold uppercase tracking-widest" style={{color:"rgba(255,255,255,0.5)"}}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 md:px-12 py-24" style={{background:"#ffffff"}}>
        <div className="max-w-3xl mx-auto">
          <div className="mb-12">
            <span className="text-xs font-bold uppercase tracking-widest" style={{color:"#2563eb"}}>FAQ</span>
            <h2 className="text-4xl md:text-5xl font-black uppercase mt-3" style={{color:"#0f172a"}}>Got Questions?</h2>
          </div>
          <div className="space-y-4">
            {[
              {q:"How realistic are the AI patient simulations?",a:"Our simulations are built by medical professionals using advanced NLP. Each scenario mirrors real clinical cases with authentic responses to your questions and examinations."},
              {q:"What conditions can I practice with?",a:"MediKarya covers cardiovascular, respiratory, endocrine, neurological, infectious diseases, and emergency scenarios — with new cases added monthly."},
              {q:"How does the feedback system work?",a:"After each simulation, you receive a detailed breakdown of your clinical reasoning, diagnostic accuracy, test ordering, and patient communication — compared against evidence-based guidelines."},
              {q:"Is it suitable for all years of MBBS?",a:"Absolutely. Cases range from basic clinical scenarios for 1st year students to complex multi-system emergencies for final year and residents."},
              {q:"Can MediKarya integrate with our institution?",a:"Yes! We offer institutional plans with progress tracking, analytics, and customizable case libraries to support your curriculum."},
            ].map((item,i) => <FAQItem key={i} question={item.q} answer={item.a} />)}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 md:px-12 py-24 relative overflow-hidden" style={{background:"#eef5fc"}}>
        <div className="absolute inset-0 pointer-events-none" style={{background:"radial-gradient(ellipse at center,rgba(37,99,235,0.06),transparent 70%)"}} />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <span className="text-xs font-bold uppercase tracking-widest" style={{color:"#2563eb"}}>Start Today</span>
          <h2 className="text-5xl md:text-7xl font-black uppercase mt-4 mb-6 leading-tight" style={{color:"#0f172a"}}>
            Practice Makes<br /><span style={{color:"#2563eb"}}>The Doctor</span>
          </h2>
          <p className="text-lg mb-10 max-w-xl mx-auto" style={{color:"#64748b"}}>
            Join thousands of MBBS students across India building clinical confidence the safe way — before the first real patient.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/login" className="flex items-center gap-2 font-black px-10 py-4 rounded-full text-base uppercase tracking-wide text-white hover:opacity-90 hover:scale-[1.03] transition-all shadow-xl" style={{background:"#0f172a"}}>
              Get Started Free <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/contribute" className="flex items-center gap-2 font-semibold px-10 py-4 rounded-full text-base uppercase tracking-wide border hover:bg-white transition-all" style={{borderColor:"#cbd5e1",color:"#334155"}}>
              Contribute Cases
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="px-6 md:px-12 py-12 border-t" style={{background:"#f8fafc",borderColor:"#e2e8f0"}}>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <img src="https://www.medikarya.in/medikarya.svg" alt="MediKarya" className="h-6 w-6" />
            <span className="font-bold" style={{color:"#2563eb"}}>MediKarya</span>
            <span className="text-sm ml-3" style={{color:"#94a3b8"}}>© {new Date().getFullYear()}</span>
          </div>
          <div className="flex gap-8 text-sm" style={{color:"#94a3b8"}}>
            {[["Privacy","/privacy"],["Terms","/terms"],["Contact","/contact"]].map(([label,href])=>(
              <Link key={label} href={href} className="hover:text-slate-700 transition-colors">{label}</Link>
            ))}
            <a href="https://x.com/Medikaryain" target="_blank" rel="noopener noreferrer" className="hover:text-slate-700 transition-colors">Twitter</a>
            <a href="https://www.instagram.com/medikarya.in/" target="_blank" rel="noopener noreferrer" className="hover:text-slate-700 transition-colors">Instagram</a>
          </div>
          <p className="text-xs max-w-xs text-center md:text-right" style={{color:"#94a3b8"}}>Empowering medical students with AI-powered patient simulation for better clinical training.</p>
        </div>
      </footer>

      <style jsx global>{`
        @keyframes marquee-strip { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
      `}</style>
    </div>
  )
}

function FAQItem({question,answer}:{question:string;answer:string}) {
  const [open,setOpen] = useState(false)
  return (
    <div className="rounded-2xl overflow-hidden border cursor-pointer transition-all duration-300" style={{borderColor:open?"#bfdbfe":"#e2e8f0",background:open?"#eff6ff":"#f8fafc"}} onClick={()=>setOpen(!open)}>
      <div className="flex items-center justify-between px-6 py-4 gap-4">
        <span className="font-semibold text-sm md:text-base" style={{color:"#0f172a"}}>{question}</span>
        <span className="text-xl font-bold shrink-0 transition-transform duration-300" style={{color:"#2563eb",transform:open?"rotate(45deg)":"rotate(0deg)"}}>+</span>
      </div>
      {open && <div className="px-6 pb-5 text-sm leading-relaxed border-t pt-4" style={{color:"#64748b",borderColor:"#e2e8f0"}}>{answer}</div>}
    </div>
  )
}
