"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { usePlanogramStore } from "@/store/usePlanogramStore";
import { getPlacedDimensions, getGlobalStats } from "@/utils/planogramHelpers";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Copy,
  Edit3,
  FileText,
  FileSpreadsheet,
  Layers,
  MapPin,
  Tag,
  Info,
  ExternalLink,
  TrendingUp,
  Package,
  X,
  AlertTriangle,
  ChevronDown,
  Check
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

export default function StoreDetails() {
  const router = useRouter();
  const params = useParams();
  const storeId = params.id as string;
  const searchParams = useSearchParams();

  const [isMounted, setIsMounted] = useState(false);
  const [isAuth, setIsAuth] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const auth = localStorage.getItem("locatel_auth");
    if (auth === "true") {
      setIsAuth(true);
    } else {
      router.push("/login");
    }
  }, [router]);

  const { products, duplicateGondola, deleteGondola, renameGondola, loadGondola, selectStore, fetchProducts } = usePlanogramStore();
  const [store, setStore] = useState<any>(null);
  const [isFetchingStore, setIsFetchingStore] = useState(true);

  const fetchStoreDetails = async () => {
    try {
      const res = await fetch(`/api/stores/${storeId}?t=${Date.now()}`, { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        setStore(data.data);
      } else {
        router.push("/stores");
      }
    } catch (err) {
      console.error("Error cargando la tienda:", err);
      router.push("/stores");
    } finally {
      setIsFetchingStore(false);
    }
  };

  useEffect(() => {
    if (isAuth) {
      fetchStoreDetails();
      fetchProducts();
    }
  }, [storeId, isAuth, router, fetchProducts]);

  // Toggle Report view
  const [showReport, setShowReport] = useState(false);

  // Modal triggers
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState<string | null>(null); // gondolaId
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null); // gondolaId
  const [showDuplicateModal, setShowDuplicateModal] = useState<string | null>(null); // gondolaId

  // Form Fields
  const [newName, setNewName] = useState("");
  const [newAisle, setNewAisle] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const [editName, setEditName] = useState("");
  const [editAisle, setEditAisle] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editDescription, setEditDescription] = useState("");

  // Aisle filter for standard view
  const [selectedAisleFilter, setSelectedAisleFilter] = useState<string>("TODAS");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("TODAS");
  const [isAisleDropdownOpen, setIsAisleDropdownOpen] = useState(false);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);

  // Custom categories state & modal dropdown states
  const [customCategories, setCustomCategories] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("customCategories");
        return saved ? JSON.parse(saved) : [];
      } catch (e) {
        return [];
      }
    }
    return [];
  });
  const [isCreatingNewCategory, setIsCreatingNewCategory] = useState(false);
  const [isEditingNewCategory, setIsEditingNewCategory] = useState(false);
  const [newCategoryInputValue, setNewCategoryInputValue] = useState("");
  const [editCategoryInputValue, setEditCategoryInputValue] = useState("");
  const [isCreateCatDropdownOpen, setIsCreateCatDropdownOpen] = useState(false);
  const [isEditCatDropdownOpen, setIsEditCatDropdownOpen] = useState(false);

  const addCustomCategory = (cat: string) => {
    const trimmed = cat.trim();
    if (!trimmed) return;
    if (!customCategories.includes(trimmed)) {
      const updated = [...customCategories, trimmed];
      setCustomCategories(updated);
      localStorage.setItem("customCategories", JSON.stringify(updated));
    }
  };

  // Comentado para evitar el doble redireccionamiento
  // useEffect(() => {
  //   if (isMounted && isAuth && !store && !isFetchingStore) {
  //     router.push("/stores");
  //   }
  // }, [store, router, isAuth, isMounted, isFetchingStore]);

  useEffect(() => {
    if (isMounted && isAuth) {
      if (searchParams.get("report") === "true") {
        setShowReport(true);
      }
    }
  }, [isMounted, isAuth, searchParams]);

  useEffect(() => {
    if (showReport && !isFetchingStore) {
      const timer = setTimeout(() => {
        const reportElement = document.getElementById("tienda-reporte-consolidado");
        if (reportElement) {
          reportElement.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [showReport, isFetchingStore]);

  if (!isMounted || !isAuth || isFetchingStore) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#f3f4f6]">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#009639] border-t-transparent"></div>
      </div>
    );
  }

  if (!store) return null;

  // Filter Options
  const aisles = ["TODAS", ...Array.from(new Set(store.library.map((g: any) => g.aisle).filter(Boolean)))];

  // Dashboard category filter: ONLY categories of existing gondolas in this store
  const categories = ["TODAS", ...Array.from(new Set(
    store.library.map((g: any) => g.category).filter(Boolean)
  ))].sort((a: any, b: any) => {
    if (a === "TODAS") return -1;
    if (b === "TODAS") return 1;
    return a.localeCompare(b);
  });

  const FIXED_CATEGORIES = [
    "Ético",
    "OTC",
    "Vitaminas",
    "Oncológico",
    "Cuidado Personal",
    "Cuidado del Bebé",
    "Dermocosmética",
    "Hogar",
    "Snack",
    "Incontinencia",
    "Alimentos y Bebidas",
    "Snack Saludable",
    "Alimentos Especiales",
    "Maquillaje",
    "Otros",
    "Congelados",
    "Juguetes",
    "Equipos Médicos"
  ];

  // Modal selector categories: categories of existing gondolas in this store + custom ones (NO random product categories!)
  const allCategories = Array.from(new Set([
    ...FIXED_CATEGORIES,
    ...store.library.map((g: any) => g.category).filter(Boolean),
    ...customCategories
  ])).sort();

  // Filtered Gondolas for standard view using both aisle and category
  const filteredGondolas = store.library.filter((g: any) => {
    const matchAisle = selectedAisleFilter === "TODAS" || g.aisle === selectedAisleFilter;
    const matchCategory = selectedCategoryFilter === "TODAS" || g.category === selectedCategoryFilter;
    return matchAisle && matchCategory;
  });

  // Global calculations for KPIs
  const storeStats = store.library.map((g: any) => {
    return {
      gondola: g,
      stats: getGlobalStats(g.config, products)
    };
  });

  const totalValue = storeStats.reduce((sum: number, item: any) => sum + item.stats.totalValue, 0);
  const totalUnits = storeStats.reduce((sum: number, item: any) => sum + item.stats.totalUnits, 0);
  const totalSKUs = Array.from(
    new Set(
      store.library.flatMap((g: any) =>
        g.config.shelves.flatMap((s: any) => s.products.flatMap((p: any) => p.layers.map((l: any) => l.productId)))
      )
    )
  ).length;

  const handleCreateGondola = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    try {
      const res = await fetch("/api/gondolas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId: storeId,
          name: newName.trim(),
          aisle: newAisle.trim(),
          category: newCategory.trim(),
          description: newDescription.trim()
        })
      });
      const data = await res.json();

      if (data.success) {
        setNewName("");
        setNewAisle("");
        setNewCategory("");
        setNewDescription("");
        setNewCategoryInputValue("");
        setIsCreatingNewCategory(false);
        setShowCreateModal(false);
        fetchStoreDetails(); // Recargar la tienda para mostrar la góndola nueva
      } else {
        alert(data.error || "Error al crear la góndola");
      }
    } catch (err) {
      alert("Error de conexión al servidor");
    }
  };

  const handleStartEdit = (gondola: any) => {
    setShowEditModal(gondola.id);
    setEditName(gondola.name);
    setEditAisle(gondola.aisle);
    setEditCategory(gondola.category);
    setEditDescription(gondola.description);
    setEditCategoryInputValue("");
    setIsEditingNewCategory(false);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditModal || !editName.trim()) return;

    try {
      const res = await fetch(`/api/gondolas/${showEditModal}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          aisle: editAisle.trim(),
          category: editCategory.trim(),
          description: editDescription.trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        setEditCategoryInputValue("");
        setIsEditingNewCategory(false);
        setShowEditModal(null);
        fetchStoreDetails(); // Recargar cambios
      } else {
        alert(data.error || "Error al actualizar la góndola");
      }
    } catch (err) {
      alert("Error de red");
    }
  };

  const handleDeleteConfirm = async () => {
    if (showDeleteModal) {
      try {
        const res = await fetch(`/api/gondolas/${showDeleteModal}`, { method: "DELETE" });
        if (res.ok) {
          setShowDeleteModal(null);
          fetchStoreDetails(); // Recargar cambios
        } else {
          alert("Error al eliminar la góndola");
        }
      } catch (err) {
        alert("Error de conexión");
      }
    }
  };

  const handleDuplicateConfirm = async () => {
    if (showDuplicateModal) {
      try {
        const res = await fetch(`/api/gondolas/${showDuplicateModal}/duplicate`, { method: "POST" });
        if (res.ok) {
          setShowDuplicateModal(null);
          fetchStoreDetails(); // Recargar cambios de SQL Server
        } else {
          alert("Error al duplicar la góndola");
        }
      } catch (err) {
        alert("Error de conexión");
      }
    }
  };

  // Generate dynamic level data for report table
  const getGondolaLevelsReport = (gondolaConfig: any) => {
    return gondolaConfig.shelves.map((s: any, sIdx: number) => {
      let levelUnits = 0;
      let levelValue = 0;
      const placements: any[] = [];

      s.products.forEach((p: any) => {
        p.layers.forEach((l: any) => {
          const prod = l.product || products.find((pr: any) => pr.id === l.productId);
          if (prod) {
            const dims = getPlacedDimensions(prod, l.orientation || 0);
            const depthUnits = Math.max(1, Math.floor(s.depth / dims.depth));
            const units = l.facings * depthUnits;
            const val = units * prod.price;

            levelUnits += units;
            levelValue += val;

            placements.push({
              productId: prod.id,
              sku: prod.sku,
              name: prod.name,
              facings: l.facings,
              depthUnits,
              totalUnits: units,
              price: prod.price,
              totalValue: val
            });
          }
        });
      });

      return {
        shelfIndex: sIdx,
        type: s.type,
        placements,
        levelUnits,
        levelValue
      };
    });
  };

  // Generate fulfillment data
  const getFulfillmentData = () => {
    const map = new Map<string, { product: any; totalUnits: number }>();
    store.library.forEach((g: any) => {
      g.config.shelves.forEach((s: any) => {
        s.products.forEach((p: any) => {
          p.layers.forEach((l: any) => {
            const prod = l.product || products.find((pr: any) => pr.id === l.productId);
            if (prod) {
              const dims = getPlacedDimensions(prod, l.orientation || 0);
              const depthUnits = Math.max(1, Math.floor(s.depth / dims.depth));
              const units = l.facings * depthUnits;

              const existing = map.get(prod.id);
              if (existing) {
                existing.totalUnits += units;
              } else {
                map.set(prod.id, { product: prod, totalUnits: units });
              }
            }
          });
        });
      });
    });
    return Array.from(map.values());
  };

  // Excel Export
  const handleExportExcel = () => {
    const detailedRows: any[] = [];
    let grandTotalUnits = 0;
    let grandTotalValue = 0;

    store.library.forEach((g: any) => {
      g.config?.shelves?.forEach((s: any) => {
        s.products?.forEach((p: any) => {
          p.layers?.forEach((l: any) => {
            const prod = l.product || products.find((pr: any) => pr.id === l.productId);
            if (prod) {
              const dims = getPlacedDimensions(prod, l.orientation || 0);
              const depthUnits = Math.max(1, Math.floor(s.depth / dims.depth));
              const units = (l.facings || 1) * depthUnits;
              const totalVal = units * prod.price;

              grandTotalUnits += units;
              grandTotalValue += totalVal;

              detailedRows.push({
                "Góndola": g.name || "N/A",
                "Categoría Góndola": g.category || "N/A",
                "Nivel Estante": `Nivel ${s.index + 1}`,
                "SKU": prod.sku,
                "Producto": prod.name,
                "Marca": prod.brand || "N/A",
                "Departamento": prod.department || "N/A",
                "Categoría": prod.category || "N/A",
                "Subcategoría": prod.subcategory || "N/A",
                "Cod Prov": prod.providerCode || "N/A",
                "Proveedor": prod.provider || "N/A",
                "Alto (cm)": prod.height,
                "Ancho (cm)": prod.width,
                "Longitud (cm)": prod.depth,
                "Unidades": units,
                "Precio Unitario (Bs.)": prod.price,
                "Valor Total (Bs.)": totalVal
              });
            }
          });
        });
      });
    });

    const totalDistinctProducts = new Set(detailedRows.map(r => r.SKU)).size;

    // Append total row
    detailedRows.push({
      "Góndola": "TOTAL CONSOLIDADO",
      "Categoría Góndola": "",
      "Nivel Estante": "",
      "SKU": "",
      "Producto": "",
      "Marca": "",
      "Departamento": "",
      "Categoría": "",
      "Subcategoría": "",
      "Cod Prov": "",
      "Proveedor": "",
      "Alto (cm)": 0,
      "Ancho (cm)": 0,
      "Longitud (cm)": 0,
      "Unidades": grandTotalUnits,
      "Precio Unitario (Bs.)": 0,
      "Valor Total (Bs.)": grandTotalValue
    });

    const wb = XLSX.utils.book_new();
    const wsPurchase = XLSX.utils.aoa_to_sheet([
      ["REPORTE FINANCIERO CONSOLIDADO DE PLANOGRAMA"],
      [`Tienda: ${store.name}`],
      [`ID Tienda: ${store.id}`],
      [`Fecha y Hora de Generación: ${new Date().toLocaleString()}`],
      [`Total de Unidades Planificadas: ${grandTotalUnits}`],
      [`Valor de Inventario Consolidado (Bs.): Bs. ${grandTotalValue.toFixed(2)}`],
      [`Cantidad de Productos Diferentes: ${totalDistinctProducts}`],
      [] // Blank row
    ]);

    XLSX.utils.sheet_add_json(wsPurchase, detailedRows, { origin: "A9" });

    // Set column widths
    wsPurchase["!cols"] = [
      { wch: 18 }, // Góndola
      { wch: 18 }, // Categoría Góndola
      { wch: 15 }, // Nivel Estante
      { wch: 15 }, // SKU
      { wch: 30 }, // Producto
      { wch: 15 }, // Marca
      { wch: 15 }, // Departamento
      { wch: 15 }, // Categoría
      { wch: 15 }, // Subcategoría
      { wch: 12 }, // Cod Prov
      { wch: 20 }, // Proveedor
      { wch: 10 }, // Alto (cm)
      { wch: 10 }, // Ancho (cm)
      { wch: 12 }, // Longitud (cm)
      { wch: 12 }, // Unidades
      { wch: 18 }, // Precio Unitario ($)
      { wch: 18 }  // Valor Total ($)
    ];

    XLSX.utils.book_append_sheet(wb, wsPurchase, "Consolidado de Compra");
    XLSX.writeFile(wb, `Reporte_Financiero_${store.name.replace(/\s+/g, "_")}.xlsx`);
  };

  // PDF Export
  const handleExportPDF = () => {
    const doc = new jsPDF("p", "pt", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();

    // Helper: Hex to RGB
    const hexToRgb = (hex: string) => {
      let h = hex.trim().replace("#", "");
      if (h.length === 3) h = h.split("").map(c => c + c).join("");
      const num = parseInt(h, 16);
      if (isNaN(num)) return { r: 59, g: 130, b: 246 };
      return {
        r: (num >> 16) & 255,
        g: (num >> 8) & 255,
        b: num & 255
      };
    };

    // Helper: Draw Header on a page
    const drawPageHeader = (subtitleText: string) => {
      doc.setFillColor(0, 150, 57); // Locatel Green
      doc.rect(0, 0, pageWidth, 55, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(14);
      doc.text("LOCATEL PLANOGRAM PRO", 40, 24);

      doc.setFontSize(8);
      doc.setFont("Helvetica", "normal");
      doc.text(subtitleText.toUpperCase(), 40, 38);
    };

    // Helper: Draw 2D Vector Gondola Schematic
    const drawGondolaVector2D = (g: any, startX: number, startY: number, drawWidth: number, drawHeight: number, productRefMap?: Map<string, number>) => {
      // 1. Draw the full-width blueprint canvas card
      doc.setFillColor(248, 250, 252); // slate-50
      doc.setDrawColor(218, 224, 233); // slate-250
      doc.setLineWidth(1);
      doc.rect(startX, startY, drawWidth, drawHeight, "FD");

      const gWidth = Number(g.config ? g.config.width : g.width) || 100;
      const gHeight = Number(g.config ? g.config.height : g.height) || 200;

      // Calculate scale to fit inside the padded canvas (20pt padding all around)
      const scale = Math.min((drawWidth - 40) / gWidth, (drawHeight - 40) / gHeight);
      const actualW = gWidth * scale;
      const actualH = gHeight * scale;

      // Center the gondola inside the canvas
      const centeredStartX = startX + (drawWidth - actualW) / 2;
      const bottomY = startY + drawHeight - 20; // 20pt padding at the bottom
      const actualStartY = bottomY - actualH;

      // Vertical side panels
      doc.setFillColor(71, 85, 105); // slate-600
      doc.rect(centeredStartX - 4, actualStartY, 4, actualH, "F");
      doc.rect(centeredStartX + actualW, actualStartY, 4, actualH, "F");

      // Shelves and products
      g.config.shelves.forEach((s: any, sIdx: number) => {
        const shelfYCm = Number(s.y) || 0;
        const shelfYPt = bottomY - (shelfYCm * scale);

        // Draw products
        s.products.forEach((p: any) => {
          let accumulatedHeightCm = 0;
          p.layers.forEach((l: any) => {
            const prod = products.find(pr => pr.id === l.productId);
            if (prod) {
              const orientation = l.orientation || 0;
              let pWidth = Number(prod.width) || 10;
              let pHeight = Number(prod.height) || 10;
              if (orientation === 1 || orientation === 3) {
                pWidth = Number(prod.height) || 10;
                pHeight = Number(prod.width) || 10;
              }

              const layerW = pWidth * (Number(l.facings) || 1);
              const layerH = pHeight;

              const wPt = layerW * scale;
              const hPt = layerH * scale;
              const xPt = centeredStartX + ((Number(p.x) || 0) * scale);
              const yPt = shelfYPt - (accumulatedHeightCm * scale) - hPt;

              const rgb = hexToRgb(prod.color || "#3b82f6");
              doc.setFillColor(rgb.r, rgb.g, rgb.b);
              doc.setDrawColor(Math.max(0, rgb.r - 30), Math.max(0, rgb.g - 30), Math.max(0, rgb.b - 30));
              doc.rect(xPt, yPt, wPt, hPt, "FD");

              // Display Ref Number centered inside the product block
              const refNumber = productRefMap ? productRefMap.get(l.productId) : null;
              if (refNumber !== undefined && refNumber !== null) {
                const labelText = String(refNumber);
                const textWidth = doc.getTextWidth(labelText);
                const fontSize = Math.max(5, Math.min(8.5, hPt - 2));
                if (wPt > textWidth + 1 && hPt > 7) {
                  doc.setTextColor(255, 255, 255);
                  doc.setFontSize(fontSize);
                  doc.setFont("Helvetica", "bold");
                  doc.text(labelText, xPt + (wPt - textWidth) / 2, yPt + (hPt / 2) + (fontSize / 3));
                }
              } else if (wPt > 15 && hPt > 6) {
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(Math.min(5, hPt - 2));
                doc.setFont("Helvetica", "bold");
                doc.text(prod.sku, xPt + 2, yPt + hPt / 2 + 1.5, { maxWidth: wPt - 4 });
              }

              accumulatedHeightCm += layerH;
            }
          });
        });

        // Draw shelf line / bar
        if (s.type === "perchero") {
          doc.setDrawColor(148, 163, 184); // slate-400
          doc.setLineDashPattern([2, 2], 0);
          doc.line(centeredStartX, shelfYPt, centeredStartX + actualW, shelfYPt);
          doc.setLineDashPattern([], 0); // reset
        } else {
          doc.setFillColor(0, 150, 57); // Locatel Green
          doc.rect(centeredStartX, shelfYPt, actualW, 3, "F");
        }
      });
    };

    // ====================================================================
    // PAGE 1: RESUMEN DE LA TIENDA
    // ====================================================================
    drawPageHeader(`REPORTE CONSOLIDADO: ${store.name}`);

    // Summary Title
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(30, 30, 30);
    doc.text("Resumen de Sucursal", 40, 95);

    // Stats Grid Container
    doc.setFillColor(245, 247, 250);
    doc.roundedRect(40, 115, pageWidth - 80, 50, 6, 6, "F");

    doc.setFontSize(8);
    doc.setFont("Helvetica", "bold");
    doc.setTextColor(120, 120, 120);
    doc.text("VALOR TOTAL INVENTARIO", 60, 133);
    doc.text("TOTAL UNIDADES", 240, 133);
    doc.text("VARIEDAD DE SKUS", 420, 133);

    doc.setFontSize(13);
    doc.setTextColor(30, 30, 30);
    doc.text(`Bs. ${totalValue.toFixed(2)}`, 60, 151);
    doc.text(`${totalUnits} U.`, 240, 151);
    doc.text(`${totalSKUs} SKUs`, 420, 151);

    // List of Gondolas table on first page
    doc.setFontSize(11);
    doc.setFont("Helvetica", "bold");
    doc.setTextColor(0, 150, 57);
    doc.text("Mobiliarios Registrados", 40, 195);

    const summaryRows = store.library.map((g: any, index: number) => {
      const stats = getGlobalStats(g.config, products);
      return [
        index + 1,
        g.name,
        g.aisle || "N/A",
        g.category || "N/A",
        `${g.config.width}x${g.config.height}x${g.config.depth} cm`,
        `${stats.totalUnits} U.`,
        `Bs. ${stats.totalValue.toFixed(2)}`
      ];
    });

    autoTable(doc, {
      startY: 205,
      head: [["#", "Góndola", "Pasillo", "Categoría", "Dimensiones", "Cantidad", "Valor Est. (Bs.)"]],
      body: summaryRows,
      theme: "striped",
      styles: { fontSize: 8.5 },
      headStyles: { fillColor: [0, 150, 57] }
    });

    // ====================================================================
    // PAGES 2+: DETALLE POR GÓNDOLA (DIAGRAMA 2D + TABLA)
    // ====================================================================
    store.library.forEach((g: any) => {
      doc.addPage();
      drawPageHeader(`Detalle de Góndola: ${g.name}`);

      // Title & Metadata
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(30, 30, 30);
      doc.text(g.name.toUpperCase(), 40, 85);

      // Metadata string
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(100, 100, 100);
      const metaStr = `Ubicación: Pasillo ${g.aisle || "N/A"}   |   Categoría: ${g.category || "N/A"}   |   Dimensiones: ${g.config.width}x${g.config.height}x${g.config.depth} cm`;
      doc.text(metaStr, 40, 98);

      if (g.description) {
        doc.setFontSize(7.5);
        doc.text(`Notas: ${g.description}`, 40, 110, { maxWidth: pageWidth - 80 });
      }

      // Build unique product list for referencing
      const uniqueProductIds = Array.from(
        new Set(
          g.config.shelves.flatMap((s: any) =>
            s.products.flatMap((p: any) => p.layers.map((l: any) => l.productId))
          )
        )
      );
      const productRefMap = new Map(uniqueProductIds.map((id: any, index: number) => [id, index + 1]));

      const diagramY = 115;
      const diagramH = 550;
      drawGondolaVector2D(g, 40, diagramY, pageWidth - 80, diagramH, productRefMap);

      // Now add a page break for the Inventory table!
      doc.addPage();
      drawPageHeader(`Detalle de Góndola: ${g.name}`);

      // Title & Metadata on the table page too (for context)
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(30, 30, 30);
      doc.text(`${g.name.toUpperCase()} - INVENTARIO DETALLADO`, 40, 85);

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(100, 100, 100);
      doc.text(metaStr, 40, 98);

      const rows: any[] = [];
      const levels = getGondolaLevelsReport(g.config);
      levels.forEach((lv: any) => {
        lv.placements.forEach((pl: any) => {
          rows.push([
            productRefMap.get(pl.productId) || "",
            `Nivel ${lv.shelfIndex + 1} (${lv.type === "perchero" ? "Gancho" : "Plancha"})`,
            pl.sku,
            pl.name,
            `${pl.totalUnits} U.`,
            `Bs. ${pl.price.toFixed(2)}`,
            `Bs. ${pl.totalValue.toFixed(2)}`
          ]);
        });
      });

      autoTable(doc, {
        startY: 115,
        head: [["Ref", "Nivel", "SKU", "Producto", "Cantidad", "Precio Unit.", "Valor Total"]],
        body: rows,
        theme: "grid",
        styles: { fontSize: 8 },
        headStyles: { fillColor: [100, 116, 139] }, // slate-500
        columnStyles: {
          0: { cellWidth: 25, halign: 'center' },
          1: { cellWidth: 90 },
          2: { cellWidth: 65 },
          4: { cellWidth: 50, halign: 'center' },
          5: { cellWidth: 55, halign: 'right' },
          6: { cellWidth: 60, halign: 'right' }
        }
      });
    });

    // ====================================================================
    // LAST PAGE: CONSOLIDADO GENERAL (FULFILLMENT)
    // ====================================================================
    doc.addPage();
    drawPageHeader("Reporte de Consolidado General (Fulfillment)");

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(30, 30, 30);
    doc.text("Consolidado General de Tienda (Fulfillment)", 40, 85);

    const fData = getFulfillmentData();
    const fulfillmentRows = fData.map(item => [
      item.product.sku,
      item.product.name,
      item.product.category,
      `${item.totalUnits} U.`,
      `Bs. ${item.product.price.toFixed(2)}`,
      `Bs. ${(item.totalUnits * item.product.price).toFixed(2)}`
    ]);

    // Calculate totals
    const fTotalUnits = fData.reduce((sum, item) => sum + item.totalUnits, 0);
    const fTotalValue = fData.reduce((sum, item) => sum + (item.totalUnits * item.product.price), 0);

    // Append a summary row at the end of body
    fulfillmentRows.push([
      "TOTAL CONSOLIDADO",
      "",
      "",
      `${fTotalUnits} U.`,
      "-",
      `Bs. ${fTotalValue.toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: 100,
      head: [["SKU", "Producto", "Categoría", "Total Unidades", "Precio Unit.", "Valor Consolidado"]],
      body: fulfillmentRows,
      theme: "grid",
      styles: { fontSize: 8 },
      headStyles: { fillColor: [0, 150, 57] }, // Locatel Green
      columnStyles: {
        0: { cellWidth: 70 },
        3: { cellWidth: 80, halign: 'center' },
        4: { cellWidth: 65, halign: 'right' },
        5: { cellWidth: 85, halign: 'right' }
      },
      didParseCell: (data) => {
        // Style the final total row
        if (data.row.index === fulfillmentRows.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [240, 245, 241];
          if (data.column.index === 3) {
            data.cell.styles.textColor = [0, 150, 57]; // Green text for total units
          } else if (data.column.index === 5) {
            data.cell.styles.textColor = [30, 30, 30]; // Dark text for total value
          }
        }
      }
    });

    doc.save(`Reporte_PDF_${store.name.replace(/\s+/g, "_")}.pdf`);
  };

  return (
    <div className="h-screen overflow-y-auto bg-[#f3f4f6] text-[#1f2937] flex flex-col font-sans">

      {/* Header exactly matching screenshot */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-40 px-8 py-3.5 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-5">
            <button
              onClick={() => router.push("/stores")}
              className="bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-500 hover:text-[#1f2937] font-bold py-2 px-3 rounded-lg text-xs transition-colors flex items-center gap-1.5"
            >
              <ArrowLeft className="h-4 w-4" /> Mis Tiendas
            </button>
            <img
              src="/logo.png"
              alt="Locatel Logo"
              className="h-11 w-auto object-contain"
            />
            <div className="h-8 w-px bg-zinc-200" />
            <div>
              <h1 className="text-xl font-bold text-[#1f2937] tracking-tight leading-tight">
                {store.name}
              </h1>
              <p className="text-xs text-zinc-400 font-semibold mt-0.5">
                Gestiona las góndolas de esta tienda
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowReport(!showReport)}
              className={`font-bold py-2 px-5 rounded-lg text-sm transition-all border ${showReport
                ? "bg-[#e6f4ea] text-[#009639] border-green-300"
                : "bg-white text-[#009639] border-[#009639]/30 hover:bg-[#e6f4ea]"
                }`}
            >
              Reporte Global
            </button>

            <button
              onClick={() => {
                setNewCategoryInputValue("");
                setIsCreatingNewCategory(false);
                setShowCreateModal(true);
              }}
              className="bg-[#009639] hover:bg-[#008030] active:scale-[0.98] text-white font-bold py-2 px-5 rounded-lg text-sm transition-all flex items-center gap-2 shadow-sm shadow-green-500/10"
            >
              <Plus className="h-4.5 w-4.5" /> Nueva Góndola
            </button>
            <button
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST" });
                localStorage.removeItem("locatel_auth");
                localStorage.removeItem("locatel_user");
                router.push("/login");
              }}
              className="bg-white hover:bg-red-50 border border-red-200 text-red-500 font-bold py-2 px-5 rounded-lg text-sm transition-all"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto px-8 py-8 w-full space-y-12">
        {/* ==================================================================== */}
        {/* STANDARD GONDOLAS LIST VIEW                                          */}
        {/* ==================================================================== */}
        <div className="space-y-6">
          {/* Filters Navigation dropdowns */}
          <div className="bg-zinc-50 border border-zinc-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm z-30 relative">
            <div className="flex flex-wrap items-center gap-6">
              {/* Pasillo Custom Select */}
              <div className="flex items-center gap-2.5">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex-shrink-0">
                  Pasillo:
                </span>
                <div className="relative">
                  {/* Trigger Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsAisleDropdownOpen(!isAisleDropdownOpen);
                      setIsCategoryDropdownOpen(false);
                    }}
                    className="bg-white border border-zinc-200 hover:border-[#009639] text-zinc-700 text-xs font-bold rounded-xl px-4 py-2 flex items-center justify-between gap-2 shadow-xs transition-all min-w-[170px] text-left outline-none"
                  >
                    <span className="truncate">{selectedAisleFilter === "TODAS" ? "Todos los Pasillos" : selectedAisleFilter}</span>
                    <ChevronDown className={`h-4 w-4 text-zinc-400 flex-shrink-0 transition-transform duration-200 ${isAisleDropdownOpen ? 'transform rotate-180 text-[#009639]' : ''}`} />
                  </button>

                  {/* Dropdown Options */}
                  {isAisleDropdownOpen && (
                    <>
                      {/* Click-away Backdrop */}
                      <div className="fixed inset-0 z-10" onClick={() => setIsAisleDropdownOpen(false)} />
                      {/* Options Card */}
                      <div className="absolute left-0 mt-2 w-[220px] bg-white border border-zinc-150 rounded-2xl shadow-xl py-2 z-20 animate-in fade-in slide-in-from-top-2 duration-150 max-h-[260px] overflow-y-auto">
                        {aisles.map((a: any) => (
                          <button
                            key={a}
                            type="button"
                            onClick={() => {
                              setSelectedAisleFilter(a);
                              setIsAisleDropdownOpen(false);
                            }}
                            className={`w-full text-left px-4 py-2 text-xs font-bold transition-colors flex items-center justify-between ${selectedAisleFilter === a
                              ? 'bg-[#e6f4ea] text-[#009639]'
                              : 'text-zinc-600 hover:bg-zinc-50'
                              }`}
                          >
                            <span className="truncate">{a === "TODAS" ? "Todos los Pasillos" : a}</span>
                            {selectedAisleFilter === a && <Check className="h-3.5 w-3.5 text-[#009639] flex-shrink-0" />}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Categoría Custom Select */}
              <div className="flex items-center gap-2.5">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex-shrink-0">
                  Categoría:
                </span>
                <div className="relative">
                  {/* Trigger Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsCategoryDropdownOpen(!isCategoryDropdownOpen);
                      setIsAisleDropdownOpen(false);
                    }}
                    className="bg-white border border-zinc-200 hover:border-[#009639] text-zinc-700 text-xs font-bold rounded-xl px-4 py-2 flex items-center justify-between gap-2 shadow-xs transition-all min-w-[180px] text-left outline-none"
                  >
                    <span className="truncate">{selectedCategoryFilter === "TODAS" ? "Todas las Categorías" : selectedCategoryFilter}</span>
                    <ChevronDown className={`h-4 w-4 text-zinc-450 flex-shrink-0 transition-transform duration-200 ${isCategoryDropdownOpen ? 'transform rotate-180 text-[#009639]' : ''}`} />
                  </button>

                  {/* Dropdown Options */}
                  {isCategoryDropdownOpen && (
                    <>
                      {/* Click-away Backdrop */}
                      <div className="fixed inset-0 z-10" onClick={() => setIsCategoryDropdownOpen(false)} />
                      {/* Options Card */}
                      <div className="absolute left-0 mt-2 w-[240px] bg-white border border-zinc-150 rounded-2xl shadow-xl py-2 z-20 animate-in fade-in slide-in-from-top-2 duration-150 max-h-[260px] overflow-y-auto">
                        {categories.map((c: any) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => {
                              setSelectedCategoryFilter(c);
                              setIsCategoryDropdownOpen(false);
                            }}
                            className={`w-full text-left px-4 py-2 text-xs font-bold transition-colors flex items-center justify-between ${selectedCategoryFilter === c
                              ? 'bg-[#e6f4ea] text-[#009639]'
                              : 'text-zinc-600 hover:bg-zinc-50'
                              }`}
                          >
                            <span className="truncate">{c === "TODAS" ? "Todas las Categorías" : c}</span>
                            {selectedCategoryFilter === c && <Check className="h-3.5 w-3.5 text-[#009639] flex-shrink-0" />}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <span className="text-xs text-[#009639] font-bold bg-[#e6f4ea] px-3.5 py-1.5 rounded-xl border border-[#009639]/15 self-start sm:self-auto flex-shrink-0">
              Mobiliarios: {filteredGondolas.length}
            </span>
          </div>

          {/* Gondolas list cards */}
          {filteredGondolas.length === 0 ? (
            <div className="border border-dashed border-zinc-300 rounded-3xl py-24 flex flex-col items-center justify-center text-center px-4 bg-white/50">
              <Layers className="h-12 w-12 text-[#009639]/40 mb-4 animate-pulse-glow" />
              <h3 className="text-base font-bold text-zinc-700">No hay góndolas registradas</h3>
              <p className="text-zinc-400 text-sm mt-1 max-w-sm font-medium">
                Utiliza el botón "+ Nueva Góndola" en la cabecera para agregar el primer estante técnico.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredGondolas.map((g: any) => {
                const stats = getGlobalStats(g.config, products);
                const maxMiniH = 75; // max height in pixels for the miniature
                const scaleMini = maxMiniH / 220; // Scale factor so a 220cm height maps to 75px
                const miniH = Math.max(35, g.config.height * scaleMini);
                const miniW = Math.max(25, g.config.width * scaleMini);
                const miniD = Math.max(8, g.config.depth * scaleMini);

                const typeColors: Record<string, any> = {
                  pared: { back: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)', shelf: '#475569', shelfTop: '#64748b', shelfFront: '#334155', border: '#334155' },
                  central: { back: 'rgba(120,113,108,0.1)', shelf: '#78716c', shelfTop: '#a8a29e', shelfFront: '#57534e', border: '#78716c' },
                  cabecera: { back: 'linear-gradient(180deg, #292524 0%, #1c1917 100%)', shelf: '#44403c', shelfTop: '#57534e', shelfFront: '#292524', border: '#57534e' },
                  refrigerado: { back: 'linear-gradient(180deg, #0c1929 0%, #0a1628 100%)', shelf: '#1e3a5f', shelfTop: '#2563eb', shelfFront: '#1e40af', border: '#3b82f6' }
                };
                const tc = typeColors[g.config.type] || typeColors.pared;
                const miniBg = tc.back;
                const miniBorder = tc.border;
                let glowStyle: React.CSSProperties = {};

                if (g.config.type === 'refrigerado') {
                  glowStyle = { boxShadow: 'inset 0 0 10px rgba(59,130,246,0.3)' };
                }

                let colLHtml = null;
                let colRHtml = null;
                if (g.config.type === 'pared') {
                  colLHtml = (
                    <div style={{ position: 'absolute', left: '-2px', top: 0, width: '2px', height: '100%', background: '#334155', transformStyle: 'preserve-3d' }}>
                      <div style={{ position: 'absolute', left: 0, width: `${miniD}px`, height: '100%', background: '#2d3a4a', transform: 'rotateY(90deg)', transformOrigin: 'left' }} />
                    </div>
                  );
                  colRHtml = (
                    <div style={{ position: 'absolute', right: '-2px', top: 0, width: '2px', height: '100%', background: '#334155', transformStyle: 'preserve-3d' }}>
                      <div style={{ position: 'absolute', right: 0, width: `${miniD}px`, height: '100%', background: '#2d3a4a', transform: 'rotateY(-90deg)', transformOrigin: 'right' }} />
                    </div>
                  );
                } else if (g.config.type === 'central') {
                  colLHtml = (
                    <div style={{ position: 'absolute', left: '-2px', top: 0, width: '2px', height: '100%', background: '#78716c', transformStyle: 'preserve-3d' }}>
                      <div style={{ position: 'absolute', left: 0, width: `${miniD}px`, height: '100%', background: '#57534e', transform: 'rotateY(90deg)', transformOrigin: 'left' }} />
                    </div>
                  );
                  colRHtml = (
                    <div style={{ position: 'absolute', right: '-2px', top: 0, width: '2px', height: '100%', background: '#78716c', transformStyle: 'preserve-3d' }}>
                      <div style={{ position: 'absolute', right: 0, width: `${miniD}px`, height: '100%', background: '#57534e', transform: 'rotateY(-90deg)', transformOrigin: 'right' }} />
                    </div>
                  );
                } else if (g.config.type === 'refrigerado') {
                  colRHtml = (
                    <div style={{ position: 'absolute', top: 0, right: 0, width: `${miniD}px`, height: '100%', background: 'rgba(59,130,246,0.04)', borderLeft: '1px solid rgba(59,130,246,0.15)', transform: 'rotateY(-90deg)', transformOrigin: 'right' }} />
                  );
                }

                let typeLabel = g.config.type === 'pared' ? 'Góndola Pared' : g.config.type === 'central' ? 'Góndola Central' : g.config.type === 'cabecera' ? 'Cabecera' : 'Refrigerado';

                return (
                  <div
                    key={g.id}
                    onClick={() => {
                      selectStore(storeId);
                      loadGondola(g.id);
                      router.push(`/editor/${g.id}`);
                    }}
                    className="gondola-card bg-white border border-zinc-200 hover:border-[#009639] rounded-2xl relative overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer flex flex-col justify-between"
                    style={{ height: '160px' }}
                  >
                    {/* Locatel Brand Top Border Gradient Line */}
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#009639] to-[#ffb81c]" />

                    <div className="flex flex-row gap-4 items-center p-4 h-full relative">
                      {/* Mini 3D Viewport */}
                      <div className="mini-viewport" style={{ width: '80px', height: '120px', borderRadius: '12px', border: '1px solid #e4e4e7', display: 'flex', alignItems: 'center', justifyContent: 'center', perspective: '250px', overflow: 'hidden', flexShrink: 0, boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.03)' }}>
                        <div className="mini-gondola" style={{ position: 'relative', width: `${miniW}px`, height: `${miniH}px`, transformStyle: 'preserve-3d', transform: 'rotateX(-12deg) rotateY(-18deg)', transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)', marginTop: '10px' }}>
                          {/* Back Panel */}
                          <div style={{ position: 'absolute', inset: 0, background: miniBg, border: `1px solid ${miniBorder}`, transformStyle: 'preserve-3d', ...glowStyle }}>
                            {colLHtml}
                            {colRHtml}
                          </div>
                          {/* Shelves */}
                          {g.config.shelves.map((shelf: any, shelfIdx: number) => {
                            const miniShelfY = shelf.y * scaleMini;
                            const miniShelfThickness = Math.max(1, g.config.shelfThickness * scaleMini);
                            const isPerchero = shelf.type === 'perchero';
                            const shelfColor = isPerchero ? '#475569' : tc.shelf;
                            const shelfTopColor = isPerchero ? '#64748b' : tc.shelfTop;
                            const shelfFrontColor = isPerchero ? '#334155' : tc.shelfFront;
                            const currentShelfDepth = shelf.depth !== undefined ? shelf.depth : g.config.shelfDepth;
                            const miniShelfDepth = (isPerchero ? 2 : currentShelfDepth) * scaleMini;

                            return (
                              <div key={shelfIdx} style={{ position: 'absolute', width: '100%', height: `${miniShelfThickness}px`, bottom: `${miniShelfY}px`, left: 0, background: shelfColor, transformStyle: 'preserve-3d' }}>
                                <div style={{ position: 'absolute', width: '100%', height: `${miniShelfDepth}px`, background: shelfTopColor, transform: 'rotateX(90deg)', transformOrigin: 'top', top: 0, left: 0 }} />
                                <div style={{ position: 'absolute', width: '100%', height: '100%', background: shelfFrontColor, transform: `translateZ(${miniShelfDepth}px)`, top: 0, left: 0 }} />
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Card Info */}
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                            <h3 style={{ marginBottom: '2px', fontSize: '15px', fontWeight: 700, color: '#1f2937', flex: 1, wordBreak: 'break-word', lineHeight: 1.3 }} title={g.name}>
                              {g.name}
                            </h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }} className="relative z-10">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartEdit(g);
                                }}
                                className="btn-edit p-1.5 hover:bg-zinc-100 rounded-lg text-zinc-400 hover:text-[#009639] transition-colors"
                                title="Editar Góndola"
                              >
                                <Edit3 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowDuplicateModal(g.id);
                                }}
                                className="btn-duplicate p-1.5 hover:bg-zinc-100 rounded-lg text-zinc-400 hover:text-zinc-650 transition-colors"
                                title="Duplicar Góndola"
                              >
                                <Copy className="h-4 w-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowDeleteModal(g.id);
                                }}
                                className="btn-delete p-1.5 hover:bg-red-50 rounded-lg text-zinc-400 hover:text-red-500 transition-colors"
                                title="Eliminar Góndola"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                          <p style={{ fontSize: '11px', color: '#71717a', fontWeight: 600, marginBottom: '4px' }}>
                            {g.config.width}x{g.config.height}x{g.config.depth} cm
                          </p>
                          {g.description ? (
                            <p style={{ fontSize: '12px', color: '#71717a', fontStyle: 'italic', marginBottom: '4px', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'normal' }} title={g.description}>
                              {g.description}
                            </p>
                          ) : (
                            <p style={{ fontSize: '12px', color: '#a1a1aa', fontStyle: 'italic', marginBottom: '4px', lineHeight: 1.4 }}>
                              Sin descripción
                            </p>
                          )}
                        </div>

                        <div className="meta" style={{ marginBottom: 0, display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          <span className="pill-badge" style={{ color: '#047857', background: 'rgba(4, 120, 87, 0.08)', border: '1px solid rgba(4, 120, 87, 0.15)', padding: '4px 8px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>
                            {stats.totalUnits} U.
                          </span>
                          <span className="pill-badge" style={{ color: '#475569', background: 'rgba(71, 85, 105, 0.08)', border: '1px solid rgba(71, 85, 105, 0.15)', padding: '4px 8px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', display: 'inline-flex', alignItems: 'center' }}>
                            {typeLabel}
                          </span>
                          {g.aisle && (
                            <span className="pill-badge" style={{ color: '#475569', background: 'rgba(71, 85, 105, 0.08)', border: '1px solid rgba(71, 85, 105, 0.15)', padding: '4px 8px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                              {g.aisle}
                            </span>
                          )}
                          {g.category && (
                            <span className="pill-badge" style={{ color: '#475569', background: 'rgba(71, 85, 105, 0.08)', border: '1px solid rgba(71, 85, 105, 0.15)', padding: '4px 8px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
                              {g.category}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ==================================================================== */}
        {/* REPORT VIEW (Reporte Consolidado de Tienda)                          */}
        {/* ==================================================================== */}
        {showReport && (
          <div id="tienda-reporte-consolidado" className="bg-white border border-zinc-200 rounded-[20px] shadow-sm flex flex-col p-8 space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-355">
            {/* Report Header block */}
            <div className="flex items-start justify-between border-b border-zinc-150 pb-5">
              <div>
                <h2 className="text-xl font-bold text-[#1f2937] tracking-tight">Reporte Consolidado de Tienda</h2>
                <p className="text-xs text-zinc-400 font-semibold mt-1">
                  Análisis financiero y de inventario de todo el mobiliario activo
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleExportPDF}
                  className="bg-[#009639] hover:bg-[#008030] text-white font-bold py-2 px-5 rounded-lg text-xs flex items-center gap-1.5 shadow-sm active:scale-95"
                >
                  <FileText className="h-4 w-4" /> Descargar Reporte (PDF)
                </button>
                <button
                  onClick={handleExportExcel}
                  className="bg-white hover:bg-zinc-50 border border-blue-200 text-blue-600 font-bold py-2 px-5 rounded-lg text-xs flex items-center gap-1.5"
                >
                  <FileSpreadsheet className="h-4 w-4" /> Descargar Reporte (Excel)
                </button>
                <button
                  onClick={() => setShowReport(false)}
                  className="bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-500 font-bold py-2 px-5 rounded-lg text-xs"
                >
                  Cerrar
                </button>
              </div>
            </div>

            {/* KPIs Block */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Inventario de Tienda */}
              <div className="bg-white border border-zinc-200 border-l-4 border-l-[#009639] rounded-2xl p-5 shadow-xs space-y-2">
                <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Inventario de Tienda</p>
                <p className="text-2xl font-bold text-[#1f2937] leading-none">
                  Bs. {totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-zinc-400 font-semibold">Valor total consolidado</p>
              </div>

              {/* Capacidad Ocupada */}
              <div className="bg-white border border-zinc-200 border-l-4 border-l-[#ffb81c] rounded-2xl p-5 shadow-xs space-y-2">
                <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Capacidad Ocupada</p>
                <p className="text-2xl font-bold text-[#1f2937] leading-none">{totalUnits} U.</p>
                <p className="text-xs text-zinc-400 font-semibold">Unidades totales colocadas</p>
              </div>

              {/* Diversidad de SKUs */}
              <div className="bg-white border border-zinc-200 border-l-4 border-l-blue-600 rounded-2xl p-5 shadow-xs space-y-2">
                <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Diversidad de SKUs</p>
                <p className="text-2xl font-bold text-[#1f2937] leading-none">{totalSKUs} SKUs</p>
                <p className="text-xs text-zinc-400 font-semibold">Referencias de productos activas</p>
              </div>
            </div>

            {/* List of Gondola tables */}
            <div className="space-y-6">
              {store.library.map((g: any) => {
                const levels = getGondolaLevelsReport(g.config);
                const stats = getGlobalStats(g.config, products);
                const uniqueProductIds = Array.from(
                  new Set(
                    g.config.shelves.flatMap((s: any) =>
                      s.products.flatMap((p: any) => p.layers.map((l: any) => l.productId))
                    )
                  )
                );
                const productRefMap = new Map(uniqueProductIds.map((id: any, index: number) => [id, index + 1]));

                return (
                  <div key={g.id} className="border border-zinc-200 rounded-2xl p-6 space-y-5">
                    {/* Gondola heading block */}
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-base font-bold text-[#1f2937]">{g.name}</h3>
                        <p className="text-xs text-zinc-400 font-semibold mt-1">
                          Tipo: {g.config.type.charAt(0).toUpperCase() + g.config.type.slice(1)} · Dimensiones: {g.config.width}×{g.config.height}×{g.config.depth} cm
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-base font-bold text-[#009639]">
                          Bs. {stats.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                        <p className="text-xs text-zinc-400 font-semibold mt-1">
                          {stats.totalUnits} Unidades · {Array.from(new Set(g.config.shelves.flatMap((s: any) => s.products.flatMap((p: any) => p.layers.map((l: any) => l.productId))))).length} SKUs
                        </p>
                      </div>
                    </div>

                    {/* Table of levels */}
                    <div className="border border-zinc-200 rounded-xl overflow-hidden bg-white">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-400 font-bold text-[10px] uppercase">
                            <th className="p-3 w-16 text-center">Ref</th>
                            <th className="p-3 w-32">SKU</th>
                            <th className="p-3">Producto</th>
                            <th className="p-3 w-32">Cantidad</th>
                            <th className="p-3 w-32">Precio Unit.</th>
                            <th className="p-3 w-32">Valor Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {levels.every((l: any) => l.placements.length === 0) ? (
                            <tr>
                              <td colSpan={6} className="p-8 text-center text-zinc-400 font-bold">
                                Sin productos colocados
                              </td>
                            </tr>
                          ) : (
                            levels.map((level: any) => (
                              <React.Fragment key={level.shelfIndex}>
                                {/* Shelf header row */}
                                <tr className="bg-[#e6f4ea] border-y border-zinc-200/60">
                                  <td colSpan={6} className="px-3 py-1.5 text-[11px] font-bold text-[#009639]">
                                    Nivel {level.shelfIndex + 1} ({level.type === "perchero" ? "Gancho" : "Plancha"})
                                  </td>
                                </tr>

                                {/* Product placements */}
                                {level.placements.length === 0 ? (
                                  <tr className="border-b border-zinc-150">
                                    <td colSpan={6} className="p-3 text-center text-zinc-400 italic">
                                      Sin productos colocados en este nivel
                                    </td>
                                  </tr>
                                ) : (
                                  level.placements.map((pl: any, idx: number) => (
                                    <tr key={idx} className="border-b border-zinc-150 hover:bg-zinc-50/50">
                                      <td className="p-3 font-mono font-bold text-center text-zinc-400">{productRefMap.get(pl.productId) || "-"}</td>
                                      <td className="p-3 font-mono font-bold text-zinc-500">{pl.sku}</td>
                                      <td className="p-3 text-zinc-750 font-medium">{pl.name}</td>
                                      <td className="p-3 font-bold text-zinc-700">{pl.totalUnits} U.</td>
                                      <td className="p-3 text-zinc-500">Bs. {pl.price.toFixed(2)}</td>
                                      <td className="p-3 font-bold text-zinc-800">Bs. {pl.totalValue.toFixed(2)}</td>
                                    </tr>
                                  ))
                                )}

                                {/* Shelf Subtotal row */}
                                {level.placements.length > 0 && (
                                  <tr className="border-b border-zinc-200 bg-zinc-50/20 font-bold text-zinc-500">
                                    <td colSpan={3} className="p-3 text-right">
                                      Subtotal Nivel {level.shelfIndex + 1} ({level.type === "perchero" ? "Gancho" : "Plancha"}):
                                    </td>
                                    <td className="p-3 text-zinc-700">{level.levelUnits} U.</td>
                                    <td className="p-3">-</td>
                                    <td className="p-3 text-[#1f2937]">Bs. {level.levelValue.toFixed(2)}</td>
                                  </tr>
                                )}
                              </React.Fragment>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Consolidated General table (Fulfillment) */}
            <div className="space-y-4">
              <h3 className="text-base font-bold text-[#1f2937]">Consolidado General de Tienda (Fulfillment)</h3>

              <div className="border border-zinc-200 rounded-xl overflow-hidden bg-white">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-400 font-bold text-[10px] uppercase">
                      <th className="p-3 w-32">SKU</th>
                      <th className="p-3">Producto</th>
                      <th className="p-3">Categoría</th>
                      <th className="p-3 w-32">Total Unidades</th>
                      <th className="p-3 w-32">Precio Unit.</th>
                      <th className="p-3 w-32">Valor Consolidado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const data = getFulfillmentData();
                      if (data.length === 0) {
                        return (
                          <tr>
                            <td colSpan={6} className="p-8 text-center text-zinc-400 font-bold">
                              No hay productos colocados en toda la tienda.
                            </td>
                          </tr>
                        );
                      }

                      const totalUnits = data.reduce((sum, item) => sum + item.totalUnits, 0);
                      const totalValue = data.reduce((sum, item) => sum + (item.totalUnits * item.product.price), 0);

                      return (
                        <>
                          {data.map((item, idx) => (
                            <tr key={idx} className="border-b border-zinc-150 hover:bg-zinc-50/50">
                              <td className="p-3 font-mono font-bold text-zinc-500">{item.product.sku}</td>
                              <td className="p-3 text-zinc-750 font-medium">{item.product.name}</td>
                              <td className="p-3 text-zinc-400 font-semibold">{item.product.category}</td>
                              <td className="p-3 font-bold text-[#009639]">{item.totalUnits} U.</td>
                              <td className="p-3 text-zinc-500">Bs. {item.product.price.toFixed(2)}</td>
                              <td className="p-3 font-bold text-zinc-800">Bs. {(item.totalUnits * item.product.price).toFixed(2)}</td>
                            </tr>
                          ))}
                          <tr className="bg-zinc-50/80 font-bold text-zinc-800 border-t border-zinc-200">
                            <td colSpan={3} className="p-3 text-right text-zinc-500 uppercase tracking-wider text-[10px]">
                              Total Consolidado Tienda:
                            </td>
                            <td className="p-3 text-[#009639] text-xs font-black">{totalUnits} U.</td>
                            <td className="p-3 text-zinc-400">-</td>
                            <td className="p-3 text-zinc-900 text-xs font-black">Bs. {totalValue.toFixed(2)}</td>
                          </tr>
                        </>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}
      </main>

      {/* ==================================================================== */
      /* MODAL: CREAR GÓNDOLA                                                 */
      /* ==================================================================== */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[20px] max-w-[520px] w-full shadow-2xl flex flex-col overflow-hidden border border-zinc-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 flex items-center justify-between border-b border-zinc-150">
              <h3 className="text-base font-bold text-[#1f2937]">Crear Nueva Góndola</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 hover:bg-zinc-100 rounded-lg text-zinc-400 hover:text-zinc-650 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateGondola}>
              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider">
                    Nombre / Identificador
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Góndola OTC Snacks"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full bg-white border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm text-zinc-800 focus:outline-none focus:border-[#009639] focus:ring-2 focus:ring-[#009639]/10 transition-all font-medium"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider">
                      Pasillo
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Pasillo 3"
                      value={newAisle}
                      onChange={(e) => setNewAisle(e.target.value)}
                      className="w-full bg-white border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm text-zinc-800 focus:outline-none focus:border-[#009639] focus:ring-2 focus:ring-[#009639]/10 transition-all font-medium"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider">
                      Categoría
                    </label>
                    {isCreatingNewCategory ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          placeholder="Nueva categoría..."
                          value={newCategoryInputValue}
                          onChange={(e) => setNewCategoryInputValue(e.target.value)}
                          className="flex-1 min-w-0 bg-white border border-zinc-200 rounded-lg px-3.5 py-2 text-sm text-zinc-800 focus:outline-none focus:border-[#009639] focus:ring-2 focus:ring-[#009639]/10 transition-all font-medium"
                          required
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const val = newCategoryInputValue.trim();
                            if (val) {
                              addCustomCategory(val);
                              setNewCategory(val);
                              setNewCategoryInputValue("");
                              setIsCreatingNewCategory(false);
                            }
                          }}
                          className="bg-[#009639] hover:bg-[#008030] text-white p-2.5 rounded-lg flex items-center justify-center transition-colors shadow-sm"
                          title="Guardar Categoría"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setNewCategoryInputValue("");
                            setIsCreatingNewCategory(false);
                          }}
                          className="bg-zinc-100 hover:bg-zinc-200 text-zinc-500 p-2.5 rounded-lg flex items-center justify-center transition-colors border border-zinc-200"
                          title="Cancelar"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <div className="relative flex-1 min-w-0">
                          <button
                            type="button"
                            onClick={() => setIsCreateCatDropdownOpen(!isCreateCatDropdownOpen)}
                            className="w-full min-w-0 bg-white border border-zinc-200 hover:border-[#009639] text-zinc-700 text-sm font-medium rounded-lg px-3.5 py-2 flex items-center justify-between shadow-xs transition-all text-left outline-none gap-2"
                          >
                            <span className="truncate">{newCategory || "Seleccionar..."}</span>
                            <ChevronDown className={`h-4 w-4 text-zinc-455 flex-shrink-0 transition-transform duration-200 ${isCreateCatDropdownOpen ? 'transform rotate-180 text-[#009639]' : ''}`} />
                          </button>

                          {isCreateCatDropdownOpen && (
                            <>
                              <div className="fixed inset-0 z-[100]" onClick={() => setIsCreateCatDropdownOpen(false)} />
                              <div className="absolute left-0 right-0 mt-1 bg-white border border-zinc-150 rounded-xl shadow-xl py-2 z-[110] animate-in fade-in slide-in-from-top-2 duration-150 max-h-[200px] overflow-y-auto">
                                {allCategories.length === 0 ? (
                                  <div className="px-4 py-2 text-xs text-zinc-400 font-semibold italic text-center">Sin categorías</div>
                                ) : (
                                  allCategories.map((c: any) => (
                                    <button
                                      key={c}
                                      type="button"
                                      onClick={() => {
                                        setNewCategory(c);
                                        setIsCreateCatDropdownOpen(false);
                                      }}
                                      className={`w-full text-left px-4 py-2 text-xs font-bold transition-colors flex items-center justify-between ${newCategory === c ? 'bg-[#e6f4ea] text-[#009639]' : 'text-zinc-655 hover:bg-zinc-555'
                                        }`}
                                    >
                                      <span>{c}</span>
                                      {newCategory === c && <Check className="h-3.5 w-3.5 text-[#009639] flex-shrink-0" />}
                                    </button>
                                  ))
                                )}
                              </div>
                            </>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsCreatingNewCategory(true)}
                          className="bg-[#e6f4ea] hover:bg-[#d8eedf] text-[#009639] border border-[#009639]/20 p-2.5 rounded-lg flex items-center justify-center transition-all shadow-xs"
                          title="Crear Nueva Categoría"
                        >
                          <Plus className="h-4.5 w-4.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider">
                    Notas / Descripción (Opcional)
                  </label>
                  <textarea
                    placeholder="Detalles técnicos..."
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    rows={2}
                    className="w-full bg-white border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm text-zinc-800 focus:outline-none focus:border-[#009639] focus:ring-2 focus:ring-[#009639]/10 transition-all font-medium resize-none"
                  />
                </div>
              </div>

              <div className="px-6 py-4 border-t border-zinc-150 flex items-center justify-end gap-3 bg-zinc-50/50">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="bg-white hover:bg-zinc-50 border border-zinc-250 text-zinc-700 font-bold py-2 px-5 rounded-lg text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-[#009639] hover:bg-[#008030] text-white font-bold py-2 px-5 rounded-lg text-sm transition-colors"
                >
                  Crear Góndola
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */
      /* MODAL: EDITAR GÓNDOLA                                                 */
      /* ==================================================================== */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[20px] max-w-[520px] w-full shadow-2xl flex flex-col overflow-hidden border border-zinc-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 flex items-center justify-between border-b border-zinc-150">
              <h3 className="text-base font-bold text-[#1f2937]">Editar Góndola</h3>
              <button
                onClick={() => setShowEditModal(null)}
                className="p-1 hover:bg-zinc-100 rounded-lg text-zinc-400 hover:text-zinc-650 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit}>
              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider">
                    Nombre / Identificador
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-white border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm text-zinc-800 focus:outline-none focus:border-[#009639] focus:ring-2 focus:ring-[#009639]/10 transition-all font-medium"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider">
                      Pasillo
                    </label>
                    <input
                      type="text"
                      value={editAisle}
                      onChange={(e) => setEditAisle(e.target.value)}
                      className="w-full bg-white border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm text-zinc-800 focus:outline-none focus:border-[#009639] focus:ring-2 focus:ring-[#009639]/10 transition-all font-medium"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider">
                      Categoría
                    </label>
                    {isEditingNewCategory ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          placeholder="Nueva categoría..."
                          value={editCategoryInputValue}
                          onChange={(e) => setEditCategoryInputValue(e.target.value)}
                          className="flex-1 min-w-0 bg-white border border-zinc-200 rounded-lg px-3.5 py-2 text-sm text-zinc-800 focus:outline-none focus:border-[#009639] focus:ring-2 focus:ring-[#009639]/10 transition-all font-medium"
                          required
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const val = editCategoryInputValue.trim();
                            if (val) {
                              addCustomCategory(val);
                              setEditCategory(val);
                              setEditCategoryInputValue("");
                              setIsEditingNewCategory(false);
                            }
                          }}
                          className="bg-[#009639] hover:bg-[#008030] text-white p-2.5 rounded-lg flex items-center justify-center transition-colors shadow-sm"
                          title="Guardar Categoría"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditCategoryInputValue("");
                            setIsEditingNewCategory(false);
                          }}
                          className="bg-zinc-100 hover:bg-zinc-200 text-zinc-500 p-2.5 rounded-lg flex items-center justify-center transition-colors border border-zinc-200"
                          title="Cancelar"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <div className="relative flex-1 min-w-0">
                          <button
                            type="button"
                            onClick={() => setIsEditCatDropdownOpen(!isEditCatDropdownOpen)}
                            className="w-full min-w-0 bg-white border border-zinc-200 hover:border-[#009639] text-zinc-700 text-sm font-medium rounded-lg px-3.5 py-2 flex items-center justify-between shadow-xs transition-all text-left outline-none gap-2"
                          >
                            <span className="truncate">{editCategory || "Seleccionar..."}</span>
                            <ChevronDown className={`h-4 w-4 text-zinc-455 flex-shrink-0 transition-transform duration-200 ${isEditCatDropdownOpen ? 'transform rotate-180 text-[#009639]' : ''}`} />
                          </button>

                          {isEditCatDropdownOpen && (
                            <>
                              <div className="fixed inset-0 z-[100]" onClick={() => setIsEditCatDropdownOpen(false)} />
                              <div className="absolute left-0 right-0 mt-1 bg-white border border-zinc-150 rounded-xl shadow-xl py-2 z-[110] animate-in fade-in slide-in-from-top-2 duration-150 max-h-[200px] overflow-y-auto">
                                {allCategories.length === 0 ? (
                                  <div className="px-4 py-2 text-xs text-zinc-400 font-semibold italic text-center">Sin categorías</div>
                                ) : (
                                  allCategories.map(c => (
                                    <button
                                      key={c}
                                      type="button"
                                      onClick={() => {
                                        setEditCategory(c);
                                        setIsEditCatDropdownOpen(false);
                                      }}
                                      className={`w-full text-left px-4 py-2 text-xs font-bold transition-colors flex items-center justify-between ${editCategory === c ? 'bg-[#e6f4ea] text-[#009639]' : 'text-zinc-655 hover:bg-zinc-555'
                                        }`}
                                    >
                                      <span>{c}</span>
                                      {editCategory === c && <Check className="h-3.5 w-3.5 text-[#009639] flex-shrink-0" />}
                                    </button>
                                  ))
                                )}
                              </div>
                            </>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsEditingNewCategory(true)}
                          className="bg-[#e6f4ea] hover:bg-[#d8eedf] text-[#009639] border border-[#009639]/20 p-2.5 rounded-lg flex items-center justify-center transition-all shadow-xs"
                          title="Crear Nueva Categoría"
                        >
                          <Plus className="h-4.5 w-4.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider">
                    Notas / Descripción
                  </label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={2}
                    className="w-full bg-white border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm text-zinc-800 focus:outline-none focus:border-[#009639] focus:ring-2 focus:ring-[#009639]/10 transition-all font-medium resize-none"
                  />
                </div>
              </div>

              <div className="px-6 py-4 border-t border-zinc-150 flex items-center justify-end gap-3 bg-zinc-50/50">
                <button
                  type="button"
                  onClick={() => setShowEditModal(null)}
                  className="bg-white hover:bg-zinc-50 border border-zinc-250 text-zinc-700 font-bold py-2 px-5 rounded-lg text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-[#009639] hover:bg-[#008030] text-white font-bold py-2 px-5 rounded-lg text-sm transition-colors"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */
      /* MODAL: DUPLICAR GÓNDOLA                                               */
      /* ==================================================================== */}
      {showDuplicateModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[20px] max-w-[460px] w-full shadow-2xl flex flex-col overflow-hidden border border-zinc-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 flex items-center justify-between border-b border-zinc-150">
              <h3 className="text-base font-bold text-[#1f2937]">¿Duplicar Góndola?</h3>
              <button
                onClick={() => setShowDuplicateModal(null)}
                className="p-1 hover:bg-zinc-100 rounded-lg text-zinc-400 hover:text-zinc-650 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-zinc-650 font-medium leading-relaxed">
                ¿Deseas crear una copia exacta de la góndola{" "}
                <span className="font-bold text-[#1f2937]">
                  {store.library.find((g: any) => g.id === showDuplicateModal)?.name}
                </span>
                ?
              </p>

              <div className="bg-[#e6f4ea] border border-green-200 text-[#009639] rounded-xl p-4 flex items-start gap-2 text-xs font-semibold leading-relaxed">
                <Copy className="h-4.5 w-4.5 text-[#009639] flex-shrink-0 mt-0.5" />
                <span>
                  Se clonarán todos los niveles y la distribución de productos de forma idéntica, creando una nueva góndola en la biblioteca.
                </span>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-zinc-150 flex items-center justify-end gap-3 bg-zinc-50/50">
              <button
                type="button"
                onClick={() => setShowDuplicateModal(null)}
                className="bg-white hover:bg-zinc-50 border border-zinc-250 text-zinc-700 font-bold py-2 px-5 rounded-lg text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDuplicateConfirm}
                className="bg-[#009639] hover:bg-[#008030] text-white font-bold py-2 px-5 rounded-lg text-sm transition-colors shadow-sm shadow-green-500/10"
              >
                Sí, Duplicar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */
      /* MODAL: ELIMINAR GÓNDOLA                                               */
      /* ==================================================================== */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[20px] max-w-[460px] w-full shadow-2xl flex flex-col overflow-hidden border border-zinc-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 flex items-center justify-between border-b border-zinc-150">
              <h3 className="text-base font-bold text-[#1f2937]">¿Eliminar Góndola?</h3>
              <button
                onClick={() => setShowDeleteModal(null)}
                className="p-1 hover:bg-zinc-100 rounded-lg text-zinc-400 hover:text-zinc-650 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-zinc-650 font-medium leading-relaxed">
                ¿Estás seguro de que deseas eliminar permanentemente la góndola{" "}
                <span className="font-bold text-[#1f2937]">
                  {store.library.find((g: any) => g.id === showDeleteModal)?.name}
                </span>
                ?
              </p>

              <div className="bg-red-50 border border-red-200 text-red-500 rounded-xl p-4 flex items-start gap-2 text-xs font-semibold leading-relaxed">
                <AlertTriangle className="h-4.5 w-4.5 text-red-500 flex-shrink-0 mt-0.5" />
                <span>
                  Esta acción destruirá todos los niveles y planogramas configurados en esta góndola y no se puede deshacer.
                </span>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-zinc-150 flex items-center justify-end gap-3 bg-zinc-50/50">
              <button
                type="button"
                onClick={() => setShowDeleteModal(null)}
                className="bg-white hover:bg-zinc-50 border border-zinc-250 text-zinc-700 font-bold py-2 px-5 rounded-lg text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="bg-[#ef4444] hover:bg-[#dc2626] text-white font-bold py-2 px-5 rounded-lg text-sm transition-colors shadow-sm shadow-red-500/10"
              >
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
import React from "react";
