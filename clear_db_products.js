const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Conectando a SQL Server...");
  try {
    console.log("Limpiando colocaciones de productos en estantes (ProductLayer y ProductPlacement)...");
    // 1. Eliminar todas las capas colocadas en estantes
    await prisma.productLayer.deleteMany({});
    
    // 2. Eliminar todas las colocaciones
    await prisma.productPlacement.deleteMany({});

    // 3. Eliminar todos los productos del catálogo
    const deleted = await prisma.product.deleteMany({});
    console.log(`\x1b[32m¡Éxito! Se eliminaron ${deleted.count} productos de la base de datos.\x1b[0m`);
  } catch (error) {
    console.error("\x1b[31mError al limpiar las tablas de productos:\x1b[0m", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
