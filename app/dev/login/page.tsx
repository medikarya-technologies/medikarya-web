import { notFound } from "next/navigation"
import { supabaseServer } from "@/lib/supabase/server"
import { DEV_CLERK_PREFIX, testLoginEnabled } from "@/lib/dev/dev-user"

// TEST MODE ONLY: choose which dummy user to be. 404 anywhere but `npm run dev:test`.

export const dynamic = "force-dynamic"

export default async function DevLoginPage() {
  if (!testLoginEnabled()) notFound()
  const { data } = await supabaseServer.from("user_profiles").select("clerk_user_id, full_name, role").like("clerk_user_id", `${DEV_CLERK_PREFIX}%`)
  return (
    <main className="mx-auto max-w-md space-y-4 px-4 py-16">
      <h1 className="text-2xl font-bold">Test mode: who are you?</h1>
      <p className="text-sm text-slate-600">Dummy users only. Make them with <code>node scripts/test-users.mjs create</code>, remove them with <code>clean</code>.</p>
      <ul className="space-y-2">
        {(data ?? []).map((u) => (
          <li key={u.clerk_user_id}>
            <a href={`/dev/as?user=${u.clerk_user_id}&next=${u.role === "admin" ? "/admin" : "/dashboard"}`} className="block rounded-lg border border-slate-300 bg-white px-4 py-3 font-medium hover:bg-slate-50">
              {u.full_name} <span className="text-slate-500">({u.role})</span>
            </a>
          </li>
        ))}
        <li>
          <a href="/dev/as?user=none&next=/" className="block rounded-lg border border-dashed border-slate-300 px-4 py-3 text-slate-600 hover:bg-slate-50">
            Signed out
          </a>
        </li>
      </ul>
    </main>
  )
}
