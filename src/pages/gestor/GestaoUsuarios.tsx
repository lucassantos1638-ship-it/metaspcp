import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { UserPlus, Edit } from 'lucide-react'

const TELAS_DISPONIVEIS = [
  { id: '/', label: 'Dashboard' },
  { id: '/produtos', label: 'Produtos' },
  { id: '/previsao-producao', label: 'Previsão de Produção' },
  { id: '/acompanhamento-pedidos', label: 'Acompanhamento' },
  { id: '/producao', label: 'Lançar Produção' },
  { id: '/lotes', label: 'Lotes' },
  { id: '/colaboradores', label: 'Colaboradores' },
  { id: '/metas', label: 'Metas' },
  { id: '/relatorios', label: 'Relatórios' },
  { id: '/pop', label: 'P.O.P' },
]

export default function GestaoUsuarios() {
  const { user, sessionToken } = useAuth()
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<any>(null)

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    nome_completo: '',
    email: '',
    role: 'colaborador' as 'gestor' | 'colaborador',
    colaborador_id: '',
    permissoes: [] as string[],
    empresa_id: ''
  })

  // Add query for colaboradores to use in the dropdown
  const { data: colaboradores } = useQuery({
    queryKey: ['colaboradores', user?.empresa_id],
    enabled: !!user?.empresa_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('colaboradores')
        .select('*')
        .eq('empresa_id', user!.empresa_id)
        .order('nome')

      if (error) throw error
      return data
    }
  })

  const { data: usuarios } = useQuery({
    queryKey: ['usuarios', user?.empresa_id],
    queryFn: async () => {
      if (!user?.empresa_id) throw new Error("Usuário sem empresa")

      const { data, error } = await supabase
        .from('usuarios')
        .select(`
            *,
            colaboradores(nome)
            `)
        .eq('empresa_id', user.empresa_id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data
    },
    enabled: !!user?.empresa_id
  })

  const criarUsuario = useMutation({
    mutationFn: async (dados: typeof formData) => {
      const payload = {
        ...dados,
        senha: dados.password,
        sessionToken
      };

      const { data, error } = await supabase.functions.invoke('create-user', {
        body: payload
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error); // Catch function usage errors passing as success: false
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] })
      toast.success('Usuário criado com sucesso!')
      setDialogOpen(false)
      resetForm()
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao criar usuário')
    }
  })

  const atualizarPermissoes = useMutation({
    mutationFn: async ({ user_id, permissoes }: { user_id: string, permissoes: string[] }) => {
      const { data, error } = await supabase.functions.invoke('update-permissions', {
        body: { user_id, permissoes, sessionToken }
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error);
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] })
      toast.success('Permissões atualizadas!')
      setDialogOpen(false)
      setEditingUser(null)
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar permissões: ${error.message}`)
    }
  })

  const resetForm = () => {
    setFormData({
      username: '',
      password: '',
      nome_completo: '',
      email: '',
      role: 'colaborador',
      colaborador_id: '',
      permissoes: [],
      empresa_id: ''
    })
    setEditingUser(null)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (editingUser) {
      atualizarPermissoes.mutate({
        user_id: editingUser.id,
        permissoes: formData.permissoes
      })
    } else {
      // Adicionar empresa_id automaticamente ao criar usuário
      criarUsuario.mutate({
        ...formData,
        empresa_id: user?.empresa_id || ''
      })
    }
  }

  const handleEdit = (usuario: any) => {
    setEditingUser(usuario)
    setFormData({
      username: usuario.username,
      password: '', // Password usually empty on edit
      nome_completo: usuario.nome_completo,
      email: usuario.email || '',
      role: usuario.role || 'colaborador',
      colaborador_id: usuario.colaborador_id || '',
      permissoes: usuario.permissoes || [],
      empresa_id: usuario.empresa_id || ''
    })
    setDialogOpen(true)
  }

  const togglePermissao = (tela: string) => {
    setFormData(prev => ({
      ...prev,
      permissoes: prev.permissoes.includes(tela)
        ? prev.permissoes.filter(p => p !== tela)
        : [...prev.permissoes, tela]
    }))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestão de Usuários</h1>
          <p className="text-muted-foreground mt-1">
            Criar e gerenciar acessos ao sistema
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) resetForm()
        }}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="w-4 h-4 mr-2" />
              Novo Usuário
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingUser ? 'Editar Permissões' : 'Criar Novo Usuário'}
              </DialogTitle>
              <DialogDescription>
                {editingUser
                  ? 'Selecione as telas que o usuário pode acessar'
                  : 'Preencha os dados para criar um novo acesso'
                }
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!editingUser && (
                <>
                  <div className="space-y-2">
                    <Label>Usuário *</Label>
                    <Input
                      value={formData.username}
                      onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                      placeholder="Nome de usuário (único)"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Senha *</Label>
                    <Input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                      placeholder="Mínimo 6 caracteres"
                      required
                      minLength={6}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Nome Completo *</Label>
                    <Input
                      value={formData.nome_completo}
                      onChange={(e) => setFormData(prev => ({ ...prev, nome_completo: e.target.value }))}
                      placeholder="Nome do usuário"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Email *</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="usuario@exemplo.com"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Perfil *</Label>
                    <Select
                      value={formData.role}
                      onValueChange={(value) => setFormData(prev => ({
                        ...prev,
                        role: value as 'gestor' | 'colaborador'
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gestor">Gestor (acesso total)</SelectItem>
                        <SelectItem value="colaborador">Colaborador (acesso limitado)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Vincular a Colaborador (opcional)</Label>
                    <Select
                      value={formData.colaborador_id || "none"}
                      onValueChange={(value) => setFormData(prev => ({
                        ...prev,
                        colaborador_id: value === "none" ? "" : value
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um colaborador" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {colaboradores?.map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {formData.role === 'colaborador' && (
                <div className="space-y-3">
                  <Label className="text-base font-semibold">
                    Telas Permitidas
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    ⚠️ Por padrão, o colaborador NÃO tem acesso a nada. Selecione as telas.
                  </p>

                  <div className="border rounded-lg p-4 space-y-3">
                    {TELAS_DISPONIVEIS.map(tela => (
                      <div key={tela.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={tela.id}
                          checked={formData.permissoes.includes(tela.id)}
                          onCheckedChange={() => togglePermissao(tela.id)}
                        />
                        <label
                          htmlFor={tela.id}
                          className="text-sm font-medium cursor-pointer"
                        >
                          {tela.label}
                        </label>
                      </div>
                    ))}
                  </div>

                  {formData.permissoes.length === 0 && (
                    <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded">
                      ⚠️ Nenhuma tela selecionada. O colaborador não conseguirá acessar o sistema.
                    </p>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button type="submit" className="flex-1">
                  {editingUser ? 'Salvar Permissões' : 'Criar Usuário'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDialogOpen(false)
                    resetForm()
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {usuarios?.map((usuario: any) => (
          <Card key={usuario.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                {usuario.nome_completo}
                <span className={`text-xs px-2 py-1 rounded ${usuario.role === 'gestor'
                  ? 'bg-primary/10 text-primary'
                  : 'bg-muted text-muted-foreground'
                  }`}>
                  {usuario.role === 'gestor' ? 'Gestor' : 'Colaborador'}
                </span>
              </CardTitle>
              <CardDescription>@{usuario.username}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {usuario.colaboradores && (
                <p className="text-sm">
                  Vinculado: <strong>{usuario.colaboradores.nome}</strong>
                </p>
              )}

              {usuario.role === 'colaborador' && (
                <div>
                  <p className="text-sm font-medium mb-2">
                    Telas permitidas: {usuario.permissoes?.length || 0}
                  </p>
                  {usuario.permissoes?.length === 0 && (
                    <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                      ⚠️ Sem acesso a nenhuma tela
                    </p>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => handleEdit(usuario)}
                >
                  <Edit className="w-3 h-3 mr-1" />
                  Editar
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
