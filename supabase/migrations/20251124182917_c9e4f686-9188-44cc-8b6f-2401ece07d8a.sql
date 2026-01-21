-- Atualizar RLS de colaboradores para multi-tenancy
DROP POLICY IF EXISTS "Allow all operations on colaboradores" ON colaboradores;

CREATE POLICY "Multi-tenancy colaboradores"
  ON colaboradores FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'super_admin'::"app_role"
    )
    OR
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE usuarios.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'super_admin'::"app_role"
    )
    OR
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE usuarios.id = auth.uid()
    )
  );

-- Atualizar RLS de produtos para multi-tenancy
DROP POLICY IF EXISTS "Allow all operations on produtos" ON produtos;

CREATE POLICY "Multi-tenancy produtos"
  ON produtos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'super_admin'::"app_role"
    )
    OR
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE usuarios.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'super_admin'::"app_role"
    )
    OR
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE usuarios.id = auth.uid()
    )
  );

-- Atualizar RLS de etapas para multi-tenancy
DROP POLICY IF EXISTS "Allow all operations on etapas" ON etapas;

CREATE POLICY "Multi-tenancy etapas"
  ON etapas FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'super_admin'::"app_role"
    )
    OR
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE usuarios.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'super_admin'::"app_role"
    )
    OR
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE usuarios.id = auth.uid()
    )
  );

-- Atualizar RLS de subetapas para multi-tenancy
DROP POLICY IF EXISTS "Allow all operations on subetapas" ON subetapas;

CREATE POLICY "Multi-tenancy subetapas"
  ON subetapas FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'super_admin'::"app_role"
    )
    OR
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE usuarios.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'super_admin'::"app_role"
    )
    OR
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE usuarios.id = auth.uid()
    )
  );

-- Atualizar RLS de lotes para multi-tenancy
DROP POLICY IF EXISTS "Allow all operations on lotes" ON lotes;

CREATE POLICY "Multi-tenancy lotes"
  ON lotes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'super_admin'::"app_role"
    )
    OR
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE usuarios.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'super_admin'::"app_role"
    )
    OR
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE usuarios.id = auth.uid()
    )
  );

-- Atualizar RLS de producoes para multi-tenancy
DROP POLICY IF EXISTS "Allow all operations on producoes" ON producoes;

CREATE POLICY "Multi-tenancy producoes"
  ON producoes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'super_admin'::"app_role"
    )
    OR
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE usuarios.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'super_admin'::"app_role"
    )
    OR
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE usuarios.id = auth.uid()
    )
  );

-- Atualizar RLS de previsoes_producao para multi-tenancy
DROP POLICY IF EXISTS "Allow all operations on previsoes_producao" ON previsoes_producao;

CREATE POLICY "Multi-tenancy previsoes_producao"
  ON previsoes_producao FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'super_admin'::"app_role"
    )
    OR
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE usuarios.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'super_admin'::"app_role"
    )
    OR
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE usuarios.id = auth.uid()
    )
  );

-- Atualizar RLS de metas para multi-tenancy
DROP POLICY IF EXISTS "Allow all operations on metas" ON metas;

CREATE POLICY "Multi-tenancy metas"
  ON metas FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'super_admin'::"app_role"
    )
    OR
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE usuarios.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'super_admin'::"app_role"
    )
    OR
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE usuarios.id = auth.uid()
    )
  );

-- Atualizar RLS de produto_etapas para multi-tenancy
DROP POLICY IF EXISTS "Allow all operations on produto_etapas" ON produto_etapas;

CREATE POLICY "Multi-tenancy produto_etapas"
  ON produto_etapas FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'super_admin'::"app_role"
    )
    OR
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE usuarios.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'super_admin'::"app_role"
    )
    OR
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE usuarios.id = auth.uid()
    )
  );

-- Atualizar RLS de previsao_ajustes para multi-tenancy
DROP POLICY IF EXISTS "Allow all operations on previsao_ajustes" ON previsao_ajustes;

CREATE POLICY "Multi-tenancy previsao_ajustes"
  ON previsao_ajustes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'super_admin'::"app_role"
    )
    OR
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE usuarios.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'super_admin'::"app_role"
    )
    OR
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE usuarios.id = auth.uid()
    )
  );

-- Atualizar RLS de previsao_imprevistos para multi-tenancy
DROP POLICY IF EXISTS "Allow all operations on previsao_imprevistos" ON previsao_imprevistos;

CREATE POLICY "Multi-tenancy previsao_imprevistos"
  ON previsao_imprevistos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'super_admin'::"app_role"
    )
    OR
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE usuarios.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'super_admin'::"app_role"
    )
    OR
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE usuarios.id = auth.uid()
    )
  );