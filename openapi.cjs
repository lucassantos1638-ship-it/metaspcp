const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const url = env.split('\n').find(l => l.startsWith('VITE_SUPABASE_URL')).split('=')[1].replace(/\"/g, '').trim();
const key = env.split('\n').find(l => l.startsWith('VITE_SUPABASE_PUBLISHABLE_KEY')).split('=')[1].replace(/\"/g, '').trim();
fetch(url + '/rest/v1/?apikey=' + key)
  .then(res => res.json())
  .then(data => fs.writeFileSync('schema.json', JSON.stringify(data, null, 2)))
  .catch(console.error);
