import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/contexts/AuthContext'
import { ShieldAlert } from 'lucide-react'

export default function SemAcesso() {
  const { logout, user, isGestor } = useAuth()

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
            <ShieldAlert className="w-8 h-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl">Acesso Negado</CardTitle>
          <CardDescription className="text-base mt-2">
            {isGestor 
              ? 'Você não tem permissão para acessar esta página.'
              : 'Você não tem permissão para acessar nenhuma funcionalidade do sistema.'
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isGestor && user?.permissoes && Array.isArray(user.permissoes) && user.permissoes.length === 0 && (
            <p className="text-sm text-muted-foreground">
              O gestor ainda não liberou nenhuma tela para você.
              <br />
              Entre em contato com o administrador.
            </p>
          )}
          <Button onClick={logout} variant="outline" className="w-full">
            Fazer Logout
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
