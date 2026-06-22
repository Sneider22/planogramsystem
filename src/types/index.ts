export type GondolaType = 'pared' | 'central' | 'cabecera' | 'refrigerado';
export type ShelfType = 'plancha' | 'perchero';

export interface Product {
  id: string;
  sku: string;
  name: string;
  width: number;
  height: number;
  depth: number;
  price: number;
  color: string;
  category: string;
  brand?: string;
  department?: string;
  subcategory?: string;
  providerCode?: string;
  provider?: string;
}

export interface ProductLayer {
  productId: string;
  facings: number;
  orientation: number; // 0 to 5
}

export interface ProductPlacement {
  x: number;
  hookIndex?: number;
  placedAt: number;
  layers: ProductLayer[];
}

export interface Shelf {
  id: string;
  index: number;
  y: number;
  type: ShelfType;
  hookSpacing?: number;
  depth: number;
  products: ProductPlacement[];
}

export interface GondolaConfig {
  type: GondolaType;
  width: number;
  height: number;
  depth: number;
  numShelves: number;
  gapBetweenShelves: number;
  baseHeight: number;
  shelfThickness: number;
  shelfDepth: number;
  shelfWidth: number;
  autoPack: boolean;
  shelves: Shelf[];
}

export interface Gondola {
  id: string;
  name: string;
  aisle: string;
  category: string;
  description: string;
  config: GondolaConfig;
}

export interface Store {
  id: string;
  name: string;
  createdAt: number;
  library: Gondola[];
}

export interface ShelfStats {
  shelfIndex: number;
  usedWidth: number;
  availableWidth: number;
  occupationPercent: number;
  units: number;
  value: number;
  productCount: number;
}

export interface GlobalStats {
  totalValue: number;
  totalUnits: number;
  totalSKUs: number;
  overallOccupation: number;
  perShelf: ShelfStats[];
}
