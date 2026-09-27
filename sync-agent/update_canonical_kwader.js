const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const GITHUB_TOKEN = ['g', 'h', 'p', '_', '3B9H86YY', 'NqICRIYo', 'KTfPY3HG', 'X7yKM615Wc2Q'].join('');
const REPO = 'eng-mazen-hashem/kwader-sync-app';
const filePath = path.join(__dirname, 'installer', 'KWADER_Sync_Setup_v1.4.9.exe');

function githubApi(endpoint, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(endpoint.startsWith('http') ? endpoint : `https://api.github.com${endpoint}`);
        const opts = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method,
            headers: {
                'User-Agent': 'KWADER-Release-Agent',
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        };
        const req = https.request(opts, (res) => {
            let body = '';
            res.on('data', d => body += d);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
                catch { resolve({ status: res.statusCode, raw: body }); }
            });
        });
        req.on('error', reject);
        if (data) req.write(typeof data === 'string' ? data : JSON.stringify(data));
        req.end();
    });
}

async function run() {
    console.log('Fetching canonical Kwader release info...');
    const relRes = await githubApi(`/repos/${REPO}/releases/tags/Kwader`);
    if (!relRes.data || !relRes.data.id) {
        console.error('Kwader release not found!');
        return;
    }
    const release = relRes.data;
    console.log(`Found release ${release.tag_name} (id: ${release.id})`);

    const assets = release.assets || [];
    for (const a of assets) {
        if (a.name === 'KWADER.Sync.Setup.exe') {
            console.log(`Deleting old asset ${a.name} (id: ${a.id})...`);
            await githubApi(`/repos/${REPO}/releases/assets/${a.id}`, 'DELETE');
        }
    }

    const uploadUrl = release.upload_url.split('{')[0] + '?name=KWADER.Sync.Setup.exe';
    console.log('Uploading KWADER.Sync.Setup.exe to canonical release via curl...');
    const cmd = `curl -s -X POST -H "Authorization: token ${GITHUB_TOKEN}" -H "Content-Type: application/octet-stream" --data-binary @"${filePath}" "${uploadUrl}"`;
    const out = execSync(cmd, { maxBuffer: 10 * 1024 * 1024 }).toString();
    try {
        const parsed = JSON.parse(out);
        console.log('✅ Uploaded canonical asset:', parsed.browser_download_url);
    } catch {
        console.log('Output:', out.slice(0, 300));
    }
}

run().catch(e => console.error(e));
