import { NextResponse } from "next/server";
import { prisma } from "@/utils/db";

// GET: Obtener una tienda específica con sus góndolas
export async function GET(
  request: Request,
  { params }: { params: { storeId: string } }
) {
  try {
    const { storeId } = params;
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      include: {
        gondolas: {
          include: {
            shelves: {
              orderBy: { y: 'asc' },
              include: {
                products: {
                  orderBy: { x: 'asc' },
                  include: {
                    layers: {
                      orderBy: { index: 'asc' },
                      include: {
                        product: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!store) {
      return NextResponse.json({ error: "Tienda no encontrada" }, { status: 404 });
    }

    // Transformamos para que el frontend (que esperaba 'library') no se rompa de golpe
    const formattedStore = {
      ...store,
      library: store.gondolas.map(g => ({
        ...g,
        config: {
          type: g.type || "pared",
          width: g.width,
          height: g.height,
          depth: g.depth,
          numShelves: g.numShelves,
          gapBetweenShelves: g.gapBetweenShelves,
          baseHeight: g.baseHeight,
          shelfThickness: g.shelfThickness,
          shelfDepth: g.shelfDepth,
          shelfWidth: g.shelfWidth,
          autoPack: g.autoPack,
          shelves: g.shelves
        }
      }))
    };

    return NextResponse.json({ success: true, data: formattedStore }, { status: 200 });
  } catch (error) {
    console.error("Error obteniendo tienda:", error);
    return NextResponse.json({ error: "Error al cargar la tienda" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { storeId: string } }
) {
  try {
    const { storeId } = params;

    // Al tener onDelete: Cascade en el schema de Prisma, 
    // borrar la tienda también borrará automáticamente todas sus góndolas, estantes y productos!
    await prisma.store.delete({
      where: { id: storeId },
    });

    return NextResponse.json({ success: true, message: "Tienda eliminada correctamente" }, { status: 200 });
  } catch (error) {
    console.error("Error eliminando tienda:", error);
    return NextResponse.json({ error: "Error al eliminar la tienda" }, { status: 500 });
  }
}

// PUT: Actualizar el nombre de una tienda
export async function PUT(
  request: Request,
  { params }: { params: { storeId: string } }
) {
  try {
    const { storeId } = params;
    const body = await request.json();
    const { name } = body;

    if (!name || name.trim() === "") {
      return NextResponse.json({ error: "El nombre no puede estar vacío" }, { status: 400 });
    }

    const updatedStore = await prisma.store.update({
      where: { id: storeId },
      data: { name: name.trim() },
    });

    return NextResponse.json({ success: true, data: updatedStore }, { status: 200 });
  } catch (error) {
    console.error("Error actualizando tienda:", error);
    return NextResponse.json({ error: "Error al actualizar la tienda" }, { status: 500 });
  }
}
