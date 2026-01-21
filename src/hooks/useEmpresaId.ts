import { useAuth } from "@/contexts/AuthContext";

export function useEmpresaId() {
  const { user } = useAuth();
  return user?.empresa_id;
}
