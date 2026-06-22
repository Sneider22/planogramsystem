import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Locatel Planogram Builder Pro",
  description: "Sistema Avanzado de Gestión y Simulación de Góndolas 3D",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-background text-foreground antialiased selection:bg-primary selection:text-white overflow-hidden h-screen w-screen">
        {children}
      </body>
    </html>
  );
}
