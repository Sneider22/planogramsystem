import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyJWT, signJWT } from "./utils/jwt";

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "default_locatel_access_secret_key_2026";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "default_locatel_refresh_secret_key_2026";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const accessToken = request.cookies.get("accessToken")?.value;
  const refreshToken = request.cookies.get("refreshToken")?.value;

  // 1. Validar el Access Token
  if (accessToken) {
    const decoded = await verifyJWT(accessToken, JWT_ACCESS_SECRET);
    if (decoded) {
      return NextResponse.next();
    }
  }

  // 2. Si el Access Token no es válido, verificar el Refresh Token
  if (refreshToken) {
    const decodedRefresh = await verifyJWT(refreshToken, JWT_REFRESH_SECRET);
    if (decodedRefresh) {
      // Regenerar el Access Token automáticamente
      const newAccessToken = await signJWT(
        { id: decodedRefresh.id, username: decodedRefresh.username, role: decodedRefresh.role },
        JWT_ACCESS_SECRET,
        900 // 15 minutos (900 segundos)
      );

      const response = NextResponse.next();
      response.cookies.set("accessToken", newAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 900,
        path: "/",
      });

      return response;
    }
  }

  // 3. Si ninguno es válido, denegar acceso
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { success: false, error: "No autorizado. Sesión expirada." },
      { status: 401 }
    );
  }

  // Redirigir a la página de login
  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}

// Configurar matcher para interceptar rutas del sistema excepto estáticos y login
export const config = {
  matcher: [
    /*
     * Intercepta todas las rutas excepto:
     * - api/auth/login
     * - login
     * - _next/static
     * - _next/image
     * - favicon.ico
     * - logo.png
     */
    "/((?!api/auth/login|login|_next/static|_next/image|favicon.ico|logo.png).*)",
  ],
};
