import { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2 } from 'lucide-react'

interface ProtectedRouteProps {
  children: ReactNode
  requiredPermission?: string
  gestorOnly?: boolean
  superAdminOnly?: boolean
}

export function ProtectedRoute({ 
  children, 
  requiredPermission,
  gestorOnly = false,
  superAdminOnly = false
}: ProtectedRouteProps) {
  const { user, isLoading, temPermissao, isGestor } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (superAdminOnly && user.role !== 'super_admin') {
    return <Navigate to="/sem-acesso" replace />
  }

  if (gestorOnly && !isGestor) {
    return <Navigate to="/sem-acesso" replace />
  }

  if (requiredPermission && !temPermissao(requiredPermission)) {
    return <Navigate to="/sem-acesso" replace />
  }

  return <>{children}</>
}
