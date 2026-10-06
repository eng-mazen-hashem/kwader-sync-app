const { createClient } = require('@supabase/supabase-js');
const s = createClient('https://zmhoafjugclgnomfebge.supabase.co', process.env.SUPABASE_SERVICE_ROLE_KEY);
s.rpc('execute_sql', { sql: "SELECT prosrc FROM pg_proc WHERE proname = 'acquire_whatsapp_lease';" })
  .then(res => console.log(JSON.stringify(res, null, 2)));
