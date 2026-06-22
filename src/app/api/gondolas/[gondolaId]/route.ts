import { NextResponse } from "next/server";
import { prisma } from "@/utils/db";

// GET: Obtener detalles de una góndola específica
export async function GET(
  request: Request,
  { params }: { params: { gondolaId: string } }
) {
  try {
    const { gondolaId } = params;
    const gondola = await prisma.gondola.findUnique({
      where: { id: gondolaId },
      include: {
        store: true, // Incluimos la tienda para saber su nombre
        shelves: {
          orderBy: { y: 'asc' },
          include: {
            products: {
              orderBy: { x: 'asc' },
              include: {
                layers: {
                  orderBy: { index: 'asc' },
                },
              },
            },
          },
        },
      }
    });

    if (!gondola) {
      return NextResponse.json({ error: "Góndola no encontrada" }, { status: 404 });
    }

    let relatedGondolas: any[] = [];
    if (gondola.category && gondola.category.trim() !== "") {
      relatedGondolas = await prisma.gondola.findMany({
        where: {
          storeId: gondola.storeId,
          category: gondola.category,
          id: { not: gondola.id }
        },
        include: {
          shelves: {
            orderBy: { y: 'asc' },
            include: {
              products: {
                orderBy: { x: 'asc' },
                include: {
                  layers: {
                    orderBy: { index: 'asc' },
                  },
                },
              },
            },
          },
        }
      });
    }

    return NextResponse.json({ success: true, data: gondola, related: relatedGondolas }, { status: 200 });
  } catch (error) {
    console.error("Error obteniendo góndola:", error);
    return NextResponse.json({ error: "Error al obtener góndola" }, { status: 500 });
  }
}

// DELETE: Eliminar una góndola por su ID
export async function DELETE(
  request: Request,
  { params }: { params: { gondolaId: string } }
) {
  try {
    const { gondolaId } = params;

    // Al tener onDelete: Cascade en el schema de Prisma, 
    // borrar la góndola borrará también sus estantes y productos!
    await prisma.gondola.delete({
      where: { id: gondolaId },
    });

    return NextResponse.json({ success: true, message: "Góndola eliminada correctamente" }, { status: 200 });
  } catch (error) {
    console.error("Error eliminando góndola:", error);
    return NextResponse.json({ error: "Error al eliminar la góndola" }, { status: 500 });
  }
}

// PUT: Actualizar los datos de una góndola (nombre, pasillo, categoría, descripción)
export async function PUT(
  request: Request,
  { params }: { params: { gondolaId: string } }
) {
  try {
    const { gondolaId } = params;
    const body = await request.json();
    const { name, aisle, category, description } = body;

    if (!name || name.trim() === "") {
      return NextResponse.json({ error: "El nombre no puede estar vacío" }, { status: 400 });
    }

    const updatedGondola = await prisma.gondola.update({
      where: { id: gondolaId },
      data: { 
        name: name.trim(),
        aisle: aisle?.trim() || "",
        category: category?.trim() || "",
        description: description?.trim() || ""
      },
    });

    return NextResponse.json({ success: true, data: updatedGondola }, { status: 200 });
  } catch (error) {
    console.error("Error actualizando góndola:", error);
    return NextResponse.json({ error: "Error al actualizar la góndola" }, { status: 500 });
  }
}
