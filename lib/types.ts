export interface InvoiceData {
  orderId: string;
  date: string;
  price: string;
  itemName: string;
  deliveryAddress: string;
  deliveryState: string;
}

export interface ParseResult {
  success: boolean;
  data?: InvoiceData;
  error?: string;
}

export interface UploadResponse {
  success: boolean;
  message: string;
  data?: InvoiceData;
  error?: string;
}

export interface InventoryItem {
  productName: string;
  currentStock: number;
  lastUpdated: string;
}

export interface StockUpdateResult {
  success: boolean;
  productName: string;
  previousStock: number;
  newStock: number;
  error?: string;
}
