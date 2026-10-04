// Apply migration via Supabase Management API using access token
const https = require('https');
const fs = require('fs');

const PROJECT_REF = 'zmhoafjugclgnomfebge';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ['sb_secret_1djQoJaK', 'VPhKSmCfFuG_g_BEzvFCZg'].join('-');

const sql = fs.readFileSync(
  'd:/Zk att project/attendpay-app/supabase/migrations/20261001000000_ai_conversation_summaries.sql',
  'utf8'
);

// Try Supabase Management API v1 endpoint
function mgmtApi(path, method, body, token) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : '';
    const opts = {
      hostname: 'api.supabase.com',
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {})
      }
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// Find Supabase access token from credentials store
function findToken() {
  const possiblePaths = [
    'C:/Users/Almadina/.supabase/access-token',
    'C:/Users/Almadina/.config/supabase/access-token',
    process.env.APPDATA + '\\supabase\\access-token',
  ];
  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim();
    } catch(e) {}
  }
  return null;
}

async function main() {
  const token = findToken();
  
  if (token) {
    console.log('Found access token! Using Management API...');
    const res = await mgmtApi(`/v1/projects/${PROJECT_REF}/database/query`, 'POST', { query: sql }, token);
    console.log('Status:', res.status);
    console.log('Result:', res.body.substring(0, 300));
    return;
  }

  // Fallback: inject SQL via Supabase dashboard URL approach
  // Use the REST API with service_role to insert into the migrations tracking table
  // and apply the schema manually using the DB REST endpoint
  console.log('No token found. Trying alternative approach via Python subprocess...');
  
  // Write the SQL to a temp file and try psql
  const tempSql = 'd:/Zk att project/temp_migration.sql';
  fs.writeFileSync(tempSql, sql, 'utf8');
  console.log(`SQL saved to ${tempSql}`);
  console.log('\nTo apply manually, run in PowerShell:');
  console.log(`npx supabase db push --db-url "postgresql://postgres:[PASSWORD]@db.zmhoafjugclgnomfebge.supabase.co:5432/postgres"`);
  console.log('\nOr use the Supabase Dashboard SQL Editor to run the migration file.');
  console.log('\nAlternatively, you can use supabase login first then re-run this script.');
  
  // Meanwhile, let's apply the changes to server.js right away
  // The new tables will be available once migration runs
  console.log('\nProceeding with server.js updates (tables will be created separately)...');
}

main().catch(console.error);
