import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({
    request: {
      headers: req.headers,
    },
  });

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

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const path = req.nextUrl.pathname;

  // Statik dosyaları, API rotalarını ve Next.js sistem dosyalarını taramadan muaf tut (Performans için)
  if (
    path.startsWith("/_next") ||
    path.startsWith("/favicon.ico") ||
    path.match(/\.(png|jpg|jpeg|gif|svg)$/)
  ) {
    return res;
  }

  const isPublicPath = path.startsWith("/login") || path.startsWith("/terminal/login");

  // 1. GİRİŞ YAPMAMIŞ KULLANICI KONTROLÜ (Tüm Sistem Kapalı Konumda)
  if (!session && !isPublicPath) {
    // Hangi portaldan (Web veya Terminal) girmeye çalıştığını tespit et ve doğru Login'e şutla
    if (path.startsWith("/terminal")) {
      return NextResponse.redirect(new URL("/terminal/login", req.url));
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // 2. GİRİŞ YAPMIŞ KULLANICI ve 72 SAAT KURALI (Zorunlu Re-Login)
  if (session) {
    const authTimeCookie = req.cookies.get("wms_session_timestamp");
    const MAX_SESSION_AGE = 72 * 60 * 60 * 1000; // Tam 3 Gün (Milisaniye bazında)

    if (!authTimeCookie) {
      // Yeni giriş yapılmış. Sistem saatini güvenli httpOnly çerezine damgala.
      res.cookies.set("wms_session_timestamp", Date.now().toString(), {
        maxAge: 72 * 60 * 60,
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
      });
    } else {
      // Çerez mevcut, yaşını hesapla
      const sessionAge = Date.now() - parseInt(authTimeCookie.value);
      if (sessionAge > MAX_SESSION_AGE) {
        // 3 GÜN DOLDU! Supabase session'ı imha et, damgayı sil ve sisteme yeniden girişi zorunlu kıl.
        await supabase.auth.signOut();
        res.cookies.delete("wms_session_timestamp");
        return NextResponse.redirect(new URL("/login?reason=timeout", req.url));
      }
    }

    // Giriş yapmış bir personel yanlışlıkla veya elle login rotalarına giderse onu sistemin içine geri çek
    if (isPublicPath) {
      if (path.startsWith("/terminal/login")) {
        return NextResponse.redirect(new URL("/terminal/menu", req.url));
      }
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  return res;
}

// ZIRH MATRİSİ: Tarayıcının uğrayacağı her yolu izle ve middleware'den geçir.
export const config = {
  matcher: [
    /*
     * Tüm dizinleri kilitliyoruz. Sadece performans için _next ve statik dosyaları hariç bırakıyoruz.
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};