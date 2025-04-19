import { useEffect } from "react"
import { useRouter } from "next/router"
import { useAuthStore } from "@/store/auth"
import { hasPermission, hasRole } from "@/lib/auth"

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredPermissions?: string[]
  requiredRole?: string
  redirectTo?: string
}

export function ProtectedRoute({
  children,
  requiredPermissions = [],
  requiredRole,
  redirectTo = "/login",
}: ProtectedRouteProps) {
  const router = useRouter()
  const { user, isAuthenticated } = useAuthStore()

  useEffect(() => {
    if (!isAuthenticated) {
      router.push(redirectTo)
      return
    }

    if (requiredRole && !hasRole(user, requiredRole)) {
      router.push("/unauthorized")
      return
    }

    if (
      requiredPermissions.length > 0 &&
      !requiredPermissions.every((permission) => hasPermission(user, permission))
    ) {
      router.push("/unauthorized")
      return
    }
  }, [isAuthenticated, user, requiredPermissions, requiredRole, router, redirectTo])

  if (!isAuthenticated) {
    return null
  }

  if (requiredRole && !hasRole(user, requiredRole)) {
    return null
  }

  if (
    requiredPermissions.length > 0 &&
    !requiredPermissions.every((permission) => hasPermission(user, permission))
  ) {
    return null
  }

  return <>{children}</>
} 