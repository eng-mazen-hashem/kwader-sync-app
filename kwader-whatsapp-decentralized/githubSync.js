const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const authDir = 'auth_info_baileys';

function pullSessionFromGithub() {
    try {
        console.log('[GithubSync] Pulling latest WhatsApp session from GitHub...');
        
        // Ensure we are in a git repository
        execSync('git status', { stdio: 'ignore' });
        
        // Fetch latest
        execSync('git fetch origin', { stdio: 'ignore' });
        
        // If the folder doesn't exist remotely, this will throw, which is fine for first time
        try {
            execSync(`git checkout origin/main -- "${authDir}"`, { stdio: 'ignore' });
            console.log('[GithubSync] Successfully pulled session from GitHub.');
        } catch (checkoutErr) {
            console.log('[GithubSync] No remote session found or first time setup.');
        }
    } catch (e) {
        console.log('[GithubSync] Git pull skipped or failed:', e.message);
    }
}

function pushSessionToGithub() {
    try {
        if (!fs.existsSync(authDir)) return;
        
        console.log('[GithubSync] Pushing WhatsApp session to GitHub...');
        
        // Add the auth directory
        execSync(`git add "${authDir}"`, { stdio: 'ignore' });
        
        // Check if there are actual changes
        const status = execSync('git status --porcelain').toString();
        if (!status.includes(authDir)) {
            console.log('[GithubSync] No new session changes to push.');
            return;
        }

        // Commit and push
        execSync('git commit -m "Auto-sync WhatsApp session via Leader Node [skip ci]"', { stdio: 'ignore' });
        execSync('git push origin main', { stdio: 'ignore' });
        console.log('✅ [GithubSync] Successfully synced session to GitHub.');
    } catch (e) {
        console.error('[GithubSync] Error pushing to GitHub:', e.message);
    }
}

module.exports = {
    pullSessionFromGithub,
    pushSessionToGithub
};
