import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function GET() {
    const cookieStore = cookies()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value
                },
            },
        }
    )

    const { data: { session }, error } = await supabase.auth.getSession()

    if (error || !session) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    return NextResponse.json({ message: "Session refreshed" })
}

export const runtime = "edge" 