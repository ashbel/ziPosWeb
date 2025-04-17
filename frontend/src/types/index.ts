export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  branchId: string;
}

export interface Role {
  id: string;
  name: string;
  permissions: string[];
}

export interface Branch {
  id: string;
  name: string;
  address: string;
  phone: string;
  productCount: number;
  stockValue: number;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  barcode: string;
  costPrice: number;
  margin: number;
  sellingPrice: number;
  categoryId: string;
  stock: number;
}

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone: string;
  address?: string;
  points: number;
  totalSpent: number;
  lastPurchase?: Date;
}

export interface Sale {
  id: string;
  customerId?: string;
  branchId: string;
  userId: string;
  items: SaleItem[];
  totalAmount: number;
  paymentType: string;
  status: string;
  createdAt: Date;
}

export interface SaleItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
} 