const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const workspaceRoot = path.resolve(__dirname, '..', '..');
const resolveFromRoot = (...segments) => path.join(workspaceRoot, ...segments);

const requiredPaths = [
    'README.md',
    'server.js',
    'ecosystem.config.js',
    'backend/server.js',
    'backend/config/db.js',
    'database/init.sql',
    'database/tenantTablePolicy.js',
    'operations/jobs/databaseBackup.js',
    'operations/scripts/test-backend.js',
    'frontend/package.json',
    'frontend/vercel.json',
    'docs/GYMVAULT.md',
    'docs/PRODUCTION_RESTART_RUNBOOK.md',
];

for (const relativePath of requiredPaths) {
    assert.equal(fs.existsSync(resolveFromRoot(relativePath)), true, `Required repository path is missing: ${relativePath}`);
}

for (const retiredRootDirectory of ['config', 'jobs', 'middleware', 'routes', 'scripts', 'utils']) {
    assert.equal(
        fs.existsSync(resolveFromRoot(retiredRootDirectory)),
        false,
        `Legacy root directory must not return: ${retiredRootDirectory}/`
    );
}

const packageJson = JSON.parse(fs.readFileSync(resolveFromRoot('package.json'), 'utf8'));
for (const [scriptName, command] of Object.entries(packageJson.scripts || {})) {
    const nodeTarget = String(command).match(/^node\s+([^\s]+)/)?.[1];
    if (!nodeTarget) continue;

    assert.equal(
        fs.existsSync(resolveFromRoot(nodeTarget)),
        true,
        `npm script ${scriptName} points to a missing file: ${nodeTarget}`
    );
}

const ecosystem = require(resolveFromRoot('ecosystem.config.js'));
for (const app of ecosystem.apps || []) {
    assert.equal(
        fs.existsSync(resolveFromRoot(app.script)),
        true,
        `PM2 app ${app.name || 'unnamed'} points to a missing script: ${app.script}`
    );
}

const rootServer = fs.readFileSync(resolveFromRoot('server.js'), 'utf8');
assert.match(rootServer, /require\(['"]\.\/backend\/server['"]\)/, 'Root server entry must delegate to backend/server.js.');

const gitignoreLines = new Set(
    fs.readFileSync(resolveFromRoot('.gitignore'), 'utf8')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
);
for (const ignoredPath of ['.env', 'node_modules/', 'dist/', 'uploads/', 'backups/']) {
    assert.equal(gitignoreLines.has(ignoredPath), true, `.gitignore must include ${ignoredPath}`);
}

console.log(`Repository layout checks passed for ${requiredPaths.length} required paths and ${Object.keys(packageJson.scripts || {}).length} npm commands.`);
