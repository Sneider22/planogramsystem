"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      const auth = localStorage.getItem("locatel_auth");
      if (auth === "true") {
        try {
          // Verificamos si realmente tenemos cookies válidas en el servidor
          const res = await fetch("/api/stores");
          if (res.ok) {
            router.push("/stores");
            return;
          }
        } catch (err) {
          // Ignorar error de red y cargar el login
        }
        // Si no tenemos cookies válidas en el servidor, limpiamos el localStorage sucio
        localStorage.removeItem("locatel_auth");
        localStorage.removeItem("locatel_user");
      }
      setIsLoading(false);
    };

    checkSession();
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        localStorage.setItem("locatel_auth", "true");
        localStorage.setItem("locatel_user", data.user.username);
        router.push("/stores");
      } else {
        setErrorMsg(data.error || "Credenciales incorrectas");
      }
    } catch (err) {
      setErrorMsg("Error de conexión con el servidor");
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#f3f4f6]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#009639] border-t-transparent"></div>
          <p className="text-zinc-500 text-sm font-medium animate-pulse">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-radial-gradient flex items-center justify-center p-6 bg-[#f3f4f6]">
      <div className="w-full max-w-[400px] bg-white/95 backdrop-blur-md border border-zinc-200/80 p-10 rounded-[24px] shadow-xl shadow-zinc-200/50">
        
        {/* Header / Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3.5 mb-4 justify-center">
            <img 
              src="/logo.png" 
              alt="Locatel Logo" 
              className="h-12 w-auto object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
          <h2 className="text-[20px] font-semibold text-zinc-800 leading-tight mb-2">
            Gestor de Planogramas
          </h2>
          <p className="text-zinc-500 text-xs font-medium">
            Ingresa tus credenciales para continuar
          </p>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="bg-red-50 border border-red-200/80 text-red-500 rounded-lg py-2.5 px-3 text-xs text-center font-semibold mb-5">
            {errorMsg}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-2">
            <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
              Usuario
            </label>
            <input
              type="text"
              placeholder="admin"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2.5 text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none focus:border-[#009639] focus:ring-2 focus:ring-[#009639]/10 transition-all font-medium"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
              Contraseña
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2.5 text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none focus:border-[#009639] focus:ring-2 focus:ring-[#009639]/10 transition-all font-medium pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-400 hover:text-zinc-600"
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-[#009639] hover:bg-[#008030] active:scale-[0.98] text-white font-semibold py-3 px-4 rounded-lg text-sm transition-all duration-200 shadow-md shadow-green-500/10 flex items-center justify-center"
          >
            Acceder
          </button>
        </form>

      </div>
    </div>
  );
}
