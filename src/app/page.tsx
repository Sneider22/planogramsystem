"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Page() {
  const router = useRouter();

  useEffect(() => {
    const auth = localStorage.getItem("locatel_auth");
    if (auth === "true") {
      router.replace("/stores");
    } else {
      router.replace("/login");
    }
  }, [router]);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#f3f4f6]">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#009639] border-t-transparent"></div>
        <p className="text-zinc-500 text-sm font-medium animate-pulse">Redirigiendo...</p>
      </div>
    </div>
  );
}
