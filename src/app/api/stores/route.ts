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

// POST: Crear una nueva tienda
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name } = body;

    if (!name || name.trim() === "") {
      return NextResponse.json({ error: "El nombre de la tienda es obligatorio" }, { status: 400 });
    }

    const newStore = await prisma.store.create({
      data: {
        name: name.trim(),
      },
    });

    return NextResponse.json({ success: true, data: newStore }, { status: 201 });
  } catch (error) {
    console.error("Error creando tienda:", error);
    return NextResponse.json({ error: "Error al crear la tienda" }, { status: 500 });
  }
}
