
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Trash2, Upload, FileText, Loader2, Eye } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import mammoth from "mammoth";
import DOMPurify from 'dompurify';

export default function GerenciarPOP() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [titulo, setTitulo] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewHtml, setPreviewHtml] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);

  const { data: documentos, isLoading } = useQuery({
    queryKey: ["documentos-pop-config", user?.empresa_id],
    queryFn: async () => {
      if (!user?.empresa_id) throw new Error("Usuário sem empresa");

      let query = supabase
        .from("documentos_pop")
        .select("*")
        .order("created_at", { ascending: false });

      if (user?.role !== 'super_admin') {
        query = query.eq("empresa_id", user.empresa_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!user?.empresa_id
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.docx')) {
      toast.error("Por favor, selecione um arquivo .docx");
      return;
    }

    setSelectedFile(file);
    setIsProcessing(true);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer });

      // HTML já contém as imagens convertidas como data URLs
      const htmlContent = result.value;

      // SANITIZAR HTML para prevenir XSS
      const sanitizedHtml = DOMPurify.sanitize(htmlContent, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'img', 'span', 'div'],
        ALLOWED_ATTR: ['src', 'alt', 'class', 'style', 'width', 'height']
      });

      // Verificar se há mensagens de aviso
      if (result.messages.length > 0) {
        console.log("Mensagens do processamento:", result.messages);
      }

      setPreviewHtml(sanitizedHtml);
      toast.success("Documento processado com sucesso!");
    } catch (error) {
      console.error("Erro ao processar documento:", error);
      toast.error("Erro ao processar documento Word");
    } finally {
      setIsProcessing(false);
    }
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!titulo.trim()) throw new Error("Título é obrigatório");
      if (!previewHtml) throw new Error("Selecione um arquivo primeiro");
      if (!user?.empresa_id) throw new Error("Empresa não identificada");

      // Salvar documento diretamente no banco (HTML já contém imagens como data URLs)
      const { error } = await supabase.from("documentos_pop").insert({
        empresa_id: user.empresa_id,
        titulo: titulo.trim(),
        conteudo_html: previewHtml,
        created_by: user.id
      });

      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      toast.success("Documento cadastrado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["documentos-pop-config"] });
      // Invalidate both keys just in case
      queryClient.invalidateQueries({ queryKey: ["documentos-pop"] });

      setTitulo("");
      setSelectedFile(null);
      setPreviewHtml("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao salvar documento");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Deletar documento do banco
      const { error } = await supabase.from("documentos_pop").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      toast.success("Documento excluído com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["documentos-pop-config"] });
      queryClient.invalidateQueries({ queryKey: ["documentos-pop"] });
      setDeleteDocId(null);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Adicionar Novo Documento P.O.P</CardTitle>
          <CardDescription>
            Faça upload de documentos Word (.docx) com procedimentos operacionais
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="titulo">Título do Documento *</Label>
            <Input
              id="titulo"
              placeholder="Ex: Manual de Operações"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="file">Arquivo Word (.docx) *</Label>
            <div className="flex gap-2">
              <Input
                ref={fileInputRef}
                id="file"
                type="file"
                accept=".docx"
                onChange={handleFileSelect}
                disabled={isProcessing}
              />
              {isProcessing && <Loader2 className="h-5 w-5 animate-spin" />}
            </div>
          </div>

          {previewHtml && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Pré-visualização
                </Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPreviewHtml("");
                    setSelectedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                >
                  Limpar
                </Button>
              </div>
              <div className="border rounded-lg p-4 max-h-96 overflow-y-auto bg-muted/50">
                <div
                  className="prose prose-sm dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              </div>
            </div>
          )}

          <Button
            onClick={() => createMutation.mutate()}
            disabled={!titulo.trim() || !previewHtml || createMutation.isPending}
            className="w-full"
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Salvar Documento
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Documentos Cadastrados</CardTitle>
          <CardDescription>
            Lista de todos os documentos P.O.P cadastrados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-4">Carregando...</p>
          ) : !documentos || documentos.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhum documento cadastrado</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Data de Criação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documentos.map((doc: any) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">{doc.titulo}</TableCell>
                    <TableCell>
                      {new Date(doc.created_at).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteDocId(doc.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteDocId} onOpenChange={(open) => !open && setDeleteDocId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este documento? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteDocId && deleteMutation.mutate(deleteDocId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
