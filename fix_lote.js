import fs from 'fs';

const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjc2ZxbXJmYWtob3BhcXhidWRoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODU5OTE4MCwiZXhwIjoyMDg0MTc1MTgwfQ.GPjivqFvJoaOGxqaDvwPjdKd4FzNl8XYB8MzCGzxCX0';

async function updateLote() {
    const loteId = '23618527-a304-4458-8698-27be5fb28ee1';
    const qtd = 2737;

    // Atualizar lotes
    const resLote = await fetch(`https://ucsfqmrfakhopaqxbudh.supabase.co/rest/v1/lotes?id=eq.${loteId}`, {
        method: 'PATCH',
        headers: {
            'apikey': apiKey,
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        },
        body: JSON.stringify({ quantidade_total: qtd })
    });

    const loteData = await resLote.json();
    console.log('Lote atualizado para:', loteData);
}

updateLote();
