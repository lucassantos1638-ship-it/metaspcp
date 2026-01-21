ALTER TABLE public.usuarios 
ADD COLUMN IF NOT EXISTS preferencia_ranking TEXT DEFAULT 'moderno'; -- Default to modern as requested to "create another model"
