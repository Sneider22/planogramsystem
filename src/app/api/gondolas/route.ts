import { NextResponse } from "next/server";
import { prisma } from "@/utils/db";

// POST: Crear una nueva góndola
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { storeId, name, aisle, category, description } = body;

    if (!storeId || !name) {
      return NextResponse.json({ error: "Faltan datos obligatorios (storeId, name)" }, { status: 400 });
    }

    // Valores por defecto de una Góndola
    const numShelves = 5;
    const baseHeight = 20;
    const gapBetweenShelves = 35;
    const shelfThickness = 2;
    const shelfDepth = 40;

    // Generar estantes por defecto
    const shelvesToCreate = [];
    for (let i = 0; i < numShelves; i++) {
      const yPos = baseHeight + i * (gapBetweenShelves + shelfThickness);
      shelvesToCreate.push({
        index: i,
        y: yPos,
        type: 'plancha',
        hookSpacing: 15,
        depth: shelfDepth
      });
    }

    const newGondola = await prisma.gondola.create({
      data: {
        storeId,
        name: name.trim(),
        aisle: aisle?.trim() || "",
        category: category?.trim() || "",
        description: description?.trim() || "",
        // Medidas estándar
        type: "pared",
        width: 100,
        height: 210,
        depth: 40,
        numShelves: numShelves,
        gapBetweenShelves: gapBetweenShelves,
        baseHeight: baseHeight,
        shelfThickness: shelfThickness,
        shelfDepth: shelfDepth,
        shelfWidth: 100,
        autoPack: true,
        // Creación anidada: creamos los estantes al mismo tiempo
        shelves: {
          create: shelvesToCreate
        }
      },
      include: {
        shelves: true // Devolver la góndola con sus estantes recién creados
      }
    });

    return NextResponse.json({ success: true, data: newGondola }, { status: 201 });
  } catch (error) {
    console.error("Error creando góndola:", error);
    return NextResponse.json({ error: "Error interno al crear la góndola" }, { status: 500 });
  }
}
