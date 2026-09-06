import { getSessionCookieOptions } from "@/lib/auth/session/config";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session/cookie";
import { NextRequest, NextResponse } from "next/server";


export async function GET (request: NextRequest) {
    const response = NextResponse.redirect(new URL("/auth", request.url ))
    response.cookies.set(SESSION_COOKIE_NAME, "", {
        ...getSessionCookieOptions(new Date(0)),
        maxAge: 0
    })
    return response;
}