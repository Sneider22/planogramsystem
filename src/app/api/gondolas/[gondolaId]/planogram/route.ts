import { NextResponse } from "next/server";
import { prisma } from "@/utils/db";

export async function PUT(
  request: Request,
  { params }: { params: { gondolaId: string } }
) {
  try {
    const { gondolaId } = params;
    const body = await request.json();
    const { gondola } = body;

    if (!gondola) {
      return NextResponse.json({ error: "No se enviaron datos del planograma" }, { status: 400 });
    }

    // 1. Verificar que la góndola existe
    const existingGondola = await prisma.gondola.findUnique({
      where: { id: gondolaId },
    });

    if (!existingGondola) {
      return NextResponse.json({ error: "Góndola no encontrada" }, { status: 404 });
    }

    // 2. Transacción de Prisma para garantizar que todo se guarda o nada se guarda
    await prisma.$transaction(async (tx) => {
      // a. Actualizar metadatos y dimensiones de la góndola
      await tx.gondola.update({
        where: { id: gondolaId },
        data: {
          type: gondola.type,
          width: parseFloat(gondola.width),
          height: parseFloat(gondola.height),
          depth: parseFloat(gondola.depth),
          numShelves: parseInt(gondola.numShelves),
          gapBetweenShelves: parseFloat(gondola.gapBetweenShelves),
          baseHeight: parseFloat(gondola.baseHeight),
          shelfThickness: parseFloat(gondola.shelfThickness),
          shelfDepth: parseFloat(gondola.shelfDepth),
          shelfWidth: parseFloat(gondola.shelfWidth),
          autoPack: Boolean(gondola.autoPack),
        },
      });

      // b. Eliminar TODOS los estantes viejos (gracias al Cascade, esto elimina placements y layers)
      await tx.shelf.deleteMany({
        where: { gondolaId: gondolaId },
      });

      // c. Crear los estantes nuevos con sus productos y capas
      for (const shelf of gondola.shelves) {
        await tx.shelf.create({
          data: {
            gondolaId: gondolaId,
            index: parseInt(shelf.index),
            y: parseFloat(shelf.y),
            type: shelf.type,
            hookSpacing: shelf.hookSpacing != null ? parseFloat(shelf.hookSpacing) : null,
            depth: parseFloat(shelf.depth),
            products: {
              create: shelf.products.map((placement: any) => ({
                x: parseFloat(placement.x),
                hookIndex: placement.hookIndex != null ? parseInt(placement.hookIndex) : null,
                layers: {
                  create: placement.layers.map((layer: any, idx: number) => ({
                    index: layer.index != null ? parseInt(layer.index) : idx,
                    facings: layer.facings != null ? parseInt(layer.facings) : 1,
                    orientation: layer.orientation != null ? parseInt(layer.orientation) : 0,
                    product: { connect: { id: layer.productId } },
                  })),
                },
              })),
            },
          },
        });
      }
    });

    return NextResponse.json({ success: true, message: "Planograma guardado exitosamente" }, { status: 200 });
  } catch (error: any) {
    console.error("Error guardando planograma:", error);
    return NextResponse.json({ error: "Error de Prisma: " + (error?.message || String(error)) }, { status: 500 });
  }
}
