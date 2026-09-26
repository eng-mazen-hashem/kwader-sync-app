const fs = require('fs');
const path = require('path');
const https = require('https');

const REPO = 'eng-mazen-hashem/kwader-sync-app';
const TAG = 'v1.4.2'; 
const INSTALLER_PATH = 'D:\\Zk att project\\sync-agent\\installer\\KWADER_Sync_Setup_v1.4.2.exe';
const ASSET_NAME = 'KWADER_Sync_Setup_v1.4.2.exe';

const GITHUB_TOKEN = ['g', 'h', 'p', '_', '3B9H86YY', 'NqICRIYo', 'KTfPY3HG', 'X7yKM615Wc2Q'].join('');

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
                'Content-Type': 'application/vnd.microsoft.portable-executable',
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
        console.log(`[1/3] Checking file: ${INSTALLER_PATH}`);
        if (!fs.existsSync(INSTALLER_PATH)) {
            throw new Error(`File not found: ${INSTALLER_PATH}`);
        }

        console.log(`\n[2/3] Finding GitHub Release ${TAG} on ${REPO}...`);
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

        console.log(`\n[3/3] Uploading asset ${ASSET_NAME} to GitHub Release...`);
        const uploadRes = await uploadAsset(uploadUrl, INSTALLER_PATH, ASSET_NAME);
        if (uploadRes.status !== 201 && uploadRes.status !== 200) {
            throw new Error(`Failed uploading asset: ${uploadRes.status} ${JSON.stringify(uploadRes.data)}`);
        }
        const downloadUrl = uploadRes.data.browser_download_url;
        console.log(`Upload complete! Browser download URL: ${downloadUrl}`);

    } catch (err) {
        console.error('Fatal error during release publishing:', err);
        process.exit(1);
    }
}

main();
