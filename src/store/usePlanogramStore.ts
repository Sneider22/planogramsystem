import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Store, Gondola, GondolaConfig, Product, Shelf, ShelfType, ProductPlacement } from '../types';
import {
  getPlacedDimensions,
  getShelfUsableHeight,
  getShelfUsedWidth,
  getShelfUsedWidth as getShelfUsedWidthHelper,
  getPlacementWidth,
  checkShelfCollisions,
  checkGlobalCollisions,
  recalculateShelfX
} from '../utils/planogramHelpers';

// SAP Catalog Mock (Empty by default, loaded from SQL Server)
const INITIAL_PRODUCTS: Product[] = [];

function getDefaultGondola(): GondolaConfig {
  return {
    type: 'pared',
    width: 100,
    height: 210,
    depth: 40,
    numShelves: 5,
    gapBetweenShelves: 35,
    baseHeight: 20,
    shelfThickness: 2,
    shelfDepth: 40,
    shelfWidth: 100,
    autoPack: true,
    shelves: []
  };
}

function buildShelves(g: GondolaConfig, recalculate = false): Shelf[] {
  const oldShelves = g.shelves || [];
  const shelves: Shelf[] = [];

  for (let i = 0; i < g.numShelves; i++) {
    const oldShelf = oldShelves[i];
    let yPos = parseFloat(g.baseHeight as any) + i * (parseFloat(g.gapBetweenShelves as any) + parseFloat(g.shelfThickness as any));
    if (!recalculate && oldShelf && oldShelf.y !== undefined && !isNaN(oldShelf.y)) {
      yPos = oldShelf.y;
    }
    shelves.push({
      id: oldShelf?.id || `shelf-${i}-${Date.now()}`,
      index: i,
      y: yPos,
      type: oldShelf ? oldShelf.type : 'plancha',
      hookSpacing: oldShelf ? (oldShelf.hookSpacing || 15) : 15,
      depth: oldShelf ? (oldShelf.depth ?? g.shelfDepth) : g.shelfDepth,
      products: oldShelf ? oldShelf.products : []
    });
  }
  return shelves;
}

interface PlanogramState {
  stores: Store[];
  currentStoreId: string | null;
  currentGondolaId: string | null;
  products: Product[];
  gondola: GondolaConfig;
  undoStack: string[];
  redoStack: string[];
  nextStoreAutoId: number;

  // Actions
  createStore: (name: string, customId?: string) => Store;
  updateStoreDetails: (oldId: string, newName: string, newId: string) => { success: boolean; reason?: string };
  deleteStore: (id: string) => void;
  selectStore: (id: string) => void;

  createNewGondola: (name: string, aisle?: string, category?: string, description?: string) => string;
  loadGondola: (id: string) => void;
  duplicateGondola: () => void;
  deleteGondola: (id: string) => void;
  renameGondola: (id: string, name: string, aisle?: string, category?: string, description?: string) => void;
  loadFromDatabase: (gondolaId: string, dbData: any) => void;

  updateGondola: (updates: Partial<GondolaConfig>) => void;
  emptyGondola: () => void;
  toggleAutoPack: () => void;
  setShelfType: (shelfIndex: number, type: ShelfType) => void;
  setShelfHookSpacing: (shelfIndex: number, spacing: number) => { success: boolean; reason?: string };
  setShelfGap: (shelfIndex: number, gap: number) => void;
  setShelfDepth: (shelfIndex: number, depth: number) => void;

  placeProduct: (shelfIndex: number, productId: string, facings?: number, targetHookIndex?: number, targetX?: number, insertIndex?: number) => { success: boolean; reason?: string };
  moveProduct: (sourceShelfIndex: number, sourcePlacementIndex: number, targetShelfIndex: number, targetHookIndex?: number, sourceLayerIndex?: number, targetX?: number, insertIndex?: number) => { success: boolean; reason?: string };
  stackProduct: (shelfIndex: number, placementIndex: number, newProductId: string) => { success: boolean; reason?: string };
  removeFromShelf: (shelfIndex: number, placementIndex: number, layerIndex?: number) => void;
  rotateProduct: (shelfIndex: number, placementIndex: number, layerIndex: number) => { success: boolean; reason?: string };
  updateProductFacings: (shelfIndex: number, placementIndex: number, layerIndex: number, newFacings: number) => { success: boolean; reason?: string };

  pushToUndoStack: (serializedState: string) => void;
  undo: () => { success: boolean; reason?: string };
  redo: () => { success: boolean; reason?: string };
  fetchProducts: () => Promise<void>;
  setProducts: (products: Product[]) => void;
}

export const usePlanogramStore = create<PlanogramState>()(
  persist(
    (set, get) => {
      const autoSave = (storesList: Store[], currentStoreId: string | null, currentGondolaId: string | null, activeGondola: GondolaConfig) => {
        if (!currentStoreId || !currentGondolaId) return storesList;
        return storesList.map(s => {
          if (s.id === currentStoreId) {
            return {
              ...s,
              library: s.library.map(g => {
                if (g.id === currentGondolaId) {
                  return { ...g, config: JSON.parse(JSON.stringify(activeGondola)) };
                }
                return g;
              })
            };
          }
          return s;
        });
      };

      return {
        stores: [],
        currentStoreId: null,
        currentGondolaId: null,
        products: INITIAL_PRODUCTS,
        gondola: getDefaultGondola(),
        undoStack: [],
        redoStack: [],
        nextStoreAutoId: 1,

        createStore: (name, customId) => {
          const state = get();
          let storeId = '';
          let nextAutoId = state.nextStoreAutoId;
          if (customId && customId.trim()) {
            storeId = 'store-' + customId.trim();
          } else {
            const formattedNum = String(nextAutoId).padStart(4, '0');
            storeId = 'store-' + formattedNum;
            nextAutoId++;
          }

          const newStore: Store = {
            id: storeId,
            name,
            createdAt: Date.now(),
            library: []
          };

          set({
            stores: [...state.stores, newStore],
            nextStoreAutoId: nextAutoId
          });
          return newStore;
        },

        updateStoreDetails: (oldId, newName, newId) => {
          const state = get();
          if (oldId !== newId && state.stores.some(s => s.id === newId)) {
            return { success: false, reason: 'Ya existe una tienda con este ID.' };
          }
          const stores = state.stores.map(s => {
            if (s.id === oldId) {
              return { ...s, name: newName, id: newId };
            }
            return s;
          });
          set({
            stores,
            currentStoreId: state.currentStoreId === oldId ? newId : state.currentStoreId
          });
          return { success: true };
        },

        deleteStore: (id) => {
          const state = get();
          set({
            stores: state.stores.filter(s => s.id !== id),
            currentStoreId: state.currentStoreId === id ? null : state.currentStoreId,
            currentGondolaId: state.currentStoreId === id ? null : state.currentGondolaId
          });
        },

        selectStore: (id) => {
          const state = get();
          const store = state.stores.find(s => s.id === id);
          if (store) {
            set({
              currentStoreId: id,
              currentGondolaId: null,
              gondola: getDefaultGondola()
            });
          }
        },

        createNewGondola: (name, aisle = '', category = '', description = '') => {
          const state = get();
          if (!state.currentStoreId) return '';

          const newId = 'gondola-' + Date.now();
          const initialConfig = getDefaultGondola();
          initialConfig.shelves = buildShelves(initialConfig, true);

          const newGondola: Gondola = {
            id: newId,
            name,
            aisle: aisle.trim(),
            category: category.trim(),
            description: description.trim(),
            config: initialConfig
          };

          const stores = state.stores.map(s => {
            if (s.id === state.currentStoreId) {
              return {
                ...s,
                library: [...s.library, newGondola]
              };
            }
            return s;
          });

          set({
            stores,
            currentGondolaId: newId,
            gondola: initialConfig,
            undoStack: [JSON.stringify(initialConfig)],
            redoStack: []
          });

          return newId;
        },

        loadGondola: (id) => {
          const state = get();
          if (!state.currentStoreId) return;
          const store = state.stores.find(s => s.id === state.currentStoreId);
          const preset = store?.library.find(p => p.id === id);
          if (preset) {
            const config = JSON.parse(JSON.stringify(preset.config));
            if (config.autoPack === undefined) {
              config.autoPack = true;
            }
            config.shelves = buildShelves(config, false);

            set({
              currentGondolaId: id,
              gondola: config,
              undoStack: [],
              redoStack: []
            });
          }
        },

        duplicateGondola: () => {
          const state = get();
          if (!state.currentStoreId || !state.currentGondolaId) return;
          const store = state.stores.find(s => s.id === state.currentStoreId);
          const currentData = store?.library.find(p => p.id === state.currentGondolaId);
          if (!currentData) return;

          const newId = 'gondola-' + Date.now();
          const newGondola: Gondola = {
            id: newId,
            name: currentData.name + ' (Copia)',
            aisle: currentData.aisle.trim(),
            category: currentData.category.trim(),
            description: currentData.description.trim(),
            config: JSON.parse(JSON.stringify(state.gondola))
          };

          const stores = state.stores.map(s => {
            if (s.id === state.currentStoreId) {
              return { ...s, library: [...s.library, newGondola] };
            }
            return s;
          });

          set({
            stores,
            currentGondolaId: newId
          });
        },

        deleteGondola: (id) => {
          const state = get();
          if (!state.currentStoreId) return;
          const stores = state.stores.map(s => {
            if (s.id === state.currentStoreId) {
              return { ...s, library: s.library.filter(p => p.id !== id) };
            }
            return s;
          });
          set({
            stores,
            currentGondolaId: state.currentGondolaId === id ? null : state.currentGondolaId
          });
        },

        renameGondola: (id, name, aisle = '', category = '', description = '') => {
          const state = get();
          if (!state.currentStoreId) return;
          const stores = state.stores.map(s => {
            if (s.id === state.currentStoreId) {
              return {
                ...s,
                library: s.library.map(g => {
                  if (g.id === id) {
                    return {
                      ...g,
                      name,
                      aisle: aisle.trim(),
                      category: category.trim(),
                      description: description.trim()
                    };
                  }
                  return g;
                })
              };
            }
            return s;
          });
          set({ stores });
        },

        loadFromDatabase: (gondolaId, dbData) => {
          set({
            gondola: dbData,
            undoStack: [],
            redoStack: []
          });
        },

        updateGondola: (updates) => {
          const state = get();
          const previousState = JSON.stringify(state.gondola);
          const shouldRecalculate = (updates.numShelves !== undefined || updates.gapBetweenShelves !== undefined || updates.baseHeight !== undefined);

          const newGondola: GondolaConfig = { ...state.gondola, ...updates };
          if (updates.width !== undefined) newGondola.shelfWidth = updates.width;
          if (updates.depth !== undefined) {
            const newDepth = updates.depth;
            newGondola.shelfDepth = newDepth;
            if (newGondola.shelves) {
              newGondola.shelves = newGondola.shelves.map(s => ({
                ...s,
                depth: newDepth
              }));
            }
          }

          newGondola.shelves = buildShelves(newGondola, shouldRecalculate);

          const stores = autoSave(state.stores, state.currentStoreId, state.currentGondolaId, newGondola);
          state.pushToUndoStack(previousState);
          set({
            gondola: newGondola,
            stores
          });
        },

        emptyGondola: () => {
          const state = get();
          const previousState = JSON.stringify(state.gondola);
          const newGondola = {
            ...state.gondola,
            shelves: state.gondola.shelves.map(shelf => ({
              ...shelf,
              products: []
            }))
          };

          const stores = autoSave(state.stores, state.currentStoreId, state.currentGondolaId, newGondola);
          state.pushToUndoStack(previousState);
          set({
            gondola: newGondola,
            stores
          });
        },

        toggleAutoPack: () => {
          const state = get();
          const previousState = JSON.stringify(state.gondola);
          const newGondola = {
            ...state.gondola,
            autoPack: !state.gondola.autoPack
          };

          if (newGondola.autoPack) {
            newGondola.shelves.forEach((_, idx) => {
              if (newGondola.shelves[idx].type === 'plancha') {
                recalculateShelfX(newGondola, idx, state.products);
              }
            });
          }

          const stores = autoSave(state.stores, state.currentStoreId, state.currentGondolaId, newGondola);
          state.pushToUndoStack(previousState);
          set({
            gondola: newGondola,
            stores
          });
        },

        setShelfType: (shelfIndex, type) => {
          const state = get();
          const previousState = JSON.stringify(state.gondola);
          const newGondola = JSON.parse(previousState) as GondolaConfig;

          newGondola.shelves[shelfIndex].type = type;
          recalculateShelfX(newGondola, shelfIndex, state.products);

          const stores = autoSave(state.stores, state.currentStoreId, state.currentGondolaId, newGondola);
          state.pushToUndoStack(previousState);
          set({
            gondola: newGondola,
            stores
          });
        },

        setShelfHookSpacing: (shelfIndex, spacing) => {
          const state = get();
          const shelf = state.gondola.shelves[shelfIndex];
          if (!shelf || shelf.type !== 'perchero') return { success: false, reason: 'Nivel inválido' };

          // Temp check for collisions
          const previousState = JSON.stringify(state.gondola);
          const newGondola = JSON.parse(previousState) as GondolaConfig;
          newGondola.shelves[shelfIndex].hookSpacing = spacing;
          recalculateShelfX(newGondola, shelfIndex, state.products);

          const checkCol = checkShelfCollisions(newGondola, shelfIndex, state.products);
          if (!checkCol.valid) {
            return { success: false, reason: checkCol.reason };
          }

          const globalCol = checkGlobalCollisions(newGondola, state.products);
          if (!globalCol.valid) {
            return { success: false, reason: globalCol.reason };
          }

          const stores = autoSave(state.stores, state.currentStoreId, state.currentGondolaId, newGondola);
          state.pushToUndoStack(previousState);
          set({
            gondola: newGondola,
            stores
          });
          return { success: true };
        },

        setShelfGap: (shelfIndex, gap) => {
          const state = get();
          const previousState = JSON.stringify(state.gondola);
          const newGondola = JSON.parse(previousState) as GondolaConfig;

          const baseHeight = parseFloat(newGondola.baseHeight as any) || 20;
          const shelfThickness = parseFloat(newGondola.shelfThickness as any) || 2;
          const prevY = shelfIndex === 0 ? baseHeight : parseFloat(newGondola.shelves[shelfIndex - 1].y as any) + shelfThickness;
          const currentGap = parseFloat(newGondola.shelves[shelfIndex].y as any) - prevY;
          const delta = gap - currentGap;

          for (let idx = shelfIndex; idx < newGondola.shelves.length; idx++) {
            newGondola.shelves[idx].y = parseFloat(newGondola.shelves[idx].y as any) + delta;
          }

          const stores = autoSave(state.stores, state.currentStoreId, state.currentGondolaId, newGondola);
          state.pushToUndoStack(previousState);
          set({
            gondola: newGondola,
            stores
          });
        },

        setShelfDepth: (shelfIndex, depth) => {
          const state = get();
          const previousState = JSON.stringify(state.gondola);
          const newGondola = JSON.parse(previousState) as GondolaConfig;

          newGondola.shelves[shelfIndex].depth = depth;

          const stores = autoSave(state.stores, state.currentStoreId, state.currentGondolaId, newGondola);
          state.pushToUndoStack(previousState);
          set({
            gondola: newGondola,
            stores
          });
        },

        placeProduct: (shelfIndex, productId, facings = 1, targetHookIndex, targetX, insertIndex) => {
          const state = get();
          const previousState = JSON.stringify(state.gondola);
          const newGondola = JSON.parse(previousState) as GondolaConfig;
          const shelf = newGondola.shelves[shelfIndex];
          if (!shelf) return { success: false, reason: 'Estante no encontrado' };

          const prod = state.products.find(p => p.id === productId);
          if (!prod) return { success: false, reason: 'Producto no encontrado' };

          const dims = getPlacedDimensions(prod, 0);
          const requiredWidth = dims.width * facings;
          const availableWidth = newGondola.shelfWidth - getShelfUsedWidth(newGondola, shelfIndex, state.products);
          const usableHeight = getShelfUsableHeight(newGondola, shelfIndex);

          if (dims.height > usableHeight) {
            return {
              success: false,
              reason: `Producto muy alto. Altura: ${dims.height}cm. Espacio libre: ${usableHeight.toFixed(1)}cm.`
            };
          }

          if (shelf.type === 'perchero') {
            const spacing = shelf.hookSpacing || 15;
            const numHooks = Math.floor(newGondola.shelfWidth / spacing);
            const occupied = shelf.products
              .filter(other => other.hookIndex !== undefined)
              .map(other => other.hookIndex as number);

            let targetIdx = targetHookIndex;
            if (targetIdx === undefined) {
              let found = -1;
              for (let i = 0; i < numHooks; i++) {
                if (!occupied.includes(i)) {
                  found = i;
                  break;
                }
              }
              if (found === -1) return { success: false, reason: 'No quedan ganchos libres.' };
              targetIdx = found;
            } else {
              if (occupied.includes(targetIdx)) {
                return { success: false, reason: `El Gancho ${targetIdx + 1} ya está ocupado.` };
              }
            }

            shelf.products.push({
              x: 0,
              hookIndex: targetIdx,
              placedAt: Date.now(),
              layers: [{ productId, facings, orientation: 0 }]
            });
          } else {
            // Plancha
            if (newGondola.autoPack) {
              if (availableWidth < requiredWidth) {
                return {
                  success: false,
                  reason: `Sin espacio lineal. Requerido: ${requiredWidth}cm. Disponible: ${availableWidth.toFixed(1)}cm.`
                };
              }
              const newPlacement: ProductPlacement = {
                x: 0,
                placedAt: Date.now(),
                layers: [{ productId, facings, orientation: 0 }]
              };

              if (insertIndex !== undefined && insertIndex >= 0 && insertIndex <= shelf.products.length) {
                shelf.products.splice(insertIndex, 0, newPlacement);
              } else {
                shelf.products.push(newPlacement);
              }
            } else {
              let finalX = targetX !== undefined ? targetX : (newGondola.shelfWidth - requiredWidth);
              if (finalX < 0) finalX = 0;

              const snapThreshold = 4;
              if (finalX < snapThreshold) finalX = 0;
              if (newGondola.shelfWidth - (finalX + requiredWidth) < snapThreshold) {
                finalX = newGondola.shelfWidth - requiredWidth;
              }

              shelf.products.forEach(other => {
                const otherWidth = getPlacementWidth(other, state.products);
                const otherLeft = other.x;
                const otherRight = other.x + otherWidth;
                if (Math.abs(finalX - otherRight) < snapThreshold) finalX = otherRight;
                if (Math.abs((finalX + requiredWidth) - otherLeft) < snapThreshold) finalX = otherLeft - requiredWidth;
              });

              shelf.products.push({
                x: finalX,
                placedAt: Date.now(),
                layers: [{ productId, facings, orientation: 0 }]
              });
            }
          }

          recalculateShelfX(newGondola, shelfIndex, state.products);

          const checkCol = checkShelfCollisions(newGondola, shelfIndex, state.products);
          if (!checkCol.valid) {
            return { success: false, reason: checkCol.reason };
          }

          const globalCol = checkGlobalCollisions(newGondola, state.products);
          if (!globalCol.valid) {
            return { success: false, reason: globalCol.reason };
          }

          const stores = autoSave(state.stores, state.currentStoreId, state.currentGondolaId, newGondola);
          state.pushToUndoStack(previousState);
          set({
            gondola: newGondola,
            stores
          });
          return { success: true };
        },

        moveProduct: (sourceShelfIndex, sourcePlacementIndex, targetShelfIndex, targetHookIndex, sourceLayerIndex, targetX, insertIndex) => {
          const state = get();
          const previousState = JSON.stringify(state.gondola);
          const newGondola = JSON.parse(previousState) as GondolaConfig;

          const sourceShelf = newGondola.shelves[sourceShelfIndex];
          const targetShelf = newGondola.shelves[targetShelfIndex];
          if (!sourceShelf || !targetShelf) return { success: false, reason: 'Estante de origen/destino inválido' };

          const placement = sourceShelf.products[sourcePlacementIndex];
          if (!placement) return { success: false, reason: 'Colocación no encontrada' };

          let singleLayerToMove = null;
          if (sourceLayerIndex !== undefined && placement.layers.length > 1) {
            singleLayerToMove = placement.layers[sourceLayerIndex];
          }

          let productId = placement.layers[0]?.productId;
          let facings = placement.layers[0]?.facings || 1;
          let orientation = placement.layers[0]?.orientation || 0;

          if (singleLayerToMove) {
            productId = singleLayerToMove.productId;
            facings = singleLayerToMove.facings;
            orientation = singleLayerToMove.orientation;
          }

          const prod = state.products.find(p => p.id === productId);
          if (!prod) return { success: false, reason: 'Producto no encontrado' };
          const dims = getPlacedDimensions(prod, orientation);

          if (targetShelf.type === 'perchero') {
            const spacing = targetShelf.hookSpacing || 15;
            const numHooks = Math.floor(newGondola.shelfWidth / spacing);
            const willRemoveSourcePlacement = !singleLayerToMove || (placement.layers.length <= 1);

            const occupied = targetShelf.products
              .filter((p, i) => {
                if (sourceShelfIndex === targetShelfIndex && i === sourcePlacementIndex) {
                  return !willRemoveSourcePlacement;
                }
                return true;
              })
              .map(p => p.hookIndex as number);

            let targetIdx = targetHookIndex;
            if (targetIdx === undefined) {
              let found = -1;
              for (let i = 0; i < numHooks; i++) {
                if (!occupied.includes(i)) {
                  found = i;
                  break;
                }
              }
              if (found === -1) return { success: false, reason: 'No quedan ganchos libres en este perchero.' };
              targetIdx = found;
            } else {
              if (occupied.includes(targetIdx)) {
                return { success: false, reason: `El Gancho ${targetIdx + 1} ya está ocupado.` };
              }
            }

            if (singleLayerToMove) {
              placement.layers.splice(sourceLayerIndex!, 1);
              if (placement.layers.length === 0) {
                sourceShelf.products.splice(sourcePlacementIndex, 1);
              }
              targetShelf.products.push({
                x: 0,
                hookIndex: targetIdx,
                placedAt: Date.now(),
                layers: [singleLayerToMove]
              });
            } else {
              sourceShelf.products.splice(sourcePlacementIndex, 1);
              placement.hookIndex = targetIdx;
              targetShelf.products.push(placement);
            }
          } else {
            // Target is plancha
            const requiredWidth = dims.width * facings;
            if (newGondola.autoPack) {
              if (singleLayerToMove) {
                placement.layers.splice(sourceLayerIndex!, 1);
                if (placement.layers.length === 0) {
                  sourceShelf.products.splice(sourcePlacementIndex, 1);
                }
                const newPlacement: ProductPlacement = {
                  x: 0,
                  placedAt: Date.now(),
                  layers: [singleLayerToMove]
                };
                if (insertIndex !== undefined && insertIndex >= 0 && insertIndex <= targetShelf.products.length) {
                  targetShelf.products.splice(insertIndex, 0, newPlacement);
                } else {
                  targetShelf.products.push(newPlacement);
                }
              } else {
                sourceShelf.products.splice(sourcePlacementIndex, 1);
                delete placement.hookIndex;
                if (insertIndex !== undefined && insertIndex >= 0 && insertIndex <= targetShelf.products.length) {
                  targetShelf.products.splice(insertIndex, 0, placement);
                } else {
                  targetShelf.products.push(placement);
                }
              }
            } else {
              // Target is plancha (libre)
              let finalX = targetX !== undefined ? targetX : (newGondola.shelfWidth - requiredWidth);
              if (finalX < 0) finalX = 0;

              const snapThreshold = 4;
              if (finalX < snapThreshold) finalX = 0;
              if (newGondola.shelfWidth - (finalX + requiredWidth) < snapThreshold) {
                finalX = newGondola.shelfWidth - requiredWidth;
              }

              targetShelf.products.forEach((other, idx) => {
                if (sourceShelfIndex === targetShelfIndex && idx === sourcePlacementIndex) return;
                const otherWidth = getPlacementWidth(other, state.products);
                const otherLeft = other.x;
                const otherRight = other.x + otherWidth;
                if (Math.abs(finalX - otherRight) < snapThreshold) finalX = otherRight;
                if (Math.abs((finalX + requiredWidth) - otherLeft) < snapThreshold) finalX = otherLeft - requiredWidth;
              });

              if (singleLayerToMove) {
                placement.layers.splice(sourceLayerIndex!, 1);
                if (placement.layers.length === 0) {
                  sourceShelf.products.splice(sourcePlacementIndex, 1);
                }
                targetShelf.products.push({
                  x: finalX,
                  placedAt: Date.now(),
                  layers: [singleLayerToMove]
                });
              } else {
                sourceShelf.products.splice(sourcePlacementIndex, 1);
                delete placement.hookIndex;
                placement.x = finalX;
                targetShelf.products.push(placement);
              }
            }
          }

          recalculateShelfX(newGondola, sourceShelfIndex, state.products);
          recalculateShelfX(newGondola, targetShelfIndex, state.products);

          const checkColS = checkShelfCollisions(newGondola, sourceShelfIndex, state.products);
          if (!checkColS.valid) return { success: false, reason: checkColS.reason };

          const checkColT = checkShelfCollisions(newGondola, targetShelfIndex, state.products);
          if (!checkColT.valid) return { success: false, reason: checkColT.reason };

          const globalCol = checkGlobalCollisions(newGondola, state.products);
          if (!globalCol.valid) return { success: false, reason: globalCol.reason };

          const stores = autoSave(state.stores, state.currentStoreId, state.currentGondolaId, newGondola);
          state.pushToUndoStack(previousState);
          set({
            gondola: newGondola,
            stores
          });
          return { success: true };
        },

        stackProduct: (shelfIndex, placementIndex, newProductId) => {
          const state = get();
          const previousState = JSON.stringify(state.gondola);
          const newGondola = JSON.parse(previousState) as GondolaConfig;
          const shelf = newGondola.shelves[shelfIndex];
          const p = shelf?.products[placementIndex];

          if (!p || p.layers.length === 0) return { success: false, reason: 'Pila inválida' };

          const baseLayer = p.layers[0];
          if (baseLayer.productId !== newProductId) {
            return {
              success: false,
              reason: 'Solo se pueden apilar unidades del mismo producto.'
            };
          }

          const baseProd = state.products.find(pr => pr.id === baseLayer.productId);
          if (!baseProd) return { success: false, reason: 'Producto base no encontrado' };

          const baseDims = getPlacedDimensions(baseProd, baseLayer.orientation || 0);
          const baseTotalWidth = baseDims.width * baseLayer.facings;

          const newProd = state.products.find(pr => pr.id === newProductId);
          if (!newProd) return { success: false, reason: 'Producto no encontrado' };

          const newDims = getPlacedDimensions(newProd, 0);
          const newFacings = Math.floor(baseTotalWidth / newDims.width);

          if (newFacings < 1) {
            return {
              success: false,
              reason: `El producto es muy ancho para apilarse aquí. Ancho disponible: ${baseTotalWidth.toFixed(1)}cm. Ancho producto: ${newDims.width}cm.`
            };
          }

          const usableHeight = getShelfUsableHeight(newGondola, shelfIndex);
          let currentStackHeight = 0;
          p.layers.forEach(layer => {
            const prod = state.products.find(pr => pr.id === layer.productId);
            if (prod) {
              currentStackHeight += getPlacedDimensions(prod, layer.orientation || 0).height;
            }
          });

          const nextStackHeight = currentStackHeight + newDims.height;
          if (nextStackHeight > usableHeight) {
            return {
              success: false,
              reason: `Sin espacio vertical. Altura proyectada: ${nextStackHeight}cm. Espacio libre: ${usableHeight.toFixed(1)}cm.`
            };
          }

          p.layers.push({
            productId: newProductId,
            facings: newFacings,
            orientation: 0
          });

          const globalCol = checkGlobalCollisions(newGondola, state.products);
          if (!globalCol.valid) {
            return { success: false, reason: globalCol.reason };
          }

          const stores = autoSave(state.stores, state.currentStoreId, state.currentGondolaId, newGondola);
          state.pushToUndoStack(previousState);
          set({
            gondola: newGondola,
            stores
          });
          return { success: true };
        },

        removeFromShelf: (shelfIndex, placementIndex, layerIndex) => {
          const state = get();
          const previousState = JSON.stringify(state.gondola);
          const newGondola = JSON.parse(previousState) as GondolaConfig;
          const shelf = newGondola.shelves[shelfIndex];
          const p = shelf?.products[placementIndex];

          if (!p) return;

          if (layerIndex === undefined || layerIndex === 0) {
            shelf.products.splice(placementIndex, 1);
          } else {
            p.layers.splice(layerIndex, 1);
          }

          recalculateShelfX(newGondola, shelfIndex, state.products);

          const stores = autoSave(state.stores, state.currentStoreId, state.currentGondolaId, newGondola);
          state.pushToUndoStack(previousState);
          set({
            gondola: newGondola,
            stores
          });
        },

        rotateProduct: (shelfIndex, placementIndex, layerIndex) => {
          const state = get();
          const previousState = JSON.stringify(state.gondola);
          const newGondola = JSON.parse(previousState) as GondolaConfig;
          const shelf = newGondola.shelves[shelfIndex];
          const p = shelf?.products[placementIndex];
          const layer = p?.layers[layerIndex];

          if (!shelf || !p || !layer) return { success: false, reason: 'Producto o capa no encontrados' };

          const originalOrientation = layer.orientation || 0;
          const originalFacings = layer.facings;

          layer.orientation = ((layer.orientation || 0) + 1) % 6;

          if (layerIndex > 0) {
            const baseLayer = p.layers[0];
            const baseProd = state.products.find(pr => pr.id === baseLayer.productId);
            if (baseProd) {
              const baseDims = getPlacedDimensions(baseProd, baseLayer.orientation || 0);
              const baseTotalWidth = baseDims.width * baseLayer.facings;

              const layerProd = state.products.find(pr => pr.id === layer.productId);
              if (layerProd) {
                const newDims = getPlacedDimensions(layerProd, layer.orientation);
                const newFacings = Math.floor(baseTotalWidth / newDims.width);
                if (newFacings < 1) {
                  layer.orientation = originalOrientation;
                  layer.facings = originalFacings;
                  return { success: false, reason: 'La rotación hace que la capa exceda el ancho de la base.' };
                }
                layer.facings = newFacings;
              }
            }
          }

          const usableHeight = getShelfUsableHeight(newGondola, shelfIndex);
          let totalHeight = 0;
          p.layers.forEach(l => {
            const prod = state.products.find(pr => pr.id === l.productId);
            if (prod) {
              totalHeight += getPlacedDimensions(prod, l.orientation || 0).height;
            }
          });

          if (totalHeight > usableHeight) {
            return { success: false, reason: `La rotación hace que el producto sea muy alto (${totalHeight}cm) para el espacio libre (${usableHeight.toFixed(1)}cm).` };
          }

          recalculateShelfX(newGondola, shelfIndex, state.products);

          const checkCol = checkShelfCollisions(newGondola, shelfIndex, state.products);
          if (!checkCol.valid) return { success: false, reason: checkCol.reason };

          const globalCol = checkGlobalCollisions(newGondola, state.products);
          if (!globalCol.valid) return { success: false, reason: globalCol.reason };

          const stores = autoSave(state.stores, state.currentStoreId, state.currentGondolaId, newGondola);
          state.pushToUndoStack(previousState);
          set({
            gondola: newGondola,
            stores
          });
          return { success: true };
        },

        updateProductFacings: (shelfIndex, placementIndex, layerIndex, newFacings) => {
          const state = get();
          const previousState = JSON.stringify(state.gondola);
          const newGondola = JSON.parse(previousState) as GondolaConfig;
          const shelf = newGondola.shelves[shelfIndex];
          const p = shelf?.products[placementIndex];
          const layer = p?.layers[layerIndex];

          if (!shelf || !p || !layer) return { success: false, reason: 'Producto o capa no encontrados' };

          const originalFacings = layer.facings;
          layer.facings = newFacings;

          const prod = state.products.find(pr => pr.id === layer.productId);
          if (prod && layerIndex === 0) {
            const dims = getPlacedDimensions(prod, layer.orientation || 0);
            const newWidth = dims.width * newFacings;

            // Recalculate layers above
            for (let i = 1; i < p.layers.length; i++) {
              const uLayer = p.layers[i];
              const uProd = state.products.find(pr => pr.id === uLayer.productId);
              if (uProd) {
                const uDims = getPlacedDimensions(uProd, uLayer.orientation || 0);
                const maxF = Math.floor(newWidth / uDims.width);
                uLayer.facings = Math.max(1, maxF);
              }
            }
          }

          recalculateShelfX(newGondola, shelfIndex, state.products);

          const checkCol = checkShelfCollisions(newGondola, shelfIndex, state.products);
          if (!checkCol.valid) return { success: false, reason: checkCol.reason };

          const globalCol = checkGlobalCollisions(newGondola, state.products);
          if (!globalCol.valid) return { success: false, reason: globalCol.reason };

          const stores = autoSave(state.stores, state.currentStoreId, state.currentGondolaId, newGondola);
          state.pushToUndoStack(previousState);
          set({
            gondola: newGondola,
            stores
          });
          return { success: true };
        },

        pushToUndoStack: (serializedState) => {
          if (!serializedState) return;
          const state = get();
          if (state.undoStack.length > 0 && state.undoStack[state.undoStack.length - 1] === serializedState) {
            return;
          }
          set({
            undoStack: [...state.undoStack, serializedState].slice(-30),
            redoStack: []
          });
        },

        undo: () => {
          const state = get();
          if (state.undoStack.length === 0) return { success: false, reason: 'Nada para deshacer' };

          const prevStr = state.undoStack[state.undoStack.length - 1];
          const newUndoStack = state.undoStack.slice(0, -1);
          const currentConfigStr = JSON.stringify(state.gondola);

          const newGondola = JSON.parse(prevStr) as GondolaConfig;
          const stores = autoSave(state.stores, state.currentStoreId, state.currentGondolaId, newGondola);

          set({
            gondola: newGondola,
            stores,
            undoStack: newUndoStack,
            redoStack: [...state.redoStack, currentConfigStr]
          });
          return { success: true };
        },

        redo: () => {
          const state = get();
          if (state.redoStack.length === 0) return { success: false, reason: 'Nada para rehacer' };

          const nextStr = state.redoStack[state.redoStack.length - 1];
          const newRedoStack = state.redoStack.slice(0, -1);
          const currentConfigStr = JSON.stringify(state.gondola);

          const newGondola = JSON.parse(nextStr) as GondolaConfig;
          const stores = autoSave(state.stores, state.currentStoreId, state.currentGondolaId, newGondola);

          set({
            gondola: newGondola,
            stores,
            undoStack: [...state.undoStack, currentConfigStr],
            redoStack: newRedoStack
          });
          return { success: true };
        },

        fetchProducts: async () => {
          try {
            const res = await fetch(`/api/products?t=${Date.now()}`, { cache: "no-store" });
            const data = await res.json();
            if (data.success && Array.isArray(data.data)) {
              set({ products: data.data });
            }
          } catch (err) {
            console.error("Error fetching products in store:", err);
          }
        },

        setProducts: (products) => {
          set({ products });
        }
      };
    },
    {
      name: 'planogram-app-store',
      partialize: (state) => ({
        stores: state.stores,
        currentStoreId: state.currentStoreId,
        currentGondolaId: state.currentGondolaId,
        nextStoreAutoId: state.nextStoreAutoId
      })
    }
  )
);
