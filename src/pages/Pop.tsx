import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Search, FileText, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import DOMPurify from 'dompurify';

export default function Pop() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [currentMatch, setCurrentMatch] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);

  const { data: documentos, isLoading } = useQuery({
    queryKey: ["documentos-pop", user?.empresa_id],
    queryFn: async () => {
      let query = supabase
        .from("documentos_pop")
        .select("*")
        .order("created_at", { ascending: false });

      if (user?.role !== 'super_admin' && user?.empresa_id) {
        query = query.eq("empresa_id", user.empresa_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!user
  });

  const highlightText = (html: string, term: string) => {
    if (!term.trim()) return html;
    
    // Sanitizar HTML antes de processar
    const sanitized = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'img', 'span', 'div'],
      ALLOWED_ATTR: ['src', 'alt', 'class', 'style', 'width', 'height']
    });
    
    const regex = new RegExp(`(${term})`, 'gi');
    const matches = sanitized.match(regex);
    setTotalMatches(matches ? matches.length : 0);
    
    return sanitized.replace(regex, '<mark class="bg-yellow-300 dark:bg-yellow-700">$1</mark>');
  };

  const scrollToMatch = (direction: 'next' | 'prev') => {
    const marks = document.querySelectorAll('mark');
    if (marks.length === 0) return;

    let newIndex = currentMatch;
    if (direction === 'next') {
      newIndex = (currentMatch + 1) % marks.length;
    } else {
      newIndex = currentMatch === 0 ? marks.length - 1 : currentMatch - 1;
    }

    marks[newIndex]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setCurrentMatch(newIndex);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Carregando documentos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">P.O.P</h1>
          <p className="text-muted-foreground">Procedimentos Operacionais Padrão</p>
        </div>
        <Badge variant="secondary" className="text-sm">
          {documentos?.length || 0} {documentos?.length === 1 ? 'documento' : 'documentos'}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="h-5 w-5" />
            Buscar em todos os documentos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Digite para buscar..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentMatch(0);
              }}
              className="flex-1"
            />
            {searchTerm && totalMatches > 0 && (
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {currentMatch + 1} de {totalMatches}
                </Badge>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => scrollToMatch('prev')}
                  disabled={totalMatches === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => scrollToMatch('next')}
                  disabled={totalMatches === 0}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {!documentos || documentos.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">Nenhum documento cadastrado</p>
            <p className="text-muted-foreground text-center">
              Acesse Configurações &gt; P.O.P para adicionar documentos
            </p>
          </CardContent>
        </Card>
      ) : (
        <Accordion type="single" collapsible className="space-y-4">
          {documentos.map((doc) => (
            <AccordionItem key={doc.id} value={doc.id} className="border rounded-lg">
              <AccordionTrigger className="px-6 hover:no-underline">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-primary" />
                  <span className="font-semibold">{doc.titulo}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <div className="mt-4 prose prose-sm dark:prose-invert max-w-none">
                  <div
                    dangerouslySetInnerHTML={{
                      __html: highlightText(doc.conteudo_html, searchTerm)
                    }}
                    className="documento-content"
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}
