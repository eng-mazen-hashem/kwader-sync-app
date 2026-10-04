require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const { data, error } = await supabase.rpc('execute_sql', {
        sql: `SELECT prosrc FROM pg_proc WHERE proname = 'sync_attendance';`
    });
    console.log(error ? error : data[0].prosrc);
}
run();
