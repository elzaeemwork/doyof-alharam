const { spawnSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const https = require('https');

// 1. Fetch GitHub token automatically from Git Credential Manager or env
let token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
if (!token) {
    try {
        const cred = spawnSync('git', ['credential', 'fill'], {
            input: 'protocol=https\nhost=github.com\n\n',
            encoding: 'utf8'
        });
        const match = cred.stdout && cred.stdout.match(/password=(.+)/);
        if (match && match[1]) {
            token = match[1].trim();
        }
    } catch (e) {
        console.warn('Could not read from git credential helper:', e.message);
    }
}

if (!token) {
    console.error('❌ Error: GitHub Token could not be found.');
    process.exit(1);
}

console.log('✅ GitHub Token detected successfully.');
process.env.GH_TOKEN = token;
process.env.GITHUB_TOKEN = token;

const pkg = require('./package.json');
const currentVersion = pkg.version;
console.log(`📦 Publishing Release for version: v${currentVersion}`);

// 2. Run electron-builder publish
console.log('🚀 Building Windows package and publishing to GitHub Releases...');
const builder = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', [
    'electron-builder',
    'build',
    '--win',
    '--publish',
    'always'
], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, GH_TOKEN: token, GITHUB_TOKEN: token }
});

builder.on('close', async (code) => {
    if (code !== 0) {
        console.error('❌ Build/Publish failed with code ' + code);
        process.exit(code);
    }
    console.log('🎉 Windows release uploaded successfully!');

    try {
        await finalizeReleaseAndUploadApk(token, currentVersion);
        console.log('\n✨ All updates published to GitHub Releases successfully!');
    } catch (err) {
        console.warn('⚠️ Finalizing release note:', err.message);
    }
});

function finalizeReleaseAndUploadApk(authToken, version) {
    return new Promise((resolve, reject) => {
        // Find release by version/tag
        const req = https.request({
            hostname: 'api.github.com',
            path: '/repos/elzaeemwork/doyof-alharam/releases',
            headers: {
                'Authorization': 'token ' + authToken,
                'User-Agent': 'Antigravity-Publisher',
                'Accept': 'application/vnd.github.v3+json'
            }
        }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', async () => {
                if (res.statusCode >= 400) {
                    return reject(new Error('Failed to list releases: ' + res.statusCode));
                }
                const releases = JSON.parse(data);
                const release = releases.find(r => r.tag_name === `v${version}` || r.tag_name === version) || releases[0];
                if (!release) {
                    return reject(new Error('Release not found for version: ' + version));
                }

                // Upload Android APK if present
                const apkPath = path.join(__dirname, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
                if (fs.existsSync(apkPath)) {
                    console.log('📱 Uploading Android APK to release...');
                    try {
                        await uploadFileToRelease(authToken, release.id, apkPath, 'doyof-alharam.apk', 'application/vnd.android.package-archive');
                        console.log('✅ Android APK attached to release successfully!');
                    } catch (e) {
                        console.warn('⚠️ Android APK upload note:', e.message);
                    }
                }

                // If draft, make it public
                if (release.draft) {
                    console.log('📢 Publishing release (setting public)...');
                    const patchReq = https.request({
                        hostname: 'api.github.com',
                        path: `/repos/elzaeemwork/doyof-alharam/releases/${release.id}`,
                        method: 'PATCH',
                        headers: {
                            'Authorization': 'token ' + authToken,
                            'User-Agent': 'Antigravity-Publisher',
                            'Content-Type': 'application/json'
                        }
                    }, (patchRes) => {
                        console.log('✅ Release is now public and live!');
                        resolve();
                    });
                    patchReq.write(JSON.stringify({ draft: false }));
                    patchReq.end();
                } else {
                    console.log('✅ Release is already public.');
                    resolve();
                }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

function uploadFileToRelease(authToken, releaseId, filePath, assetName, contentType) {
    return new Promise((resolve, reject) => {
        const stat = fs.statSync(filePath);
        const fileStream = fs.createReadStream(filePath);
        const req = https.request({
            hostname: 'uploads.github.com',
            path: `/repos/elzaeemwork/doyof-alharam/releases/${releaseId}/assets?name=${assetName}`,
            method: 'POST',
            headers: {
                'Authorization': 'token ' + authToken,
                'User-Agent': 'Antigravity-Publisher',
                'Content-Type': contentType,
                'Content-Length': stat.size
            }
        }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                if (res.statusCode >= 400) {
                    return reject(new Error(`Upload failed: ${res.statusCode} ${data}`));
                }
                resolve(JSON.parse(data));
            });
        });
        req.on('error', reject);
        fileStream.pipe(req);
    });
}
