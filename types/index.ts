// types/index.ts
export interface User {
  id: string;
  name: string;
  username: string;
  role: "admin" | "kasir";
}

export interface TransactionItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  type: "kue_custom" | "kue_ready" | "produk_lainnya";
  notes?: string;
  cakeName?: string; // for kue ready
  customDetails?: CustomCakeDetails;
}

export interface CustomCakeDetails {
  cakeType: string;
  variation: string;
  size: string;
  box: string;
  images?: string[];
  notes?: string;
  additionalCosts?: AdditionalCost[];
}

export interface AdditionalCost {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  category: string;
  image?: string;
}

export interface Category {
  id: string;
  name: string;
}

export interface Transaction {
  id: string;
  transactionNumber: string;
  customerName: string;
  items: TransactionItem[];
  additionalCosts: AdditionalCost[];
  total: number;
  paymentMethod: "cash" | "transfer";
  paidAmount: number;
  change: number;
  notes?: string;
  transactionDate: Date;
  pickupDate: Date;
  pickupTime: string;
  status: "pending" | "processing" | "ready" | "completed" | "cancelled";
  createdAt: Date;
  updatedAt: Date;
}

export interface KueReady {
  id: string;
  name: string;
  basePrice: number;
  image?: string;
  cakeType: {
    id: string;
    name: string;
  };
  variation: {
    id: string;
    name: string;
  };
  size: {
    id: string;
    name: string;
  };
  accessories: Array<{
    accessory: {
      id: string;
      name: string;
      price: number;
    };
  }>;
  status: "available" | "sold" | "reserved";
}

export interface MasterData {
  cakeTypes: Array<{ id: string; name: string }>;
  variations: Array<{ id: string; name: string }>;
  sizes: Array<{ id: string; name: string }>;
  boxes: Array<{ id: string; name: string }>;
  accessories: Array<{ id: string; name: string; price: number }>;
  productCategories: Array<{ id: string; name: string }>;
}

export interface PriceRule {
  id: string;
  cakeTypeId: string;
  variationId: string;
  sizeId: string;
  boxId: string;
  basePrice: number;
  sellingPrice: number;
  margin: number;
}
