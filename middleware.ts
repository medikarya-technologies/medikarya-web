import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

const CANONICAL_HOST = "www.medikarya.in";

const isProtectedRoute = createRouteMatcher([
    "/dashboard(.*)",
    "/admin(.*)"
]);

const isAuthRoute = createRouteMatcher([
    "/login(.*)",
    "/signup(.*)"
]);

// Pages anyone can read that never ask the server who is signed in (the navbar and hero read it in the browser with
// useAuth). Loading one of these does not go through Clerk at all. Clerk's middleware otherwise "handshakes" a
// returning visitor whose minute-long session token has lapsed: it bounces every page load, the home page included,
// through clerk.medikarya.in/v1/client/handshake and back before showing anything. Only GET and HEAD skip it: a
// server action on these pages (the /try case saving an attempt, say) is a POST and still gets Clerk's auth.
const isPublicPage = createRouteMatcher([
    "/",
    "/about(.*)",
    "/features(.*)",
    "/how-it-works(.*)",
    "/try(.*)",
    "/blog(.*)",
    "/case-studies(.*)",
    "/contact(.*)",
    "/contribute(.*)",
    "/contributors(.*)",
    "/colleges(.*)",
    "/tutorials(.*)",
    "/privacy(.*)",
    "/terms(.*)",
    "/cookies(.*)",
    "/refund-policy(.*)",
    "/medventure",
    "/verify(.*)",
]);

// Routes that go through Clerk but need no sign-in check here (token links, webhooks, and API routes that check the
// viewer themselves).
const isPublicRoute = createRouteMatcher([
    "/review(.*)",
    "/protocol-review(.*)",
    "/advisor(.*)",
    "/api-docs(.*)",
    "/api/webhook(.*)",
    "/api/clerk-webhook(.*)",
    "/api/cases(.*)",
    "/api/chat(.*)",
    "/api/try-funnel(.*)",
]);

const withClerk = clerkMiddleware(async (auth, req) => {
    // Don't redirect if this is a Clerk OAuth callback or internal route
    if (req.nextUrl.pathname.includes('/sso-callback') ||
        req.nextUrl.pathname.includes('/oauth') ||
        req.nextUrl.pathname.startsWith('/_next/')) {
        return;
    }

    // The Medventure subdomain is one deployment with its own short routes. Keep /admin protected by Clerk before
    // rewriting it to the scoped organiser workspace, so organisers sign in to their normal MediKarya account.
    let eventResponse: NextResponse | undefined;
    if (req.nextUrl.hostname === "medventure.medikarya.in") {
        const eventUrl = req.nextUrl.clone();
        if (req.nextUrl.pathname === "/") eventUrl.pathname = "/medventure";
        else if (req.nextUrl.pathname === "/admin" || req.nextUrl.pathname.startsWith("/admin/")) eventUrl.pathname = `/medventure${req.nextUrl.pathname}`;
        else if (req.nextUrl.pathname === "/join") eventUrl.pathname = "/medventure/join";
        if (eventUrl.pathname !== req.nextUrl.pathname) eventResponse = NextResponse.rewrite(eventUrl);
    }

    // Public pages reached by POST (server actions) and the other public routes: Clerk has run, no sign-in needed
    if (isPublicPage(req) || isPublicRoute(req)) {
        return eventResponse;
    }

    const { userId } = await auth();

    // Protect dashboard routes - redirect unauthenticated users to login
    if (isProtectedRoute(req)) {
        if (!userId) {
            const loginUrl = new URL("/login", req.url);
            return NextResponse.redirect(loginUrl);
        }
    }

    // Redirect authenticated users away from auth pages to dashboard
    if (isAuthRoute(req) && userId) {
        const dashboardUrl = new URL("/dashboard", req.url);
        return NextResponse.redirect(dashboardUrl);
    }

    return eventResponse;
});

export default function middleware(req: NextRequest, event: NextFetchEvent) {
    // Force a single canonical host so Search Console only sees one site variant.
    if (req.nextUrl.protocol === "https:" && req.nextUrl.hostname === "medikarya.in") {
        const canonicalUrl = req.nextUrl.clone();
        canonicalUrl.hostname = CANONICAL_HOST;
        return NextResponse.redirect(canonicalUrl, 308);
    }

    const read = req.method === "GET" || req.method === "HEAD";
    // A public page, or a file such as /llms.txt or /blog/<slug>.md: served without Clerk
    if (read && !req.nextUrl.pathname.startsWith("/api/") && (isPublicPage(req) || req.nextUrl.pathname.includes("."))) {
        if (req.nextUrl.hostname === "medventure.medikarya.in" && req.nextUrl.pathname === "/") {
            const eventUrl = req.nextUrl.clone();
            eventUrl.pathname = "/medventure";
            return NextResponse.rewrite(eventUrl);
        }
        return NextResponse.next();
    }

    return withClerk(req, event);
}

export const config = {
    matcher: [
        // Skip Next.js internals and all static files, unless found in search params
        "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
        // Always run for API routes
        "/(api|trpc)(.*)",
    ],
};
