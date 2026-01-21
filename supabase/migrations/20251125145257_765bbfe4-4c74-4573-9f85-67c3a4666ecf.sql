-- Criar tabela para documentos P.O.P
CREATE TABLE documentos_pop (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  conteudo_html TEXT NOT NULL,
  arquivo_original_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES usuarios(id)
);

-- Habilitar RLS
ALTER TABLE documentos_pop ENABLE ROW LEVEL SECURITY;

-- Policy: Usuários podem ver documentos da sua empresa
CREATE POLICY "Usuarios podem ver documentos da sua empresa"
  ON documentos_pop FOR SELECT
  USING (
    empresa_id IN (
      SELECT empresa_id FROM usuarios WHERE id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );

-- Policy: Gestores podem gerenciar documentos da sua empresa
CREATE POLICY "Gestores podem gerenciar documentos da sua empresa"
  ON documentos_pop FOR ALL
  USING (
    empresa_id IN (
      SELECT empresa_id FROM usuarios WHERE id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );

-- Criar buckets de storage para documentos e imagens
INSERT INTO storage.buckets (id, name, public)
VALUES ('pop-documents', 'pop-documents', true);

INSERT INTO storage.buckets (id, name, public)
VALUES ('pop-images', 'pop-images', true);

-- Policies para pop-documents bucket
CREATE POLICY "Usuarios podem ver documentos da sua empresa"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'pop-documents' AND (
      EXISTS (
        SELECT 1 FROM usuarios WHERE id = auth.uid()
      ) OR EXISTS (
        SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin'
      )
    )
  );

CREATE POLICY "Gestores podem fazer upload de documentos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'pop-documents' AND (
      EXISTS (
        SELECT 1 FROM usuarios WHERE id = auth.uid()
      ) OR EXISTS (
        SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin'
      )
    )
  );

CREATE POLICY "Gestores podem deletar documentos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'pop-documents' AND (
      EXISTS (
        SELECT 1 FROM usuarios WHERE id = auth.uid()
      ) OR EXISTS (
        SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin'
      )
    )
  );

-- Policies para pop-images bucket
CREATE POLICY "Imagens são publicamente acessíveis"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'pop-images');

CREATE POLICY "Gestores podem fazer upload de imagens"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'pop-images' AND (
      EXISTS (
        SELECT 1 FROM usuarios WHERE id = auth.uid()
      ) OR EXISTS (
        SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin'
      )
    )
  );

CREATE POLICY "Gestores podem deletar imagens"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'pop-images' AND (
      EXISTS (
        SELECT 1 FROM usuarios WHERE id = auth.uid()
      ) OR EXISTS (
        SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin'
      )
    )
  );