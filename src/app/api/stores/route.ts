import { NextResponse } from "next/server";
import { prisma } from "@/utils/db";

// GET: Obtener todas las tiendas
export async function GET() {
  try {
    const stores = await prisma.store.findMany({
      orderBy: { createdAt: "desc" }, // Las más nuevas primero
      include: {
        _count: {
          select: { gondolas: true } // Para saber cuántas góndolas tiene cada tienda
        },
        gondolas: {
          include: {
            shelves: {
              include: {
                products: {
                  include: {
                    layers: {
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
    
    return NextResponse.json({ success: true, data: stores }, { status: 200 });
  } catch (error) {
    console.error("Error obteniendo tiendas:", error);
    return NextResponse.json({ error: "Error al cargar las tiendas" }, { status: 500 });
  }
}

// POST: Crear una nueva tienda (con soporte opcional para clonar distribución de otra tienda)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, customId, cloneFromStoreId } = body;

    if (!name || name.trim() === "") {
      return NextResponse.json({ error: "El nombre de la tienda es obligatorio" }, { status: 400 });
    }

    let storeId = undefined;
    if (customId && customId.trim() !== "") {
      storeId = "store-" + customId.trim();
      
      // Validar si ya existe una tienda con ese ID
      const existing = await prisma.store.findUnique({
        where: { id: storeId }
      });
      if (existing) {
        return NextResponse.json({ error: "Ya existe una tienda con este ID" }, { status: 400 });
      }
    }

    // Realizar la creación de la tienda y la copia de góndolas en una transacción atómica
    const newStore = await prisma.$transaction(async (tx) => {
      const store = await tx.store.create({
        data: {
          id: storeId,
          name: name.trim(),
        },
      });

      if (cloneFromStoreId) {
        const sourceGondolas = await tx.gondola.findMany({
          where: { storeId: cloneFromStoreId },
          include: {
            shelves: {
              include: {
                products: {
                  include: {
                    layers: true
                  }
                }
              }
            }
          }
        });

        for (const g of sourceGondolas) {
          await tx.gondola.create({
            data: {
              storeId: store.id,
              name: g.name,
              aisle: g.aisle,
              category: g.category,
              description: g.description,
              type: g.type,
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
              shelves: {
                create: g.shelves.map((shelf) => ({
                  index: shelf.index,
                  y: shelf.y,
                  type: shelf.type,
                  hookSpacing: shelf.hookSpacing,
                  depth: shelf.depth,
                  products: {
                    create: shelf.products.map((placement) => ({
                      x: placement.x,
                      hookIndex: placement.hookIndex,
                      layers: {
                        create: placement.layers.map((layer) => ({
                          index: layer.index,
                          facings: layer.facings,
                          orientation: layer.orientation,
                          productId: layer.productId
                        }))
                      }
                    }))
                  }
                }))
              }
            }
          });
        }
      }

      return store;
    });

    return NextResponse.json({ success: true, data: newStore }, { status: 201 });
  } catch (error) {
    console.error("Error creando tienda:", error);
    return NextResponse.json({ error: "Error al crear la tienda" }, { status: 500 });
  }
}
