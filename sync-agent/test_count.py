import os
import base64
from supabase import create_client

SUPABASE_URL = "https://zmhoafjugclgnomfebge.supabase.co"
SUPABASE_KEY = "eyJhb... replace this with env loading"

import dotenv
dotenv.load_dotenv(dotenv_path='d:/Zk att project/kwader-whatsapp-decentralized/.env')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
SUPABASE = create_client(SUPABASE_URL, SUPABASE_KEY)

company_id = 'cc8dda7c-9c65-456e-83ea-b94de1fbcffd'

try:
    emp_resp = SUPABASE.table('employees').select('id', count='exact').eq('company_id', company_id).execute()
    print("COUNT:", emp_resp.count)
except Exception as e:
    print("ERROR:", e)
