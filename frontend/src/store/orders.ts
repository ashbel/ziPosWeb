import { create } from "zustand"
import { Order, orders } from "@/lib/api"

interface OrdersState {
  orders: Order[]
  selectedOrder: Order | null
  loading: boolean
  error: string | null
  total: number
  page: number
  limit: number
  status: string | null
  setOrders: (orders: Order[]) => void
  setSelectedOrder: (order: Order | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setTotal: (total: number) => void
  setPage: (page: number) => void
  setLimit: (limit: number) => void
  setStatus: (status: string | null) => void
  fetchOrders: () => Promise<void>
  createOrder: (order: Omit<Order, "id" | "createdAt" | "updatedAt">) => Promise<void>
  updateOrder: (id: string, order: Partial<Order>) => Promise<void>
  cancelOrder: (id: string) => Promise<void>
}

export const useOrdersStore = create<OrdersState>((set, get) => ({
  orders: [],
  selectedOrder: null,
  loading: false,
  error: null,
  total: 0,
  page: 1,
  limit: 10,
  status: null,

  setOrders: (orders) => set({ orders }),
  setSelectedOrder: (order) => set({ selectedOrder: order }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setTotal: (total) => set({ total }),
  setPage: (page) => set({ page }),
  setLimit: (limit) => set({ limit }),
  setStatus: (status) => set({ status }),

  fetchOrders: async () => {
    const { page, limit, status } = get()
    set({ loading: true, error: null })
    try {
      const { data } = await orders.list({ page, limit, status })
      set({ orders: data.orders, total: data.total })
    } catch (err) {
      const error = err instanceof Error ? err.message : "Failed to fetch orders"
      set({ error })
    } finally {
      set({ loading: false })
    }
  },

  createOrder: async (order) => {
    set({ loading: true, error: null })
    try {
      await orders.create(order)
      await get().fetchOrders()
    } catch (err) {
      const error = err instanceof Error ? err.message : "Failed to create order"
      set({ error })
    } finally {
      set({ loading: false })
    }
  },

  updateOrder: async (id, order) => {
    set({ loading: true, error: null })
    try {
      await orders.update(id, order)
      await get().fetchOrders()
    } catch (err) {
      const error = err instanceof Error ? err.message : "Failed to update order"
      set({ error })
    } finally {
      set({ loading: false })
    }
  },

  cancelOrder: async (id) => {
    set({ loading: true, error: null })
    try {
      await orders.cancel(id)
      await get().fetchOrders()
    } catch (err) {
      const error = err instanceof Error ? err.message : "Failed to cancel order"
      set({ error })
    } finally {
      set({ loading: false })
    }
  },
})) 