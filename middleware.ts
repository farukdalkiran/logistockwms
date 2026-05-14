// middleware.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // NextResponse'u oluşturuyoruz ki cookie'leri güncelleyebilelim
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Güvenlik kontrolü: getUser() auth-helpers'daki getSession()'dan çok daha güvenlidir.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Kullanıcı GİRİŞ YAPMAMIŞSA ve login sayfasında değilse -> Login'e at
  if (!user && !request.nextUrl.pathname.startsWith('/login')) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Kullanıcı GİRİŞ YAPMIŞSA ve login sayfasına gitmeye çalışıyorsa -> Ana Sayfaya (Dashboard) at
  if (user && request.nextUrl.pathname.startsWith('/login')) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

// Hangi yolların (route) middleware tarafından izleneceğini belirliyoruz
export const config = {
  matcher: [
    /*
     * Aşağıdaki yollar hariç tüm istekleri yakala:
     * - _next/static (statik dosyalar)
     * - _next/image (imaj optimizasyonu)
     * - favicon.ico (tarayıcı ikonu)
     * - svg, png, jpg, jpeg, gif, webp gibi görseller
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};