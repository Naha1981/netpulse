import { NextResponse, type NextRequest } from 'next/server';
export function proxy(request:NextRequest){if(['/dashboard','/onboarding'].some(p=>request.nextUrl.pathname.startsWith(p))&&!request.cookies.get('np_session'))return NextResponse.redirect(new URL('/login',request.url));return NextResponse.next();}
export const config={matcher:['/dashboard/:path*','/onboarding/:path*']};
