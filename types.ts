export interface InvoiceItem {
  id: string;
  name: string;
  qty: number; // Column 2
  rate: number; // Column 3
  tp: number; // Column 4 (Rate - 14.5%)
  discount: number; // Column 5 (-X% or +X%)
  totalPerPiece: number; // Column 6
  totalAmount: number; // Column 7
}

export interface PaymentRow {
  id: string;
  narration: string;
  amount: number;
}

export enum InvoiceStatus {
  PENDING = 'Pending',
  PAID = 'Paid',
}

export interface Invoice {
  id: string;
  name: string;
  date: string; // ISO Date string
  items: InvoiceItem[];
  payments: PaymentRow[];
  status: InvoiceStatus;
  totalAmount: number; // Sum of all items
  remainingBalance: number; // Total - Payments
  createdAt: number;
}

export interface User {
  username: string;
}
