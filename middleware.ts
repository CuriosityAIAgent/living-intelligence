import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes that don't require authentication
// Routes that are public (prefix match)
const PUBLIC_PREFIXES = ['/login', '/join', '/invite', '/privacy', '/about', '/api/auth/', '/api/webhooks/stripe', '/api/invite/', '/api/feedback']
// Routes that are public (exact match)
const PUBLIC_EXACT = ['/']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public routes, static assets, and Next.js internals
  if (
    PUBLIC_EXACT.includes(pathname) ||
    PUBLIC_PREFIXES.some(prefix => pathname.startsWith(prefix)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/icon') ||
    pathname.startsWith('/logos') ||
    pathname === '/api/health'
  ) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — this must be called to keep the session alive
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  // Check user has a complete profile with an active org
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name, company, org_id, organizations(status)')
    .eq('id', user.id)
    .single()

  // Incomplete profile or no org → onboarding
  if (!profile?.full_name || !profile?.company || !profile?.org_id) {
    if (pathname !== '/onboarding') {
      const url = request.nextUrl.clone()
      url.pathname = '/onboarding'
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  const org = profile.organizations as unknown as { status: string } | null
  if (org?.status !== 'active') {
    // Org is inactive (cancelled, suspended)
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('error', 'inactive')
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all routes except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, icon.svg (favicon files)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|icon.svg|logos/).*)',
  ],
}
