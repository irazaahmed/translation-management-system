import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase auth session on every request and guards
 * protected routes. Public routes (everything else) stay viewable by anyone.
 */
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: refreshes the session cookie. Do not run code between
  // createServerClient and getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Routes that create or edit data — only logged-in staff (admin/editor) allowed.
  const writeRoutes: RegExp[] = [
    /^\/languages\/new$/,
    /^\/languages\/[^/]+\/edit$/,
    /^\/languages\/[^/]+\/meetings\/new$/,
    /^\/meetings\/new$/,
    /^\/meetings\/[^/]+\/edit$/,
    /^\/progress\/[^/]+$/,
  ];
  const isWriteRoute = writeRoutes.some((re) => re.test(pathname));
  const isAdminRoute = pathname.startsWith("/admin");

  // Not logged in → send to login for protected routes
  if ((isWriteRoute || isAdminRoute) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // Logged in → check role for protected routes
  if (user && (isWriteRoute || isAdminRoute)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = profile?.role;
    const isStaff = role === "admin" || role === "editor";
    const isAdmin = role === "admin";

    // Viewers can't reach write/admin pages — bounce them home.
    if (isWriteRoute && !isStaff) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
    if (isAdminRoute && !isAdmin) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  // If already logged in, keep users off the login page
  if (pathname === "/login" && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // Login-first gate: anyone who is NOT logged in must land on the login page
  // first — for the home page and any direct link alike. The only exceptions
  // are the login page itself, the "continue without login" entry point, and
  // API routes.
  const isAuthExempt =
    pathname === "/login" ||
    pathname === "/view" ||
    pathname.startsWith("/api");

  if (!user && !isAuthExempt) {
    const optedIntoView = request.cookies.get("qtms_view");
    // Guests (opted into view-only, not logged in) may preview ONLY the two
    // dashboards — the Quranic home (/) and the English dashboard (/et). Every
    // other page requires logging in (even just as a viewer). Logged-in viewers
    // keep full view access to the whole site.
    const guestAllowed = pathname === "/" || pathname === "/et";
    if (!optedIntoView || !guestAllowed) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirect", pathname + request.nextUrl.search);
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for static assets:
     * - _next/static, _next/image, favicon, and common image files
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
