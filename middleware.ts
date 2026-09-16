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

  // KRİTİK: getSession yerine getUser ile sunucu bazlı eşzamanlı doğrulama
  const { data: { user } } = await supabase.auth.getUser();

  const path = req.nextUrl.pathname;

  // Statik dosyaları, API rotalarını ve Next.js sistem dosyalarını taramadan muaf tut (Performans)
  if (
    path.startsWith("/_next") ||
    path.startsWith("/favicon.ico") ||
    path.match(/\.(png|jpg|jpeg|gif|svg)$/)
  ) {
    return res;
  }

  // 1. HİÇ OTURUM YOKSA VEYA TOKEN GEÇERSİZ KALMIŞSA (!user)
  if (!user) {
    // Güvenlik Duvarı: Sadece Login rotasına izin ver (Mobil terminal iptal edildi)
    if (path !== "/login") {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("reason", "session_expired"); 
      return NextResponse.redirect(loginUrl);
    }
    return res;
  }

  // 2. YÖNETİCİ OTURUMU VARSA VE GEÇERLİYSE (user)
  if (user) {
    const authTimeCookie = req.cookies.get("wms_session_timestamp");
    const MAX_SESSION_AGE = 72 * 60 * 60 * 1000; // 3 Gün (Milisaniye)

    // Ağer daha önce bir cookie atandıysa, süresini kontrol et
    if (authTimeCookie) {
      const sessionAge = Date.now() - parseInt(authTimeCookie.value);
      // Kullanıcı 3 gün boyunca SİSTEMDE HİÇBİR İŞLEM YAPMADIYSA at
      if (sessionAge > MAX_SESSION_AGE) {
        await supabase.auth.signOut();
        res.cookies.delete("wms_session_timestamp");
        return NextResponse.redirect(new URL("/login?reason=timeout", req.url));
      }
    }

    // YENİ: SLIDING WINDOW (KAYAN PENCERE) MOTORU
    // Kullanıcı içeride ve işlem yapıyorsa (Middleware tetiklendiyse), süreyi şu andan itibaren 72 saat sonraya uzat!
    // Bu sayede aktif çalışan personel ASLA sistemden düşmez.
    res.cookies.set("wms_session_timestamp", Date.now().toString(), {
      maxAge: 72 * 60 * 60, // 3 Gün (Saniye)
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    });

    // A. Web Login Kalkanı
    // Giriş yapmış cihaz manuel olarak /login rotasına giderse onu Management paneline it.
    if (path === "/login") {
      return NextResponse.redirect(new URL("/", req.url));
    }

    // B. Terminal Zırhı ve Çapraz Geçiş Denetimi
    if (path.startsWith("/terminal")) {
      // Terminal Login sayfasına erişimi SERBEST bırak. (Personelin ID barkodunu okutabilmesi için)
      if (path === "/terminal/login") {
        return res;
      }

      // EĞER personel login olmadan (URL'de empId parametresi olmadan) menüye veya operasyon ekranlarına 
      // direkt girmeye çalışırsa, sistem onu /terminal/login ekranına geri fırlatır.
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