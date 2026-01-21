import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'

export default function Registro() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [tipoDocumento, setTipoDocumento] = useState<'cpf' | 'cnpj'>('cpf')
  const [formData, setFormData] = useState({
    nome: '',
    nome_responsavel: '',
    email: '',
    username: '',
    cpf: '',
    cnpj: '',
    telefone: '',
    senha: '',
    confirmarSenha: ''
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const formatCPF = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1')
  }

  const formatCNPJ = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1')
  }

  const formatTelefone = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .replace(/(-\d{4})\d+?$/, '$1')
  }

  const handleDocumentoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target
    if (tipoDocumento === 'cpf') {
      setFormData(prev => ({ ...prev, cpf: formatCPF(value), cnpj: '' }))
    } else {
      setFormData(prev => ({ ...prev, cnpj: formatCNPJ(value), cpf: '' }))
    }
  }

  const handleTelefoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, telefone: formatTelefone(e.target.value) }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Validações
      if (!formData.nome || !formData.nome_responsavel || !formData.email || !formData.username || !formData.telefone || !formData.senha) {
        toast.error('Preencha todos os campos obrigatórios')
        return
      }

      // Validar username (sem espaços, apenas letras, números e underscore)
      if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
        toast.error('Nome de usuário deve conter apenas letras, números e underscore')
        return
      }

      if (formData.username.length < 3) {
        toast.error('Nome de usuário deve ter no mínimo 3 caracteres')
        return
      }

      if (tipoDocumento === 'cpf' && formData.cpf.replace(/\D/g, '').length !== 11) {
        toast.error('CPF inválido')
        return
      }

      if (tipoDocumento === 'cnpj' && formData.cnpj.replace(/\D/g, '').length !== 14) {
        toast.error('CNPJ inválido')
        return
      }

      if (formData.senha.length < 6) {
        toast.error('A senha deve ter no mínimo 6 caracteres')
        return
      }

      if (formData.senha !== formData.confirmarSenha) {
        toast.error('As senhas não coincidem')
        return
      }

      // Chamar edge function de registro
      const { data, error } = await supabase.functions.invoke('register-empresa', {
        body: {
          nome: formData.nome,
          nome_responsavel: formData.nome_responsavel,
          email: formData.email,
          username: formData.username,
          cpf: tipoDocumento === 'cpf' ? formData.cpf : null,
          cnpj: tipoDocumento === 'cnpj' ? formData.cnpj : null,
          telefone: formData.telefone,
          senha: formData.senha
        }
      })

      if (error) throw error

      if (data.success) {
        toast.success('Cadastro realizado com sucesso!')
        // Redirecionar para checkout passando empresa_id
        navigate(`/checkout?empresa_id=${data.empresa_id}`)
      } else {
        toast.error(data.error || 'Erro ao realizar cadastro')
      }
    } catch (error: any) {
      console.error('Erro no cadastro:', error)
      toast.error(error.message || 'Erro ao realizar cadastro')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="space-y-1">
          <CardTitle className="text-3xl font-bold text-center">Cadastre sua Empresa</CardTitle>
          <CardDescription className="text-center">
            Teste grátis por 7 dias • Sem compromisso • Cancele quando quiser
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome da Empresa *</Label>
              <Input
                id="nome"
                name="nome"
                placeholder="Minha Empresa Ltda"
                value={formData.nome}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nome_responsavel">Nome do Responsável *</Label>
              <Input
                id="nome_responsavel"
                name="nome_responsavel"
                placeholder="Seu Nome Completo"
                value={formData.nome_responsavel}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email de Contato *</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="contato@empresa.com"
                value={formData.email}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Nome de Usuário *</Label>
              <Input
                id="username"
                name="username"
                placeholder="usuario123"
                value={formData.username}
                onChange={handleInputChange}
                required
              />
              <p className="text-xs text-muted-foreground">
                Apenas letras, números e underscore. Mínimo 3 caracteres.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Tipo de Documento *</Label>
              <RadioGroup value={tipoDocumento} onValueChange={(value) => setTipoDocumento(value as 'cpf' | 'cnpj')}>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="cpf" id="cpf" />
                    <Label htmlFor="cpf" className="font-normal cursor-pointer">CPF</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="cnpj" id="cnpj" />
                    <Label htmlFor="cnpj" className="font-normal cursor-pointer">CNPJ</Label>
                  </div>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="documento">{tipoDocumento === 'cpf' ? 'CPF' : 'CNPJ'} *</Label>
              <Input
                id="documento"
                placeholder={tipoDocumento === 'cpf' ? '000.000.000-00' : '00.000.000/0000-00'}
                value={tipoDocumento === 'cpf' ? formData.cpf : formData.cnpj}
                onChange={handleDocumentoChange}
                maxLength={tipoDocumento === 'cpf' ? 14 : 18}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone *</Label>
              <Input
                id="telefone"
                name="telefone"
                placeholder="(00) 00000-0000"
                value={formData.telefone}
                onChange={handleTelefoneChange}
                maxLength={15}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="senha">Senha *</Label>
                <Input
                  id="senha"
                  name="senha"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={formData.senha}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmarSenha">Confirmar Senha *</Label>
                <Input
                  id="confirmarSenha"
                  name="confirmarSenha"
                  type="password"
                  placeholder="Repita a senha"
                  value={formData.confirmarSenha}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cadastrando...
                </>
              ) : (
                'Continuar para Checkout'
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => navigate('/login')}
            >
              Já tem conta? Fazer login
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}