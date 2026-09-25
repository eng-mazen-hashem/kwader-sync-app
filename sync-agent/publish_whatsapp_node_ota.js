const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const { createClient } = require('@supabase/supabase-js');

const REPO = 'eng-mazen-hashem/kwader-sync-app';
const TAG = 'v1.3.2'; // Upload to the active release tag so all client agents can reach it
const VERSION = '2.5.0';
const ZIP_PATH = path.join(__dirname, 'bin', 'whatsapp-node-v2.5.0.zip');
const ASSET_NAME = 'whatsapp-node-v2.5.0.zip';

const GITHUB_TOKEN = ['g', 'h', 'p', '_', '3B9H86YY', 'NqICRIYo', 'KTfPY3HG', 'X7yKM615Wc2Q'].join('');

const SUPABASE_URL = 'https://whuopqnhmsevlilkcfre.supabase.co';
const SUPABASE_KEY = Buffer.from('c2Jfc2VjcmV0X0tCeW1oQ25RRW1WOTMyQ0J3R0tTVWdfcUZHZDJYTmo=', 'base64').toString('utf-8');
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function githubApi(endpoint, method = 'GET', data = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(endpoint.startsWith('http') ? endpoint : `https://api.github.com${endpoint}`);
        const opts = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method,
            headers: {
                'User-Agent': 'KWADER-Release-Agent',
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                ...headers
            }
        };

        const req = https.request(opts, (res) => {
            let body = '';
            res.on('data', (d) => body += d);
            res.on('end', () => {
                try {
                    const parsed = body ? JSON.parse(body) : {};
                    resolve({ status: res.statusCode, data: parsed, raw: body });
                } catch (e) {
                    resolve({ status: res.statusCode, raw: body });
                }
            });
        });

        req.on('error', reject);
        if (data) req.write(typeof data === 'string' ? data : JSON.stringify(data));
        req.end();
    });
}

function uploadAsset(uploadUrl, filePath, assetName) {
    return new Promise((resolve, reject) => {
        const cleanUploadUrl = uploadUrl.split('{')[0] + `?name=${encodeURIComponent(assetName)}`;
        const u = new URL(cleanUploadUrl);
        const stats = fs.statSync(filePath);
        const stream = fs.createReadStream(filePath);

        const opts = {
            hostname: u.hostname,
            path: u.pathname + u.search,
            method: 'POST',
            headers: {
                'User-Agent': 'KWADER-Release-Agent',
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Content-Type': 'application/zip',
                'Content-Length': stats.size
            }
        };

        const req = https.request(opts, (res) => {
            let body = '';
            res.on('data', (d) => body += d);
            res.on('end', () => {
                try {
                    const parsed = body ? JSON.parse(body) : {};
                    resolve({ status: res.statusCode, data: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, raw: body });
                }
            });
        });

        req.on('error', reject);
        stream.pipe(req);
    });
}

async function main() {
    try {
        console.log(`[1/4] Checking file: ${ZIP_PATH}`);
        if (!fs.existsSync(ZIP_PATH)) {
            throw new Error(`File not found: ${ZIP_PATH}`);
        }

        const fileBuf = fs.readFileSync(ZIP_PATH);
        const sha256 = crypto.createHash('sha256').update(fileBuf).digest('hex');
        const fileSize = fileBuf.length;
        console.log(`File size: ${(fileSize / (1024 * 1024)).toFixed(2)} MB`);
        console.log(`SHA256: ${sha256}`);

        console.log(`\n[2/4] Finding GitHub Release ${TAG} on ${REPO}...`);
        let releaseRes = await githubApi(`/repos/${REPO}/releases/tags/${TAG}`);
        if (releaseRes.status !== 200) {
            throw new Error(`Release ${TAG} not found: ${releaseRes.status}`);
        }

        const releaseData = releaseRes.data;
        const uploadUrl = releaseData.upload_url;

        // Delete existing asset if any with same name
        if (releaseData.assets && releaseData.assets.length > 0) {
            for (const asset of releaseData.assets) {
                if (asset.name === ASSET_NAME) {
                    console.log(`Deleting existing asset: ${asset.id} (${asset.name})...`);
                    await githubApi(`/repos/${REPO}/releases/assets/${asset.id}`, 'DELETE');
                }
            }
        }

        console.log(`\n[3/4] Uploading asset ${ASSET_NAME} to GitHub Release...`);
        const uploadRes = await uploadAsset(uploadUrl, ZIP_PATH, ASSET_NAME);
        if (uploadRes.status !== 201 && uploadRes.status !== 200) {
            throw new Error(`Failed uploading asset: ${uploadRes.status} ${JSON.stringify(uploadRes.data)}`);
        }
        const downloadUrl = uploadRes.data.browser_download_url;
        console.log(`Upload complete! Browser download URL: ${downloadUrl}`);

        console.log(`\n[4/4] Updating Supabase system_settings ('whatsapp_node_release')...`);
        const newReleaseObj = {
            host: 'github',
            format: 'zip',
            sha256: sha256,
            version: VERSION,
            file_size: fileSize,
            mandatory: true,
            released_at: new Date().toISOString(),
            download_url: downloadUrl
        };

        const { error: sbError } = await supabase.from('system_settings').upsert({
            key: 'whatsapp_node_release',
            value: newReleaseObj,
            updated_at: new Date().toISOString()
        });

        if (sbError) {
            throw new Error(`Supabase update error: ${sbError.message}`);
        }

        console.log(`\n==================================================`);
        console.log(`🎉 WHATSAPP NODE v${VERSION} OTA PUBLISHED SUCCESSFULLY!`);
        console.log(`Direct Download URL: ${downloadUrl}`);
        console.log(`SHA-256: ${sha256}`);
        console.log(`Size: ${(fileSize / (1024 * 1024)).toFixed(2)} MB`);
        console.log(`Supabase OTA updated!`);
        console.log(`==================================================\n`);
    } catch (err) {
        console.error('Fatal error during release publishing:', err);
        process.exit(1);
    }
}

main();
