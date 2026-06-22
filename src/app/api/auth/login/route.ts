import { NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import bcrypt from "bcryptjs";
import { signJWT } from "@/utils/jwt";

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "default_locatel_access_secret_key_2026";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "default_locatel_refresh_secret_key_2026";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "Usuario y contraseña son requeridos" },
        { status: 400 }
      );
    }

    console.log("=========================================");
    console.log("🔥 ¡PRUEBA DE VIDA DEL BACKEND! 🔥");
    console.log(`El usuario '${username}' está intentando entrar.`);
    console.log("Consultando la base de datos SQL Server...");
    console.log("=========================================");

    // 1. Buscar al usuario en la base de datos
    const user = await prisma.user.findUnique({
      where: { username: username.toLowerCase() },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Credenciales incorrectas" },
        { status: 401 }
      );
    }

    // 2. Comparar la contraseña ingresada con la encriptada
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return NextResponse.json(
        { error: "Credenciales incorrectas" },
        { status: 401 }
      );
    }

    // 3. Generar Access Token (15 minutos) y Refresh Token (7 días)
    const payload = { id: user.id, username: user.username, role: user.role };
    const accessToken = await signJWT(payload, JWT_ACCESS_SECRET, 900); // 15 mins
    const refreshToken = await signJWT(payload, JWT_REFRESH_SECRET, 7 * 24 * 60 * 60); // 7 days

    // 4. Crear respuesta de éxito y adjuntar cookies
    const response = NextResponse.json(
      { 
        success: true, 
        user: { id: user.id, username: user.username, role: user.role } 
      },
      { status: 200 }
    );

    // Cookie de Access Token
    response.cookies.set("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 900,
      path: "/",
    });

    // Cookie de Refresh Token
    response.cookies.set("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    return response;

  } catch (error) {
    console.error("Error en el login:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
