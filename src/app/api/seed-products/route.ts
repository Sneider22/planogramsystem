import { NextResponse } from "next/server";
import { prisma } from "@/utils/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const INITIAL_PRODUCTS = [
      // Farmacia
      { id: 'P001', sku: 'SAP-FAR01', name: 'Paracetamol 500mg (10 Tab)', width: 10, height: 6, depth: 2, price: 1.20, color: '#3b82f6', category: 'Farmacia' },
      { id: 'P002', sku: 'SAP-FAR02', name: 'Ibuprofeno 400mg (10 Tab)', width: 11, height: 7, depth: 2, price: 1.80, color: '#ef4444', category: 'Farmacia' },
      { id: 'P003', sku: 'SAP-FAR03', name: 'Jarabe Antigripal 120ml', width: 6, height: 14, depth: 6, price: 4.50, color: '#10b981', category: 'Farmacia' },
      { id: 'P004', sku: 'SAP-FAR04', name: 'Alcohol Antiséptico 70% 500ml', width: 8, height: 18, depth: 8, price: 2.10, color: '#06b6d4', category: 'Farmacia' },
      { id: 'P005', sku: 'SAP-FAR05', name: 'Curitas Band-Aid (Caja 30)', width: 8, height: 12, depth: 3, price: 1.50, color: '#f59e0b', category: 'Farmacia' },
      { id: 'P006', sku: 'SAP-FAR06', name: 'Venda Elástica 10cm x 5m', width: 7, height: 7, depth: 7, price: 3.20, color: '#d97706', category: 'Farmacia' },
      { id: 'P007', sku: 'SAP-FAR07', name: 'Alcohol 70% 500ml', width: 10, height: 6, depth: 2, price: 1.20, color: '#3b82f6', category: 'Farmacia' },
      { id: 'P008', sku: 'SAP-FAR08', name: 'Ácido Acetilsalicílico 500mg (10 Tab)', width: 11, height: 7, depth: 2, price: 1.80, color: '#ef4444', category: 'Farmacia' },
      { id: 'P009', sku: 'SAP-FAR09', name: 'Venda Elástica 10cm x 5m', width: 6, height: 14, depth: 6, price: 4.50, color: '#10b981', category: 'Farmacia' },
      { id: 'P010', sku: 'SAP-FAR10', name: 'Crema Antitranspirante', width: 8, height: 18, depth: 8, price: 2.10, color: '#06b6d4', category: 'Farmacia' },
      { id: 'P011', sku: 'SAP-FAR11', name: 'Gel de Ducha', width: 8, height: 12, depth: 3, price: 1.50, color: '#f59e0b', category: 'Farmacia' },
      // Cuidado Personal
      { id: 'P012', sku: 'SAP-CUI01', name: 'Champú Herbal Locatel 400ml', width: 7, height: 21, depth: 5, price: 5.40, color: '#047857', category: 'Cuidado Personal' },
      { id: 'P013', sku: 'SAP-CUI02', name: 'Acondicionador Brillo 400ml', width: 7, height: 21, depth: 5, price: 5.60, color: '#10b981', category: 'Cuidado Personal' },
      { id: 'P014', sku: 'SAP-CUI03', name: 'Crema Dental Triple Acción', width: 18, height: 4, depth: 4, price: 2.30, color: '#dc2626', category: 'Cuidado Personal' },
      { id: 'P015', sku: 'SAP-CUI04', name: 'Enjuague Bucal Menta 500ml', width: 9, height: 22, depth: 6, price: 6.90, color: '#0ea5e9', category: 'Cuidado Personal' },
      { id: 'P016', sku: 'SAP-CUI05', name: 'Desodorante Invisible Roll-on', width: 5, height: 11, depth: 5, price: 3.50, color: '#64748b', category: 'Cuidado Personal' },
      { id: 'P017', sku: 'SAP-CUI06', name: 'Crema Corporal Dermacare 200ml', width: 8, height: 16, depth: 4, price: 8.90, color: '#f1f5f9', category: 'Cuidado Personal' },
      // Nutrición & Suplementos
      { id: 'P018', sku: 'SAP-NUT01', name: 'Vitamina C Efervescente 1000mg', width: 4, height: 14, depth: 4, price: 6.50, color: '#f97316', category: 'Nutrición & Suplementos' },
      { id: 'P019', sku: 'SAP-NUT02', name: 'Omega 3 Premium (60 Cáps)', width: 6, height: 12, depth: 6, price: 14.90, color: '#eab308', category: 'Nutrición & Suplementos' },
      { id: 'P020', sku: 'SAP-NUT03', name: 'Calcio + Vitamina D (90 Tab)', width: 7, height: 13, depth: 7, price: 12.50, color: '#cbd5e1', category: 'Nutrición & Suplementos' },
      { id: 'P021', sku: 'SAP-NUT04', name: 'Complejo B Forte (30 Cáps)', width: 5, height: 10, depth: 5, price: 9.80, color: '#991b1b', category: 'Nutrición & Suplementos' },
      { id: 'P022', sku: 'SAP-NUT05', name: 'Proteína Whey Fit 500g', width: 14, height: 22, depth: 14, price: 29.90, color: '#111827', category: 'Nutrición & Suplementos' },
      // Mamá & Bebé
      { id: 'P023', sku: 'SAP-BEB01', name: 'Pañales Bebé Confort (Talla G)', width: 22, height: 26, depth: 12, price: 18.50, color: '#a5f3fc', category: 'Mamá & Bebé' },
      { id: 'P024', sku: 'SAP-BEB02', name: 'Toallitas Húmedas Sin Alcohol', width: 18, height: 5, depth: 10, price: 2.80, color: '#ecfeff', category: 'Mamá & Bebé' },
      { id: 'P025', sku: 'SAP-BEB03', name: 'Crema Antipañalitis Óxido Zinc', width: 14, height: 4, depth: 4, price: 4.90, color: '#fbcfe8', category: 'Mamá & Bebé' },
      { id: 'P026', sku: 'SAP-BEB04', name: 'Fórmula Infantil Etapa 1 400g', width: 10, height: 12, depth: 10, price: 11.20, color: '#fef08a', category: 'Mamá & Bebé' },
      // Bebidas & Snacks
      { id: 'P027', sku: 'SAP-ALM01', name: 'Barra de Proteína Avena & Miel', width: 14, height: 4, depth: 2, price: 1.50, color: '#d97706', category: 'Bebidas & Snacks' },
      { id: 'P028', sku: 'SAP-ALM02', name: 'Bebida Isotónica Hidratante', width: 7, height: 22, depth: 7, price: 2.20, color: '#3b82f6', category: 'Bebidas & Snacks' },
      { id: 'P029', sku: 'SAP-ALM03', name: 'Agua de Coco 100% Organica', width: 6, height: 15, depth: 6, price: 3.10, color: '#22c55e', category: 'Bebidas & Snacks' },
      { id: 'P030', sku: 'SAP-ALM04', name: 'Té Verde Matcha Orgánico', width: 8, height: 12, depth: 5, price: 5.90, color: '#86efac', category: 'Bebidas & Snacks' },
    ];

    for (const product of INITIAL_PRODUCTS) {
      await prisma.product.upsert({
        where: { id: product.id },
        update: {},
        create: product,
      });
    }

    return NextResponse.json({ success: true, message: "¡30 Productos inyectados a SQL Server exitosamente!" }, { status: 200 });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
