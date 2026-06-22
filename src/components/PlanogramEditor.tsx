"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { usePlanogramStore } from "@/store/usePlanogramStore";
import { ProductPlacement } from "@/types";
import {
  getPlacedDimensions,
  getShelfUsableHeight,
  getShelfUsedWidth,
  getPlacementWidth,
  getPlacementBoundingBox,
  getGlobalStats,
  getPlacementName,
  getDepthUnits,
  getStackCapacity
} from "@/utils/planogramHelpers";
import {
  ArrowLeft,
  RotateCcw,
  RotateCw,
  Plus,
  Trash2,
  Columns,
  Undo2,
  Redo2,
  Sparkles,
  Maximize2,
  Rotate3d,
  Grid,
  TrendingUp,
  Box,
  Sliders,
  DollarSign,
  Search,
  ChevronRight,
  Info,
  Maximize,
  LogOut,
  FileText,
  FileSpreadsheet,
  Check,
  X,
  ChevronDown,
  AlertCircle,
  AlertTriangle,
  Save
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

const globalCameraState = {
  rotateX: -15,
  rotateY: 25,
  zoom: 1,
  scrollLeft: 0,
  scrollTop: 0,
  panX: 0,
  panY: 0
};

export default function PlanogramEditor() {
  const router = useRouter();
  const params = useParams();
  const gondolaId = params.gondolaId as string;
  const [isAuth, setIsAuth] = useState(false);

  useEffect(() => {
    const auth = localStorage.getItem("locatel_auth");
    if (auth === "true") {
      setIsAuth(true);
    } else {
      router.push("/login");
    }
  }, [router]);

  const {
    stores,
    currentStoreId,
    currentGondolaId,
    products,
    gondola,
    undoStack,
    redoStack,
    updateGondola,
    emptyGondola,
    toggleAutoPack,
    setShelfType,
    setShelfHookSpacing,
    setShelfGap,
    setShelfDepth,
    placeProduct,
    moveProduct,
    stackProduct,
    removeFromShelf,
    rotateProduct,
    updateProductFacings,
    undo,
    redo,
    loadGondola,
    duplicateGondola,
    fetchProducts
  } = usePlanogramStore();

  useEffect(() => {
    if (isAuth) {
      fetchProducts();
    }
  }, [isAuth, fetchProducts]);

  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState<string | null>(null);
  const [showConfirmEmpty, setShowConfirmEmpty] = useState(false);

  // Excel Import States
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const loadFromDatabase = usePlanogramStore((state) => state.loadFromDatabase);

  useEffect(() => {
    if (gondolaId) {
      loadGondola(gondolaId);
      setInputDrafts({});
    }
  }, [gondolaId, loadGondola]);

  // Synchronize route if currentGondolaId changes (e.g. duplication)
  useEffect(() => {
    if (currentGondolaId && currentGondolaId !== gondolaId) {
      router.push(`/editor/${currentGondolaId}`, { scroll: false });
    }
  }, [currentGondolaId, gondolaId, router]);

  // Fetch metadata real de la Góndola y la Tienda desde SQL Server
  const [activeGondolaWrapper, setActiveGondolaWrapper] = useState<any>(null);
  const [relatedGondolas, setRelatedGondolas] = useState<any[]>([]);
  const [storeName, setStoreName] = useState<string>("Tienda");

  useEffect(() => {
    if (gondolaId) {
      fetch(`/api/gondolas/${gondolaId}?t=${Date.now()}`, { cache: "no-store" })
        .then(res => res.json())
        .then(resData => {
          if (resData.success && resData.data) {
            setActiveGondolaWrapper(resData.data);
            if (resData.data.store) {
              setStoreName(resData.data.store.name);
            }
            if (resData.related) {
              setRelatedGondolas(resData.related);
            }

            // Format DB data to match Zustand exactly
            const dbGondola = {
              type: resData.data.type,
              width: resData.data.width,
              height: resData.data.height,
              depth: resData.data.depth,
              numShelves: resData.data.numShelves,
              gapBetweenShelves: resData.data.gapBetweenShelves,
              baseHeight: resData.data.baseHeight,
              shelfThickness: resData.data.shelfThickness,
              shelfDepth: resData.data.shelfDepth,
              shelfWidth: resData.data.shelfWidth,
              autoPack: resData.data.autoPack,
              shelves: (resData.data.shelves || []).map((s: any) => ({
                index: s.index,
                y: s.y,
                type: s.type,
                hookSpacing: s.hookSpacing,
                depth: s.depth,
                products: (s.products || []).map((p: any) => ({
                  x: p.x,
                  hookIndex: p.hookIndex,
                  layers: (p.layers || []).map((l: any) => ({
                    index: l.index,
                    facings: l.facings,
                    orientation: l.orientation,
                    productId: l.productId
                  }))
                }))
              }))
            };
            loadFromDatabase(gondolaId, dbGondola);
          }
        })
        .catch(err => console.error("Error fetching gondola metadata:", err));
    }
  }, [gondolaId]);

  // We no longer rely on Zustand local stores array for metadata
  let matchingGondolas = activeGondolaWrapper ? [{ ...activeGondolaWrapper, config: gondola }] : [];

  if (relatedGondolas.length > 0) {
    const mappedRelated = relatedGondolas.map((g: any) => ({
      ...g,
      config: {
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
        shelves: (g.shelves || []).map((s: any) => ({
          index: s.index,
          y: s.y,
          type: s.type,
          hookSpacing: s.hookSpacing,
          depth: s.depth,
          products: (s.products || []).map((p: any) => ({
            x: p.x,
            hookIndex: p.hookIndex,
            layers: (p.layers || []).map((l: any) => ({
              index: l.index,
              facings: l.facings,
              orientation: l.orientation,
              productId: l.productId
            }))
          }))
        }))
      }
    }));
    matchingGondolas = [...matchingGondolas, ...mappedRelated];
    // Sort alphabetically by name to keep stable visual ordering
    matchingGondolas.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  }

  // 3D Viewport Controls
  const [rotateX, setRotateX] = useState(globalCameraState.rotateX);
  const [rotateY, setRotateY] = useState(globalCameraState.rotateY);
  const [zoom, setZoom] = useState(globalCameraState.zoom);
  const [panX, setPanX] = useState(globalCameraState.panX || 0);
  const [panY, setPanY] = useState(globalCameraState.panY || 0);

  const isDraggingRotate = useRef(false);
  const isDraggingPan = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const panStart = useRef({ x: 0, y: 0 });
  const scrollStart = useRef({ left: 0, top: 0 });
  const viewportRef = useRef<HTMLDivElement | null>(null);

  // Search & Catalog state
  const [inputDrafts, setInputDrafts] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("TODOS");
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const toggleCategoryExpand = (cat: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [cat]: !prev[cat]
    }));
  };

  // Selection states
  const [selectedPlacement, setSelectedPlacement] = useState<{
    shelfIndex: number;
    placementIndex: number;
    layerIndex: number;
  } | null>(null);

  const [activeRightTab, setActiveRightTab] = useState<"details" | "cabinet" | "shelf">("details");
  const [dragOverShelf, setDragOverShelf] = useState<{ gondolaId: string, shelfIndex: number } | null>(null);
  const [dragCaretX, setDragCaretX] = useState<number | null>(null);
  const [dragOverProduct, setDragOverProduct] = useState<{ shelfIdx: number, placementIdx: number } | null>(null);

  // Report Modal and Toast Notification state
  const [showReportModal, setShowReportModal] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [pendingNavigationUrl, setPendingNavigationUrl] = useState<string | null>(null);

  const safeNavigate = (url: string) => {
    if (undoStack.length > 0) {
      setPendingNavigationUrl(url);
    } else {
      router.push(url);
    }
  };

  const handleSaveToDatabase = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/gondolas/${gondolaId}/planogram`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gondola }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        triggerToast("Planograma guardado", "success");
        // Clear undo/redo stacks on successful save
        usePlanogramStore.setState({ undoStack: [], redoStack: [] });
      } else {
        triggerToast(data.error || "Error guardando planograma", "error");
      }
    } catch (e) {
      triggerToast("Error de conexión", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const [hoveredProduct, setHoveredProduct] = useState<{
    product: any;
    layer: any;
    shelfIdx: number;
    placementIdx: number;
    unitsInZ: number;
    totalUnits: number;
    totalValue: number;
    catAbbr: string;
    rect: DOMRect;
    flipDown: boolean;
  } | null>(null);

  const downloadExcelTemplate = () => {
    const headers = [
      "SKU",
      "Producto",
      "Marca",
      "Departamento",
      "Categoría",
      "Subcategoría",
      "Cod Prov",
      "Proveedor",
      "Alto",
      "Ancho",
      "Longitud",
      "Unidad de Medida",
      "Costo"
    ];

    const exampleRow = [
      "SAP-FAR01",
      "Paracetamol 500mg (10 Tab)",
      "Bayer",
      "Farmacia",
      "Farmacia",
      "Analgésicos",
      "PROV-001",
      "Droguería Central",
      "6",
      "10",
      "2",
      "cm",
      "1.20"
    ];

    const worksheetData = [headers, exampleRow];
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

    worksheet["!cols"] = [
      { wch: 15 }, // SKU
      { wch: 30 }, // Producto
      { wch: 15 }, // Marca
      { wch: 15 }, // Departamento
      { wch: 15 }, // Categoría
      { wch: 15 }, // Subcategoría
      { wch: 12 }, // Cod Prov
      { wch: 20 }, // Proveedor
      { wch: 8 },  // Alto
      { wch: 8 },  // Ancho
      { wch: 10 }, // Longitud
      { wch: 16 }, // Unidad de Medida
      { wch: 10 }  // Costo
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Plantilla de Productos");
    XLSX.writeFile(workbook, "Plantilla_Catalogo_Locatel.xlsx");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setImportResult(null);
      setImportErrors([]);
    }
  };

  const handleImportExcel = async () => {
    if (!selectedFile) return;
    setImporting(true);
    setImportResult(null);
    setImportErrors([]);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: "binary" });
        const wsname = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[wsname];
        const rawData: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (rawData.length < 2) {
          setImportErrors(["El archivo está vacío o no contiene filas de datos."]);
          setImporting(false);
          return;
        }

        const headers = rawData[0].map((h: any) => String(h).trim().toLowerCase());
        const getIdx = (names: string[]) => headers.findIndex((h: string) => names.includes(h));

        const idxSku = getIdx(["sku", "código", "codigo", "id"]);
        const idxName = getIdx(["producto", "nombre", "name", "descripción", "descripcion"]);
        const idxBrand = getIdx(["marca", "brand"]);
        const idxDept = getIdx(["departamento", "depto", "dept"]);
        const idxCat = getIdx(["categoría", "categoria", "category"]);
        const idxSubcat = getIdx(["subcategoría", "subcategoria", "subcategory"]);
        const idxCodProv = getIdx(["cod prov", "codigo proveedor", "código proveedor", "codprov", "providercode"]);
        const idxProv = getIdx(["proveedor", "provider"]);
        const idxHeight = getIdx(["alto", "height"]);
        const idxWidth = getIdx(["ancho", "width"]);
        const idxDepth = getIdx(["longitud", "profundidad", "depth", "profundidad base"]);
        const idxUnit = getIdx(["unidad de medida", "unidad", "unit"]);
        const idxCost = getIdx(["costo", "precio", "price", "cost"]);

        if (idxSku === -1 || idxName === -1 || idxWidth === -1 || idxHeight === -1 || idxDepth === -1 || idxCat === -1) {
          setImportErrors([
            "Las columnas obligatorias no pudieron ser identificadas. Por favor, descarga la plantilla y usa los nombres de columnas predefinidos."
          ]);
          setImporting(false);
          return;
        }

        const productsToUpsert: any[] = [];
        const parsingErrors: string[] = [];

        for (let i = 1; i < rawData.length; i++) {
          const row = rawData[i];
          if (!row || row.length === 0 || (row.length === 1 && !row[0])) continue;

          const sku = row[idxSku] !== undefined ? String(row[idxSku]).trim() : "";
          const name = row[idxName] !== undefined ? String(row[idxName]).trim() : "";
          const brand = idxBrand !== -1 && row[idxBrand] !== undefined ? String(row[idxBrand]).trim() : "";
          const dept = idxDept !== -1 && row[idxDept] !== undefined ? String(row[idxDept]).trim() : "";
          const cat = idxCat !== -1 && row[idxCat] !== undefined ? String(row[idxCat]).trim() : "";
          const subcat = idxSubcat !== -1 && row[idxSubcat] !== undefined ? String(row[idxSubcat]).trim() : "";
          const codProv = idxCodProv !== -1 && row[idxCodProv] !== undefined ? String(row[idxCodProv]).trim() : "";
          const prov = idxProv !== -1 && row[idxProv] !== undefined ? String(row[idxProv]).trim() : "";

          let heightRaw = row[idxHeight];
          let widthRaw = row[idxWidth];
          let depthRaw = row[idxDepth];
          let unit = idxUnit !== -1 && row[idxUnit] !== undefined ? String(row[idxUnit]).trim().toLowerCase() : "cm";
          let costRaw = idxCost !== -1 && row[idxCost] !== undefined ? row[idxCost] : 0;

          if (!sku) {
            parsingErrors.push(`Fila ${i + 1}: SKU vacío. Fila omitida.`);
            continue;
          }

          let height = parseFloat(heightRaw);
          let width = parseFloat(widthRaw);
          let depth = parseFloat(depthRaw);
          let cost = parseFloat(costRaw);

          if (isNaN(height) || isNaN(width) || isNaN(depth)) {
            parsingErrors.push(`Fila ${i + 1} (SKU: ${sku}): Dimensiones inválidas (Alto: ${heightRaw}, Ancho: ${widthRaw}, Longitud: ${depthRaw}).`);
            continue;
          }

          if (unit === "mm") {
            height = height / 10;
            width = width / 10;
            depth = depth / 10;
          }

          productsToUpsert.push({
            sku,
            name,
            brand,
            department: dept,
            category: cat,
            subcategory: subcat,
            providerCode: codProv,
            provider: prov,
            height,
            width,
            depth,
            price: cost
          });
        }

        if (productsToUpsert.length === 0) {
          setImportErrors([...parsingErrors, "No se encontraron productos válidos para importar."]);
          setImporting(false);
          return;
        }

        const res = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ products: productsToUpsert })
        });

        const data = await res.json();
        if (data.success) {
          setImportResult({
            created: data.data.createdCount,
            updated: data.data.updatedCount,
            errors: [...parsingErrors, ...data.data.errors]
          });
          await fetchProducts();
        } else {
          setImportErrors([data.error || "Ocurrió un error al procesar el archivo en el servidor."]);
        }

      } catch (err: any) {
        console.error(err);
        setImportErrors(["Error al leer el archivo Excel: " + (err.message || err)]);
      } finally {
        setImporting(false);
      }
    };
    reader.readAsBinaryString(selectedFile);
  };

  const triggerToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    const duration = type === "error" ? 4000 : 3000;
    setTimeout(() => setToast(null), duration);
  };

  const commitDraftValue = (
    key: string,
    minVal: number,
    maxVal: number,
    parseFn: (v: string) => number,
    updateFn: (num: number) => void
  ) => {
    const draft = inputDrafts[key];
    if (draft === undefined) return;

    if (draft.trim() === "") {
      setInputDrafts(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      return;
    }

    let val = parseFn(draft);
    if (!isNaN(val)) {
      val = Math.max(minVal, Math.min(maxVal, val));
      updateFn(val);
    }

    setInputDrafts(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleMasterDimensionChange = (dimension: string, value: number) => {
    if (gondola[dimension as keyof typeof gondola] === value) return;
    const currentHeight = dimension === "height" ? value : gondola.height;
    const currentNumShelves = dimension === "numShelves" ? value : gondola.numShelves;
    const currentBaseHeight = dimension === "baseHeight" ? value : (gondola.baseHeight || 20);
    const thick = gondola.shelfThickness || 2;
    let newGap = gondola.gapBetweenShelves;
    if (currentNumShelves > 1) {
      newGap = (currentHeight - currentBaseHeight - (currentNumShelves * thick)) / (currentNumShelves - 1);
      if (newGap < 10) newGap = 10;
    }
    updateGondola({ [dimension]: value, gapBetweenShelves: newGap });
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    localStorage.removeItem("locatel_auth");
    localStorage.removeItem("locatel_user");
    router.push("/login");
  };

  useEffect(() => {
    // Keyboard shortcuts for Undo / Redo
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
        setSelectedPlacement(null);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        setSelectedPlacement(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  const handleWheelNatively = useCallback((e: WheelEvent) => {
    if (
      (e.target as HTMLElement).closest(".dashboard-overlay") ||
      (e.target as HTMLElement).closest(".product-modal") ||
      (e.target as HTMLElement).closest("#product-details-modal") ||
      (e.target as HTMLElement).closest(".report-modal-content")
    ) return;

    e.preventDefault();
    setZoom(prev => Math.max(0.3, Math.min(3, prev - e.deltaY * 0.0005)));
  }, []);

  const handleViewportScroll = useCallback(() => {
    if (viewportRef.current) {
      globalCameraState.scrollLeft = viewportRef.current.scrollLeft;
      globalCameraState.scrollTop = viewportRef.current.scrollTop;
    }
  }, []);

  const viewportCallback = useCallback((node: HTMLDivElement | null) => {
    if (viewportRef.current) {
      viewportRef.current.removeEventListener("wheel", handleWheelNatively);
    }
    viewportRef.current = node;
    if (node) {
      node.addEventListener("wheel", handleWheelNatively, { passive: false });
      node.scrollLeft = globalCameraState.scrollLeft;
      node.scrollTop = globalCameraState.scrollTop;
    }
  }, [handleWheelNatively]);

  useEffect(() => {
    globalCameraState.rotateX = rotateX;
  }, [rotateX]);

  useEffect(() => {
    globalCameraState.rotateY = rotateY;
  }, [rotateY]);

  useEffect(() => {
    globalCameraState.zoom = zoom;
  }, [zoom]);

  useEffect(() => {
    globalCameraState.panX = panX;
  }, [panX]);

  useEffect(() => {
    globalCameraState.panY = panY;
  }, [panY]);

  if (!isAuth) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#f3f4f6]">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#009639] border-t-transparent"></div>
      </div>
    );
  }

  if (!gondola) return null;

  // Catalog categories
  const categories = ["TODOS", ...Array.from(new Set(products.map(p => p.category)))];

  const filteredProducts = products.filter(p => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      p.name.toLowerCase().includes(query) ||
      p.sku.toLowerCase().includes(query) ||
      (p.category && p.category.toLowerCase().includes(query)) ||
      (p.subcategory && p.subcategory.toLowerCase().includes(query)) ||
      (p.brand && p.brand.toLowerCase().includes(query));
    const matchesCategory = selectedCategoryFilter === "TODOS" || p.category === selectedCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Calculate live stock details
  const stats = getGlobalStats(gondola, products);

  // Drag and Drop Mouse Handlers
  const handleViewportMouseDown = (e: React.MouseEvent) => {
    if (
      (e.target as HTMLElement).closest("button") ||
      (e.target as HTMLElement).closest("input") ||
      (e.target as HTMLElement).closest("select") ||
      (e.target as HTMLElement).closest(".draggable-product") ||
      (e.target as HTMLElement).closest(".placed-product") ||
      (e.target as HTMLElement).closest(".product-hover-card") ||
      (e.target as HTMLElement).closest(".dashboard-overlay") ||
      (e.target as HTMLElement).closest(".product-modal") ||
      (e.target as HTMLElement).closest("#product-details-modal")
    ) {
      return;
    }

    if (e.button === 2) {
      // Right click: rotation
      isDraggingRotate.current = true;
      dragStart.current = { x: e.clientX, y: e.clientY };
    } else if (e.button === 0) {
      // Left click: pan
      isDraggingPan.current = true;
      dragStart.current = { x: e.clientX, y: e.clientY };
      panStart.current = { x: panX, y: panY };
    }
  };

  const handleViewportMouseMove = (e: React.MouseEvent) => {
    if (isDraggingRotate.current) {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      setRotateY(prev => prev + dx * 0.18);
      setRotateX(prev => Math.max(-60, Math.min(60, prev - dy * 0.18)));
      dragStart.current = { x: e.clientX, y: e.clientY };
    } else if (isDraggingPan.current) {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      setPanX(panStart.current.x + dx);
      setPanY(panStart.current.y + dy);
    }
  };

  const handleViewportMouseUp = () => {
    isDraggingRotate.current = false;
    isDraggingPan.current = false;
  };

  const resetCamera = () => {
    setRotateX(-15);
    setRotateY(25);
    setZoom(1);
    setPanX(0);
    setPanY(0);
  };

  // Excel Export for single gondola
  const handleExportGondolaExcel = () => {
    if (!gondola || !gondola.shelves) return;

    const detailedProductsData: any[] = [];
    gondola.shelves.forEach((s, sIdx) => {
      s.products.forEach(p => {
        p.layers.forEach((l) => {
          const prod = products.find(pr => pr.id === l.productId);
          if (!prod) return;
          const dims = getPlacedDimensions(prod, l.orientation);
          const depthUnits = Math.max(1, Math.floor(s.depth / dims.depth));
          const totalUnits = (l.facings || 1) * depthUnits;
          const totalValue = totalUnits * prod.price;

          detailedProductsData.push({
            "Nivel Estante": `Nivel ${sIdx + 1}`,
            "Tipo Estante": s.type === "perchero" ? "Gancho" : "Plancha",
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
            "Frentes (Facings)": l.facings || 1,
            "Profundidad (Fondo)": depthUnits,
            "Unidades": totalUnits,
            "Precio Unitario (Bs.)": prod.price,
            "Valor Total (Bs.)": totalValue
          });
        });
      });
    });

    const totalDistinctProducts = new Set(detailedProductsData.map(r => r.SKU)).size;

    // Append total row
    detailedProductsData.push({
      "Nivel Estante": "TOTAL CONSOLIDADO",
      "Tipo Estante": "",
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
      "Frentes (Facings)": 0,
      "Profundidad (Fondo)": 0,
      "Unidades": stats.totalUnits,
      "Precio Unitario (Bs.)": 0,
      "Valor Total (Bs.)": stats.totalValue
    });

    const wb = XLSX.utils.book_new();
    const wsGondola = XLSX.utils.aoa_to_sheet([
      ["REPORTE FINANCIERO DE GÓNDOLA"],
      [`Góndola: ${activeGondolaWrapper?.name || "Góndola"}`],
      [`ID Góndola: ${gondolaId}`],
      [`Pasillo / Aisle: ${activeGondolaWrapper?.aisle || "N/A"}`],
      [`Categoría Góndola: ${activeGondolaWrapper?.category || "N/A"}`],
      [`Dimensiones Góndola: ${gondola.width}cm x ${gondola.height}cm x ${gondola.depth}cm`],
      [`Fecha y Hora de Generación: ${new Date().toLocaleString()}`],
      [`Total de Unidades Planificadas: ${stats.totalUnits}`],
      [`Valor de Inventario Consolidado (Bs.): Bs. ${stats.totalValue.toFixed(2)}`],
      [`Ocupación de Góndola: ${stats.overallOccupation.toFixed(1)}%`],
      [`Cantidad de Productos Diferentes: ${totalDistinctProducts}`],
      [] // Blank row
    ]);

    XLSX.utils.sheet_add_json(wsGondola, detailedProductsData, { origin: "A13" });

    // Set column widths
    wsGondola["!cols"] = [
      { wch: 15 }, // Nivel Estante
      { wch: 15 }, // Tipo Estante
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
      { wch: 18 }, // Frentes (Facings)
      { wch: 20 }, // Profundidad (Fondo)
      { wch: 12 }, // Unidades
      { wch: 18 }, // Precio Unitario ($)
      { wch: 18 }  // Valor Total ($)
    ];

    XLSX.utils.book_append_sheet(wb, wsGondola, "Detalle Góndola");
    XLSX.writeFile(wb, `Reporte_Gondola_${(activeGondolaWrapper?.name || "Gondola").replace(/\s+/g, "_")}.xlsx`);
    triggerToast("Excel descargado con éxito");
  };

  // PDF Export for single gondola
  const handleExportGondolaPDF = () => {
    if (!gondola) return;
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
      g.shelves.forEach((s: any, sIdx: number) => {
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

    // Header Band
    doc.setFillColor(0, 150, 57);
    doc.rect(0, 0, pageWidth, 60, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(14);
    doc.text("LOCATEL PLANOGRAM PRO", 40, 25);

    doc.setFontSize(8);
    doc.setFont("Helvetica", "normal");
    const title = activeGondolaWrapper?.name || "GÓNDOLA";
    doc.text(`REPORTE DE MOBILIARIO: ${title.toUpperCase()}`, 40, 39);

    // Summary stats card
    doc.setFillColor(245, 247, 250);
    doc.roundedRect(40, 80, pageWidth - 80, 40, 5, 5, "F");

    doc.setFontSize(7.5);
    doc.setFont("Helvetica", "bold");
    doc.setTextColor(120, 120, 120);
    doc.text("VALOR TOTAL MUEBLE", 60, 95);
    doc.text("UNIDADES TOTALES", 240, 95);
    doc.text("SKUS DIVERSOS", 420, 95);

    const uniqueSKUsCount = Array.from(
      new Set(
        gondola.shelves.flatMap(s => s.products.flatMap(p => p.layers.map(l => l.productId)))
      )
    ).length;

    doc.setFontSize(11);
    doc.setTextColor(30, 30, 30);
    doc.text(`Bs. ${stats.totalValue.toFixed(2)}`, 60, 110);
    doc.text(`${stats.totalUnits} U.`, 240, 110);
    doc.text(`${uniqueSKUsCount} SKUs`, 420, 110);

    // Build unique product list for referencing
    const uniqueProductIds = Array.from(
      new Set(
        gondola.shelves.flatMap(s => s.products.flatMap(p => p.layers.map(l => l.productId)))
      )
    );
    const productRefMap = new Map(uniqueProductIds.map((id, index) => [id, index + 1]));

    // Draw 2D Vector Gondola Schematic
    const diagramY = 140;
    const diagramH = 550;
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text("VISTA FRONTAL TÉCNICA (2D)", 40, 135);

    drawGondolaVector2D(gondola, 40, diagramY, pageWidth - 80, diagramH, productRefMap);

    // Page Break for the inventory table!
    doc.addPage();

    // Re-draw Header on Page 2 for consistency
    doc.setFillColor(0, 150, 57);
    doc.rect(0, 0, pageWidth, 60, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(14);
    doc.text("LOCATEL PLANOGRAM PRO", 40, 25);

    doc.setFontSize(8);
    doc.setFont("Helvetica", "normal");
    doc.text(`DETALLE DE MOBILIARIO - INVENTARIO CONSOLIDADO: ${title.toUpperCase()}`, 40, 39);

    // Inventory title on Page 2
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(30, 30, 30);
    doc.text("Detalle de Inventario", 40, 85);

    // Inventory rows
    const rows: any[] = [];
    gondola.shelves.forEach((s, sIdx) => {
      s.products.forEach(p => {
        p.layers.forEach(l => {
          const prod = products.find(pr => pr.id === l.productId);
          if (prod) {
            const dims = getPlacedDimensions(prod, l.orientation || 0);
            const depthUnits = Math.max(1, Math.floor(s.depth / dims.depth));
            const units = l.facings * depthUnits;
            const val = units * prod.price;

            rows.push([
              productRefMap.get(l.productId) || "",
              `Nivel ${sIdx + 1} (${s.type === "perchero" ? "Gancho" : "Bandeja"})`,
              prod.sku,
              prod.name,
              `${units} U.`,
              `Bs. ${prod.price.toFixed(2)}`,
              `Bs. ${val.toFixed(2)}`
            ]);
          }
        });
      });
    });

    autoTable(doc, {
      startY: 95,
      head: [["Ref", "Nivel", "SKU", "Producto", "Cantidad", "Precio Unit.", "Valor Total"]],
      body: rows,
      theme: "grid",
      styles: { fontSize: 8 },
      headStyles: { fillColor: [0, 150, 57] },
      columnStyles: {
        0: { cellWidth: 25, halign: 'center' },
        1: { cellWidth: 90 },
        2: { cellWidth: 65 },
        4: { cellWidth: 50, halign: 'center' },
        5: { cellWidth: 55, halign: 'right' },
        6: { cellWidth: 60, halign: 'right' }
      }
    });

    doc.save(`Reporte_Gondola_${(activeGondolaWrapper?.name || "Gondola").replace(/\s+/g, "_")}.pdf`);
    triggerToast("PDF descargado con éxito");
  };

  // Drag and drop mechanics for products
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragOverShelf = (e: React.DragEvent, shelfIndex: number, targetGondolaId: string, targetGConfig: any) => {
    e.preventDefault();
    setDragOverShelf({ gondolaId: targetGondolaId, shelfIndex });

    const rect = e.currentTarget.getBoundingClientRect();
    const dragXpx = e.clientX - rect.left;
    const dragXcm = (dragXpx / rect.width) * targetGConfig.width;

    const shelf = targetGConfig.shelves[shelfIndex];
    if (!shelf) return;

    let caretX = 0;
    let currentAccumX = 0;
    let found = false;

    if (shelf.products && shelf.products.length > 0) {
      for (let i = 0; i < shelf.products.length; i++) {
        const p = shelf.products[i];
        let pWidth = 0;
        if (p.layers && p.layers.length > 0) {
          const baseLayer = p.layers[0];
          const prod = products.find(pr => pr.id === baseLayer.productId);
          pWidth = prod ? getPlacedDimensions(prod, baseLayer.orientation || 0).width * baseLayer.facings : 10;
        }
        const midX = currentAccumX + pWidth / 2;
        if (dragXcm < midX) {
          caretX = currentAccumX;
          found = true;
          break;
        }
        currentAccumX += pWidth;
      }
      if (!found) {
        caretX = currentAccumX;
      }
    }
    setDragCaretX(caretX);
  };

  const handleDrop = (e: React.DragEvent, targetShelfIndex: number, targetGondolaId: string, targetGConfig: any) => {
    e.preventDefault();
    setDragOverShelf(null);
    setDragCaretX(null);

    if (targetGondolaId !== gondolaId) {
      loadGondola(targetGondolaId);
    }

    const dataStr = e.dataTransfer.getData("application/json");
    const textData = e.dataTransfer.getData("text/plain");

    const rect = e.currentTarget.getBoundingClientRect();
    const dropXpx = e.clientX - rect.left;
    const dropXcm = (dropXpx / rect.width) * targetGConfig.width;

    const shelf = targetGConfig.shelves[targetShelfIndex];
    if (!shelf) return;

    let targetHookIndex: number | undefined;
    let targetX: number | undefined;
    let insertIndex: number | undefined;

    if (shelf.type === "perchero") {
      const spacing = shelf.hookSpacing || 15;
      const numHooks = Math.floor(targetGConfig.width / spacing);
      const margin = (targetGConfig.width - (numHooks - 1) * spacing) / 2;

      let closestHookIdx = 0;
      let minDistance = Infinity;
      for (let i = 0; i < numHooks; i++) {
        const hookX = margin + i * spacing;
        const dist = Math.abs(dropXcm - hookX);
        if (dist < minDistance) {
          minDistance = dist;
          closestHookIdx = i;
        }
      }
      targetHookIndex = closestHookIdx;
    } else {
      if (targetGConfig.autoPack) {
        let currentAccumX = 0;
        let found = false;
        for (let i = 0; i < shelf.products.length; i++) {
          const p = shelf.products[i];
          let pWidth = 0;
          if (p.layers && p.layers.length > 0) {
            const baseLayer = p.layers[0];
            const prod = products.find(pr => pr.id === baseLayer.productId);
            pWidth = prod ? getPlacedDimensions(prod, baseLayer.orientation || 0).width * baseLayer.facings : 10;
          }
          const midX = currentAccumX + pWidth / 2;
          if (dropXcm < midX) {
            insertIndex = i;
            found = true;
            break;
          }
          currentAccumX += pWidth;
        }
        if (!found) {
          insertIndex = shelf.products.length;
        }
      } else {
        let productWidth = 10;
        if (dataStr) {
          try {
            const dragData = JSON.parse(dataStr);
            if (dragData.type === "new") {
              const prod = products.find(pr => pr.id === dragData.productId);
              if (prod) productWidth = prod.width;
            } else {
              const sourceGondolaPreset = stores.flatMap(s => s.library).find(g => g.id === dragData.sourceGondolaId);
              const sourceGondolaConfig = sourceGondolaPreset?.config;
              const sourceShelf = sourceGondolaConfig?.shelves[dragData.sourceShelfIndex];
              const placement = sourceShelf?.products[dragData.sourcePlacementIndex];
              if (placement) {
                const layer = (dragData.sourceLayerIndex !== undefined && placement.layers[dragData.sourceLayerIndex])
                  ? placement.layers[dragData.sourceLayerIndex]
                  : placement.layers[0];
                const prod = products.find(pr => pr.id === layer.productId);
                if (prod) {
                  productWidth = getPlacedDimensions(prod, layer.orientation || 0).width * layer.facings;
                }
              }
            }
          } catch (e) { }
        } else if (textData) {
          try {
            const dragData = JSON.parse(textData);
            if (dragData.productId) {
              const prod = products.find(pr => pr.id === dragData.productId);
              if (prod) productWidth = prod.width;
            }
          } catch (e) {
            const prod = products.find(pr => pr.id === textData);
            if (prod) productWidth = prod.width;
          }
        }
        targetX = dropXcm - (productWidth / 2);
      }
    }

    if (dataStr) {
      try {
        const dragData = JSON.parse(dataStr);
        if (dragData.type === "new") {
          const res = placeProduct(targetShelfIndex, dragData.productId, 1, targetHookIndex, targetX, insertIndex);
          if (!res.success) triggerToast(res.reason || "Error al colocar el producto", "error");
        } else if (dragData.sourceGondolaId === targetGondolaId) {
          const res = moveProduct(
            dragData.sourceShelfIndex,
            dragData.sourcePlacementIndex,
            targetShelfIndex,
            targetHookIndex,
            dragData.sourceLayerIndex,
            targetX,
            insertIndex
          );
          if (!res.success) triggerToast(res.reason || "Error al mover el producto", "error");
        } else {
          const sourceGondolaPreset = stores.flatMap(s => s.library).find(g => g.id === dragData.sourceGondolaId);
          const sourceGondolaConfig = sourceGondolaPreset?.config;
          const sourceShelf = sourceGondolaConfig?.shelves[dragData.sourceShelfIndex];
          const placement = sourceShelf?.products[dragData.sourcePlacementIndex];

          if (placement) {
            const layer = (dragData.sourceLayerIndex !== undefined && placement.layers[dragData.sourceLayerIndex])
              ? placement.layers[dragData.sourceLayerIndex]
              : placement.layers[0];

            loadGondola(dragData.sourceGondolaId);
            removeFromShelf(dragData.sourceShelfIndex, dragData.sourcePlacementIndex, dragData.sourceLayerIndex);

            loadGondola(targetGondolaId);
            const res = placeProduct(targetShelfIndex, layer.productId, layer.facings, targetHookIndex, targetX, insertIndex);
            if (!res.success) triggerToast(res.reason || "Error al colocar el producto", "error");
          }
        }
      } catch (err) {
        console.error(err);
      }
    } else if (textData) {
      try {
        let pId = textData;
        try {
          const parsed = JSON.parse(textData);
          if (parsed.productId) pId = parsed.productId;
        } catch (e) { }

        const res = placeProduct(targetShelfIndex, pId, 1, targetHookIndex, targetX, insertIndex);
        if (!res.success) triggerToast(res.reason || "Error al colocar el producto", "error");
      } catch (err) {
        console.error(err);
      }
    }
    setSelectedPlacement(null);
  };

  // Double click catalog fast placing
  const handleCatalogDoubleClick = (productId: string) => {
    // Find shelf with maximum available width
    let bestShelfIndex = 0;
    let maxAvail = -9999;
    gondola.shelves.forEach((s, idx) => {
      if (s.type === "plancha") {
        const avail = gondola.width - getShelfUsedWidth(gondola, idx, products);
        if (avail > maxAvail) {
          maxAvail = avail;
          bestShelfIndex = idx;
        }
      }
    });

    const res = placeProduct(bestShelfIndex, productId, 1);
    if (!res.success) {
      triggerToast(res.reason || "Error al colocar el producto", "error");
    }
  };

  // Stack drop handler (drop a product card on top of an existing item)
  const handleStackDrop = (e: React.DragEvent, shelfIndex: number, placementIndex: number) => {
    e.stopPropagation();
    e.preventDefault();

    const dataStr = e.dataTransfer.getData("application/json");
    if (!dataStr) return;

    try {
      const data = JSON.parse(dataStr);
      if (data.type === "new") {
        const res = stackProduct(shelfIndex, placementIndex, data.productId);
        if (!res.success) triggerToast(res.reason || "Error al apilar el producto", "error");
      } else if (data.sourceShelfIndex !== undefined) {
        // Drop an existing placement to stack it on top
        const sourceShelf = gondola.shelves[data.sourceShelfIndex];
        const sourcePlacement = sourceShelf?.products[data.sourcePlacementIndex];
        if (sourcePlacement && sourcePlacement.layers.length > 0) {
          const prodToMove = sourcePlacement.layers[data.sourceLayerIndex || 0].productId;
          const res = stackProduct(shelfIndex, placementIndex, prodToMove);
          if (res.success) {
            removeFromShelf(data.sourceShelfIndex, data.sourcePlacementIndex, data.sourceLayerIndex || 0);
          } else {
            triggerToast(res.reason || "Error al apilar el producto", "error");
          }
        }
      }
      setSelectedPlacement(null);
    } catch (err) {
      console.error(err);
    }
  };

  // Active Placement variables
  let activePlacement: ProductPlacement | null = null;
  let activeProduct: any = null;
  if (selectedPlacement) {
    const s = gondola.shelves[selectedPlacement.shelfIndex];
    activePlacement = s?.products[selectedPlacement.placementIndex] || null;
    if (activePlacement) {
      const l = activePlacement.layers[selectedPlacement.layerIndex];
      activeProduct = products.find(p => p.id === l?.productId) || null;
    }
  }
  // 3D Cabinet dimension mapping
  const pxScale = 3.2; // 1 cm = 3.2px
  const widthPx = gondola.width * pxScale;
  const heightPx = gondola.height * pxScale;
  const depthPx = gondola.depth * pxScale;

  const totalUnscaledWidth = matchingGondolas.reduce((acc, gObj) => {
    const gWidth = gObj.id === gondolaId ? gondola.width : (gObj.config?.width || 120);
    return acc + gWidth * 3;
  }, 0) + (matchingGondolas.length - 1) * 80;
  const totalUnscaledHeight = gondola.height * 3;

  return (
    <div className="h-screen max-h-screen bg-[#f3f4f6] text-zinc-800 flex flex-col font-sans overflow-hidden">
      {/* Editor Top Bar Header */}
      <header className="border-b border-zinc-200 bg-white/95 backdrop-blur-md h-16 flex items-center justify-between px-6 z-40 select-none shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              if (activeGondolaWrapper?.storeId) {
                safeNavigate(`/stores/${activeGondolaWrapper.storeId}`);
              } else {
                safeNavigate("/stores");
              }
            }}
            className="p-2 hover:bg-zinc-150 rounded-xl text-zinc-500 hover:text-zinc-850 transition-colors"
            title="Volver a la Tienda"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div className="h-5 w-px bg-zinc-200" />

          {/* Undo/Redo */}
          <div className="flex items-center gap-1">
            <button
              onClick={undo}
              disabled={undoStack.length === 0}
              className="p-2 hover:bg-zinc-100 rounded-xl text-zinc-400 hover:text-zinc-750 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="Deshacer (Ctrl+Z)"
            >
              <Undo2 className="h-4 w-4" />
            </button>
            <button
              onClick={redo}
              disabled={redoStack.length === 0}
              className="p-2 hover:bg-zinc-100 rounded-xl text-zinc-400 hover:text-zinc-750 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="Rehacer (Ctrl+Y)"
            >
              <Redo2 className="h-4 w-4" />
            </button>
          </div>

          <div className="h-5 w-px bg-zinc-200" />

          {/* Locatel Logo */}
          <img src="/logo.png" alt="Locatel Logo" className="h-7 w-auto object-contain" />

          {/* Store Detail Text */}
          <div className="hidden md:block">
            <h1 className="text-sm font-bold text-zinc-800 leading-none">
              {storeName} › {activeGondolaWrapper?.name || "Góndola"}
            </h1>
            <p className="text-[9px] text-zinc-500 font-medium mt-1 uppercase tracking-wider">
              Pasillo: {activeGondolaWrapper?.aisle || "N/A"} · Categoría: {activeGondolaWrapper?.category || "N/A"}
              {activeGondolaWrapper?.description && ` · ${activeGondolaWrapper.description}`}
            </p>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveToDatabase}
            disabled={isSaving}
            className="flex items-center gap-2 bg-[#ffb81c] hover:bg-[#e0a000] text-zinc-900 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            <span className="hidden sm:inline">{isSaving ? "Guardando..." : "Guardar"}</span>
            <span className="sm:hidden">Guardar</span>
          </button>

          <button
            onClick={() => setShowReportModal(true)}
            className="bg-[#009639] hover:bg-[#008030] text-white text-xs font-bold py-2 px-4 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
          >
            <FileText className="h-3.5 w-3.5" /> Ver Informe Detallado
          </button>

          <button
            onClick={() => {
              setSelectedFile(null);
              setImportResult(null);
              setImportErrors([]);
              setShowImportModal(true);
            }}
            className="bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-650 text-xs font-bold py-2 px-4 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-[#009639]" /> Importar Excel
          </button>

          <button
            onClick={handleLogout}
            className="p-2 hover:bg-red-50 text-zinc-400 hover:text-red-505 rounded-xl transition-all"
            title="Cerrar Sesión"
          >
            <LogOut className="h-4.5 w-4.5" />
          </button>
        </div>
      </header>

      {/* Editor Body Area */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* Left Sidebar: Cabinet Configuration & Shelf Properties */}
        <aside className="w-80 flex-shrink-0 border-r border-zinc-200 bg-white/95 backdrop-blur flex flex-col z-10 shadow-sm overflow-y-auto overflow-x-auto scrollbar-thin select-none">
          <div className="p-5 space-y-6">

            {/* Section 1: Tipo de Mobiliario */}
            <div className="space-y-3">
              <h3 className="text-[11px] font-bold text-[#006827] uppercase tracking-wider">Tipo de Mobiliario</h3>
              <div className="relative">
                <select
                  value={gondola.type}
                  onChange={(e) => {
                    const type = e.target.value;
                    const presets = {
                      central: { width: 120, height: 150, depth: 45, baseHeight: 15, numShelves: 4 },
                      cabecera: { width: 90, height: 150, depth: 35, baseHeight: 15, numShelves: 4 },
                      pared: { width: 100, height: 210, depth: 40, baseHeight: 20, numShelves: 5 },
                      refrigerado: { width: 180, height: 200, depth: 65, baseHeight: 25, numShelves: 4 }
                    };
                    const p = presets[type as keyof typeof presets];
                    if (p) {
                      const thick = gondola.shelfThickness || 2;
                      let newGap = 35;
                      if (p.numShelves > 1) {
                        newGap = (p.height - p.baseHeight - (p.numShelves * thick)) / (p.numShelves - 1);
                        if (newGap < 10) newGap = 10;
                      }
                      updateGondola({
                        type: type as any,
                        width: p.width,
                        height: p.height,
                        depth: p.depth,
                        baseHeight: p.baseHeight,
                        numShelves: p.numShelves,
                        gapBetweenShelves: newGap
                      });
                    }
                  }}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-xs font-bold text-zinc-700 focus:outline-none focus:ring-1 focus:ring-[#009639] appearance-none"
                >
                  <option value="pared">Góndola de Pared (Estándar)</option>
                  <option value="central">Góndola Central (Doble Cara)</option>
                  <option value="cabecera">Góndola de Cabecera</option>
                  <option value="refrigerado">Mueble Refrigerado / Vitrina</option>
                </select>
                <ChevronDown className="absolute right-3.5 top-3.5 h-4 w-4 text-zinc-400 pointer-events-none" />
              </div>
            </div>

            <hr className="border-zinc-150" />

            {/* Section 2: Posicionamiento de Productos */}
            <div className="space-y-3">
              <h3 className="text-[11px] font-bold text-[#006827] uppercase tracking-wider">Alineación de Productos</h3>
              <div className="flex items-center justify-between p-3.5 border border-zinc-150 rounded-xl bg-zinc-50/50">
                <span className="text-xs font-bold text-zinc-600">Alineación automática</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={gondola.autoPack}
                    onChange={toggleAutoPack}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#009639]"></div>
                </label>
              </div>
              <div className="p-3 bg-green-50/50 border border-green-100/50 rounded-xl text-[10px] text-[#009639] font-medium leading-relaxed">
                <strong>Tip:</strong> Usa Drag & Drop para añadir productos, al soltar en la bandeja se alinean de izquierda a derecha de forma ordenada.
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmEmpty(true)}
                className="w-full py-2.5 px-4 bg-red-50 hover:bg-red-100 border border-red-200 text-red-650 hover:text-red-700 font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Trash2 className="h-4 w-4" /> Vaciar Góndola
              </button>
            </div>

            <hr className="border-zinc-150" />

            {/* Section 3: Dimensiones Base */}
            <div className="space-y-4">
              <h3 className="text-[11px] font-bold text-[#006827] uppercase tracking-wider">Dimensiones Base</h3>

              {/* Preset Selector */}
              <div>
                <label className="block text-[10px] font-semibold uppercase text-zinc-500 tracking-wider mb-1">Preset de Tamaño</label>
                <div className="relative">
                  <select
                    value={
                      ["90x150x30", "120x200x48", "120x220x60"].includes(`${gondola.width}x${gondola.height}x${gondola.depth}`)
                        ? `${gondola.width}x${gondola.height}x${gondola.depth}`
                        : "custom"
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val !== "custom") {
                        const [w, h, d] = val.split("x").map(Number);
                        if (h !== gondola.height) {
                          handleMasterDimensionChange("height", h);
                          updateGondola({ width: w, depth: d });
                        } else {
                          updateGondola({ width: w, depth: d });
                        }
                      }
                    }}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2 text-xs font-bold text-zinc-700 focus:outline-none focus:ring-1 focus:ring-[#009639] appearance-none"
                  >
                    <option value="custom">Personalizado (Manual)</option>
                    <option value="90x150x30">90x150x30 cm (Mini)</option>
                    <option value="120x200x48">120x200x48 cm (Estándar)</option>
                    <option value="120x220x60">120x220x60 cm (Almacén)</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-2.5 h-4 w-4 text-zinc-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Ancho Total (cm)</label>
                <input
                  type="number"
                  min={50}
                  max={240}
                  step={5}
                  value={inputDrafts["width"] !== undefined ? inputDrafts["width"] : gondola.width}
                  onChange={(e) => {
                    const txt = e.target.value;
                    setInputDrafts(prev => ({ ...prev, "width": txt }));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      commitDraftValue("width", 50, 240, parseInt, (v) => updateGondola({ width: v }));
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  onBlur={() => {
                    commitDraftValue("width", 50, 240, parseInt, (v) => updateGondola({ width: v }));
                  }}
                  className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-2.5 text-xs font-bold text-zinc-700 focus:outline-none focus:ring-1 focus:ring-[#009639] transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Alto Total (cm)</label>
                <input
                  type="number"
                  min={100}
                  max={260}
                  step={5}
                  value={inputDrafts["height"] !== undefined ? inputDrafts["height"] : gondola.height}
                  onChange={(e) => {
                    const txt = e.target.value;
                    setInputDrafts(prev => ({ ...prev, "height": txt }));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      commitDraftValue("height", 100, 260, parseInt, (v) => handleMasterDimensionChange("height", v));
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  onBlur={() => {
                    commitDraftValue("height", 100, 260, parseInt, (v) => handleMasterDimensionChange("height", v));
                  }}
                  className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-2.5 text-xs font-bold text-zinc-700 focus:outline-none focus:ring-1 focus:ring-[#009639] transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Profundidad Base (cm)</label>
                <input
                  type="number"
                  min={20}
                  max={80}
                  step={5}
                  value={inputDrafts["depth"] !== undefined ? inputDrafts["depth"] : gondola.depth}
                  onChange={(e) => {
                    const txt = e.target.value;
                    setInputDrafts(prev => ({ ...prev, "depth": txt }));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      commitDraftValue("depth", 20, 80, parseInt, (v) => updateGondola({ depth: v }));
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  onBlur={() => {
                    commitDraftValue("depth", 20, 80, parseInt, (v) => updateGondola({ depth: v }));
                  }}
                  className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-2.5 text-xs font-bold text-zinc-700 focus:outline-none focus:ring-1 focus:ring-[#009639] transition-all"
                />
              </div>
            </div>

            <hr className="border-zinc-150" />

            {/* Section 4: Niveles y Zócalo */}
            <div className="space-y-4">
              <h3 className="text-[11px] font-bold text-[#006827] uppercase tracking-wider">Niveles y Zócalo</h3>

              <div>
                <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Número de Niveles</label>
                <input
                  type="number"
                  min={2}
                  max={8}
                  value={inputDrafts["numShelves"] !== undefined ? inputDrafts["numShelves"] : gondola.numShelves}
                  onChange={(e) => {
                    const txt = e.target.value;
                    setInputDrafts(prev => ({ ...prev, "numShelves": txt }));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      commitDraftValue("numShelves", 2, 8, parseInt, (v) => handleMasterDimensionChange("numShelves", v));
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  onBlur={() => {
                    commitDraftValue("numShelves", 2, 8, parseInt, (v) => handleMasterDimensionChange("numShelves", v));
                  }}
                  className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-2.5 text-xs font-bold text-zinc-700 focus:outline-none focus:ring-1 focus:ring-[#009639] transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Espacio entre Niveles (cm)</label>
                <input
                  type="number"
                  min={10}
                  max={100}
                  value={inputDrafts["gapBetweenShelves"] !== undefined ? inputDrafts["gapBetweenShelves"] : Math.round(gondola.gapBetweenShelves * 10) / 10}
                  onChange={(e) => {
                    const txt = e.target.value;
                    setInputDrafts(prev => ({ ...prev, "gapBetweenShelves": txt }));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      commitDraftValue("gapBetweenShelves", 10, 100, parseFloat, (v) => updateGondola({ gapBetweenShelves: v }));
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  onBlur={() => {
                    commitDraftValue("gapBetweenShelves", 10, 100, parseFloat, (v) => updateGondola({ gapBetweenShelves: v }));
                  }}
                  className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-2.5 text-xs font-bold text-zinc-700 focus:outline-none focus:ring-1 focus:ring-[#009639] transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Altura del Zócalo (Base)</label>
                <input
                  type="number"
                  min={10}
                  max={40}
                  step={2}
                  value={inputDrafts["baseHeight"] !== undefined ? inputDrafts["baseHeight"] : gondola.baseHeight}
                  onChange={(e) => {
                    const txt = e.target.value;
                    setInputDrafts(prev => ({ ...prev, "baseHeight": txt }));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      commitDraftValue("baseHeight", 10, 40, parseInt, (v) => handleMasterDimensionChange("baseHeight", v));
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  onBlur={() => {
                    commitDraftValue("baseHeight", 10, 40, parseInt, (v) => handleMasterDimensionChange("baseHeight", v));
                  }}
                  className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-2.5 text-xs font-bold text-zinc-700 focus:outline-none focus:ring-1 focus:ring-[#009639] transition-all"
                />
              </div>
            </div>

            <hr className="border-zinc-150" />

            {/* Section 5: Configuración de Niveles (Shelf Details) */}
            <div className="space-y-4">
              <h3 className="text-[11px] font-bold text-[#006827] uppercase tracking-wider">Configuración de Niveles</h3>

              <div className="space-y-5">
                {[...gondola.shelves].reverse().map((shelf) => {
                  const sIdx = shelf.index;
                  return (
                    <div key={shelf.id} className="p-3 border border-zinc-150 rounded-xl bg-zinc-50/30 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-zinc-700">Nivel {sIdx + 1}</span>
                        <div className="relative">
                          <select
                            value={shelf.type}
                            onChange={(e) => setShelfType(sIdx, e.target.value as any)}
                            className="bg-white border border-zinc-200 rounded-lg px-2.5 py-1 text-[10px] font-bold text-zinc-600 focus:outline-none appearance-none pr-6 font-sans"
                          >
                            <option value="plancha">Plancha</option>
                            <option value="perchero">Perchero</option>
                          </select>
                          <ChevronDown className="absolute right-1.5 top-2 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
                        </div>
                      </div>

                      {/* Level Y Adjustment */}
                      <div>
                        <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">Distancia al Nivel {sIdx + 1} (cm):</label>
                        <input
                          type="number"
                          min={10}
                          max={gondola.height - 20}
                          value={(() => {
                            if (inputDrafts[`shelf-y-${sIdx}`] !== undefined) return inputDrafts[`shelf-y-${sIdx}`];
                            const prevShelfTop = sIdx === 0 ? 0 : (parseFloat(gondola.shelves[sIdx - 1].y as any) + (parseFloat(gondola.shelfThickness as any) || 2));
                            return Math.round(shelf.y - prevShelfTop);
                          })()}
                          onChange={(e) => {
                            const txt = e.target.value;
                            setInputDrafts(prev => ({ ...prev, [`shelf-y-${sIdx}`]: txt }));
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              commitDraftValue(`shelf-y-${sIdx}`, 10, gondola.height - 20, parseFloat, (v) => {
                                if (sIdx === 0) {
                                  const baseHeight = parseFloat(gondola.baseHeight as any) || 20;
                                  setShelfGap(0, v - baseHeight);
                                } else {
                                  setShelfGap(sIdx, v);
                                }
                              });
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          onBlur={() => {
                            commitDraftValue(`shelf-y-${sIdx}`, 10, gondola.height - 20, parseFloat, (v) => {
                              if (sIdx === 0) {
                                const baseHeight = parseFloat(gondola.baseHeight as any) || 20;
                                setShelfGap(0, v - baseHeight);
                              } else {
                                setShelfGap(sIdx, v);
                              }
                            });
                          }}
                          className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-1.5 text-xs font-bold text-zinc-700 focus:outline-none focus:ring-1 focus:ring-[#009639] transition-all"
                        />
                      </div>

                      {/* Level Depth Adjustment */}
                      <div>
                        <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">Profundidad (cm):</label>
                        <input
                          type="number"
                          min={15}
                          max={80}
                          step={5}
                          value={inputDrafts[`shelf-depth-${sIdx}`] !== undefined ? inputDrafts[`shelf-depth-${sIdx}`] : (shelf.depth || gondola.shelfDepth)}
                          onChange={(e) => {
                            const txt = e.target.value;
                            setInputDrafts(prev => ({ ...prev, [`shelf-depth-${sIdx}`]: txt }));
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              commitDraftValue(`shelf-depth-${sIdx}`, 15, 80, parseInt, (v) => setShelfDepth(sIdx, v));
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          onBlur={() => {
                            commitDraftValue(`shelf-depth-${sIdx}`, 15, 80, parseInt, (v) => setShelfDepth(sIdx, v));
                          }}
                          className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-1.5 text-xs font-bold text-zinc-700 focus:outline-none focus:ring-1 focus:ring-[#009639] transition-all"
                        />
                      </div>

                      {/* Hook Spacing */}
                      {shelf.type === "perchero" && (
                        <div>
                          <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">Separación Ganchos (cm):</label>
                          <input
                            type="number"
                            min={5}
                            max={30}
                            value={inputDrafts[`shelf-hookSpacing-${sIdx}`] !== undefined ? inputDrafts[`shelf-hookSpacing-${sIdx}`] : (shelf.hookSpacing || 15)}
                            onChange={(e) => {
                              const txt = e.target.value;
                              setInputDrafts(prev => ({ ...prev, [`shelf-hookSpacing-${sIdx}`]: txt }));
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                commitDraftValue(`shelf-hookSpacing-${sIdx}`, 5, 30, parseInt, (v) => {
                                  const res = setShelfHookSpacing(sIdx, v);
                                  if (!res.success) triggerToast(res.reason || "Error al cambiar la separación", "error");
                                });
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                            onBlur={() => {
                              commitDraftValue(`shelf-hookSpacing-${sIdx}`, 5, 30, parseInt, (v) => {
                                const res = setShelfHookSpacing(sIdx, v);
                                if (!res.success) triggerToast(res.reason || "Error al cambiar la separación", "error");
                              });
                            }}
                            className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-1.5 text-xs font-bold text-zinc-700 focus:outline-none focus:ring-1 focus:ring-[#009639] transition-all"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <hr className="border-zinc-150" />

            {/* Actions: Duplicar Gondola */}
            <div className="space-y-3">
              <button
                onClick={duplicateGondola}
                className="w-full bg-white hover:bg-zinc-50 text-[#009639] border border-[#009639]/30 font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm"
              >
                Duplicar esta Góndola
              </button>
            </div>

          </div>
        </aside>

        <section
          ref={viewportCallback}
          onScroll={handleViewportScroll}
          onMouseDown={handleViewportMouseDown}
          onMouseMove={handleViewportMouseMove}
          onMouseUp={handleViewportMouseUp}
          onMouseLeave={handleViewportMouseUp}
          onContextMenu={(e) => e.preventDefault()}
          className="flex-1 relative overflow-y-auto overflow-x-auto scene-3d select-none cursor-grab active:cursor-grabbing scrollbar-thin"
          style={{
            padding: "130px 150px 80px 280px",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "flex-start",
            perspective: "1200px",
            background: "radial-gradient(circle at center, #ffffff 0%, #f3f4f6 100%)"
          }}
        >
          {/* Subtle Grid Floor */}
          <div className="absolute inset-0 grid-dots pointer-events-none opacity-50" />

          {/* 3D Scene Wrapper */}
          <div
            className="preserve-3d flex flex-row gap-[80px] items-end justify-start"
            style={{
              transform: `translate(${panX}px, ${panY}px) scale(${zoom}) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
              transformStyle: "preserve-3d",
              backfaceVisibility: "hidden"
            }}
          >
            {matchingGondolas.map((gObj) => {
              const isGondolaActive = gObj.id === gondolaId;
              const g = isGondolaActive ? gondola : gObj.config;
              const typeColors = {
                pared: { back: '#1e293b', shelf: '#475569', shelfTop: '#64748b', shelfFront: '#334155', border: '#334155', accent: 'rgba(255,255,255,0.03)' },
                central: { back: 'transparent', shelf: '#78716c', shelfTop: '#a8a29e', shelfFront: '#57534e', border: '#44403c', accent: 'rgba(168,162,158,0.08)' },
                cabecera: { back: '#1c1917', shelf: '#44403c', shelfTop: '#57534e', shelfFront: '#292524', border: '#57534e', accent: 'rgba(251,146,60,0.05)' },
                refrigerado: { back: '#0c1929', shelf: '#1e3a5f', shelfTop: '#2563eb', shelfFront: '#1e40af', border: '#3b82f6', accent: 'rgba(59,130,246,0.06)' }
              };
              const tc = typeColors[g.type as keyof typeof typeColors] || typeColors.pared;
              const scale = 3;

              return (
                <div
                  key={gObj.id}
                  className={`single-gondola-3d ${isGondolaActive ? 'active-gondola' : ''}`}
                  onPointerDown={(e) => {
                    (e.currentTarget as any)._startPos = { x: e.clientX, y: e.clientY };
                  }}
                  onPointerUp={(e) => {
                    const startPos = (e.currentTarget as any)._startPos;
                    if (!startPos) return;
                    const dist = Math.hypot(e.clientX - startPos.x, e.clientY - startPos.y);
                    if (dist < 8) {
                      if ((e.target as HTMLElement).closest('.placed-product') || (e.target as HTMLElement).closest('button')) return;
                      if (gondolaId !== gObj.id) {
                        safeNavigate(`/editor/${gObj.id}`);
                      }
                    }
                    (e.currentTarget as any)._startPos = null;
                  }}
                  style={{
                    position: 'relative',
                    width: `${g.width * scale}px`,
                    height: `${g.height * scale}px`,
                    transformStyle: 'preserve-3d',
                    transition: 'box-shadow 0.3s ease, border-color 0.3s ease, opacity 0.3s ease',
                    borderRadius: '8px',
                    boxShadow: isGondolaActive ? '0 0 0 3px #009639, 0 20px 40px rgba(0, 150, 57, 0.15)' : '0 10px 25px rgba(0, 0, 0, 0.15)',
                    opacity: isGondolaActive ? 1 : 0.75,
                  }}
                >
                  {/* Floating Header Badge Above Gondola */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '-110px',
                      left: 0,
                      right: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                      pointerEvents: 'auto',
                      cursor: 'pointer',
                      zIndex: 10000,
                      transform: 'translateZ(20px) scale(0.5)',
                      transformOrigin: 'bottom center',
                    }}
                    onPointerDown={(e) => {
                      (e.currentTarget as any)._startPos = { x: e.clientX, y: e.clientY };
                    }}
                    onPointerUp={(e) => {
                      const startPos = (e.currentTarget as any)._startPos;
                      if (!startPos) return;
                      const dist = Math.hypot(e.clientX - startPos.x, e.clientY - startPos.y);
                      if (dist < 8) {
                        if (gondolaId !== gObj.id) {
                          safeNavigate(`/editor/${gObj.id}`);
                        }
                      }
                      (e.currentTarget as any)._startPos = null;
                    }}
                  >
                    <div
                      style={{
                        background: isGondolaActive ? '#009639' : 'rgba(30, 41, 59, 0.85)',
                        color: 'white',
                        padding: '12px 24px',
                        borderRadius: '16px',
                        fontSize: '22px',
                        fontWeight: 700,
                        border: isGondolaActive ? '2px solid rgba(255,255,255,0.2)' : '2px solid rgba(255,255,255,0.1)',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                        whiteSpace: 'nowrap',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {isGondolaActive ? (
                        <>
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ verticalAlign: 'middle' }}>
                            <path d="M12 20h9"></path>
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                          </svg>
                          <span>{gObj.name} (Activa)</span>
                        </>
                      ) : (
                        <span>{gObj.name}</span>
                      )}
                    </div>
                    <div
                      style={{
                        background: 'rgba(0, 0, 0, 0.5)',
                        color: 'rgba(255,255,255,0.6)',
                        padding: '4px 16px',
                        borderRadius: '8px',
                        fontSize: '18px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '1px',
                      }}
                    >
                      {gObj.category || 'Sin Categoría'}
                    </div>
                  </div>

                  {/* Back Panel */}
                  <div
                    className="gondola-back-panel"
                    style={{
                      width: '100%',
                      height: '100%',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      background: g.type === 'pared'
                        ? 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)'
                        : g.type === 'cabecera'
                          ? 'linear-gradient(180deg, #292524 0%, #1c1917 100%)'
                          : g.type === 'refrigerado'
                            ? 'linear-gradient(180deg, #0c1929 0%, #0a1628 100%)'
                            : 'transparent',
                      borderLeft: g.type === 'pared'
                        ? `3px solid ${tc.border}`
                        : g.type === 'central'
                          ? `4px solid #78716c`
                          : 'none',
                      borderRight: g.type === 'pared'
                        ? `3px solid ${tc.border}`
                        : g.type === 'central'
                          ? `4px solid #78716c`
                          : 'none',
                      border: (g.type === 'cabecera' || g.type === 'refrigerado')
                        ? `2.5px solid ${tc.border}`
                        : undefined,
                      borderRadius: (g.type === 'cabecera' || g.type === 'refrigerado') ? '6px' : undefined,
                      boxShadow: g.type === 'pared'
                        ? 'inset 0 0 60px rgba(0,0,0,0.4)'
                        : g.type === 'refrigerado'
                          ? 'inset 0 0 80px rgba(59,130,246,0.08), 0 0 30px rgba(59,130,246,0.1)'
                          : undefined,
                    }}
                  >
                    {g.type === 'cabecera' && (
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, #f97316, #fb923c, #f97316)', borderRadius: '2px 2px 0 0' }} />
                    )}
                    {g.type === 'refrigerado' && (
                      <>
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, transparent, #3b82f6, #60a5fa, #3b82f6, transparent)' }} />
                        <div style={{ position: 'absolute', top: 0, right: 0, width: `${g.depth * scale}px`, height: '100%', background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.15)', transform: 'rotateY(90deg)', transformOrigin: 'right', backdropFilter: 'blur(2px)' }} />
                      </>
                    )}
                  </div>

                  {/* Columns for 'pared' */}
                  {g.type === 'pared' && (
                    <>
                      <div style={{ position: 'absolute', left: '-6px', top: 0, width: '6px', height: '100%', background: '#334155', transformStyle: 'preserve-3d' }}>
                        <div style={{ position: 'absolute', left: 0, width: `${g.depth * scale}px`, height: '100%', background: '#2d3a4a', transform: 'rotateY(-90deg)', transformOrigin: 'left' }} />
                      </div>
                      <div style={{ position: 'absolute', right: '-6px', top: 0, width: '6px', height: '100%', background: '#334155', transformStyle: 'preserve-3d' }}>
                        <div style={{ position: 'absolute', right: 0, width: `${g.depth * scale}px`, height: '100%', background: '#2d3a4a', transform: 'rotateY(90deg)', transformOrigin: 'right' }} />
                      </div>
                    </>
                  )}

                  {/* Posts for 'central' */}
                  {g.type === 'central' && (
                    <>
                      <div style={{ position: 'absolute', left: '-8px', top: 0, width: '8px', height: '100%', background: 'linear-gradient(180deg, #a8a29e, #78716c)', borderRadius: '2px', transformStyle: 'preserve-3d' }}>
                        <div style={{ position: 'absolute', left: 0, width: `${g.depth * scale}px`, height: '100%', background: '#57534e', transform: 'rotateY(-90deg)', transformOrigin: 'left' }} />
                      </div>
                      <div style={{ position: 'absolute', right: '-8px', top: 0, width: '8px', height: '100%', background: 'linear-gradient(180deg, #a8a29e, #78716c)', borderRadius: '2px', transformStyle: 'preserve-3d' }}>
                        <div style={{ position: 'absolute', right: 0, width: `${g.depth * scale}px`, height: '100%', background: '#57534e', transform: 'rotateY(90deg)', transformOrigin: 'right' }} />
                      </div>
                    </>
                  )}

                  {/* Shelves & Pegboards */}
                  {g.shelves.map((shelf: any, shelfIdx: number) => {
                    const isPerchero = shelf.type === 'perchero';
                    const currentShelfDepth = shelf.depth !== undefined ? shelf.depth : g.shelfDepth;
                    const nextShelf = g.shelves[shelfIdx + 1];
                    const ceiling = nextShelf ? nextShelf.y : g.height;
                    const usableHeight = ceiling - (shelf.y + g.shelfThickness);

                    // Check collisions
                    let hasHeightCollision = false;
                    let hasDepthCollision = false;
                    (shelf.products || []).forEach((p: any) => {
                      let totalHeight = 0;
                      let maxDepth = 0;
                      (p.layers || []).forEach((layer: any) => {
                        const prod = products.find(pr => pr.id === layer.productId);
                        if (prod) {
                          const dims = getPlacedDimensions(prod, layer.orientation || 0);
                          totalHeight += dims.height;
                          maxDepth = Math.max(maxDepth, dims.depth);
                        }
                      });
                      if (totalHeight > usableHeight) hasHeightCollision = true;
                      if (maxDepth > currentShelfDepth) hasDepthCollision = true;
                    });

                    const isDraggedOverThis = dragOverShelf && dragOverShelf.gondolaId === gObj.id && dragOverShelf.shelfIndex === shelfIdx;

                    return (
                      <React.Fragment key={shelf.id || `shelf-${gObj.id}-${shelfIdx}`}>
                        {/* Pegboard panel */}
                        {isPerchero && (
                          <div
                            className="pegboard-panel"
                            onDragOver={(e) => handleDragOverShelf(e, shelfIdx, gObj.id, g)}
                            onDragLeave={() => {
                              setDragOverShelf(null);
                              setDragCaretX(null);
                            }}
                            onDrop={(e) => handleDrop(e, shelfIdx, gObj.id, g)}
                            style={{
                              position: 'absolute',
                              left: 0,
                              bottom: `${(shelf.y + g.shelfThickness) * scale}px`,
                              width: '100%',
                              height: `${usableHeight * scale}px`,
                              background: 'radial-gradient(rgba(255,255,255,0.15) 15%, transparent 15%) 0 0, radial-gradient(rgba(255,255,255,0.15) 15%, transparent 15%) 8px 8px',
                              backgroundColor: isDraggedOverThis ? 'rgba(34, 197, 94, 0.2)' : '#1e293b',
                              borderTop: isDraggedOverThis ? '2px dashed #22c55e' : 'none',
                              borderLeft: isDraggedOverThis ? '2px dashed #22c55e' : 'none',
                              borderRight: isDraggedOverThis ? '2px dashed #22c55e' : 'none',
                              borderBottom: isDraggedOverThis ? '2px dashed #22c55e' : '1px solid rgba(255,255,255,0.05)',
                              backgroundSize: '16px 16px',
                              transform: 'translateZ(0.5px)',
                              transition: 'background-color 0.2s',
                            }}
                          />
                        )}

                        {/* Shelf structure */}
                        <div
                          className={`shelf-3d ${isDraggedOverThis ? 'drag-over' : ''}`}
                          onDragOver={(e) => handleDragOverShelf(e, shelfIdx, gObj.id, g)}
                          onDragLeave={() => {
                            setDragOverShelf(null);
                            setDragCaretX(null);
                          }}
                          onDrop={(e) => handleDrop(e, shelfIdx, gObj.id, g)}
                          style={{
                            position: 'absolute',
                            width: `${g.width * scale}px`,
                            height: `${(isPerchero ? 1 : g.shelfThickness) * scale}px`,
                            bottom: `${shelf.y * scale}px`,
                            left: '0px',
                            transform: 'translateZ(0px)',
                            background: isPerchero ? '#475569' : tc.shelf,
                            borderColor: isPerchero ? '#334155' : tc.border,
                            boxShadow: (hasHeightCollision || hasDepthCollision) ? '0 0 15px rgba(239, 68, 68, 0.7)' : undefined,
                            animation: (hasHeightCollision || hasDepthCollision) ? 'pulseError 1.5s infinite alternate' : undefined,
                          }}
                          title={hasHeightCollision
                            ? 'Advertencia: ¡Los productos exceden la altura disponible del estante!'
                            : hasDepthCollision
                              ? 'Advertencia: ¡Los productos sobresalen de la profundidad del estante!'
                              : undefined
                          }
                        >
                          {/* Shelf Top */}
                          <div
                            className="shelf-top"
                            style={{
                              position: 'absolute',
                              width: '100%',
                              height: `${(isPerchero ? 2 : currentShelfDepth) * scale}px`,
                              background: isPerchero ? '#64748b' : tc.shelfTop,
                              transform: 'rotateX(90deg)',
                              transformOrigin: 'top',
                              top: 0,
                              left: 0,
                            }}
                          />
                          {/* Shelf Front */}
                          <div
                            className="shelf-front"
                            style={{
                              position: 'absolute',
                              width: '100%',
                              height: '100%',
                              transform: `translateZ(${(isPerchero ? 2 : currentShelfDepth) * scale}px)`,
                              background: isPerchero ? '#334155' : tc.shelfFront,
                              top: 0,
                              left: 0,
                            }}
                          />

                          {/* AutoPack insertion caret */}
                          {isDraggedOverThis && g.autoPack && dragCaretX !== null && (
                            <div
                              className="drag-caret"
                              style={{
                                position: 'absolute',
                                top: 0,
                                width: '4px',
                                height: '100%',
                                backgroundColor: '#009639',
                                boxShadow: '0 0 8px #009639',
                                zIndex: 100,
                                left: `${dragCaretX * scale}px`,
                                pointerEvents: 'none',
                              }}
                            />
                          )}
                        </div>

                        {/* Hook rods for perchero */}
                        {isPerchero && (() => {
                          const spacing = shelf.hookSpacing || 15;
                          const numHooks = Math.floor(g.width / spacing);
                          const margin = (g.width - (numHooks - 1) * spacing) / 2;
                          const rods = [];
                          for (let i = 0; i < numHooks; i++) {
                            const hookX = margin + i * spacing;
                            const hasProduct = (shelf.products || []).some((p: any) => p.hookIndex === i);
                            rods.push(
                              <div
                                key={i}
                                className="hook-3d"
                                style={{
                                  position: 'absolute',
                                  left: `${hookX * scale - 2}px`,
                                  bottom: `${shelf.y * scale}px`,
                                  width: '4px',
                                  height: '4px',
                                  background: '#94a3b8',
                                  transformStyle: 'preserve-3d',
                                  transform: 'translateZ(0px)',
                                  pointerEvents: 'none',
                                }}
                              >
                                {/* Volumetric Rod pointing forward - only render if no product is hanging */}
                                {!hasProduct && (
                                  <div
                                    style={{
                                      position: 'absolute',
                                      width: `${currentShelfDepth * scale}px`,
                                      height: '4px',
                                      transformStyle: 'preserve-3d',
                                      transform: 'rotateY(-90deg)',
                                      transformOrigin: 'left',
                                    }}
                                  >
                                    {/* Top Face */}
                                    <div style={{
                                      position: 'absolute',
                                      width: '100%',
                                      height: '4px',
                                      background: '#cbd5e1',
                                      transform: 'rotateX(90deg)',
                                      transformOrigin: 'top',
                                      boxShadow: '0 3px 5px rgba(0,0,0,0.15)',
                                    }} />
                                    {/* Bottom Face */}
                                    <div style={{
                                      position: 'absolute',
                                      width: '100%',
                                      height: '4px',
                                      background: '#64748b',
                                      transform: 'rotateX(-90deg)',
                                      transformOrigin: 'bottom',
                                    }} />
                                    {/* Left Face */}
                                    <div style={{
                                      position: 'absolute',
                                      width: '100%',
                                      height: '4px',
                                      background: '#94a3b8',
                                      transform: 'translateZ(2px)',
                                    }} />
                                    {/* Right Face */}
                                    <div style={{
                                      position: 'absolute',
                                      width: '100%',
                                      height: '4px',
                                      background: '#475569',
                                      transform: 'translateZ(-2px)',
                                    }} />
                                  </div>
                                )}

                                {/* Upward-facing tip at the front end */}
                                <div
                                  style={{
                                    position: 'absolute',
                                    left: 0,
                                    bottom: 0,
                                    width: '4px',
                                    height: '10px',
                                    background: '#e2e8f0',
                                    transformStyle: 'preserve-3d',
                                    transform: `translate3d(0px, 0px, ${currentShelfDepth * scale}px) rotateX(-45deg)`,
                                    transformOrigin: 'bottom center',
                                    boxShadow: '0 3px 5px rgba(0,0,0,0.2)',
                                  }}
                                >
                                  {/* Volumetric faces for the tip */}
                                  <div style={{
                                    position: 'absolute',
                                    width: '100%',
                                    height: '100%',
                                    background: '#cbd5e1',
                                    transform: 'translateZ(1px)',
                                  }} />
                                  <div style={{
                                    position: 'absolute',
                                    width: '100%',
                                    height: '100%',
                                    background: '#94a3b8',
                                    transform: 'translateZ(-1px)',
                                  }} />
                                </div>
                              </div>
                            );
                          }
                          return rods;
                        })()}

                        {/* Products placed on this shelf */}
                        {(shelf.products || []).map((p: any, pIdx: number) => {
                          if (!p.layers || p.layers.length === 0) return null;

                          const baseLayer = p.layers[0];
                          const baseProd = products.find(pr => pr.id === baseLayer.productId);
                          if (!baseProd) return null;

                          const baseDims = getPlacedDimensions(baseProd, baseLayer.orientation || 0);
                          const leftPos = p.x * scale;
                          const bottomPos = isPerchero
                            ? `${(shelf.y - baseDims.height * 0.85) * scale}px`
                            : `${(shelf.y + g.shelfThickness) * scale}px`;

                          let accumulatedY = 0;

                          return (
                            <div
                              key={p.placedAt || pIdx}
                              className="placement-wrapper"
                              style={{
                                position: 'absolute',
                                left: `${leftPos}px`,
                                bottom: bottomPos,
                                transformStyle: 'preserve-3d',
                              }}
                            >
                              {(p.layers || []).map((layer: any, lIdx: number) => {
                                const product = products.find(pr => pr.id === layer.productId);
                                if (!product) return null;

                                const dims = getPlacedDimensions(product, layer.orientation || 0);
                                const unitsInZ = Math.max(1, Math.floor(currentShelfDepth / dims.depth));
                                const visualDepth = unitsInZ * dims.depth * scale;

                                const isSelected = selectedPlacement &&
                                  selectedPlacement.shelfIndex === shelfIdx &&
                                  selectedPlacement.placementIndex === pIdx &&
                                  selectedPlacement.layerIndex === lIdx &&
                                  isGondolaActive;

                                const totalUnits = (layer.facings || 1) * unitsInZ;
                                const totalValue = totalUnits * (product.price || 0);
                                const catAbbr = product.category ? product.category.substring(0, 2).toUpperCase() : 'PR';

                                const unitW = dims.width * scale;
                                const unitH = dims.height * scale;
                                const unitD = dims.depth * scale;
                                const gridBg = 'linear-gradient(to right, rgba(0,0,0,0.25) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.25) 1px, transparent 1px)';

                                const currentYVal = accumulatedY;
                                accumulatedY += dims.height;

                                return (
                                  <div
                                    key={lIdx}
                                    className={`placed-product ${isSelected ? 'ring-2 ring-yellow-400 ring-offset-1 z-50' : ''} ${dragOverProduct?.shelfIdx === shelfIdx && dragOverProduct?.placementIdx === pIdx
                                      ? 'ring-4 ring-emerald-500 ring-offset-2 z-[999]'
                                      : ''
                                      }`}
                                    draggable
                                    onDragStart={(e) => {
                                      e.stopPropagation();
                                      e.dataTransfer.setData("application/json", JSON.stringify({
                                        sourceShelfIndex: shelfIdx,
                                        sourcePlacementIndex: pIdx,
                                        sourceLayerIndex: lIdx,
                                        sourceGondolaId: gObj.id
                                      }));
                                      e.dataTransfer.setData("text/plain", layer.productId);
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (gondolaId !== gObj.id) {
                                        safeNavigate(`/editor/${gObj.id}`);
                                      } else {
                                        setSelectedPlacement({
                                          shelfIndex: shelfIdx,
                                          placementIndex: pIdx,
                                          layerIndex: lIdx
                                        });
                                      }
                                    }}
                                    onDoubleClick={(e) => {
                                      e.stopPropagation();
                                      if (gondolaId !== gObj.id) {
                                        safeNavigate(`/editor/${gObj.id}`);
                                      } else {
                                        removeFromShelf(shelfIdx, pIdx, lIdx);
                                        setSelectedPlacement(null);
                                      }
                                    }}
                                    onMouseEnter={(e) => {
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      setHoveredProduct({
                                        product,
                                        layer,
                                        shelfIdx,
                                        placementIdx: pIdx,
                                        unitsInZ,
                                        totalUnits,
                                        totalValue,
                                        catAbbr,
                                        rect,
                                        flipDown: shelfIdx === g.numShelves - 1
                                      });
                                    }}
                                    onMouseLeave={() => setHoveredProduct(null)}
                                    onDragOver={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setDragOverProduct({ shelfIdx, placementIdx: pIdx });
                                    }}
                                    onDragLeave={() => setDragOverProduct(null)}
                                    onDrop={(e) => {
                                      setDragOverProduct(null);
                                      handleStackDrop(e, shelfIdx, pIdx);
                                    }}
                                    style={{
                                      position: 'absolute',
                                      cursor: 'grab',
                                      width: `${dims.width * scale * layer.facings}px`,
                                      height: `${dims.height * scale}px`,
                                      bottom: `${currentYVal * scale}px`,
                                      left: 0,
                                      transform: `translateZ(${currentShelfDepth * scale - visualDepth}px)`,
                                      transformStyle: 'preserve-3d',
                                      transition: 'opacity 0.2s',
                                    }}
                                  >
                                    {/* 3D Product Box */}
                                    <div className="product-box" style={{ transformStyle: 'preserve-3d', width: '100%', height: '100%', position: 'relative' }}>
                                      {/* Face Front */}
                                      <div
                                        className="face face-front"
                                        style={{
                                          position: 'absolute',
                                          width: '100%',
                                          height: '100%',
                                          background: `${gridBg}, ${product.color}`,
                                          backgroundSize: `${unitW}px ${unitH}px`,
                                          transform: `translateZ(${visualDepth}px)`,
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          color: 'white',
                                          fontSize: '9px',
                                          fontWeight: 'black',
                                        }}
                                      >
                                        {layer.facings > 1 ? `${layer.facings}X` : ''}
                                        {isPerchero && (
                                          <div
                                            style={{
                                              position: 'absolute',
                                              top: '4px',
                                              left: '50%',
                                              transform: 'translateX(-50%)',
                                              width: '6px',
                                              height: '6px',
                                              background: '#0f172a',
                                              borderRadius: '50%',
                                              border: '1px solid rgba(255,255,255,0.2)',
                                            }}
                                          />
                                        )}
                                      </div>

                                      {/* Face Top */}
                                      <div
                                        className="face face-top"
                                        style={{
                                          position: 'absolute',
                                          width: '100%',
                                          height: `${visualDepth}px`,
                                          background: `${gridBg}, ${product.color}`,
                                          backgroundSize: `${unitW}px ${unitD}px`,
                                          transform: 'rotateX(90deg)',
                                          transformOrigin: 'top',
                                          top: 0,
                                          left: 0,
                                        }}
                                      />

                                      {/* Face Side Right */}
                                      <div
                                        className="face face-side"
                                        style={{
                                          position: 'absolute',
                                          height: '100%',
                                          width: `${visualDepth}px`,
                                          background: `${gridBg}, ${product.color}`,
                                          backgroundSize: `${unitD}px ${unitH}px`,
                                          transform: 'rotateY(90deg)',
                                          transformOrigin: 'right',
                                          right: 0,
                                          top: 0,
                                        }}
                                      />

                                      {/* Face Left */}
                                      <div
                                        className="face face-left"
                                        style={{
                                          position: 'absolute',
                                          height: '100%',
                                          width: `${visualDepth}px`,
                                          background: `${gridBg}, ${product.color}`,
                                          backgroundSize: `${unitD}px ${unitH}px`,
                                          transform: 'rotateY(-90deg)',
                                          transformOrigin: 'left',
                                          left: 0,
                                          top: 0,
                                        }}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Quick HUD guide controls */}
          <div className="absolute top-4 left-4 bg-white/95 backdrop-blur border border-zinc-200 rounded-xl px-4 py-2.5 text-[10px] text-zinc-500 font-medium flex flex-col gap-1 select-none pointer-events-none shadow-md">
            <span className="text-[#009639] font-bold tracking-wider text-[11px] mb-0.5 uppercase">Vista 3D</span>
            <div className="space-y-0.5">
              <div>Click Izquierdo + Arrastrar: <span className="text-zinc-800 font-semibold">Desplazar Vista</span></div>
              <div>Click Derecho + Arrastrar: <span className="text-zinc-800 font-semibold">Rotar Góndola</span></div>
              <div>Rueda del Ratón: <span className="text-zinc-800 font-semibold">Zoom +/-</span></div>
            </div>
            <button
              onClick={resetCamera}
              className="mt-2 w-full bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 text-zinc-700 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1 pointer-events-auto"
            >
              <Rotate3d className="h-3 w-3 text-[#009639]" /> Reset Vista
            </button>
          </div>


        </section>

        {/* Right Sidebar: Product Catalog and Selection Details */}
        <aside className="w-80 flex-shrink-0 border-l border-zinc-200 bg-white/95 backdrop-blur flex flex-col z-10 shadow-sm overflow-y-auto overflow-x-auto scrollbar-thin select-none">
          {/* Catalog Head */}
          <div className="p-4 border-b border-zinc-200 space-y-3">
            <h2 className="text-xs font-bold text-zinc-500 tracking-wider uppercase">Catálogo SAP</h2>

            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar por nombre o SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl pl-9 pr-4 py-2 text-xs font-bold text-zinc-700 focus:outline-none focus:ring-1 focus:ring-[#009639] placeholder-zinc-400"
              />
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
            </div>
          </div>

          {/* Draggable Product List Grouped by Collapsible Accordions */}
          <div className="flex-1 overflow-y-auto overflow-x-auto scrollbar-thin p-4 space-y-3 select-none">
            {categories.filter(cat => cat !== "TODOS").map((cat) => {
              const catProducts = filteredProducts.filter(p => p.category === cat);
              if (searchQuery && catProducts.length === 0) return null; // hide empty categories during search

              const isExpanded = expandedCategories[cat] !== false; // default to expanded

              return (
                <div key={cat} className="space-y-2">
                  <button
                    onClick={() => toggleCategoryExpand(cat)}
                    className="w-full flex items-center justify-between p-3 bg-zinc-100 hover:bg-zinc-200/80 border border-zinc-200/60 rounded-xl transition-all text-left font-bold text-xs text-zinc-750 uppercase tracking-wider shadow-xs"
                  >
                    <span>
                      {cat} <span className="text-zinc-400 font-bold ml-1">({catProducts.length})</span>
                    </span>
                    <ChevronRight className={`h-4 w-4 text-zinc-450 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} />
                  </button>

                  {isExpanded && (
                    <div className="pl-1 space-y-2 animate-in fade-in duration-150">
                      {catProducts.map((prod) => (
                        <div
                          key={prod.id}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData("application/json", JSON.stringify({ type: "new", productId: prod.id }));
                            e.dataTransfer.setData("text/plain", prod.id);
                          }}
                          onDoubleClick={() => handleCatalogDoubleClick(prod.id)}
                          className="draggable-product flex items-center justify-between p-3 bg-white border border-zinc-200 rounded-xl hover:border-zinc-350 hover:shadow-md transition-all cursor-grab active:cursor-grabbing group"
                        >
                          <div className="flex-1 min-w-0 pr-3">
                            <h4 className="text-xs font-bold text-zinc-800 line-clamp-1 leading-snug group-hover:text-[#009639] transition-colors">
                              {prod.name}
                            </h4>
                            <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-bold">
                              <span className="font-mono text-[9px] bg-zinc-100 px-1.5 py-0.5 rounded text-zinc-500">
                                {prod.sku}
                              </span>
                              <span>{prod.width}x{prod.height}x{prod.depth} cm</span>
                            </div>
                          </div>
                          <div className="text-right flex flex-col justify-between h-full">
                            <span className="text-xs font-bold text-[#009639]">Bs. {prod.price.toFixed(2)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {filteredProducts.length === 0 && (
              <div className="text-center py-8 text-zinc-450 text-xs font-semibold">
                No se encontraron productos.
              </div>
            )}
          </div>

          <div className="p-3 bg-zinc-50 border-t border-zinc-150 text-[10px] text-zinc-400 flex items-center gap-1.5 font-bold border-b border-zinc-200">
            <Info className="h-3.5 w-3.5 text-zinc-400 flex-shrink-0" />
            <span>Arrastra un producto a la repisa o haz doble click para colocar.</span>
          </div>

          {/* Live stock values summary on side foot */}
          <div className="p-4 bg-zinc-50 space-y-2 select-none font-bold">
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span>Capacidad Total:</span>
              <span className="text-zinc-800">{stats.totalUnits} unids.</span>
            </div>
            <div className="flex items-center justify-between text-xs text-[#009639]">
              <span>Valor Total:</span>
              <span>Bs. {stats.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex items-center justify-between text-[10px] text-zinc-400">
              <span>Ocupación Lineal:</span>
              <span>{stats.overallOccupation.toFixed(1)}%</span>
            </div>
          </div>
        </aside>
      </div>

      {/* Detailed Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
          <div className="bg-white rounded-[24px] shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden border border-zinc-150 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-zinc-200 flex items-start justify-between bg-zinc-50">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#009639] bg-green-50 border border-green-200/50 px-2.5 py-1 rounded-lg">
                  Informe Técnico Detallado
                </span>
                <h2 className="text-lg font-bold text-zinc-800 mt-2">
                  {activeGondolaWrapper?.name || "Góndola"}
                </h2>
                <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider mt-0.5">
                  Pasillo: {activeGondolaWrapper?.aisle || "N/A"} · Categoría: {activeGondolaWrapper?.category || "N/A"}
                </p>
              </div>
              <button
                onClick={() => setShowReportModal(false)}
                className="p-2 hover:bg-zinc-200 rounded-xl text-zinc-400 hover:text-zinc-700 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 report-modal-content">
              {/* KPIs Summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 border border-zinc-150 bg-zinc-50/50 rounded-2xl">
                  <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">Valor Inventario</span>
                  <span className="text-xl font-bold text-[#009639]">Bs. {stats.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="p-4 border border-zinc-150 bg-zinc-50/50 rounded-2xl">
                  <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">Unidades Colocadas</span>
                  <span className="text-xl font-bold text-zinc-800">{stats.totalUnits} U.</span>
                </div>
                <div className="p-4 border border-zinc-150 bg-zinc-50/50 rounded-2xl">
                  <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">Ocupación Lineal</span>
                  <span className="text-xl font-bold text-[#ffb81c]">{stats.overallOccupation.toFixed(1)}%</span>
                </div>
              </div>

              {/* Levels Breakdown */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-zinc-455 uppercase tracking-widest">Resumen por Nivel</h3>
                <div className="border border-zinc-150 rounded-2xl overflow-hidden bg-white">
                  <table className="w-full text-left text-xs font-bold text-zinc-650">
                    <thead className="bg-zinc-50 text-[10px] text-zinc-400 uppercase tracking-wider border-b border-zinc-150">
                      <tr>
                        <th className="px-4 py-3">Nivel</th>
                        <th className="px-4 py-3">Tipo</th>
                        <th className="px-4 py-3">Profundidad</th>
                        <th className="px-4 py-3 text-center">Frentes</th>
                        <th className="px-4 py-3 text-center">Total Uds.</th>
                        <th className="px-4 py-3 text-right">Valor Nivel</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {gondola.shelves.map((s, idx) => {
                        let levelUnits = 0;
                        let levelValue = 0;
                        let levelFacings = 0;
                        s.products.forEach(p => {
                          p.layers.forEach(l => {
                            const prod = products.find(pr => pr.id === l.productId);
                            if (prod) {
                              const dims = getPlacedDimensions(prod, l.orientation || 0);
                              const depthUnits = Math.max(1, Math.floor(s.depth / dims.depth));
                              levelUnits += l.facings * depthUnits;
                              levelValue += l.facings * depthUnits * prod.price;
                              levelFacings += l.facings;
                            }
                          });
                        });
                        return (
                          <tr key={s.id} className="hover:bg-zinc-50/50 transition-colors">
                            <td className="px-4 py-2.5 text-zinc-800">Nivel {idx + 1}</td>
                            <td className="px-4 py-2.5 uppercase text-[10px]">{s.type === 'perchero' ? 'Ganchos' : 'Bandeja'}</td>
                            <td className="px-4 py-2.5 text-zinc-500">{s.depth || gondola.shelfDepth} cm</td>
                            <td className="px-4 py-2.5 text-center">{levelFacings}</td>
                            <td className="px-4 py-2.5 text-center text-zinc-800">{levelUnits}</td>
                            <td className="px-4 py-2.5 text-right text-[#009639]">Bs. {levelValue.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Product Listing Table */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-zinc-455 uppercase tracking-widest">Detalle de Productos</h3>
                <div className="border border-zinc-150 rounded-2xl overflow-hidden bg-white">
                  <table className="w-full text-left text-xs font-bold text-zinc-650">
                    <thead className="bg-zinc-50 text-[10px] text-zinc-400 uppercase tracking-wider border-b border-zinc-150">
                      <tr>
                        <th className="px-4 py-3">Nivel</th>
                        <th className="px-4 py-3">SKU</th>
                        <th className="px-4 py-3">Producto</th>
                        <th className="px-4 py-3 text-center">Frentes</th>
                        <th className="px-4 py-3 text-center">Fondo</th>
                        <th className="px-4 py-3 text-center">Total Uds.</th>
                        <th className="px-4 py-3 text-right">Unitario</th>
                        <th className="px-4 py-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {(() => {
                        const rows: React.ReactNode[] = [];
                        gondola.shelves.forEach((s, sIdx) => {
                          s.products.forEach((p, pIdx) => {
                            p.layers.forEach((l, lIdx) => {
                              const prod = products.find(pr => pr.id === l.productId);
                              if (prod) {
                                const dims = getPlacedDimensions(prod, l.orientation || 0);
                                const depthUnits = Math.max(1, Math.floor(s.depth / dims.depth));
                                const totalUnits = l.facings * depthUnits;
                                const totalValue = totalUnits * prod.price;
                                rows.push(
                                  <tr key={`${sIdx}-${pIdx}-${lIdx}`} className="hover:bg-zinc-50/50 transition-colors">
                                    <td className="px-4 py-2.5 text-zinc-800">Nivel {sIdx + 1}</td>
                                    <td className="px-4 py-2.5 font-mono text-[10px] text-zinc-500">{prod.sku}</td>
                                    <td className="px-4 py-2.5 text-zinc-800 truncate max-w-[200px]" title={prod.name}>{prod.name}</td>
                                    <td className="px-4 py-2.5 text-center">{l.facings}</td>
                                    <td className="px-4 py-2.5 text-center text-zinc-500">{depthUnits}</td>
                                    <td className="px-4 py-2.5 text-center text-zinc-800">{totalUnits}</td>
                                    <td className="px-4 py-2.5 text-right text-zinc-500">Bs. {prod.price.toFixed(2)}</td>
                                    <td className="px-4 py-2.5 text-right text-[#009639]">Bs. {totalValue.toFixed(2)}</td>
                                  </tr>
                                );
                              }
                            });
                          });
                        });
                        if (rows.length === 0) {
                          return (
                            <tr>
                              <td colSpan={8} className="px-4 py-8 text-center text-zinc-400">
                                No hay productos colocados en esta góndola.
                              </td>
                            </tr>
                          );
                        }
                        return rows;
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-zinc-200 bg-zinc-50 flex items-center justify-between">
              <div className="flex gap-2">
                <button
                  onClick={handleExportGondolaPDF}
                  className="bg-[#009639] hover:bg-[#008030] text-white text-xs font-bold py-2 px-4 rounded-xl shadow-sm flex items-center gap-1.5 transition-all"
                >
                  <FileText className="h-4 w-4" /> Exportar PDF
                </button>
                <button
                  onClick={handleExportGondolaExcel}
                  className="bg-white hover:bg-zinc-100 border border-zinc-200 text-zinc-700 text-xs font-bold py-2 px-4 rounded-xl shadow-sm flex items-center gap-1.5 transition-all"
                >
                  <FileSpreadsheet className="h-4 w-4" /> Exportar Excel
                </button>
              </div>
              <button
                onClick={() => setShowReportModal(false)}
                className="bg-zinc-200 hover:bg-zinc-300 text-zinc-700 text-xs font-bold py-2 px-5 rounded-xl transition-all"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Product Details Modal */}
      {selectedPlacement && activePlacement && activeProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
          <div className="bg-white rounded-[24px] shadow-2xl max-w-md w-full border border-zinc-200/80 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-5 border-b border-zinc-150 bg-zinc-50 flex items-start justify-between">
              <div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-[#009639] bg-green-50 border border-green-200/50 px-2 py-0.5 rounded">
                  Detalles de Colocación
                </span>
                <h3 className="text-sm font-bold text-zinc-800 mt-1.5 leading-snug">
                  {activeProduct.name}
                </h3>
                <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-400 font-bold mt-1">
                  <span className="bg-white border border-zinc-200 px-1.5 py-0.5 rounded text-zinc-500">{activeProduct.sku}</span>
                  <span>·</span>
                  <span>Nivel {selectedPlacement.shelfIndex + 1} ({gondola.shelves[selectedPlacement.shelfIndex].type === "perchero" ? "Ganchos" : "Bandeja"})</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedPlacement(null)}
                className="p-1.5 hover:bg-zinc-200 rounded-xl text-zinc-400 hover:text-zinc-750 transition-colors"
                title="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-5">
              {/* Facings Counter */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Frentes (Facings)</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const currentL = activePlacement!.layers[selectedPlacement.layerIndex];
                      if (currentL.facings > 1) {
                        const res = updateProductFacings(selectedPlacement.shelfIndex, selectedPlacement.placementIndex, selectedPlacement.layerIndex, currentL.facings - 1);
                        if (!res.success) triggerToast(res.reason || "Error al actualizar facings", "error");
                      }
                    }}
                    className="bg-zinc-150 hover:bg-zinc-200 border border-zinc-200 text-zinc-750 font-bold h-9 w-9 rounded-xl flex items-center justify-center transition-all text-sm shadow-sm"
                  >
                    -
                  </button>
                  <span className="text-sm font-bold text-zinc-855 w-8 text-center">{activePlacement.layers[selectedPlacement.layerIndex]?.facings}</span>
                  <button
                    type="button"
                    onClick={() => {
                      const currentL = activePlacement!.layers[selectedPlacement.layerIndex];
                      const res = updateProductFacings(selectedPlacement.shelfIndex, selectedPlacement.placementIndex, selectedPlacement.layerIndex, currentL.facings + 1);
                      if (!res.success) triggerToast(res.reason || "Error al actualizar facings", "error");
                    }}
                    className="bg-zinc-150 hover:bg-zinc-200 border border-zinc-200 text-zinc-750 font-bold h-9 w-9 rounded-xl flex items-center justify-center transition-all text-sm shadow-sm"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Orientation Slider/Cycle */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Orientación en Góndola</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const res = rotateProduct(selectedPlacement!.shelfIndex, selectedPlacement!.placementIndex, selectedPlacement!.layerIndex);
                      if (!res.success) triggerToast(res.reason || "Error al rotar producto", "error");
                    }}
                    className="w-full bg-[#e6f4ea] hover:bg-[#d8eedf] text-[#009639] border border-[#009639]/20 font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-sm"
                  >
                    <RotateCw className="h-4 w-4" />
                    <span>Rotar Producto</span>
                  </button>
                </div>
                {/* Orientation visual display */}
                <div className="bg-zinc-50 border border-zinc-150 rounded-xl p-3 text-xs font-bold text-zinc-650 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Modo de Rotación:</span>
                    <span className="text-zinc-850">
                      {(() => {
                        const orientations = [
                          "Normal (Estándar)",
                          "Lateral XY (Acostado)",
                          "Profundidad XZ (Volteado)",
                          "Profundidad Lateral",
                          "Superior YZ (Vertical)",
                          "Superior Lateral"
                        ];
                        return orientations[activePlacement.layers[selectedPlacement.layerIndex]?.orientation || 0];
                      })()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Medidas Colocado:</span>
                    <span className="font-mono text-[11px] text-zinc-850">
                      {(() => {
                        const dims = getPlacedDimensions(activeProduct, activePlacement.layers[selectedPlacement.layerIndex]?.orientation || 0);
                        return `${dims.width} x ${dims.height} x ${dims.depth} cm`;
                      })()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Space Capacity Metrics */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Métricas de Espacio</label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-zinc-50 border border-zinc-150 rounded-xl p-2.5">
                    <span className="text-[9px] font-bold text-zinc-400 uppercase block">Unidades en Fondo</span>
                    <span className="text-xs font-bold text-zinc-800">
                      {getDepthUnits(gondola.shelves[selectedPlacement.shelfIndex].depth, getPlacedDimensions(activeProduct, activePlacement.layers[selectedPlacement.layerIndex]?.orientation).depth)} U.
                    </span>
                  </div>
                  <div className="bg-zinc-50 border border-zinc-150 rounded-xl p-2.5">
                    <span className="text-[9px] font-bold text-zinc-400 uppercase block">Capacidad de Pila</span>
                    <span className="text-xs font-bold text-[#009639]">
                      {getStackCapacity(activePlacement, gondola.shelves[selectedPlacement.shelfIndex].depth, products)} U.
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-zinc-150 bg-zinc-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  removeFromShelf(selectedPlacement.shelfIndex, selectedPlacement.placementIndex, selectedPlacement.layerIndex);
                  setSelectedPlacement(null);
                }}
                className="bg-red-50 hover:bg-red-100 text-red-650 border border-red-200/50 font-bold py-2 px-4 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-sm"
              >
                <Trash2 className="h-4 w-4" /> Eliminar del Estante
              </button>
              <button
                type="button"
                onClick={() => setSelectedPlacement(null)}
                className="bg-zinc-800 hover:bg-zinc-900 text-white font-bold py-2 px-5 rounded-xl text-xs transition-all shadow-sm"
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toast && (
        <div
          className={`fixed top-6 left-1/2 -translate-x-1/2 z-[9999999] flex items-center gap-3 px-5 py-3 rounded-2xl text-xs font-bold shadow-2xl border backdrop-blur-sm transition-all duration-300 animate-in slide-in-from-top-5 ${toast.type === "error"
            ? "bg-red-500/95 border-red-400 text-white shadow-red-500/20"
            : "bg-zinc-900/95 border-zinc-850 text-white shadow-black/20"
            }`}
        >
          {toast.type === "error" ? (
            <AlertCircle className="h-4 w-4 text-white" />
          ) : (
            <Check className="h-4 w-4 text-emerald-400" />
          )}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Global sharp hover card */}
      {hoveredProduct && (
        <div
          className="fixed pointer-events-none z-[999999] flex gap-4 items-center rounded-2xl p-3.5 shadow-2xl border border-white/20 text-white bg-slate-900/95 backdrop-blur-md w-[310px] transition-all duration-200 ease-out"
          style={{
            left: `${hoveredProduct.rect.left + hoveredProduct.rect.width / 2}px`,
            top: hoveredProduct.flipDown
              ? `${hoveredProduct.rect.bottom + 12}px`
              : `${hoveredProduct.rect.top - 12}px`,
            transform: hoveredProduct.flipDown
              ? 'translate(-50%, 0)'
              : 'translate(-50%, -100%)',
          }}
        >
          <div
            className="w-[60px] h-[78px] rounded-xl flex items-center justify-center relative overflow-hidden flex-shrink-0 border border-white/10"
            style={{
              background: `linear-gradient(135deg, ${hoveredProduct.product.color || '#3b82f6'} 0%, rgba(15, 23, 42, 0.4) 100%)`,
              boxShadow: '0 4px 10px rgba(0, 0, 0, 0.3), inset 0 0 12px rgba(255, 255, 255, 0.2)',
            }}
          >
            <span className="font-extrabold text-lg text-white/95 tracking-wider drop-shadow">
              {hoveredProduct.catAbbr}
            </span>
          </div>

          <div className="flex-1 flex flex-col gap-1 min-w-0">
            <div className="font-mono text-[10px] font-bold text-amber-400 tracking-wider uppercase leading-none">
              {hoveredProduct.product.sku || 'N/A'}
            </div>
            <div className="text-[13px] font-bold text-white leading-snug break-words line-clamp-2">
              {hoveredProduct.product.name || 'Producto'}
            </div>

            <div className="flex flex-col gap-1 mt-1.5 border-t border-white/15 pt-1.5">
              <div className="text-[10px] text-white/70 leading-normal flex justify-between">
                <span>Facings:</span>
                <span className="text-white font-semibold">{hoveredProduct.layer.facings || 1}</span>
              </div>
              <div className="text-[10px] text-white/70 leading-normal flex justify-between">
                <span>Profundidad:</span>
                <span className="text-white font-semibold">{hoveredProduct.unitsInZ} uds. (Total: {hoveredProduct.totalUnits})</span>
              </div>

              <div className="mt-1.5 flex justify-between items-center border-t border-dashed border-white/15 pt-1.5">
                <span className="text-[9.5px] font-semibold text-white/60">Valor Fila:</span>
                <span className="text-sm font-bold text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.25)]">
                  Bs. {hoveredProduct.totalValue.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ==================================================================== */}
      {/* MODAL: IMPORTAR EXCEL                                                 */}
      {/* ==================================================================== */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[20px] max-w-[560px] w-full shadow-2xl flex flex-col overflow-hidden border border-zinc-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 flex items-center justify-between border-b border-zinc-150">
              <h3 className="text-base font-bold text-[#1f2937] flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-[#009639]" /> Importar Catálogo de Productos
              </h3>
              <button
                onClick={() => {
                  if (!importing) setShowImportModal(false);
                }}
                className="p-1 hover:bg-zinc-100 rounded-lg text-zinc-400 hover:text-zinc-650 transition-colors"
                disabled={importing}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">
              {/* Step 1: Descargar Plantilla */}
              <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  Paso 1: Descargar Plantilla Oficial
                </h4>
                <p className="text-xs text-zinc-650 font-medium leading-relaxed">
                  Para evitar errores de importación, descarga el formato Excel prediseñado. Contiene una fila de ejemplo y los encabezados exactos que el sistema reconoce.
                </p>
                <button
                  type="button"
                  onClick={downloadExcelTemplate}
                  className="bg-white hover:bg-zinc-50 border border-zinc-200 text-[#009639] font-bold py-1.5 px-4 rounded-lg text-xs transition-all flex items-center gap-1.5 shadow-xs"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" /> Descargar Plantilla Excel
                </button>
              </div>

              {/* Step 2: Subir Archivo */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  Paso 2: Cargar Archivo Excel Rellenado
                </h4>

                <div className="border-2 border-dashed border-zinc-200 hover:border-[#009639]/40 rounded-xl p-6 transition-all flex flex-col items-center justify-center gap-2 bg-zinc-50/30">
                  <FileSpreadsheet className="h-8 w-8 text-zinc-400" />
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleFileChange}
                    className="hidden"
                    id="excel-file-upload"
                    disabled={importing}
                  />
                  <label
                    htmlFor="excel-file-upload"
                    className="cursor-pointer bg-[#009639] hover:bg-[#008030] text-white font-bold py-1.5 px-4 rounded-lg text-xs transition-all shadow-xs"
                  >
                    Seleccionar Archivo Excel
                  </label>
                  <span className="text-[11px] text-zinc-500 font-medium">
                    {selectedFile ? selectedFile.name : "Ningún archivo seleccionado"}
                  </span>
                </div>
              </div>

              {/* Error General Banner */}
              {importErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs font-semibold text-red-600 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
                    <span>Se encontraron errores en el proceso:</span>
                  </div>
                  <ul className="list-disc pl-5 font-medium text-red-650 max-h-32 overflow-y-auto">
                    {importErrors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Success Result Banner */}
              {importResult && (
                <div className="bg-[#e6f4ea] border border-green-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#009639]">
                    <Check className="h-4.5 w-4.5" />
                    <span>¡Importación finalizada con éxito!</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs font-medium text-zinc-750">
                    <div className="bg-white/80 p-2.5 rounded-lg border border-green-100 flex flex-col">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Creados Nuevos</span>
                      <span className="text-lg font-bold text-[#009639]">{importResult.created}</span>
                    </div>
                    <div className="bg-white/80 p-2.5 rounded-lg border border-green-100 flex flex-col">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Actualizados</span>
                      <span className="text-lg font-bold text-zinc-700">{importResult.updated}</span>
                    </div>
                  </div>

                  {/* Warning errors on specific rows */}
                  {importResult.errors.length > 0 && (
                    <div className="mt-2 text-[11px] text-zinc-650 font-medium space-y-1">
                      <span className="font-bold text-orange-650 block">Detalle de filas omitidas/advertencias:</span>
                      <ul className="list-disc pl-4 space-y-0.5 max-h-24 overflow-y-auto text-zinc-500 font-normal">
                        {importResult.errors.map((err: string, idx: number) => (
                          <li key={idx}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-zinc-150 flex items-center justify-between bg-zinc-50/50">
              <span className="text-[10px] text-zinc-450 font-bold uppercase tracking-wider">
                {importing ? "Procesando productos..." : ""}
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="bg-white hover:bg-zinc-50 border border-zinc-250 text-zinc-700 font-bold py-2 px-5 rounded-lg text-sm transition-colors"
                  disabled={importing}
                >
                  {importResult ? "Listo" : "Cancelar"}
                </button>
                {!importResult && (
                  <button
                    onClick={handleImportExcel}
                    className="bg-[#009639] hover:bg-[#008030] disabled:bg-zinc-300 disabled:cursor-not-allowed text-white font-bold py-2 px-5 rounded-lg text-sm transition-colors shadow-sm"
                    disabled={!selectedFile || importing}
                  >
                    {importing ? "Importando..." : "Importar Catálogo"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ==================================================================== */}
      {/* MODAL: CONFIRMAR VACIAR GÓNDOLA                                      */}
      {/* ==================================================================== */}
      {showConfirmEmpty && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[20px] max-w-[460px] w-full shadow-2xl flex flex-col overflow-hidden border border-zinc-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 flex items-center justify-between border-b border-zinc-150 bg-zinc-50">
              <h3 className="text-base font-bold text-[#1f2937] flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-red-500" /> ¿Vaciar Góndola?
              </h3>
              <button
                onClick={() => setShowConfirmEmpty(false)}
                className="p-1 hover:bg-zinc-150 rounded-lg text-zinc-400 hover:text-zinc-650 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-zinc-650 font-medium leading-relaxed">
                ¿Estás seguro de que deseas vaciar todos los productos colocados en esta góndola?
              </p>

              <div className="bg-red-50 border border-red-200 text-red-500 rounded-xl p-4 flex items-start gap-2 text-xs font-semibold leading-relaxed">
                <AlertTriangle className="h-4.5 w-4.5 text-red-500 flex-shrink-0 mt-0.5" />
                <span>
                  Esta acción retirará todos los productos de todos los estantes. Recuerda que puedes revertir esta acción usando el botón de Deshacer (Ctrl + Z).
                </span>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-zinc-150 flex items-center justify-end gap-3 bg-zinc-50/50">
              <button
                type="button"
                onClick={() => setShowConfirmEmpty(false)}
                className="bg-white hover:bg-zinc-50 border border-zinc-250 text-zinc-700 font-bold py-2 px-5 rounded-lg text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  emptyGondola();
                  setShowConfirmEmpty(false);
                  triggerToast("Góndola vaciada con éxito", "success");
                }}
                className="bg-[#ef4444] hover:bg-[#dc2626] text-white font-bold py-2 px-5 rounded-lg text-sm transition-colors shadow-sm shadow-red-500/10"
              >
                Confirmar Vaciar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: CONFIRMAR CAMBIOS SIN GUARDAR                                 */}
      {/* ==================================================================== */}
      {pendingNavigationUrl && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[20px] max-w-[480px] w-full shadow-2xl flex flex-col overflow-hidden border border-zinc-100 animate-in fade-in zoom-in-95 duration-200 animate-fade-in">
            <div className="px-6 py-4 flex items-center justify-between border-b border-zinc-150 bg-zinc-50">
              <h3 className="text-base font-bold text-[#1f2937] flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500 animate-pulse" /> Cambios sin guardar
              </h3>
              <button
                onClick={() => setPendingNavigationUrl(null)}
                className="p-1 hover:bg-zinc-150 rounded-lg text-zinc-400 hover:text-zinc-650 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-zinc-650 font-medium leading-relaxed">
                Has realizado modificaciones en esta góndola. Si cambias de góndola o sales de esta página sin guardar, perderás todo el progreso actual de productos y personalización.
              </p>
            </div>

            <div className="px-6 py-4 border-t border-zinc-150 flex flex-wrap items-center justify-end gap-2 bg-zinc-50/50">
              <button
                type="button"
                onClick={() => setPendingNavigationUrl(null)}
                className="bg-white hover:bg-zinc-50 border border-zinc-250 text-zinc-750 font-bold py-2 px-4 rounded-lg text-xs transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetUrl = pendingNavigationUrl;
                  setPendingNavigationUrl(null);
                  usePlanogramStore.setState({ undoStack: [], redoStack: [] });
                  router.push(targetUrl);
                }}
                className="bg-rose-50 hover:bg-rose-100 text-rose-650 border border-rose-200/50 font-bold py-2 px-4 rounded-lg text-xs transition-colors"
              >
                Descartar cambios
              </button>
              <button
                type="button"
                onClick={async () => {
                  setIsSaving(true);
                  try {
                    const res = await fetch(`/api/gondolas/${gondolaId}/planogram`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ gondola }),
                    });
                    const data = await res.json();
                    if (res.ok && data.success) {
                      triggerToast("Planograma guardado", "success");
                      usePlanogramStore.setState({ undoStack: [], redoStack: [] });
                      const targetUrl = pendingNavigationUrl;
                      setPendingNavigationUrl(null);
                      router.push(targetUrl);
                    } else {
                      triggerToast(data.error || "Error guardando planograma", "error");
                    }
                  } catch (e) {
                    triggerToast("Error de conexión", "error");
                  } finally {
                    setIsSaving(false);
                  }
                }}
                disabled={isSaving}
                className="bg-[#009639] hover:bg-[#008030] text-white font-bold py-2 px-4 rounded-lg text-xs transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {isSaving ? "Guardando..." : "Guardar y Continuar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
