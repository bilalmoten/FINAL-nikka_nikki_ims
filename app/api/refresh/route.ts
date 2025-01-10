import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function POST() {
    try {
        // Revalidate the dashboard page
        await Promise.all([
            // Add any specific cache invalidation here if needed
            // For now, we'll just revalidate the page
        ])

        return NextResponse.json({ revalidated: true, now: Date.now() })
    } catch (err) {
        return NextResponse.json({ revalidated: false, message: "Error revalidating" }, { status: 500 })
    }
}

export const runtime = "edge" 