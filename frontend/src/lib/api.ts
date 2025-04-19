import axios from "axios"
import { getStoredAuth, clearStoredAuth } from "./auth"
import type { User } from "./auth"

export interface Product {
  id: string
  name: string
  description: string
  price: number
  sku: string
  stock: number
  category: string
  createdAt: string
  updatedAt: string
}

export interface Order {
  id: string
  userId: string
  items: OrderItem[]
  status: string
  total: number
  createdAt: string
  updatedAt: string
}

export interface OrderItem {
  productId: string
  quantity: number
  price: number
}

export interface InventoryItem {
  id: string
  productId: string
  quantity: number
  location: string
  lastUpdated: string
}

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api",
  headers: {
    "Content-Type": "application/json",
  },
})

// Add a request interceptor to add the auth token to requests
api.interceptors.request.use((config) => {
  const { token } = getStoredAuth()
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Add a response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearStoredAuth()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export const auth = {
  login: (email: string, password: string) =>
    api.post<{ token: string; requires2FA?: boolean }>('/auth/login', { email, password }),
  register: (data: {
    email: string;
    password: string;
    name: string;
    role: string;
  }) => api.post<{ token: string }>('/auth/register', data),
  logout: () => api.post('/auth/logout'),
  refreshToken: () => api.post<{ token: string }>('/auth/refresh'),
  verify2FA: (code: string) =>
    api.post<{ token: string }>('/auth/2fa/verify', { code }),
  setup2FA: () => api.post<{ secret: string; qrCode: string }>('/auth/2fa/setup'),
  enable2FA: (code: string) => api.post('/auth/2fa/enable', { code }),
  disable2FA: (code: string) => api.post('/auth/2fa/disable', { code }),
  oauth: {
    google: () => api.get('/auth/google'),
    github: () => api.get('/auth/github'),
    facebook: () => api.get('/auth/facebook'),
  },
};

export const users = {
  getProfile: () => api.get<User>('/users/profile'),
  updateProfile: (data: { name?: string; email?: string }) =>
    api.put<User>('/users/profile', data),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.put('/users/password', data),
  list: (params?: { page?: number; limit?: number; search?: string }) =>
    api.get<{ users: User[]; total: number }>('/users', { params }),
  get: (id: string) => api.get<User>(`/users/${id}`),
  update: (id: string, data: Partial<User>) => api.put<User>(`/users/${id}`, data),
  delete: (id: string) => api.delete(`/users/${id}`),
};

export const products = {
  list: (params?: { page?: number; limit?: number; search?: string }) =>
    api.get<{ products: Product[]; total: number }>('/products', { params }),
  get: (id: string) => api.get<Product>(`/products/${id}`),
  create: (data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) =>
    api.post<Product>('/products', data),
  update: (id: string, data: Partial<Product>) =>
    api.put<Product>(`/products/${id}`, data),
  delete: (id: string) => api.delete(`/products/${id}`),
};

export const orders = {
  list: (params?: { page?: number; limit?: number; status?: string }) =>
    api.get<{ orders: Order[]; total: number }>('/orders', { params }),
  get: (id: string) => api.get<Order>(`/orders/${id}`),
  create: (data: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>) =>
    api.post<Order>('/orders', data),
  update: (id: string, data: Partial<Order>) =>
    api.put<Order>(`/orders/${id}`, data),
  cancel: (id: string) => api.post(`/orders/${id}/cancel`),
};

export const inventory = {
  list: (params?: { page?: number; limit?: number; search?: string }) =>
    api.get<{ items: InventoryItem[]; total: number }>('/inventory', { params }),
  get: (id: string) => api.get<InventoryItem>(`/inventory/${id}`),
  update: (id: string, data: Partial<InventoryItem>) =>
    api.put<InventoryItem>(`/inventory/${id}`, data),
  adjust: (id: string, data: { quantity: number; reason: string }) =>
    api.post<InventoryItem>(`/inventory/${id}/adjust`, data),
};

export default api; 