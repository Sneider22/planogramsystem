"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePlanogramStore } from "@/store/usePlanogramStore";
import { getPlacedDimensions } from "@/utils/planogramHelpers";
import {
  Plus,
  Trash2,
  Edit3,
  X,
  Home,
  FileText,
  AlertTriangle
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function StoresDashboard() {
  const router = useRouter();
  const [isAuth, setIsAuth] = useState(false);

  useEffect(() => {
    const auth = localStorage.getItem("locatel_auth");
    if (auth === "true") {
      setIsAuth(true);
    } else {
      router.push("/login");
    }
  }, [router]);

  const { products, selectStore } = usePlanogramStore();
  const [apiStores, setApiStores] = useState<any[]>([]);
  const [isFetchingStores, setIsFetchingStores] = useState(true);

  const fetchStores = async () => {
    try {
      const res = await fetch(`/api/stores?t=${Date.now()}`, { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        setApiStores(data.data);
      }
    } catch (err) {
      console.error("Error al cargar tiendas desde BD:", err);
    } finally {
      setIsFetchingStores(false);
    }
  };

  useEffect(() => {
    if (isAuth) {
      fetchStores();
    }
  }, [isAuth]);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null); // storeId to delete
  const [showEditModal, setShowEditModal] = useState<string | null>(null); // storeId to edit

  // Form Fields
  const [newStoreName, setNewStoreName] = useState("");
  const [customId, setCustomId] = useState("");
  const [editName, setEditName] = useState("");
  const [editCustomId, setEditCustomId] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoreName.trim()) return;

    try {
      const res = await fetch("/api/stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newStoreName.trim(), customId: customId.trim() }),
      });
      const data = await res.json();

      if (data.success) {
        setNewStoreName("");
        setCustomId("");
        setShowCreateModal(false);
        fetchStores(); // Recargar lista desde SQL Server
      } else {
        setErrorMsg(data.error || "Error al crear la tienda");
      }
    } catch (err) {
      setErrorMsg("Error de conexión con el servidor");
    }
  };

  const handleStartEdit = (store: any) => {
    setShowEditModal(store.id);
    setEditName(store.name);
    setEditCustomId(store.id.replace("store-", ""));
    setErrorMsg("");
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditModal || !editName.trim()) return;

    try {
      const res = await fetch(`/api/stores/${showEditModal}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim() }),
      });
      const data = await res.json();

      if (data.success) {
        setShowEditModal(null);
        setErrorMsg("");
        fetchStores(); // Recargar de BD
      } else {
        setErrorMsg(data.error || "Error al actualizar la tienda.");
      }
    } catch (err) {
      setErrorMsg("Error de red al actualizar");
    }
  };

  const handleDeleteConfirm = async () => {
    if (showDeleteModal) {
      try {
        const res = await fetch(`/api/stores/${showDeleteModal}`, {
          method: "DELETE",
        });
        if (res.ok) {
          setShowDeleteModal(null);
          fetchStores(); // Recargar de BD
        } else {
          alert("Hubo un problema al eliminar la tienda");
        }
      } catch (err) {
        alert("Error de conexión");
      }
    }
  };

  // Helper to calculate store stats (Simplificado para BD)
  const getStoreStats = (store: any) => {
    const gondolasCount = store._count?.gondolas || 0;
    let totalUnits = 0;

    if (store.gondolas && Array.isArray(store.gondolas)) {
      store.gondolas.forEach((g: any) => {
        if (g.shelves && Array.isArray(g.shelves)) {
          g.shelves.forEach((s: any) => {
            if (s.products && Array.isArray(s.products)) {
              s.products.forEach((p: any) => {
                if (p.layers && Array.isArray(p.layers)) {
                  p.layers.forEach((l: any) => {
                    const prod = l.product;
                    if (prod) {
                      const dims = getPlacedDimensions(prod, l.orientation || 0);
                      const shelfDepth = s.depth || g.shelfDepth || 40;
                      const depthUnits = Math.max(1, Math.floor(shelfDepth / dims.depth));
                      totalUnits += l.facings * depthUnits;
                    }
                  });
                }
              });
            }
          });
        }
      });
    }

    return { gondolasCount, totalUnits };
  };

  // Simple PDF Report generator for a specific store
  const generateStoreReport = (store: any) => {
    const doc = new jsPDF("p", "pt", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();

    // Locatel Green Header Banner
    doc.setFillColor(0, 150, 57);
    doc.rect(0, 0, pageWidth, 80, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(20);
    doc.text("LOCATEL PLANOGRAM PRO", 40, 42);

    doc.setFontSize(10);
    doc.setFont("Helvetica", "normal");
    doc.text(`REPORTE GENERAL: ${store.name.toUpperCase()}`, 40, 58);

    // Body Info
    doc.setTextColor(50, 50, 50);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Resumen Técnico de Góndolas", 40, 120);

    const tableRows = store.library.map((g: any) => {
      let unitsCount = 0;
      g.config.shelves.forEach((s: any) => {
        s.products.forEach((p: any) => {
          p.layers.forEach((l: any) => {
            const prod = products.find(pr => pr.id === l.productId);
            if (prod) {
              const dims = getPlacedDimensions(prod, l.orientation || 0);
              unitsCount += l.facings * Math.max(1, Math.floor(s.depth / dims.depth));
            }
          });
        });
      });

      return [
        g.name,
        g.aisle || "N/A",
        g.category || "N/A",
        `${g.config.width}x${g.config.height}x${g.config.depth} cm`,
        g.config.shelves.length.toString(),
        unitsCount.toString()
      ];
    });

    autoTable(doc, {
      startY: 135,
      head: [["Nombre Góndola", "Pasillo", "Categoría", "Medidas", "Niveles", "Capacidad Unidades"]],
      body: tableRows,
      theme: "striped",
      headStyles: { fillColor: [0, 150, 57] }
    });

    doc.save(`Reporte_Sucursal_${store.name.replace(/\s+/g, "_")}.pdf`);
  };

  if (!isAuth) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#f3f4f6]">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#009639] border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3f4f6] text-[#1f2937] flex flex-col font-sans">
      {/* Top Header matching mockup */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-40 px-8 py-3.5 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-5">
            <img
              src="/logo.png"
              alt="Locatel Logo"
              className="h-11 w-auto object-contain"
            />
            <div className="h-8 w-px bg-zinc-200" />
            <div>
              <h1 className="text-xl font-bold text-[#1f2937] tracking-tight leading-tight">
                Mis Tiendas
              </h1>
              <p className="text-xs text-zinc-400 font-semibold mt-0.5">
                Selecciona o crea una tienda para gestionar planogramas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-[#009639] hover:bg-[#008030] active:scale-[0.98] text-white font-bold py-2 px-5 rounded-lg text-sm transition-all flex items-center gap-2 shadow-sm shadow-green-500/10"
            >
              <Plus className="h-4.5 w-4.5" /> Nueva Tienda
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

      {/* Main Grid area */}
      <main className="flex-1 max-w-7xl mx-auto px-8 py-10 w-full">
        {isFetchingStores ? (
          <div className="flex justify-center py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#009639] border-t-transparent"></div>
          </div>
        ) : apiStores.length === 0 ? (
          <div className="border border-dashed border-zinc-300 rounded-3xl py-28 flex flex-col items-center justify-center text-center px-4 bg-white/50">
            <Home className="h-14 w-14 text-[#009639]/30 mb-4 animate-pulse-glow" />
            <h3 className="text-lg font-bold text-zinc-700">No hay tiendas registradas</h3>
            <p className="text-zinc-400 text-sm mt-1 max-w-sm font-medium">
              Haz clic en "+ Nueva Tienda" para registrar la primera sucursal corporativa de Locatel.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {apiStores.map((store) => {
              const { gondolasCount, totalUnits } = getStoreStats(store);
              return (
                <div
                  key={store.id}
                  className="bg-white border border-zinc-200 rounded-2xl relative overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between h-[210px] w-full"
                >
                  {/* Locatel Brand Top Border Gradient Line */}
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#009639] to-[#ffb81c]" />

                  {/* Top content block */}
                  <div className="p-6 pb-2 flex items-start justify-between">
                    <div className="flex gap-4">
                      {/* Left icon wrapper */}
                      <div className="bg-[#e6f4ea] text-[#009639] p-3.5 rounded-xl flex items-center justify-center h-12 w-12 flex-shrink-0">
                        <Home className="h-5.5 w-5.5" />
                      </div>
                      {/* Title block */}
                      <div className="space-y-1">
                        <h3 className="text-base font-bold text-[#1f2937] leading-snug line-clamp-1">
                          {store.name}
                        </h3>
                        <p className="text-xs text-zinc-400 font-semibold">
                          {gondolasCount} {gondolasCount === 1 ? "góndola" : "góndolas"} · {totalUnits} {totalUnits === 1 ? "unidad" : "unidades"}
                        </p>
                      </div>
                    </div>

                    {/* Edit/Delete Icons */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleStartEdit(store)}
                        className="p-1.5 hover:bg-zinc-100 rounded-lg text-zinc-400 hover:text-[#009639] transition-colors"
                        title="Editar Tienda"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setShowDeleteModal(store.id)}
                        className="p-1.5 hover:bg-red-50 rounded-lg text-zinc-400 hover:text-red-500 transition-colors"
                        title="Eliminar Tienda"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Middle Pills Block */}
                  <div className="px-6 flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-bold bg-zinc-150/60 text-zinc-500 border border-zinc-200/50 px-2.5 py-1 rounded-md flex items-center gap-1 font-mono">
                      🕒 {new Date(store.createdAt).toLocaleDateString()}
                    </span>
                    <span className="text-[10px] font-bold bg-zinc-150/60 text-zinc-500 border border-zinc-200/50 px-2.5 py-1 rounded-md font-mono">
                      ID: {store.id.substring(0, 8)}...
                    </span>
                  </div>

                  {/* Bottom Action buttons */}
                  <div className="p-6 pt-3 flex items-center justify-between gap-4 border-t border-zinc-100">
                    <button
                      onClick={() => {
                        selectStore(store.id);
                        router.push(`/stores/${store.id}?report=true`);
                      }}
                      className="bg-white hover:bg-zinc-50 border border-zinc-250 text-zinc-700 font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 w-1/2 transition-colors"
                    >
                      <FileText className="h-3.5 w-3.5" /> Reporte
                    </button>

                    <button
                      onClick={() => {
                        selectStore(store.id);
                        router.push(`/stores/${store.id}`);
                      }}
                      className="bg-[#009639] hover:bg-[#008030] text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 w-1/2 transition-all active:scale-[0.98]"
                    >
                      Gestionar →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* CREATE TIENDA MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[20px] max-w-[440px] w-full shadow-2xl flex flex-col overflow-hidden border border-zinc-100 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 flex items-center justify-between border-b border-zinc-150">
              <h3 className="text-base font-bold text-[#1f2937]">Crear Nueva Tienda</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 hover:bg-zinc-100 rounded-lg text-zinc-400 hover:text-zinc-650 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreate}>
              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider">
                    Nombre de la Tienda
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Sucursal Central, Tienda Norte..."
                    value={newStoreName}
                    onChange={(e) => setNewStoreName(e.target.value)}
                    className="w-full bg-white border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm text-zinc-800 focus:outline-none focus:border-[#009639] focus:ring-2 focus:ring-[#009639]/10 transition-all font-medium"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider">
                    ID de la Tienda (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. 0001, 1024 (dejar vacío para auto-generar)"
                    value={customId}
                    onChange={(e) => setCustomId(e.target.value.replace(/[^a-zA-Z0-9]/g, ""))}
                    className="w-full bg-white border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm text-zinc-800 focus:outline-none focus:border-[#009639] focus:ring-2 focus:ring-[#009639]/10 transition-all font-medium"
                  />
                </div>
              </div>

              {/* Modal Footer */}
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
                  Crear Tienda
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT TIENDA MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[20px] max-w-[440px] w-full shadow-2xl flex flex-col overflow-hidden border border-zinc-100 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 flex items-center justify-between border-b border-zinc-150">
              <h3 className="text-base font-bold text-[#1f2937]">Editar Tienda</h3>
              <button
                onClick={() => setShowEditModal(null)}
                className="p-1 hover:bg-zinc-100 rounded-lg text-zinc-400 hover:text-zinc-650 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveEdit}>
              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider">
                    Nombre de la Tienda
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-white border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm text-zinc-800 focus:outline-none focus:border-[#009639] focus:ring-2 focus:ring-[#009639]/10 transition-all font-medium"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider">
                    ID de la Tienda
                  </label>
                  <input
                    type="text"
                    value={editCustomId}
                    onChange={(e) => setEditCustomId(e.target.value.replace(/[^a-zA-Z0-9]/g, ""))}
                    className="w-full bg-white border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm text-zinc-800 focus:outline-none focus:border-[#009639] focus:ring-2 focus:ring-[#009639]/10 transition-all font-medium"
                    required
                  />
                </div>

                {errorMsg && <p className="text-xs text-red-500 font-bold text-center">{errorMsg}</p>}
              </div>

              {/* Modal Footer */}
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

      {/* DELETE TIENDA MODAL (¿Eliminar Tienda?) */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[20px] max-w-[460px] w-full shadow-2xl flex flex-col overflow-hidden border border-zinc-100 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 flex items-center justify-between border-b border-zinc-150">
              <h3 className="text-base font-bold text-[#1f2937]">¿Eliminar Tienda?</h3>
              <button
                onClick={() => setShowDeleteModal(null)}
                className="p-1 hover:bg-zinc-100 rounded-lg text-zinc-400 hover:text-zinc-650 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <p className="text-sm text-zinc-650 font-medium leading-relaxed">
                ¿Estás seguro de que deseas eliminar permanentemente la tienda{" "}
                <span className="font-bold text-[#1f2937]">
                  {apiStores.find((s) => s.id === showDeleteModal)?.name}
                </span>
                ?
              </p>

              {/* Warning alert banner box */}
              <div className="bg-red-50 border border-red-200 text-red-500 rounded-xl p-4 flex items-start gap-2 text-xs font-semibold leading-relaxed">
                <AlertTriangle className="h-4.5 w-4.5 text-red-500 flex-shrink-0 mt-0.5" />
                <span>
                  Esta acción destruirá todas las góndolas y planogramas configurados en esta tienda y no se puede deshacer.
                </span>
              </div>
            </div>

            {/* Modal Footer */}
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
