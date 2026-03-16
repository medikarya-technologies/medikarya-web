"use client"

import Link from "next/link"
import { ArrowRight, Clock, User } from "lucide-react"
import { useState } from "react"

const CATEGORIES = ["All", "AI in Medicine", "Clinical Reasoning", "Medical Education", "Study Tips"] as const

type Article = {
    slug: string
    title: string
    excerpt: string
    category: string
    categoryColor: string
    author: string
    date: string
    readTime: string
}

export default function ArticleGrid({ articles }: { articles: Article[] }) {
    const [active, setActive] = useState<string>("All")

    const filtered = active === "All" ? articles : articles.filter(a => a.category === active)

    return (
        <div>
            {/* Category filter */}
            <div className="flex flex-wrap gap-2 mb-10">
                {CATEGORIES.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setActive(cat)}
                        className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all duration-150 cursor-pointer ${
                            active === cat
                                ? "bg-slate-900 text-white border-slate-900"
                                : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                        }`}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtered.map((article) => (
                    <Link
                        key={article.slug}
                        href={`/blog/${article.slug}`}
                        className="group flex flex-col bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-200 overflow-hidden"
                    >
                        {/* Top color bar */}
                        <div className="h-1.5 bg-gradient-to-r from-blue-500 to-cyan-500 w-full" />
                        <div className="flex flex-col flex-1 p-6 space-y-4">
                            <span className={`self-start text-xs font-semibold px-3 py-1 rounded-full border ${article.categoryColor}`}>
                                {article.category}
                            </span>
                            <h2 className="text-lg font-bold text-slate-900 leading-snug group-hover:text-blue-600 transition-colors">
                                {article.title}
                            </h2>
                            <p className="text-sm text-slate-500 leading-relaxed flex-1">
                                {article.excerpt}
                            </p>
                            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                <div className="flex items-center gap-3 text-xs text-slate-400">
                                    <span className="flex items-center gap-1"><User className="w-3 h-3" />{article.author}</span>
                                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{article.readTime}</span>
                                </div>
                                <span className="text-xs font-medium text-blue-600 flex items-center gap-1 group-hover:gap-2 transition-all">
                                    Read <ArrowRight className="w-3 h-3" />
                                </span>
                            </div>
                        </div>
                    </Link>
                ))}
                {filtered.length === 0 && (
                    <p className="col-span-3 text-center py-16 text-slate-400">No articles in this category yet.</p>
                )}
            </div>
        </div>
    )
}
