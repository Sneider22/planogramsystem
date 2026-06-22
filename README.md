# PlanogramSystem 

Plataforma empresarial de ingeniería retail orientada a la creación, gestión y visualización en tiempo real de planogramas comerciales 3D y análisis financiero de inventario.

---

## 🏗️ Arquitectura y Stack Tecnológico

El sistema ha sido estructurado con tecnologías de última generación para garantizar la escalabilidad, el alto rendimiento y la máxima fidelidad visual:

*   **Entorno de Ejecución (Runtime):** [Bun 1.1](https://bun.sh/) para operaciones ultrarrápidas, gestión eficiente de dependencias y ejecución de scripts.
*   **Framework Principal:** [Next.js 14](https://nextjs.org/) (App Router) en conjunto con **React 18** y **TypeScript** para un desarrollo estructurado y libre de errores en tiempo de compilación.
*   **Gestión de Estado Global:** [Zustand](https://github.com/pmndrs/zustand) para la manipulación y reactividad óptima del editor 3D en el cliente, evitando re-renderizados costosos.
*   **Estilos y Sistema de Diseño:** **Tailwind CSS** para una interfaz moderna, limpia, cohesiva y responsiva con la paleta de identidad corporativa de Locatel.
*   **Persistencia y ORM:** **Microsoft SQL Server 2022** acoplado mediante [Prisma ORM](https://www.prisma.io/), asegurando integridad referencial estricta y consultas optimizadas.
*   **Generadores de Reportes:** **jsPDF** (con `jspdf-autotable`) para informes técnicos vectoriales y **XLSX (SheetJS)** para hojas de cálculo financieras detalladas.

---

## 📈 Lógica de Negocio y Moneda Nacional (Bs.)

*   **Representación Monetaria:** Todos los costos, valorizaciones de góndolas, subtotales de niveles y resúmenes consolidados financieros en pantalla se representan en **Bolívares (Bs.)**.
*   **Exportación Coherente:** Tanto las descargas de reportes técnicos detallados en PDF como las hojas de cálculo consolidadas de compras generadas en Excel adoptan la nomenclatura de Bolívares (`Bs.`) y formateo numérico localizado para las columnas de costo unitario y total.

---

## Guía de Instalación y Despliegue

La solución soporta dos entornos: **Desarrollo Local** (híbrido con base de datos en Docker) y **Producción en Contenedores** (completamente Dockerizado).

### Requisitos Previos
*   [Docker Desktop](https://www.docker.com/) instalado y en ejecución.
*   [Bun](https://bun.sh/) instalado localmente (si vas a ejecutar en modo desarrollo).

---

### Opción A: Configuración para Desarrollo Local (Recomendado)

En este modo, la base de datos SQL Server corre dentro de un contenedor Docker, mientras que la aplicación web corre localmente en tu sistema operativo utilizando Bun para agilizar el desarrollo.

1.  **Levantar la Base de Datos:**
    Utiliza la plantilla de compose para iniciar únicamente la instancia de SQL Server:
    ```bash
    docker compose up db_planogramas -d
    ```
    *Nota: La base de datos estará disponible externamente en el puerto `14333`.*

2.  **Configurar Variables de Entorno:**
    Duplica el archivo de plantilla `.env` y asegúrate de que apunte al puerto externo de la base de datos:
    ```env
    DATABASE_URL="sqlserver://127.0.0.1:14333;database=PlanogramaDB;user=sa;password=Planograma2026Db;encrypt=true;trustServerCertificate=true;"
    ```

3.  **Instalar Dependencias:**
    Descarga los paquetes necesarios utilizando Bun:
    ```bash
    bun install
    ```

4.  **Sincronizar Esquema y Cliente Prisma:**
    Genera el cliente Prisma y empuja el esquema relacional a la base de datos de SQL Server:
    ```bash
    bun run prisma:generate
    bun run prisma:db
    ```

5.  **Iniciar Servidor de Desarrollo:**
    Lanza el servidor de Next.js localmente:
    ```bash
    bun run dev
    ```
    Accede al sistema desde [http://localhost:3000](http://localhost:3000).

---

### Opción B: Despliegue Completo en Producción (Docker Compose)

Para desplegar la aplicación completa (Base de datos SQL Server + Servidor Web de Producción Next.js) en contenedores Docker autónomos:

1.  **Construir y compilar la Imagen Web:**
    Compila la imagen local de Next.js ejecutando Docker en la raíz del proyecto:
    ```bash
    docker build -t planograma:v0.1.0 -f ./docker/Dockerfile .
    ```

2.  **Levantar el Stack de Producción:**
    Inicia todos los servicios configurados en el orquestador:
    ```bash
    docker compose up -d
    ```

3.  **Monitorear Contenedores:**
    Asegúrate de que los contenedores estén activos:
    ```bash
    docker compose ps
    ```
    La aplicación estará disponible de forma unificada en el puerto `3000`.

---

## 🔒 Seguridad y Gitignore (Políticas de Repositorio)

Para evitar la fuga accidental de credenciales, datos de pruebas o configuraciones de entornos específicos en repositorios públicos/privados (como GitHub), se implementa una política estricta a través del archivo `.gitignore`:

*   **Exclusión de Credenciales:** Los archivos `.env`, `.env.db` y cualquier variante de configuración local están totalmente ignorados.
*   **Aislamiento de Docker Local:** El archivo `docker-compose.yml` (que contiene credenciales del usuario de base de datos `sa`) está ignorado de forma predeterminada. Para la colaboración en el equipo se provee el archivo plantilla `docker-compose.example.yml`.
*   **Ignorado de Archivos de Claves:** Se bloquea automáticamente la subida de llaves privadas (`*.key`), certificados (`*.cert`, `*.pem`, `*.pfx`) y archivos de texto planos con credenciales (`credentials.txt`).
*   **Limpieza de Ejecución:** Carpetas del compilador de Next.js (`.next/`), módulos instalados (`node_modules/`, `.bun/`) y logs de error (`*.log`) no se incluyen en el control de versiones.

---

## 📂 Estructura del Código Fuente

```text
/
├── prisma/                  # Esquema Prisma relacional e histórico de migraciones
├── docker/                  # Configuración de Dockerfile optimizado para producción con Alpine
├── public/                  # Recursos estáticos (Logos, imágenes, iconos)
├── src/
│   ├── app/                 # Enrutamiento de Next.js (App Router) y APIs REST
│   ├── components/          # Componentes visuales y lógica modular del Planograma
│   │   ├── LoginPage.tsx      # Lógica y maquetación de control de acceso
│   │   ├── StoresDashboard.tsx# Vista y gestión de sucursales a nivel comercial
│   │   ├── StoreDetails.tsx   # Reporte consolidado financiero y de inventarios
│   │   └── PlanogramEditor.tsx# Editor visual 3D interactivo y lógica de estanterías
│   ├── store/               # Stores de Zustand para estado global reactivo
│   ├── types/               # Tipos de TypeScript e interfaces del dominio
│   └── utils/               # Helpers matemáticos, colisiones 3D y lógica de exportación
├── .gitignore               # Configuración de exclusiones de Git (Seguridad)
├── package.json             # Manifiesto de scripts y dependencias
└── README.md                # Documentación oficial de la plataforma
```

---
