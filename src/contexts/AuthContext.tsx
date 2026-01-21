import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'

const extractEdgeErrorMessage = (err: unknown): string | null => {
  // Safe cast to access properties
  const sensitiveErr = err as { context?: { body?: unknown }, message?: unknown }
  // supabase-js FunctionsHttpError often includes the JSON body in `context` or in the message string
  const body = sensitiveErr?.context?.body

  const tryParse = (value: unknown): Record<string, unknown> | null => {
    if (!value) return null
    if (typeof value === 'object' && value !== null) return value as Record<string, unknown>
    if (typeof value === 'string') {
      try {
        return JSON.parse(value) as Record<string, unknown>
      } catch {
        return null
      }
    }
    return null
  }

  const parsedFromContext = tryParse(body)
  if (parsedFromContext?.error && typeof parsedFromContext.error === 'string') {
    return parsedFromContext.error
  }

  const msg = typeof sensitiveErr?.message === 'string' ? sensitiveErr.message : ''
  const jsonMatch = msg.match(/\{[\s\S]*\}/)
  if (jsonMatch?.[0]) {
    const parsedFromMessage = tryParse(jsonMatch[0])
    if (parsedFromMessage?.error && typeof parsedFromMessage.error === 'string') {
      return parsedFromMessage.error
    }
  }

  return null
}

interface User {
  id: string
  username: string
  nome: string
  email: string
  role: 'super_admin' | 'gestor' | 'colaborador'
  colaborador_id?: string
  empresa_id?: string | null
  empresa_nome?: string // Added for display
  permissoes: string[] | 'all'
}

interface AuthContextType {
  user: User | null
  sessionToken: string | null
  isLoading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  temPermissao: (tela: string) => boolean
  isGestor: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true) // Start true to check session
  const navigate = useNavigate()

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select(`
          *,
          empresas (
            nome
          )
        `)
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        return;
      }

      if (data) {
        const userData = data as any;
        setUser({
          id: userData.id,
          username: userData.username,
          nome: userData.nome_completo,
          email: userData.email,
          role: userData.role,
          empresa_id: userData.empresa_id,
          empresa_nome: userData.empresas?.nome,
          permissoes: userData.permissoes
        });
      }
    } catch (err) {
      console.error('Exception fetching profile', err);
    }
  };

  useEffect(() => {
    // Check for existing session on mount
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()

        if (session) {
          setSessionToken(session.access_token)
          console.log("Session found", session.user.email)
          await fetchUserProfile(session.user.id)
        }

      } catch (error) {
        console.error("Session check failed", error)
      } finally {
        setIsLoading(false)
      }
    }

    checkSession()
  }, [])

  const login = async (username: string, password: string) => {
    setIsLoading(true)
    try {
      console.log(`Attempting login for ${username}`)

      // 3. Real Supabase Login
      const { data, error } = await supabase.auth.signInWithPassword({
        email: username,
        password: password
      })

      if (error) throw error

      if (data.session) {
        setSessionToken(data.session.access_token)
        // Fetch full profile
        await fetchUserProfile(data.user.id)
        navigate('/')
      }

      if (error) throw error

      if (data.user) {
        setSessionToken(data.session.access_token)
        navigate('/')
      }

    } catch (error) {
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const logout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setSessionToken(null)
    navigate('/login')
  }

  const temPermissao = (tela: string): boolean => {
    if (!user) return false;

    // Only Super Admin has full access regardless of permissions
    if (user.role === 'super_admin') {
      return true;
    }

    // Gestor and Colaborador check specific permissions
    if ((user.role === 'gestor' || user.role === 'colaborador') && Array.isArray(user.permissoes)) {
      return user.permissoes.includes(tela);
    }

    // Default deny
    return false;
  }

  const isGestor = user?.role === 'gestor' || user?.role === 'super_admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        sessionToken,
        isLoading,
        login,
        logout,
        temPermissao,
        isGestor,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider')
  }
  return context
}
