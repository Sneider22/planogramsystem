import { NextResponse } from "next/server";
import { prisma } from "@/utils/db";

// Helper to generate a nice distinct color based on category and SKU
function getColorByProduct(category: string, sku: string): string {
  const normalized = `${category || "General"}-${sku || "Product"}`.trim().toLowerCase();

  const palette = [
    "#3b82f6", // Blue
    "#ef4444", // Red
    "#10b981", // Green
    "#f59e0b", // Amber
    "#8b5cf6", // Purple
    "#ec4899", // Pink
    "#06b6d4", // Cyan
    "#f97316", // Orange
    "#14b8a6", // Teal
    "#6366f1", // Indigo
    "#a855f7", // Purple-light
    "#eab308", // Yellow
  ];

  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = normalized.charCodeAt(i) + ((hash << 5) - hash);
  }

  const index = Math.abs(hash) % palette.length;
  return palette[index];
}

export async function GET() {
  try {
    const products = await prisma.product.findMany({});

    let updatedCount = 0;
    for (const p of products) {
      const newColor = getColorByProduct(p.category, p.sku);
      if (p.color !== newColor) {
        await prisma.product.update({
          where: { id: p.id },
          data: { color: newColor }
        });
        updatedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Se actualizaron los colores de ${updatedCount} productos en la base de datos.`
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || "Error al recolorear productos"
    }, { status: 500 });
  }
}
