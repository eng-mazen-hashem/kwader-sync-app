import os
import base64
from supabase import create_client
from dotenv import load_dotenv

ENCODED_URL = 'aHR0cHM6Ly9vbGNydGZlb2JldHZkZG9jYm1ucy5zdXBhYmFzZS5jbw=='
ENCODED_KEY = 'ZXlKaGJHY2lPaUpJVXpJMU5pSXNJblI1Y0NJNklrcFhWQ0o5LmV5SnBjM01pT2lKemRYQmhZbUZ6WlNJc0luSmxaaUk2SW05c1kzSjBabVZ2WW1WMGRtUmtiMk5pYlc1eklpd2ljbTlzWlNJNkltRnViMjRpTENKcFlYUWlPakUzTnpJNE16WXlNVGNzSW1WNGNDSTZNakE0T0RReE1qSXhOMzAuUWdNRFdkUE43VldyNmZObW9VaDFZQngzYlRwYWxOWVFMOTBBdXVIcVY3cw=='

SUPABASE_URL = base64.b64decode(ENCODED_URL).decode('utf-8')
SUPABASE_KEY = base64.b64decode(ENCODED_KEY).decode('utf-8')
SUPABASE = create_client(SUPABASE_URL, SUPABASE_KEY)

try:
    print("Testing read...")
    res = SUPABASE.table('sync_service_status').select('*').limit(1).execute()
    print("Read success:", res.data)
except Exception as e:
    print("Read failed:", e)

try:
    print("Testing insert...")
    # Try to insert a dummy record
    res2 = SUPABASE.table('sync_service_status').upsert({'company_id': '00000000-0000-0000-0000-000000000000', 'device_ping_status': False}).execute()
    print("Insert success:", res2.data)
except Exception as e:
    print("Insert failed:", e)
