import { redirect } from 'next/navigation'

// /invite?code=FRIEND2026 now redirects to /login?code=FRIEND2026
// All invite logic lives in the login page
export default async function InvitePage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; invite?: string }>
}) {
  const params = await searchParams
  const code = params.code || params.invite || ''
  redirect(code ? `/login?code=${encodeURIComponent(code)}` : '/login')
}
