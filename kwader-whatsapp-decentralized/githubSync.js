const { execSync: _execSync } = require('child_process');
const execSync = (cmd, opts) => _execSync(cmd, { windowsHide: true, ...opts });
const path = require('path');
const fs = require('fs');

const authDir = 'auth_info_baileys';

/**
 * Pulls the latest WhatsApp session from GitHub.
 * On failure (e.g., not a git repo, no internet), falls back silently
 * so the local session files are used.
 */
function pullSessionFromGithub() {
    // If local session already exists (credentialss.json), it's safe to skip GitHub pull.
    // This is the common case when the same node is restarting after being leader.
    const credsPath = path.join(authDir, 'creds.json');
    if (fs.existsSync(credsPath)) {
        const credsSize = fs.statSync(credsPath).size;
        if (credsSize > 100) {
            console.log('[GithubSync] Local session found, skipping GitHub pull to preserve existing session.');
            return Promise.resolve();
        }
    }

    return new Promise((resolve) => {
        try {
            console.log('[GithubSync] Pulling latest WhatsApp session from GitHub...');
            
            // Ensure we are in a git repository
            try {
                execSync('git status', { stdio: 'ignore', timeout: 5000 });
            } catch (e) {
                console.log('[GithubSync] Not a git repository or git not available. Using local session.');
                return resolve();
            }
            
            // Fetch latest
            try {
                execSync('git fetch origin', { stdio: 'ignore', timeout: 10000 });
            } catch (e) {
                console.log('[GithubSync] Git fetch failed (no internet?). Using local session.');
                return resolve();
            }
            
            // Try to checkout latest remote session
            try {
                execSync(`git checkout origin/master -- "${authDir}"`, { stdio: 'ignore', timeout: 5000 });
                console.log('[GithubSync] Successfully pulled session from GitHub.');
            } catch (checkoutErr) {
                console.log('[GithubSync] No remote session found or first time setup (first run). Using local session.');
            }
        } catch (e) {
            console.log('[GithubSync] Git pull skipped or failed:', e.message);
        }
        resolve();
    });
}

function pushSessionToGithub() {
    // Non-blocking: don't fail the calling flow if this errors
    try {
        if (!fs.existsSync(authDir)) return;
        
        console.log('[GithubSync] Pushing WhatsApp session to GitHub...');
        
        // Validate we're in a git repo
        try {
            execSync('git status', { stdio: 'ignore', timeout: 5000 });
        } catch (e) {
            console.log('[GithubSync] Not a git repo, skipping session push.');
            return;
        }
        
        // Add the auth directory
        try {
            execSync(`git add "${authDir}"`, { stdio: 'ignore', timeout: 5000 });
        } catch (e) {
            console.log('[GithubSync] git add failed:', e.message);
            return;
        }
        
        // Check if there are actual changes
        let status;
        try {
            status = execSync('git status --porcelain', { timeout: 5000 }).toString();
        } catch (e) {
            console.log('[GithubSync] git status failed:', e.message);
            return;
        }
        
        if (!status.includes(authDir)) {
            console.log('[GithubSync] No new session changes to push.');
            return;
        }

        // Commit and push
        try {
            execSync('git commit -m "Auto-sync WhatsApp session via Leader Node [skip ci]"', { stdio: 'ignore', timeout: 5000 });
            execSync('git push origin master', { stdio: 'ignore', timeout: 15000 });
            console.log('✅ [GithubSync] Successfully synced session to GitHub.');
        } catch (e) {
            console.error('[GithubSync] Error pushing to GitHub:', e.message);
        }
    } catch (e) {
        console.error('[GithubSync] Error pushing to GitHub:', e.message);
    }
}

module.exports = {
    pullSessionFromGithub,
    pushSessionToGithub
};
