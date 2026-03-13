$headers = @{
    "apikey" = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjc2ZxbXJmYWtob3BhcXhidWRoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODU5OTE4MCwiZXhwIjoyMDg0MTc1MTgwfQ.GPjivqFvJoaOGxqaDvwPjdKd4FzNl8XYB8MzCGzxCX0"
    "Authorization" = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjc2ZxbXJmYWtob3BhcXhidWRoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODU5OTE4MCwiZXhwIjoyMDg0MTc1MTgwfQ.GPjivqFvJoaOGxqaDvwPjdKd4FzNl8XYB8MzCGzxCX0"
}
$loteUrl = "https://ucsfqmrfakhopaqxbudh.supabase.co/rest/v1/lotes?numero_lote=eq.2843&select=id,numero_lote,quantidade_total,produto_id"
$lotes = Invoke-RestMethod -Uri $loteUrl -Headers $headers -Method Get

if ($lotes.Length -gt 0) {
    Write-Output "=== LOTE 2843 ==="
    $lotes | ConvertTo-Json

    $loteId = $lotes[0].id
    $prodUrl = "https://ucsfqmrfakhopaqxbudh.supabase.co/rest/v1/producoes?lote_id=eq.$loteId&select=id,etapa_id,subetapa_id,quantidade_produzida,status"
    $producoes = Invoke-RestMethod -Uri $prodUrl -Headers $headers -Method Get

    Write-Output "=== PRODUCOES ==="
    $producoes | ConvertTo-Json
} else {
    Write-Output "Lote 2843 not found."
}
