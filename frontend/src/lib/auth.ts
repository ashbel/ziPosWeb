import { jwtDecode } from "jwt-decode"

export interface User {
  id: string
  email: string
  name: string
  role: string
  permissions: string[]
  is2FAEnabled: boolean
  oauthProviders: string[]
}

export interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  is2FARequired: boolean
  tempToken: string | null
}

export const AUTH_STORAGE_KEY = "pos_auth"

export const getStoredAuth = (): AuthState => {
  if (typeof window === "undefined") {
    return { user: null, token: null, isAuthenticated: false, is2FARequired: false, tempToken: null }
  }

  const stored = localStorage.getItem(AUTH_STORAGE_KEY)
  if (!stored) {
    return { user: null, token: null, isAuthenticated: false, is2FARequired: false, tempToken: null }
  }

  try {
    const { token, tempToken } = JSON.parse(stored)
    if (tempToken) {
      return {
        user: null,
        token: null,
        isAuthenticated: false,
        is2FARequired: true,
        tempToken,
      }
    }
    const decoded = jwtDecode<User>(token)
    return {
      user: decoded,
      token,
      isAuthenticated: true,
      is2FARequired: false,
      tempToken: null,
    }
  } catch {
    return { user: null, token: null, isAuthenticated: false, is2FARequired: false, tempToken: null }
  }
}

export const setStoredAuth = (token: string, tempToken?: string) => {
  if (typeof window === "undefined") return
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ token, tempToken }))
}

export const clearStoredAuth = () => {
  if (typeof window === "undefined") return
  localStorage.removeItem(AUTH_STORAGE_KEY)
}

export const hasPermission = (user: User | null, permission: string): boolean => {
  if (!user) return false
  return user.permissions.includes(permission)
}

export const hasRole = (user: User | null, role: string): boolean => {
  if (!user) return false
  return user.role === role
}

export const isOAuthProvider = (provider: string): boolean => {
  return ["google", "github", "facebook"].includes(provider)
}

export const getOAuthUrl = (provider: string): string => {
  return `${process.env.NEXT_PUBLIC_API_URL}/auth/${provider}`
} 