import { Product, ProductPlacement, Shelf, GondolaConfig, GlobalStats, ShelfStats } from '../types';

export function getPlacedDimensions(product: Product, orientation: number = 0) {
  const w = product.width;
  const h = product.height;
  const d = product.depth;
  switch (orientation) {
    case 1: return { width: h, height: w, depth: d }; // side (xy)
    case 2: return { width: d, height: h, depth: w }; // depth-facing (xz)
    case 3: return { width: d, height: w, depth: h }; // depth-facing side
    case 4: return { width: w, height: d, depth: h }; // top-facing (yz)
    case 5: return { width: h, height: d, depth: w }; // top-facing side
    default: return { width: w, height: h, depth: d }; // normal
  }
}

export function getDepthUnits(shelfDepth: number, productDepth: number): number {
  return Math.max(1, Math.floor(shelfDepth / productDepth));
}

export function getMaxFacings(shelfWidth: number, productWidth: number): number {
  return Math.max(1, Math.floor(shelfWidth / productWidth));
}

export function getStackCapacity(placement: ProductPlacement, shelfDepth: number, productsCatalog: Product[]): number {
  return placement.layers.reduce((sum, layer) => {
    const prod = productsCatalog.find(p => p.id === layer.productId);
    if (!prod) return sum;
    const dims = getPlacedDimensions(prod, layer.orientation || 0);
    const depthUnits = getDepthUnits(shelfDepth, dims.depth);
    return sum + (layer.facings * depthUnits);
  }, 0);
}

export function getShelfCapacity(shelf: Shelf, productsCatalog: Product[]): number {
  return shelf.products.reduce((sum, placement) => {
    return sum + getStackCapacity(placement, shelf.depth, productsCatalog);
  }, 0);
}

export function getShelfUsableHeight(gondola: GondolaConfig, shelfIndex: number): number {
  const shelf = gondola.shelves[shelfIndex];
  if (!shelf) return 0;
  const nextShelf = gondola.shelves[shelfIndex + 1];
  const ceiling = nextShelf ? nextShelf.y : gondola.height;
  return ceiling - (shelf.y + gondola.shelfThickness);
}

export function getPlacementWidth(placement: ProductPlacement, productsCatalog: Product[]): number {
  if (placement.layers.length === 0) return 0;
  const baseLayer = placement.layers[0];
  const prod = productsCatalog.find(p => p.id === baseLayer.productId);
  if (!prod) return 0;
  const dims = getPlacedDimensions(prod, baseLayer.orientation || 0);
  return dims.width * baseLayer.facings;
}

export function getShelfUsedWidth(gondola: GondolaConfig, shelfIndex: number, productsCatalog: Product[]): number {
  const shelf = gondola.shelves[shelfIndex];
  if (!shelf) return 0;
  return shelf.products.reduce((sum, p) => sum + getPlacementWidth(p, productsCatalog), 0);
}

export function getPlacementBoundingBox(
  gondola: GondolaConfig,
  shelfIndex: number,
  placement: ProductPlacement,
  productsCatalog: Product[]
) {
  const shelf = gondola.shelves[shelfIndex];
  let w = 0;
  let h = 0;

  if (placement.layers.length > 0) {
    const baseLayer = placement.layers[0];
    const baseProd = productsCatalog.find(pr => pr.id === baseLayer.productId);
    if (baseProd) {
      const baseDims = getPlacedDimensions(baseProd, baseLayer.orientation || 0);
      w = baseDims.width * baseLayer.facings;
    }

    placement.layers.forEach(layer => {
      const prod = productsCatalog.find(pr => pr.id === layer.productId);
      if (prod) {
        const layerDims = getPlacedDimensions(prod, layer.orientation || 0);
        h += layerDims.height;
      }
    });
  }

  let yBottom = 0;
  let yTop = 0;

  if (shelf.type === 'perchero') {
    yBottom = shelf.y - h * 0.85;
    yTop = shelf.y + h * 0.15;
  } else {
    yBottom = shelf.y + gondola.shelfThickness;
    yTop = yBottom + h;
  }

  return {
    x1: placement.x,
    x2: placement.x + w,
    y1: yBottom,
    y2: yTop,
    width: w,
    height: h
  };
}

export function checkShelfCollisions(
  gondola: GondolaConfig,
  shelfIndex: number,
  productsCatalog: Product[]
): { valid: boolean; reason?: string } {
  const shelf = gondola.shelves[shelfIndex];
  if (!shelf) return { valid: true };

  const isPerchero = shelf.type === 'perchero';
  const shelfWidth = gondola.shelfWidth;

  if (isPerchero) {
    const spacing = shelf.hookSpacing || 15;
    const numHooks = Math.floor(shelfWidth / spacing);
    const margin = (shelfWidth - (numHooks - 1) * spacing) / 2;

    if (shelf.products.length > numHooks) {
      return {
        valid: false,
        reason: `No hay suficientes ganchos disponibles. Caben ${numHooks} ganchos pero hay ${shelf.products.length} productos.`
      };
    }

    for (let i = 0; i < shelf.products.length; i++) {
      const p1 = shelf.products[i];
      if (p1.hookIndex === undefined) continue;

      const w1 = getPlacementWidth(p1, productsCatalog);
      if (w1 > spacing) {
        const name = getPlacementName(p1, productsCatalog);
        return {
          valid: false,
          reason: `Ancho excedido: El producto "${name}" (${w1}cm de ancho) supera la separación entre ganchos (${spacing}cm) en este nivel.`
        };
      }

      const hookX = margin + p1.hookIndex * spacing;
      const leftEdge = hookX - w1 / 2;
      const rightEdge = hookX + w1 / 2;

      if (leftEdge < 0) {
        return {
          valid: false,
          reason: `Colisión de borde: El producto en el Gancho ${p1.hookIndex + 1} (${w1}cm de ancho) sobresaldría ${Math.abs(leftEdge).toFixed(1)}cm por el lateral izquierdo.`
        };
      }
      if (rightEdge > shelfWidth) {
        return {
          valid: false,
          reason: `Colisión de borde: El producto en el Gancho ${p1.hookIndex + 1} (${w1}cm de ancho) sobresaldría ${(rightEdge - shelfWidth).toFixed(1)}cm por el lateral derecho.`
        };
      }

      for (let j = i + 1; j < shelf.products.length; j++) {
        const p2 = shelf.products[j];
        if (p2.hookIndex === undefined) continue;

        const w2 = getPlacementWidth(p2, productsCatalog);
        const hookX2 = margin + p2.hookIndex * spacing;
        const leftEdge2 = hookX2 - w2 / 2;
        const rightEdge2 = hookX2 + w2 / 2;

        if (leftEdge < rightEdge2 && rightEdge > leftEdge2) {
          return {
            valid: false,
            reason: `Colisión física: El producto en el Gancho ${p1.hookIndex + 1} choca con el producto en el Gancho ${p2.hookIndex + 1}.`
          };
        }
      }
    }
  } else {
    // Standard Plancha
    for (let i = 0; i < shelf.products.length; i++) {
      const pA = shelf.products[i];
      const wA = getPlacementWidth(pA, productsCatalog);
      const xA1 = pA.x;
      const xA2 = pA.x + wA;

      if (xA1 < 0 || xA2 > shelfWidth) {
        return {
          valid: false,
          reason: `El producto sobresale de los límites de la repisa (Ancho repisa: ${shelfWidth}cm, Ocupa: ${xA1.toFixed(1)} - ${xA2.toFixed(1)}cm).`
        };
      }

      for (let j = i + 1; j < shelf.products.length; j++) {
        const pB = shelf.products[j];
        const wB = getPlacementWidth(pB, productsCatalog);
        const xB1 = pB.x;
        const xB2 = pB.x + wB;

        if (xA1 < xB2 && xA2 > xB1) {
          const nameA = getPlacementName(pA, productsCatalog);
          const nameB = getPlacementName(pB, productsCatalog);
          return {
            valid: false,
            reason: `Colisión física: El producto "${nameA}" choca con "${nameB}".`
          };
        }
      }
    }
  }
  return { valid: true };
}

export function checkGlobalCollisions(
  gondola: GondolaConfig,
  productsCatalog: Product[]
): { valid: boolean; reason?: string } {
  const placements: Array<{
    shelfIndex: number;
    productName: string;
    box: { x1: number; x2: number; y1: number; y2: number };
  }> = [];

  gondola.shelves.forEach(shelf => {
    shelf.products.forEach(p => {
      const box = getPlacementBoundingBox(gondola, shelf.index, p, productsCatalog);
      placements.push({
        shelfIndex: shelf.index,
        productName: getPlacementName(p, productsCatalog),
        box: box
      });
    });
  });

  for (let i = 0; i < placements.length; i++) {
    for (let j = i + 1; j < placements.length; j++) {
      const pA = placements[i];
      const pB = placements[j];

      if (pA.shelfIndex === pB.shelfIndex) continue;

      const bA = pA.box;
      const bB = pB.box;

      if (bA.y2 <= bB.y1 || bA.y1 >= bB.y2) continue;

      const xOverlap = bA.x1 < bB.x2 && bA.x2 > bB.x1;
      if (xOverlap) {
        return {
          valid: false,
          reason: `Choque de estantería: El producto colgante "${pA.productName}" (Nivel ${pA.shelfIndex + 1}) colisiona verticalmente con "${pB.productName}" (Nivel ${pB.shelfIndex + 1}).`
        };
      }
    }
  }
  return { valid: true };
}

export function recalculateShelfX(
  gondola: GondolaConfig,
  shelfIndex: number,
  productsCatalog: Product[]
): void {
  const shelf = gondola.shelves[shelfIndex];
  if (!shelf) return;

  const isPerchero = shelf.type === 'perchero';

  if (isPerchero) {
    const spacing = shelf.hookSpacing || 15;
    const numHooks = Math.floor(gondola.shelfWidth / spacing);
    const margin = (gondola.shelfWidth - (numHooks - 1) * spacing) / 2;

    shelf.products.forEach((p, idx) => {
      if (p.hookIndex === undefined) {
        const occupied = shelf.products
          .filter(other => other !== p && other.hookIndex !== undefined)
          .map(other => other.hookIndex as number);

        let found = 0;
        for (let i = 0; i < numHooks; i++) {
          if (!occupied.includes(i)) {
            found = i;
            break;
          }
        }
        p.hookIndex = found;
      }

      const hookX = margin + p.hookIndex * spacing;
      if (p.layers.length > 0) {
        const baseLayer = p.layers[0];
        const prod = productsCatalog.find(pr => pr.id === baseLayer.productId);
        const w = prod ? getPlacedDimensions(prod, baseLayer.orientation || 0).width : 0;
        p.x = hookX - (w * baseLayer.facings) / 2;
      } else {
        p.x = hookX;
      }
    });
  } else {
    if (gondola.autoPack) {
      let currentX = 0;
      shelf.products.forEach(p => {
        p.x = currentX;
        currentX += getPlacementWidth(p, productsCatalog);
      });
    }
  }
}

export function getPlacementName(placement: ProductPlacement, productsCatalog: Product[]): string {
  if (placement.layers.length === 0) return 'Producto';
  const prod = productsCatalog.find(p => p.id === placement.layers[0].productId);
  return prod ? prod.name : 'Producto';
}

export function getGlobalStats(gondola: GondolaConfig, productsCatalog: Product[]): GlobalStats {
  let totalValue = 0;
  let totalUnits = 0;
  let totalWidthUsed = 0;
  let totalWidthAvailable = 0;
  const skuSet = new Set<string>();
  const perShelf: ShelfStats[] = [];

  gondola.shelves.forEach((shelf, idx) => {
    const usedWidth = getShelfUsedWidth(gondola, idx, productsCatalog);
    const availWidth = gondola.shelfWidth;
    let shelfUnits = 0;
    let shelfValue = 0;

    shelf.products.forEach(placement => {
      placement.layers.forEach((layer: any) => {
        const product = layer.product || productsCatalog.find((p: any) => p.id === layer.productId);
        if (!product) return;

        const dims = getPlacedDimensions(product, layer.orientation || 0);
        const depthUnits = Math.max(1, Math.floor(shelf.depth / dims.depth));
        const units = layer.facings * depthUnits;
        shelfUnits += units;
        shelfValue += units * product.price;
        skuSet.add(layer.productId);
      });
    });

    totalValue += shelfValue;
    totalUnits += shelfUnits;
    totalWidthUsed += usedWidth;
    totalWidthAvailable += availWidth;

    perShelf.push({
      shelfIndex: idx,
      usedWidth,
      availableWidth: availWidth,
      occupationPercent: availWidth > 0 ? (usedWidth / availWidth) * 100 : 0,
      units: shelfUnits,
      value: shelfValue,
      productCount: shelf.products.length
    });
  });

  const overallOccupation = totalWidthAvailable > 0
    ? (totalWidthUsed / totalWidthAvailable) * 100 : 0;

  return {
    totalValue,
    totalUnits,
    totalSKUs: skuSet.size,
    overallOccupation,
    perShelf
  };
}
