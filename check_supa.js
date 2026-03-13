import fs from 'fs';

const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjc2ZxbXJmYWtob3BhcXhidWRoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODU5OTE4MCwiZXhwIjoyMDg0MTc1MTgwfQ.GPjivqFvJoaOGxqaDvwPjdKd4FzNl8XYB8MzCGzxCX0';

async function check() {
    const res = await fetch('https://ucsfqmrfakhopaqxbudh.supabase.co/rest/v1/', {
        headers: { 'apikey': apiKey, 'Authorization': `Bearer ${apiKey}` }
    });
    const spec = await res.json();
    const paths = Object.keys(spec.paths).filter(p => p.startsWith('/rpc/'));
    fs.writeFileSync('rpcs.json', JSON.stringify(paths, null, 2));
}
check();
