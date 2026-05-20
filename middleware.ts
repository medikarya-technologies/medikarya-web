import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const CANONICAL_HOST = "www.medikarya.in";

const isProtectedRoute = createRouteMatcher([
    "/dashboard(.*)",
    "/admin(.*)"
]);

const isAuthRoute = createRouteMatcher([
    "/login(.*)",
    "/signup(.*)"
]);

// Public routes that should NEVER trigger Clerk auth/redirects (important for SEO/Googlebot)
const isPublicRoute = createRouteMatcher([
    "/",
    "/try(.*)",
    "/contact(.*)",
    "/about(.*)",
    "/blog(.*)",
    "/case-studies(.*)",
    "/contribute(.*)",
    "/cookies(.*)",
    "/privacy(.*)",
    "/terms(.*)",
    "/tutorials(.*)",
    "/api-docs(.*)",
    "/api/webhook(.*)",
    "/api/clerk-webhook(.*)",
    "/api/cases(.*)",
    "/api/chat(.*)",
    "/api/tests(.*)",
    "/api/diagnosis(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
    // Force a single canonical host so Search Console only sees one site variant.
    if (req.nextUrl.protocol === "https:" && req.nextUrl.hostname === "medikarya.in") {
        const canonicalUrl = req.nextUrl.clone();
        canonicalUrl.hostname = CANONICAL_HOST;
        return NextResponse.redirect(canonicalUrl, 308);
    }

    // Don't redirect if this is a Clerk OAuth callback or internal route
    if (req.nextUrl.pathname.includes('/sso-callback') ||
        req.nextUrl.pathname.includes('/oauth') ||
        req.nextUrl.pathname.startsWith('/_next/') ||
        req.nextUrl.pathname.includes('.')) {
        return;
    }

    // Skip auth entirely for public routes — no Clerk call, no redirects, clean response for Googlebot
    if (isPublicRoute(req)) {
        return;
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
});

export const config = {
    matcher: [
        // Skip Next.js internals and all static files, unless found in search params
        "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
        // Always run for API routes
        "/(api|trpc)(.*)",
    ],
};
