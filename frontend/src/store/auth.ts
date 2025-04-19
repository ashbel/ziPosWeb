import { create } from "zustand"
import { persist } from "zustand/middleware"
import { AuthState, User, getStoredAuth, setStoredAuth, clearStoredAuth } from "@/lib/auth"
import { auth } from "@/lib/api"

interface AuthStore extends AuthState {
  login: (email: string, password: string) => Promise<void>
  register: (data: {
    email: string
    password: string
    name: string
    role: string
  }) => Promise<void>
  logout: () => Promise<void>
  refreshToken: () => Promise<void>
  setUser: (user: User) => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      ...getStoredAuth(),
      login: async (email: string, password: string) => {
        const { data } = await auth.login(email, password)
        setStoredAuth(data.token)
        set({ ...getStoredAuth() })
      },
      register: async (data) => {
        const { data: response } = await auth.register(data)
        setStoredAuth(response.token)
        set({ ...getStoredAuth() })
      },
      logout: async () => {
        await auth.logout()
        clearStoredAuth()
        set({ user: null, token: null, isAuthenticated: false })
      },
      refreshToken: async () => {
        const { data } = await auth.refreshToken()
        setStoredAuth(data.token)
        set({ ...getStoredAuth() })
      },
      setUser: (user: User) => {
        set({ user })
      },
    }),
    {
      name: "auth-storage",
    }
  )
) 