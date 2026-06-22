import { NextResponse } from "next/server";
import { prisma } from "@/utils/db";

export async function GET() {
  try {
    // 1. Delete all ProductLayers
    await prisma.productLayer.deleteMany({});

    // 2. Delete all ProductPlacements
    await prisma.productPlacement.deleteMany({});

    // 3. Delete all Products
    const deleted = await prisma.product.deleteMany({});
    return NextResponse.json({
      success: true,
      message: `¡Éxito! Se limpiaron los estantes y se eliminaron ${deleted.count} productos de la base de datos.`
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || "Error al vaciar la tabla de productos"
    }, { status: 500 });
  }
}
