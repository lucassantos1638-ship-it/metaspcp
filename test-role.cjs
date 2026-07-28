const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const url = env.split('\n').find(l => l.startsWith('VITE_SUPABASE_URL')).split('=')[1].replace(/\"/g, '').trim();
const key = env.split('\n').find(l => l.startsWith('SUPABASE_SERVICE_ROLE_KEY')).split('=')[1].replace(/\"/g, '').trim();
fetch(url + '/rest/v1/lotes?limit=1', { headers: { 'apikey': key, 'Authorization': 'Bearer ' + key } })
  .then(res => res.json())
  .then(data => console.log('Columns:', Object.keys(data[0] || {})))
  .catch(console.error);
