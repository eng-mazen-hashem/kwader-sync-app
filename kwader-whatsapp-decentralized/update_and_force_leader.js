const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

const env = dotenv.parse(fs.readFileSync('d:/Zk att project/kwader-whatsapp-decentralized/.env'));
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log('1. Killing running whatsapp-node...');
  try {
    execSync('taskkill /F /IM whatsapp-node.exe /T', { stdio: 'ignore' });
  } catch (e) {}

  await new Promise(r => setTimeout(r, 1500));

  const binDir = path.join(process.env.APPDATA, 'sync-agent', 'bin');
  const targetExe = path.join(binDir, 'whatsapp-node.exe');
  const oldExe = path.join(binDir, 'whatsapp-node.old.exe');
  const newExe = 'd:/Zk att project/kwader-whatsapp-decentralized/build/whatsapp-node.exe';

  console.log('2. Swapping binary...');
  if (fs.existsSync(oldExe)) {
    try { fs.unlinkSync(oldExe); } catch (e) {}
  }

  if (fs.existsSync(targetExe)) {
    try {
      fs.renameSync(targetExe, oldExe);
      console.log('Renamed targetExe -> oldExe');
    } catch (e) {
      console.log('Rename failed, trying unlink:', e.message);
      try { fs.unlinkSync(targetExe); } catch (e2) {}
    }
  }

  fs.copyFileSync(newExe, targetExe);
  console.log('Copied new v2.10.7 binary to APPDATA successfully!');

  const verFile = path.join(binDir, 'whatsapp-node.version.json');
  fs.writeFileSync(verFile, JSON.stringify({
    version: '2.10.7',
    updated_at: new Date().toISOString()
  }, null, 2));

  console.log('3. Forcing channel 2a326ace to Demo-DESKTOP-S2B1RKS_2a326ace in Supabase...');
  const { data, error } = await supabase.from('whatsapp_channels').update({
    active_leader_id: 'Demo-DESKTOP-S2B1RKS_2a326ace',
    active_node_id: 'Demo-DESKTOP-S2B1RKS_2a326ace',
    forced_leader_node_id: 'Demo-DESKTOP-S2B1RKS_2a326ace',
    current_epoch: 300,
    lease_expires_at: new Date(Date.now() + 60000).toISOString()
  }).eq('id', '2a326ace-afbd-47b9-927e-25e44fb973cd').select();

  console.log('Channel updated:', data, error);
}

main().catch(console.error);
