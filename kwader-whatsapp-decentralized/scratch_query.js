require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
s.from('whatsapp_node_assignments').select('*').then(res => console.log(JSON.stringify(res.data, null, 2)));
