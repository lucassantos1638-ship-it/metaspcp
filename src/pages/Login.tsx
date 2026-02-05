

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, Lock, User, Building2, Mail, ArrowRight } from 'lucide-react'
import logoMetaPCP from '@/assets/logo-metapcp.png'
import bgSlideLogin from '@/assets/bg-slide-login.png'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/integrations/supabase/client'

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [loading, setLoading] = useState(false)

  // Login States
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  // Register States
  const [regNome, setRegNome] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regSenha, setRegSenha] = useState('')
  const [regEmpresa, setRegEmpresa] = useState('') // Razão Social
  const [regDocumento, setRegDocumento] = useState('') // CNPJ/CPF
  const [regEndereco, setRegEndereco] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) {
      toast.error('Preencha usuário e senha')
      return
    }

    setLoading(true)
    try {
      await login(username.trim(), password.trim())
      toast.success('Bem-vindo ao Meta PCP!')
    } catch (error: any) {
      toast.error(error.message || 'Credenciais inválidas')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!regNome || !regEmpresa || !regEmail || !regSenha || !regDocumento) {
      toast.error('Preencha os campos obrigatórios')
      return
    }

    setLoading(true)
    try {
      // Real Supabase Registration with Metadata Trigger
      const { data, error } = await supabase.auth.signUp({
        email: regEmail,
        password: regSenha,
        options: {
          data: {
            nome_admin: regNome,
            nome_empresa: regEmpresa,
            documento: regDocumento,
            endereco: regEndereco,
            role: 'super_admin'
          }
        }
      })

      if (error) throw error

      if (data.user) {
        toast.success('Cadastro realizado com sucesso!')

        if (data.session) {
          // Auto login successful (Email confirmation disabled or implicit)
          await login(regEmail, regSenha)
        } else {
          // Email confirmation required
          toast.info('Verifique seu e-mail para confirmar o cadastro e liberar o acesso.', {
            duration: 6000,
          })
        }
      }

    } catch (error: any) {
      console.error("Registration error:", error)
      toast.error(error.message || 'Erro ao realizar cadastro.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex w-full">
      {/* Left Side - Hero / Image */}
      {/* Left Side - Hero / Image */}
      <div className="hidden lg:flex lg:w-3/5 bg-[#0a192f] relative items-center justify-center overflow-hidden">
        {/* Imagem de fundo sem sobreposição e sem texto adicional */}
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${bgSlideLogin})` }}></div>
      </div>

      {/* Right Side - Auth Forms */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 bg-background overflow-y-auto">
        <div className="w-full max-w-md space-y-8 my-auto">
          {/* Logo visible on form side for all screens */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="flex items-center justify-center">
              <img src={logoMetaPCP} alt="Meta PCP" className="h-24 w-auto" />
            </div>
          </div>

          <Card className="border-none shadow-none bg-transparent">
            <CardHeader className="px-0 pt-0 text-center">
              <CardTitle className="text-2xl font-bold">Acesse sua conta</CardTitle>
              <CardDescription>Gerencie sua produção de forma eficiente</CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-8">
                  <TabsTrigger value="login">Entrar</TabsTrigger>
                  <TabsTrigger value="register">Cadastrar Empresa</TabsTrigger>
                </TabsList>

                <TabsContent value="login">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="username">Usuário</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                        <Input
                          id="username"
                          placeholder="Seu usuário ou email"
                          className="pl-10 h-10"
                          value={username}
                          onChange={e => setUsername(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Senha</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                        <Input
                          id="password"
                          type="password"
                          placeholder="••••••••"
                          className="pl-10 h-10"
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                        />
                      </div>
                    </div>
                    <Button type="submit" className="w-full h-10 text-base" disabled={loading}>
                      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Acessar Sistema'}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="register">
                  <form onSubmit={handleRegister} className="space-y-4">

                    {/* Dados do Usuário (Admin) - Topo */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Dados de Acesso</h3>

                      <div className="space-y-2">
                        <Label htmlFor="regNome">Nome do Usuário (Admin)</Label>
                        <div className="relative">
                          <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="regNome"
                            placeholder="Seu nome completo"
                            className="pl-9"
                            value={regNome}
                            onChange={e => setRegNome(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="regEmail">Email</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="regEmail"
                            type="email"
                            placeholder="seu@email.com"
                            className="pl-9"
                            value={regEmail}
                            onChange={e => setRegEmail(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="regSenha">Senha</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="regSenha"
                            type="password"
                            placeholder="Crie uma senha forte"
                            className="pl-9"
                            value={regSenha}
                            onChange={e => setRegSenha(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="relative py-2">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                    </div>

                    {/* Dados da Empresa - Baixo */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Dados da Empresa</h3>

                      <div className="space-y-2">
                        <Label htmlFor="regEmpresa">Razão Social</Label>
                        <div className="relative">
                          <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="regEmpresa"
                            placeholder="Nome da sua empresa"
                            className="pl-9"
                            value={regEmpresa}
                            onChange={e => setRegEmpresa(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="regDocumento">CNPJ ou CPF</Label>
                        <Input
                          id="regDocumento"
                          placeholder="00.000.000/0000-00"
                          value={regDocumento}
                          onChange={e => setRegDocumento(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="regEndereco">Endereço</Label>
                        <Input
                          id="regEndereco"
                          placeholder="Rua, Número, Bairro, Cidade - UF"
                          value={regEndereco}
                          onChange={e => setRegEndereco(e.target.value)}
                        />
                      </div>
                    </div>

                    <Button type="submit" className="w-full h-10 mt-4" disabled={loading}>
                      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                        <span className="flex items-center gap-2">
                          Finalizar Cadastro <ArrowRight className="h-4 w-4" />
                        </span>
                      )}
                    </Button>
                    <p className="text-xs text-center text-muted-foreground">
                      Ao se cadastrar, você concorda com nossos Termos de Uso.
                    </p>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <div className="text-center text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Meta PCP
          </div>
        </div>
      </div>
    </div>
  )
}

