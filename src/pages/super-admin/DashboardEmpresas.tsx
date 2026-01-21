import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Building2, Plus, Pencil, Trash2, KeyRound, Users as UsersIcon } from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default function DashboardEmpresas() {
  const { sessionToken } = useAuth()
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [senhaDialogOpen, setSenhaDialogOpen] = useState(false)
  const [editingEmpresa, setEditingEmpresa] = useState<any>(null)
  const [empresaParaSenha, setEmpresaParaSenha] = useState<any>(null)
  const [novaSenha, setNovaSenha] = useState('')

  const [formData, setFormData] = useState({
    nome: '',
    cnpj: '',
    cpf: '',
    email_contato: '',
    telefone: '',
    plano_ativo: 'mensal',
    status_assinatura: 'ativa',
    forma_pagamento: ''
  })

  const { data: empresas, isLoading } = useQuery({
    queryKey: ['empresas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('empresas')
        .select(`
            *,
            usuarios:usuarios(count)
          `)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data
    }
  })

  const criarOuEditarEmpresa = useMutation({
    mutationFn: async (dados: any) => {
      if (editingEmpresa) {
        // Editar empresa existente
        const { error } = await supabase
          .from('empresas')
          .update(dados)
          .eq('id', editingEmpresa.id)
        if (error) throw error
      } else {
        // Criar nova empresa
        const { data, error } = await supabase.functions.invoke('create-empresa', {
          body: dados
        })
        if (error) throw error
        return data
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empresas'] })
      toast.success(editingEmpresa ? 'Empresa atualizada!' : 'Empresa criada!')
      setDialogOpen(false)
      resetForm()
    },
    onError: (error: any) => {
      toast.error(error.message || `Erro ao ${editingEmpresa ? 'atualizar' : 'criar'} empresa`)
    }
  })

  const excluirEmpresa = useMutation({
    mutationFn: async (empresaId: string) => {
      console.log('Excluindo empresa:', empresaId)

      const { data, error } = await supabase.functions.invoke('delete-empresa', {
        body: { empresa_id: empresaId }
      })

      if (error) throw error
      if (!data?.success) throw new Error(data?.error || 'Erro ao excluir empresa')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empresas'] })
      toast.success('Empresa excluída com sucesso!')
    },
    onError: (error: any) => {
      console.error('Erro ao excluir empresa:', error)
      toast.error(error.message || 'Erro ao excluir empresa. Verifique os logs.')
    }
  })

  const criarOuResetarSenhaGestor = useMutation({
    mutationFn: async ({ empresaId, senha }: { empresaId: string, senha: string }) => {
      // Buscar gestor existente da empresa
      const { data: usuarios, error: usuariosError } = await supabase
        .from('usuarios')
        .select('id')
        .eq('empresa_id', empresaId)
        .limit(1)

      if (usuariosError) throw usuariosError

      if (usuarios && usuarios.length > 0) {
        // Resetar senha do gestor existente
        const { data, error } = await supabase.functions.invoke('update-user-password', {
          body: {
            userId: usuarios[0].id,
            newPassword: senha,
            sessionToken
          }
        })
        if (error) throw error
        return { action: 'reset', data }
      } else {
        // Criar novo usuário gestor
        const empresa = empresas?.find((e: any) => e.id === empresaId)
        if (!empresa) throw new Error('Empresa não encontrada')

        const { data, error } = await supabase.functions.invoke('create-user', {
          body: {
            username: empresa.email_contato.split('@')[0],
            nome_completo: empresa.nome,
            email: empresa.email_contato,
            senha: senha,
            role: 'gestor',
            empresa_id: empresaId,
            sessionToken
          }
        })
        if (error) throw error
        return { action: 'create', data }
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['empresas'] })
      if (result.action === 'reset') {
        toast.success('Senha do gestor resetada com sucesso!')
      } else {
        toast.success('Usuário gestor criado com sucesso!')
      }
      setSenhaDialogOpen(false)
      setNovaSenha('')
      setEmpresaParaSenha(null)
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao processar senha do gestor')
    }
  })

  const handleResetarSenha = (empresa: any) => {
    setEmpresaParaSenha(empresa)
    setSenhaDialogOpen(true)
  }

  const handleSubmitSenha = (e: React.FormEvent) => {
    e.preventDefault()
    if (!empresaParaSenha || !novaSenha) return

    if (novaSenha.length < 6) {
      toast.error('A senha deve ter no mínimo 6 caracteres')
      return
    }

    criarOuResetarSenhaGestor.mutate({
      empresaId: empresaParaSenha.id,
      senha: novaSenha
    })
  }

  const resetForm = () => {
    setFormData({
      nome: '',
      cnpj: '',
      cpf: '',
      email_contato: '',
      telefone: '',
      plano_ativo: 'mensal',
      status_assinatura: 'ativa',
      forma_pagamento: ''
    })
    setEditingEmpresa(null)
  }

  const handleEdit = (empresa: any) => {
    setEditingEmpresa(empresa)
    setFormData({
      nome: empresa.nome || '',
      cnpj: empresa.cnpj || '',
      cpf: empresa.cpf || '',
      email_contato: empresa.email_contato || '',
      telefone: empresa.telefone || '',
      plano_ativo: empresa.plano_ativo || 'mensal',
      status_assinatura: empresa.status_assinatura || 'ativa',
      forma_pagamento: empresa.forma_pagamento || ''
    })
    setDialogOpen(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    criarOuEditarEmpresa.mutate(formData)
  }

  const getDiasRestantes = (dataFim: string | null) => {
    if (!dataFim) return null
    const dias = differenceInDays(new Date(dataFim), new Date())
    return dias > 0 ? dias : 0
  }

  const getStatusBadge = (empresa: any) => {
    if (!empresa.ativo) {
      return <Badge variant="destructive">Desativada</Badge>
    }

    if (empresa.status_assinatura === 'trial') {
      const diasRestantes = getDiasRestantes(empresa.data_fim_trial)
      return <Badge variant="secondary">Trial ({diasRestantes} dias)</Badge>
    }

    if (empresa.status_assinatura === 'ativa') {
      return <Badge variant="default">Ativa</Badge>
    }

    if (empresa.status_assinatura === 'vencida') {
      return <Badge variant="destructive">Vencida</Badge>
    }

    if (empresa.status_assinatura === 'cancelada') {
      return <Badge variant="outline">Cancelada</Badge>
    }

    return <Badge>Ativa</Badge>
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestão de Empresas</h1>
          <p className="text-muted-foreground">Gerencie todas as empresas cadastradas no sistema</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) resetForm()
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Empresa
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingEmpresa ? 'Editar Empresa' : 'Cadastrar Nova Empresa'}</DialogTitle>
              <DialogDescription>
                {editingEmpresa ? 'Atualize os dados da empresa' : 'Preencha os dados para cadastrar uma nova empresa'}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome da Empresa *</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email de Contato *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email_contato}
                    onChange={(e) => setFormData({ ...formData, email_contato: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cnpj">CNPJ</Label>
                  <Input
                    id="cnpj"
                    value={formData.cnpj}
                    onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                    placeholder="00.000.000/0000-00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cpf">CPF</Label>
                  <Input
                    id="cpf"
                    value={formData.cpf}
                    onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                    placeholder="000.000.000-00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="telefone">Telefone</Label>
                  <Input
                    id="telefone"
                    value={formData.telefone}
                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                    placeholder="(00) 00000-0000"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="plano">Plano</Label>
                  <Select
                    value={formData.plano_ativo}
                    onValueChange={(value) => setFormData({ ...formData, plano_ativo: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mensal">Mensal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="status">Status da Assinatura</Label>
                  <Select
                    value={formData.status_assinatura}
                    onValueChange={(value) => setFormData({ ...formData, status_assinatura: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trial">Trial</SelectItem>
                      <SelectItem value="ativa">Ativa</SelectItem>
                      <SelectItem value="vencida">Vencida</SelectItem>
                      <SelectItem value="cancelada">Cancelada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pagamento">Forma de Pagamento</Label>
                  <Select
                    value={formData.forma_pagamento}
                    onValueChange={(value) => setFormData({ ...formData, forma_pagamento: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="boleto">Boleto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingEmpresa ? 'Atualizar' : 'Cadastrar'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Empresas Cadastradas
          </CardTitle>
          <CardDescription>
            {empresas?.length || 0} empresa(s) no total
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Carregando...</div>
          ) : empresas && empresas.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Email/Telefone</TableHead>
                    <TableHead>CPF/CNPJ</TableHead>
                    <TableHead>Usuários</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead>Cadastro</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {empresas.map((empresa: any) => (
                    <TableRow key={empresa.id}>
                      <TableCell className="font-medium">{empresa.nome}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{empresa.email_contato}</div>
                          {empresa.telefone && (
                            <div className="text-muted-foreground">{empresa.telefone}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {empresa.cpf ? `CPF: ${empresa.cpf}` : empresa.cnpj ? `CNPJ: ${empresa.cnpj}` : '-'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <UsersIcon className="h-4 w-4 text-muted-foreground" />
                          {empresa.usuarios?.[0]?.count || 0}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(empresa)}</TableCell>
                      <TableCell>
                        {empresa.forma_pagamento ? (
                          <span className="text-sm capitalize">
                            {empresa.forma_pagamento.replace('_', ' ')}
                          </span>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        {empresa.created_at && format(new Date(empresa.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleResetarSenha(empresa)}
                            title="Criar/Resetar Senha do Gestor"
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(empresa)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir a empresa <strong>{empresa.nome}</strong>?
                                  Esta ação irá excluir todos os usuários e dados relacionados e não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => excluirEmpresa.mutate(empresa.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma empresa cadastrada ainda
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog para Criar/Resetar Senha do Gestor */}
      <Dialog open={senhaDialogOpen} onOpenChange={(open) => {
        setSenhaDialogOpen(open)
        if (!open) {
          setNovaSenha('')
          setEmpresaParaSenha(null)
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Definir Senha do Gestor</DialogTitle>
            <DialogDescription>
              {empresaParaSenha?.usuarios?.[0]?.count > 0
                ? 'Redefina a senha do gestor existente'
                : 'Crie um novo usuário gestor para esta empresa'}
              {empresaParaSenha && ` - ${empresaParaSenha.nome}`}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitSenha} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="novaSenha">Nova Senha</Label>
              <Input
                id="novaSenha"
                type="password"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                placeholder="Digite a nova senha"
                required
                minLength={6}
              />
              <p className="text-xs text-muted-foreground">Mínimo 6 caracteres</p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSenhaDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={criarOuResetarSenhaGestor.isPending}>
                {criarOuResetarSenhaGestor.isPending ? 'Processando...' : 'Confirmar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}