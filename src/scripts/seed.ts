import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando inyección del Administrador...");

  // Revisar si ya existe el admin
  const existingAdmin = await prisma.user.findUnique({
    where: { username: "admin" },
  });

  if (existingAdmin) {
    console.log("⚠️ El usuario 'admin' ya existe en la base de datos.");
    return;
  }

  // Encriptar la contraseña (NUNCA GUARDAR admin123.. EN TEXTO PLANO)
  const hashedPassword = await bcrypt.hash("admin123..", 10);

  // Crear el usuario maestro
  const admin = await prisma.user.create({
    data: {
      username: "admin",
      password: hashedPassword,
      role: "admin",
    },
  });

  console.log("✅ ¡Administrador creado exitosamente con credenciales seguras!");
}

main()
  .catch((e) => {
    console.error("❌ Error creando el usuario:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
