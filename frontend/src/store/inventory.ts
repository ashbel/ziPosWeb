import { create } from "zustand"
import { InventoryItem, inventory } from "@/lib/api"

interface InventoryState {
  items: InventoryItem[]
  selectedItem: InventoryItem | null
  loading: boolean
  error: string | null
  total: number
  page: number
  limit: number
  search: string
  setItems: (items: InventoryItem[]) => void
  setSelectedItem: (item: InventoryItem | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setTotal: (total: number) => void
  setPage: (page: number) => void
  setLimit: (limit: number) => void
  setSearch: (search: string) => void
  fetchItems: () => Promise<void>
  updateItem: (id: string, item: Partial<InventoryItem>) => Promise<void>
  adjustItem: (id: string, quantity: number, reason: string) => Promise<void>
}

export const useInventoryStore = create<InventoryState>((set, get) => ({
  items: [],
  selectedItem: null,
  loading: false,
  error: null,
  total: 0,
  page: 1,
  limit: 10,
  search: "",

  setItems: (items) => set({ items }),
  setSelectedItem: (item) => set({ selectedItem: item }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setTotal: (total) => set({ total }),
  setPage: (page) => set({ page }),
  setLimit: (limit) => set({ limit }),
  setSearch: (search) => set({ search }),

  fetchItems: async () => {
    const { page, limit, search } = get()
    set({ loading: true, error: null })
    try {
      const { data } = await inventory.list({ page, limit, search })
      set({ items: data.items, total: data.total })
    } catch (err) {
      const error = err instanceof Error ? err.message : "Failed to fetch inventory items"
      set({ error })
    } finally {
      set({ loading: false })
    }
  },

  updateItem: async (id, item) => {
    set({ loading: true, error: null })
    try {
      await inventory.update(id, item)
      await get().fetchItems()
    } catch (err) {
      const error = err instanceof Error ? err.message : "Failed to update inventory item"
      set({ error })
    } finally {
      set({ loading: false })
    }
  },

  adjustItem: async (id, quantity, reason) => {
    set({ loading: true, error: null })
    try {
      await inventory.adjust(id, { quantity, reason })
      await get().fetchItems()
    } catch (err) {
      const error = err instanceof Error ? err.message : "Failed to adjust inventory item"
      set({ error })
    } finally {
      set({ loading: false })
    }
  },
})) 