-- Remover políticas antigas de documentos_pop
DROP POLICY IF EXISTS "Usuarios podem ver documentos da sua empresa" ON documentos_pop;
DROP POLICY IF EXISTS "Gestores podem gerenciar documentos da sua empresa" ON documentos_pop;

-- Criar política de multi-tenancy similar às outras tabelas do sistema
CREATE POLICY "Multi-tenancy documentos_pop" 
ON documentos_pop FOR ALL
USING (
  (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin'))
  OR (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid()))
)
WITH CHECK (
  (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin'))
  OR (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid()))
);

-- Remover políticas de storage (não usaremos mais)
DROP POLICY IF EXISTS "Usuarios podem ver documentos da sua empresa" ON storage.objects;
DROP POLICY IF EXISTS "Gestores podem fazer upload de documentos" ON storage.objects;
DROP POLICY IF EXISTS "Gestores podem deletar documentos" ON storage.objects;
DROP POLICY IF EXISTS "Imagens são publicamente acessíveis" ON storage.objects;
DROP POLICY IF EXISTS "Gestores podem fazer upload de imagens" ON storage.objects;
DROP POLICY IF EXISTS "Gestores podem deletar imagens" ON storage.objects;

-- Remover buckets de storage (não usaremos mais)
DELETE FROM storage.buckets WHERE id IN ('pop-documents', 'pop-images');