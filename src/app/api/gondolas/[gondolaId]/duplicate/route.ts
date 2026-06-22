import { NextResponse } from "next/server";
import { prisma } from "@/utils/db";

export async function POST(
  request: Request,
  { params }: { params: { gondolaId: string } }
) {
  try {
    const { gondolaId } = params;

    // 1. Obtener la góndola original con toda su jerarquía
    const originalGondola = await prisma.gondola.findUnique({
      where: { id: gondolaId },
      include: {
        shelves: {
          include: {
            products: {
              include: {
                layers: true,
              },
            },
          },
        },
      },
    });

    if (!originalGondola) {
      return NextResponse.json({ error: "Góndola original no encontrada" }, { status: 404 });
    }

    // 2. Crear la copia profunda usando transacciones
    const duplicatedGondola = await prisma.gondola.create({
      data: {
        storeId: originalGondola.storeId,
        name: `${originalGondola.name} (Copia)`,
        aisle: originalGondola.aisle,
        category: originalGondola.category,
        description: originalGondola.description,
        type: originalGondola.type,
        width: originalGondola.width,
        height: originalGondola.height,
        depth: originalGondola.depth,
        numShelves: originalGondola.numShelves,
        gapBetweenShelves: originalGondola.gapBetweenShelves,
        baseHeight: originalGondola.baseHeight,
        shelfThickness: originalGondola.shelfThickness,
        shelfDepth: originalGondola.shelfDepth,
        shelfWidth: originalGondola.shelfWidth,
        autoPack: originalGondola.autoPack,
        
        // Copiar los estantes (omitiendo los IDs originales)
        shelves: {
          create: originalGondola.shelves.map((shelf) => ({
            index: shelf.index,
            y: shelf.y,
            type: shelf.type,
            hookSpacing: shelf.hookSpacing,
            depth: shelf.depth,
            
            // Copiar los productos del estante
            products: {
              create: shelf.products.map((placement) => ({
                x: placement.x,
                hookIndex: placement.hookIndex,
                
                // Copiar las capas del producto
                layers: {
                  create: placement.layers.map((layer) => ({
                    index: layer.index,
                    facings: layer.facings,
                    orientation: layer.orientation,
                    product: { connect: { id: layer.productId } }
                  }))
                }
              }))
            }
          }))
        }
      }
    });

    return NextResponse.json({ success: true, data: duplicatedGondola }, { status: 200 });
  } catch (error) {
    console.error("Error duplicando góndola:", error);
    return NextResponse.json({ error: "Error al duplicar la góndola" }, { status: 500 });
  }
}
