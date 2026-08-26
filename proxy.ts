import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';

function isAuthenticated(){
    // dummy function 
    return false;
}

function proxyLog(...messages: unknown[]){
    console.log('[proxy]', ...messages)


}

export default function proxy(request: NextRequest) {
    // console.log('[proxy]', request.nextUrl.pathname);
    const reqUrl = request.nextUrl.clone()
    if (request.nextUrl.pathname != "/auth") {
        if (!isAuthenticated()) {
            reqUrl.pathname = "/auth"
            proxyLog(reqUrl.href)
            return NextResponse.redirect(reqUrl)
        }
    }

    return NextResponse.next();
}


export const config = {
    matcher: ['/((?!api|_next/static|_next/image|.*\\.(?:png|jpg|svg|ico)$).*)'],
};