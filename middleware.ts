import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  // 1. Orijinal isteği klonlayıp yanıt nesnesini hazırlıyoruz
  let res = NextResponse.next({
    request: {
      headers: req.headers,
    },
  });

  // 2. SADECE Edge uyumlu @supabase/ssr istemcisini kuruyoruz
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

  // 3. Kullanıcı oturumunu Edge üzerinden güvenli şekilde denetliyoruz
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const isManagementPath = req.nextUrl.pathname.startsWith("/management");
  
  // 4. Yetkisiz girişleri Login sayfasına geri şutluyoruz
  if (!session && isManagementPath) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return res;
}

// 5. Middleware'in sadece bu yollarda tetiklenmesini sağlayarak performansı koruyoruz
export const config = {
  matcher: [
    "/management/:path*",
    "/terminal/:path*",
  ],
};