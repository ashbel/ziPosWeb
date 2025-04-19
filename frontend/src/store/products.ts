import { create } from "zustand"
import { Product, products } from "@/lib/api"

interface ProductsState {
  products: Product[]
  selectedProduct: Product | null
  loading: boolean
  error: string | null
  total: number
  page: number
  limit: number
  search: string
  setProducts: (products: Product[]) => void
  setSelectedProduct: (product: Product | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setTotal: (total: number) => void
  setPage: (page: number) => void
  setLimit: (limit: number) => void
  setSearch: (search: string) => void
  fetchProducts: () => Promise<void>
  createProduct: (product: Omit<Product, "id" | "createdAt" | "updatedAt">) => Promise<void>
  updateProduct: (id: string, product: Partial<Product>) => Promise<void>
  deleteProduct: (id: string) => Promise<void>
}

export const useProductsStore = create<ProductsState>((set, get) => ({
  products: [],
  selectedProduct: null,
  loading: false,
  error: null,
  total: 0,
  page: 1,
  limit: 10,
  search: "",

  setProducts: (products) => set({ products }),
  setSelectedProduct: (product) => set({ selectedProduct: product }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setTotal: (total) => set({ total }),
  setPage: (page) => set({ page }),
  setLimit: (limit) => set({ limit }),
  setSearch: (search) => set({ search }),

  fetchProducts: async () => {
    const { page, limit, search } = get()
    set({ loading: true, error: null })
    try {
      const { data } = await products.list({ page, limit, search })
      set({ products: data.products, total: data.total })
    } catch (err) {
      const error = err instanceof Error ? err.message : "Failed to fetch products"
      set({ error })
    } finally {
      set({ loading: false })
    }
  },

  createProduct: async (product) => {
    set({ loading: true, error: null })
    try {
      await products.create(product)
      await get().fetchProducts()
    } catch (err) {
      const error = err instanceof Error ? err.message : "Failed to create product"
      set({ error })
    } finally {
      set({ loading: false })
    }
  },

  updateProduct: async (id, product) => {
    set({ loading: true, error: null })
    try {
      await products.update(id, product)
      await get().fetchProducts()
    } catch (err) {
      const error = err instanceof Error ? err.message : "Failed to update product"
      set({ error })
    } finally {
      set({ loading: false })
    }
  },

  deleteProduct: async (id) => {
    set({ loading: true, error: null })
    try {
      await products.delete(id)
      await get().fetchProducts()
    } catch (err) {
      const error = err instanceof Error ? err.message : "Failed to delete product"
      set({ error })
    } finally {
      set({ loading: false })
    }
  },
})) 