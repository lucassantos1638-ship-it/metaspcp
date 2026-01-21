-- Remover a política restritiva atual
DROP POLICY IF EXISTS "Multi-tenancy colaboradores" ON colaboradores;

-- Criar políticas permissivas para operações
CREATE POLICY "Colaboradores: Todos autenticados podem ler" 
ON colaboradores FOR SELECT 
USING (true);

CREATE POLICY "Colaboradores: Sistema pode inserir" 
ON colaboradores FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Colaboradores: Sistema pode atualizar" 
ON colaboradores FOR UPDATE 
USING (true);

CREATE POLICY "Colaboradores: Sistema pode deletar" 
ON colaboradores FOR DELETE 
USING (true);