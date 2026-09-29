const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://ucsfqmrfakhopaqxbudh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjc2ZxbXJmYWtob3BhcXhidWRoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODU5OTE4MCwiZXhwIjoyMDg0MTc1MTgwfQ.GPjivqFvJoaOGxqaDvwPjdKd4FzNl8XYB8MzCGzxCX0';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public');
  if (error) {
    console.error('Error fetching tables:', error);
  } else {
    console.log('Tables:', data.map(t => t.table_name));
  }
}
test();
