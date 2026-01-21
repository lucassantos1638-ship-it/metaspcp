import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Clock } from 'lucide-react'
import { differenceInDays } from 'date-fns'

export function TrialBanner() {
  const { user } = useAuth()

  const { data: empresa } = useQuery({
    queryKey: ['empresa-trial', user?.id],
    queryFn: async () => {
      if (!user?.id) return null

      const { data: usuario } = await supabase
        .from('usuarios')
        .select('empresa_id')
        .eq('id', user.id)
        .single()

      if (!usuario?.empresa_id) return null

      const { data: empresa } = await supabase
        .from('empresas')
        .select('status_assinatura, data_fim_trial')
        .eq('id', usuario.empresa_id)
        .single()

      return empresa
    },
    enabled: !!user?.id && user?.role !== 'super_admin'
  })

  if (!empresa || empresa.status_assinatura !== 'trial' || !empresa.data_fim_trial) {
    return null
  }

  const diasRestantes = differenceInDays(new Date(empresa.data_fim_trial), new Date())
  
  if (diasRestantes < 0) return null

  return (
    <Alert className="border-primary/50 bg-primary/5">
      <Clock className="h-4 w-4 text-primary" />
      <AlertDescription className="ml-2">
        <strong>Período de teste:</strong> Você tem {diasRestantes} dia{diasRestantes !== 1 ? 's' : ''} restante{diasRestantes !== 1 ? 's' : ''} no seu trial gratuito.
        {diasRestantes <= 2 && ' Configure seu pagamento para continuar usando o sistema após o término.'}
      </AlertDescription>
    </Alert>
  )
}