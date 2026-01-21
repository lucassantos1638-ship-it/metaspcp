import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { CreditCard, Smartphone, FileText, Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'

export default function Checkout() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const empresaId = searchParams.get('empresa_id')
  const [loading, setLoading] = useState(false)
  const [formaPagamento, setFormaPagamento] = useState<'cartao_credito' | 'pix' | 'boleto'>('cartao_credito')

  useEffect(() => {
    if (!empresaId) {
      toast.error('Empresa não identificada')
      navigate('/registro')
    }
  }, [empresaId, navigate])

  const handleSubmit = async () => {
    if (!empresaId) return
    
    setLoading(true)

    try {
      const { data, error } = await supabase.functions.invoke('process-checkout', {
        body: {
          empresa_id: empresaId,
          forma_pagamento: formaPagamento
        }
      })

      if (error) throw error

      if (data.success) {
        toast.success('Cadastro finalizado! Seu trial de 7 dias começou.')
        navigate('/login')
      } else {
        toast.error(data.error || 'Erro ao processar checkout')
      }
    } catch (error: any) {
      console.error('Erro no checkout:', error)
      toast.error(error.message || 'Erro ao processar checkout')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="w-full max-w-4xl grid md:grid-cols-2 gap-6">
        {/* Resumo do Plano */}
        <Card>
          <CardHeader>
            <CardTitle>Plano Mensal</CardTitle>
            <CardDescription>Sistema completo de gestão de produção</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold">R$ 197</span>
              <span className="text-muted-foreground">/mês</span>
            </div>

            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="default" className="text-sm">7 DIAS GRÁTIS</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Teste todas as funcionalidades sem compromisso
              </p>
            </div>

            <div className="space-y-3 pt-4">
              <div className="flex items-start gap-2">
                <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-sm">Gestão completa de produção</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-sm">Controle de lotes e pedidos</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-sm">Relatórios em tempo real</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-sm">Gestão de colaboradores</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-sm">Previsão de entregas</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-sm">Suporte via email</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Forma de Pagamento */}
        <Card>
          <CardHeader>
            <CardTitle>Forma de Pagamento</CardTitle>
            <CardDescription>
              Escolha como prefere pagar após o período de teste
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup value={formaPagamento} onValueChange={(value: any) => setFormaPagamento(value)}>
              <div className="space-y-3">
                <Label
                  htmlFor="cartao"
                  className="flex items-center space-x-3 border rounded-lg p-4 cursor-pointer hover:bg-accent transition-colors"
                >
                  <RadioGroupItem value="cartao_credito" id="cartao" />
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="font-medium">Cartão de Crédito</div>
                    <div className="text-sm text-muted-foreground">Cobrança automática mensal</div>
                  </div>
                  <Badge variant="secondary">Recomendado</Badge>
                </Label>

                <Label
                  htmlFor="pix"
                  className="flex items-center space-x-3 border rounded-lg p-4 cursor-pointer hover:bg-accent transition-colors"
                >
                  <RadioGroupItem value="pix" id="pix" />
                  <Smartphone className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="font-medium">PIX</div>
                    <div className="text-sm text-muted-foreground">Pagamento instantâneo</div>
                  </div>
                </Label>

                <Label
                  htmlFor="boleto"
                  className="flex items-center space-x-3 border rounded-lg p-4 cursor-pointer hover:bg-accent transition-colors"
                >
                  <RadioGroupItem value="boleto" id="boleto" />
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="font-medium">Boleto Bancário</div>
                    <div className="text-sm text-muted-foreground">Vencimento em 3 dias úteis</div>
                  </div>
                </Label>
              </div>
            </RadioGroup>

            <div className="mt-6 bg-muted rounded-lg p-4 text-sm text-muted-foreground">
              <strong>Importante:</strong> Você não será cobrado agora. Apenas após o fim do período de teste de 7 dias, caso decida continuar usando o sistema.
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-3">
            <Button className="w-full" size="lg" onClick={handleSubmit} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Finalizando...
                </>
              ) : (
                'Iniciar Teste Grátis'
              )}
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Ao continuar, você concorda com nossos termos de uso
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}