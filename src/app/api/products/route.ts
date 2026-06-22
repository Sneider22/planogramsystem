import { NextResponse } from "next/server";
import { prisma } from "@/utils/db";

// Helper to generate a nice distinct color based on category and SKU
function getColorByProduct(category: string, sku: string): string {
  const normalized = `${category || "General"}-${sku || "Product"}`.trim().toLowerCase();
  
  // A palette of premium, harmonious pastel/distinct colors
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
    const products = await prisma.product.findMany({
      orderBy: { name: "asc" }
    });
    return NextResponse.json({ success: true, data: products }, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching products:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { products } = body;

    if (!Array.isArray(products)) {
      return NextResponse.json({ success: false, error: "El cuerpo de la petición debe contener un arreglo de productos." }, { status: 400 });
    }

    let createdCount = 0;
    let updatedCount = 0;
    const errors: string[] = [];

    // Process all products in a transaction or sequential upserts
    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      const rowNum = i + 2; // Row offset for Excel readability

      // 1. Mandatory validations
      if (!p.sku || typeof p.sku !== "string" || !p.sku.trim()) {
        errors.push(`Fila ${rowNum}: SKU es obligatorio y no puede estar vacío.`);
        continue;
      }
      if (!p.name || typeof p.name !== "string" || !p.name.trim()) {
        errors.push(`Fila ${rowNum} (SKU: ${p.sku}): Nombre de producto es obligatorio.`);
        continue;
      }
      if (!p.category || typeof p.category !== "string" || !p.category.trim()) {
        errors.push(`Fila ${rowNum} (SKU: ${p.sku}): Categoría es obligatoria.`);
        continue;
      }

      // Convert dimensions to float
      const width = parseFloat(p.width);
      const height = parseFloat(p.height);
      const depth = parseFloat(p.depth);
      const price = parseFloat(p.price !== undefined ? p.price : 0);

      if (isNaN(width) || width <= 0) {
        errors.push(`Fila ${rowNum} (SKU: ${p.sku}): El ancho debe ser un número mayor a 0.`);
        continue;
      }
      if (isNaN(height) || height <= 0) {
        errors.push(`Fila ${rowNum} (SKU: ${p.sku}): El alto debe ser un número mayor a 0.`);
        continue;
      }
      if (isNaN(depth) || depth <= 0) {
        errors.push(`Fila ${rowNum} (SKU: ${p.sku}): La longitud debe ser un número mayor a 0.`);
        continue;
      }
      if (isNaN(price) || price < 0) {
        errors.push(`Fila ${rowNum} (SKU: ${p.sku}): El costo debe ser un número igual o mayor a 0.`);
        continue;
      }

      // 2. Resolve optional fields
      const brand = p.brand ? String(p.brand).trim() : "Genérico";
      const department = p.department ? String(p.department).trim() : null;
      const subcategory = p.subcategory ? String(p.subcategory).trim() : null;
      const providerCode = p.providerCode ? String(p.providerCode).trim() : null;
      const provider = p.provider ? String(p.provider).trim() : null;

      // Color selection (use hash color based on category + SKU)
      const color = getColorByProduct(p.category, p.sku);

      try {
        // Find existing product by SKU
        const existing = await prisma.product.findUnique({
          where: { sku: p.sku.trim() }
        });

        if (existing) {
          await prisma.product.update({
            where: { sku: p.sku.trim() },
            data: {
              name: p.name.trim(),
              brand,
              department,
              subcategory,
              providerCode,
              provider,
              width,
              height,
              depth,
              price,
              color,
              category: p.category.trim()
            }
          });
          updatedCount++;
        } else {
          await prisma.product.create({
            data: {
              sku: p.sku.trim(),
              name: p.name.trim(),
              brand,
              department,
              subcategory,
              providerCode,
              provider,
              width,
              height,
              depth,
              price,
              color,
              category: p.category.trim()
            }
          });
          createdCount++;
        }
      } catch (err: any) {
        errors.push(`Fila ${rowNum} (SKU: ${p.sku}): Error al guardar en base de datos. ${err.message || err}`);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        createdCount,
        updatedCount,
        errors
      }
    }, { status: 200 });

  } catch (error: any) {
    console.error("Error bulk upserting products:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
