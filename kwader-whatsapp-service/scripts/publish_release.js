/**
 * ============================================================
 * KWADER WhatsApp Node - Enterprise Release & OTA Publisher
 * ============================================================
 * Automates:
 * 1. Binary packaging & High-Ratio Compression (ZIP ~28MB vs 99MB)
 * 2. SHA-256 Checksum generation
 * 3. Upload to GitHub Releases (free bandwidth - no Supabase quota)
 * 4. Atomic publication to 'system_settings' (key: 'whatsapp_node_release')
 *
 * Usage:
 *   node scripts/publish_release.js
 */

const fs      = require('fs');
const path    = require('path');
const crypto  = require('crypto');
const https   = require('https');
const AdmZip  = require('adm-zip');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

// ── Supabase (manifest only – tiny payload, no binary storage) ──────────────
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
}

// ── GitHub (binary hosting – free bandwidth) ────────────────────────────────
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO  = process.env.GITHUB_REPO || 'eng-mazen-hashem/kwader-sync-app';

if (!GITHUB_TOKEN) {
    console.error('❌ Missing GITHUB_TOKEN in .env');
    process.exit(1);
}

const [GH_OWNER, GH_REPO] = GITHUB_REPO.split('/');
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Helpers ──────────────────────────────────────────────────────────────────

function computeSha256(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

/**
 * Generic GitHub REST API request (JSON body/response).
 */
function githubRequest(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.github.com',
            path,
            method,
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept':        'application/vnd.github+json',
                'User-Agent':    'kwader-release-publisher/2.0',
                'Content-Type':  'application/json',
            },
        };

        const req = https.request(options, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (res.statusCode >= 400) {
                        reject(new Error(`GitHub API ${res.statusCode}: ${parsed.message || data}`));
                    } else {
                        resolve(parsed);
                    }
                } catch {
                    resolve(data);
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

/**
 * Upload a binary asset to a GitHub Release.
 * Uses uploads.github.com endpoint.
 */
function uploadReleaseAsset(uploadUrl, fileName, fileBuffer) {
    return new Promise((resolve, reject) => {
        // uploadUrl example: https://uploads.github.com/repos/owner/repo/releases/123/assets{?name,label}
        const cleanUrl = uploadUrl.replace(/\{[^}]+\}/, '');
        const url = new URL(`${cleanUrl}?name=${encodeURIComponent(fileName)}`);

        const options = {
            hostname: url.hostname,
            path:     url.pathname + url.search,
            method:   'POST',
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept':        'application/vnd.github+json',
                'User-Agent':    'kwader-release-publisher/2.0',
                'Content-Type':  'application/zip',
                'Content-Length': fileBuffer.length,
            },
        };

        const req = https.request(options, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (res.statusCode >= 400) {
                        reject(new Error(`Upload ${res.statusCode}: ${parsed.message || data}`));
                    } else {
                        resolve(parsed);
                    }
                } catch {
                    resolve(data);
                }
            });
        });

        req.on('error', reject);
        req.write(fileBuffer);
        req.end();
    });
}

// ── Patch PE Subsystem ───────────────────────────────────────────────────────

function patchPeSubsystem(exePath) {
    try {
        const fd  = fs.openSync(exePath, 'r+');
        const buf = Buffer.alloc(1024);
        fs.readSync(fd, buf, 0, 1024, 0);
        const peOffset        = buf.readUInt32LE(0x3c);
        const subsystemOffset = peOffset + 0x5c;
        const subBuf          = Buffer.alloc(2);
        fs.readSync(fd, subBuf, 0, 2, subsystemOffset);
        const current = subBuf.readUInt16LE(0);
        if (current === 3) {
            subBuf.writeUInt16LE(2, 0);
            fs.writeSync(fd, subBuf, 0, 2, subsystemOffset);
            console.log('🛡️  Patched PE Subsystem → 2 (GUI, silent background).');
        } else {
            console.log(`🛡️  PE Subsystem already set to ${current} (GUI).`);
        }
        fs.closeSync(fd);
    } catch (err) {
        console.warn('⚠️  Could not patch PE Subsystem:', err.message);
    }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function publishRelease() {
    console.log('🚀 Starting KWADER WhatsApp Node Release & OTA Deployment...\n');
    console.log(`📡 Target: GitHub Releases → ${GITHUB_REPO}`);
    console.log(`📡 Manifest: Supabase system_settings (tiny JSON only)\n`);

    // ── Read version ──────────────────────────────────────────────────────────
    const pkgPath = path.join(__dirname, '..', 'package.json');
    const pkg     = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const version = pkg.version || '2.2.2';
    const tagName = `whatsapp-node-v${version}`;

    // ── Verify binary ─────────────────────────────────────────────────────────
    const exePath = path.join(__dirname, '..', 'build', 'whatsapp-node.exe');
    if (!fs.existsSync(exePath)) {
        console.error(`❌ Binary not found: ${exePath}`);
        console.error('💡 Run: npm run build:exe');
        process.exit(1);
    }

    patchPeSubsystem(exePath);

    // ── Compress ──────────────────────────────────────────────────────────────
    const zipFileName = `whatsapp-node-v${version}.zip`;
    const zipPath     = path.join(__dirname, '..', 'build', zipFileName);
    console.log('📦 Compressing binary → ZIP archive...');
    const zip = new AdmZip();
    zip.addLocalFile(exePath, '', 'whatsapp-node.exe');
    zip.writeZip(zipPath);

    const zipBuffer = fs.readFileSync(zipPath);
    const sha256    = computeSha256(zipPath);
    const sizeMb    = (zipBuffer.length / (1024 * 1024)).toFixed(2);

    console.log('\n📋 Release Package:');
    console.log(`   Version  : v${version}`);
    console.log(`   Payload  : ${zipFileName} (${sizeMb} MB)`);
    console.log(`   SHA-256  : ${sha256}`);

    // ── Delete existing GitHub release with same tag (if any) ─────────────────
    console.log(`\n🔍 Checking for existing GitHub release tag "${tagName}"...`);
    try {
        const existing = await githubRequest('GET', `/repos/${GH_OWNER}/${GH_REPO}/releases/tags/${tagName}`);
        if (existing && existing.id) {
            console.log(`🗑️  Deleting existing release id=${existing.id}...`);
            await githubRequest('DELETE', `/repos/${GH_OWNER}/${GH_REPO}/releases/${existing.id}`);
        }
    } catch {
        // No existing release – that's fine
    }

    // Also delete tag if it exists
    try {
        await githubRequest('DELETE', `/repos/${GH_OWNER}/${GH_REPO}/git/refs/tags/${tagName}`);
        console.log(`🏷️  Deleted stale tag "${tagName}".`);
    } catch {
        // Tag didn't exist
    }

    // ── Create GitHub Release ─────────────────────────────────────────────────
    console.log(`\n🚀 Creating GitHub Release "${tagName}"...`);
    const release = await githubRequest('POST', `/repos/${GH_OWNER}/${GH_REPO}/releases`, {
        tag_name:         tagName,
        target_commitish: 'main',
        name:             `WhatsApp Node v${version}`,
        body:             `## KWADER WhatsApp Node v${version}\n\n**SHA-256:** \`${sha256}\`\n\n> Auto-deployed by KWADER Release Publisher. Clients update silently via OTA.`,
        draft:            false,
        prerelease:       false,
    });

    console.log(`✅ Release created: ${release.html_url}`);

    // ── Upload ZIP asset ──────────────────────────────────────────────────────
    console.log(`\n⬆️  Uploading ${zipFileName} to GitHub Release...`);
    const asset = await uploadReleaseAsset(release.upload_url, zipFileName, zipBuffer);
    const downloadUrl = asset.browser_download_url;
    console.log(`✅ Upload Successful!\n   Download URL: ${downloadUrl}`);

    // ── Publish OTA manifest to Supabase (tiny JSON record only) ─────────────
    console.log('\n📡 Publishing OTA manifest to Supabase system_settings...');
    const releasePayload = {
        version,
        download_url: downloadUrl,          // ← GitHub URL (free bandwidth)
        sha256,
        format:       'zip',
        file_size:    zipBuffer.length,
        mandatory:    false,
        host:         'github',
        released_at:  new Date().toISOString(),
    };

    const { error: settingsErr } = await supabase
        .from('system_settings')
        .upsert({
            key:        'whatsapp_node_release',
            value:      releasePayload,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'key' });

    if (settingsErr) {
        console.error('❌ Failed to update system_settings:', settingsErr.message);
        process.exit(1);
    }

    console.log('\n🎉 SUCCESS: OTA Release v' + version + ' published!');
    console.log('   📦 Binary hosted on : GitHub Releases (free unlimited bandwidth)');
    console.log('   📋 Manifest stored at: Supabase system_settings (< 1KB)');
    console.log(`   🔗 Release URL: ${release.html_url}`);
    console.log(`   ⬇️  Download  : ${downloadUrl}`);
    console.log('\n   ✅ Client nodes will auto-detect & upgrade silently within 6 hours.');
}

publishRelease().catch(err => {
    console.error('❌ Unhandled Exception:', err.message || err);
    process.exit(1);
});
