import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({
    request: {
      headers: req.headers,
    },
  });

  const path = req.nextUrl.pathname;

  // 1. STATİK DOSYALAR VE API İSTİSNALARI (Performans)
  if (
    path.startsWith("/_next") ||
    path.startsWith("/favicon.ico") ||
    path.match(/\.(png|jpg|jpeg|gif|svg)$/)
  ) {
    return res;
  }

  // ==========================================
  // 2. SAHA PERSONELİ (PORTAL) ZIRHI VE BYPASS
  // ==========================================
  // Bu rotalar Supabase Auth duvarına girmeden kendi çereziyle (wms_portal_session) çalışır.
  if (path.startsWith("/portal")) {
    if (path === "/portal/login") {
      return res; // Login sayfasına erişim serbest
    }

    // Portal ana sayfasına çerezsiz girmeye çalışanları portal login'e at
    const portalSession = req.cookies.get("wms_portal_session");
    if (!portalSession) {
      return NextResponse.redirect(new URL("/portal/login", req.url));
    }
    
    return res; // Çerezi varsa Supabase kontrolüne sokmadan doğrudan içeri al
  }

  // ==========================================
  // 3. YÖNETİCİ / MERKEZ KADRO SUPABASE ZIRHI
  // ==========================================
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({
            request: {
              headers: req.headers,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Supabase ES256 JWTs can be verified with cached JWKS. Unlike getUser(),
  // getClaims() does not require a /auth/v1/user HTTP request per page hit.
  // Sensitive Server Actions still call getUser() to check live sessions.
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const user = !claimsError && claimsData?.claims?.sub ? { id: claimsData.claims.sub } : null;

  // A. HİÇ OTURUM YOKSA VEYA TOKEN GEÇERSİZ KALMIŞSA (!user)
  if (!user) {
    if (path !== "/login") {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("reason", "session_expired"); 
      return NextResponse.redirect(loginUrl);
    }
    return res;
  }

  // B. YÖNETİCİ OTURUMU VARSA VE GEÇERLİYSE (user)
  if (user) {
    const authTimeCookie = req.cookies.get("wms_session_timestamp");
    const MAX_SESSION_AGE = 72 * 60 * 60 * 1000; // 3 Gün (Milisaniye)

    if (authTimeCookie) {
      const sessionAge = Date.now() - parseInt(authTimeCookie.value);
      if (sessionAge > MAX_SESSION_AGE) {
        await supabase.auth.signOut();
        res.cookies.delete("wms_session_timestamp");
        return NextResponse.redirect(new URL("/login?reason=timeout", req.url));
      }
    }

    // KAYAN PENCERE (SLIDING WINDOW) - Aktif kullanıcı düşmez
    res.cookies.set("wms_session_timestamp", Date.now().toString(), {
      maxAge: 72 * 60 * 60, // 3 Gün (Saniye)
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    });

    // Giriş yapmış cihaz manuel olarak /login rotasına giderse onu içeri it
    if (path === "/login") {
      return NextResponse.redirect(new URL("/", req.url));
    }

    // C. ESKİ TERMİNAL ZIRHI (Şu anki operasyonda kullanılmaya devam edebilir)
    if (path.startsWith("/terminal")) {
      if (path === "/terminal/login") {
        return res;
      }
      if (!req.nextUrl.searchParams.has("empId")) {
        return NextResponse.redirect(new URL("/terminal/login", req.url));
      }
    }
  }

  return res;
}

// ZIRH MATRİSİ
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};