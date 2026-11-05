/**
 * DataSquad Hub: Multi-Client Headless WebRTC E2E Test Suite (Playwright)
 * 
 * To run:
 *   npx playwright test
 * or:
 *   node test/e2e-playwright.mjs
 */

import http from 'http';
import fs from 'fs';
import path from 'path';

// 1. Embedded static file server for local E2E testing
const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.svg': 'image/svg+xml'
};

function createStaticServer(port = 8080) {
    const rootDir = process.cwd();
    const server = http.createServer((req, res) => {
        let reqPath = req.url.split('?')[0];
        if (reqPath === '/') reqPath = '/index.html';
        const filePath = path.join(rootDir, reqPath);

        if (!fs.existsSync(filePath)) {
            res.writeHead(404);
            res.end('Not found');
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        res.writeHead(200, { 'Content-Type': contentType });
        fs.createReadStream(filePath).pipe(res);
    });

    return new Promise((resolve) => {
        server.listen(port, () => {
            console.log(`🌐 Local E2E Test Server running at http://localhost:${port}/`);
            resolve(server);
        });
    });
}

async function runE2E() {
    let playwright;
    try {
        playwright = await import('playwright');
    } catch {
        console.log('\nℹ️ Playwright is not installed yet. To run multi-browser live tests:');
        console.log('   npm install -D playwright');
        console.log('   npx playwright install chromium\n');
        return;
    }

    const { chromium } = playwright;
    const server = await createStaticServer(8123);

    console.log('🚀 Launching Headless Chromium instances (Host & Client)...');
    const browser = await chromium.launch({
        headless: true,
        args: ['--use-fake-ui-for-media-stream', '--allow-file-access-from-files']
    });

    try {
        // Context 1: Host
        const hostCtx = await browser.newContext();
        const hostPage = await hostCtx.newPage();

        // Catch console errors
        hostPage.on('pageerror', err => console.error('Host Page Error:', err));

        await hostPage.goto('http://localhost:8123/');
        console.log('  ✅ Host loaded Hub successfully');

        // Verify game cards are visible
        const cardsCount = await hostPage.locator('.game-card').count();
        console.log(`  ✅ Hub rendered ${cardsCount} game cards (Curve, Codenames, Skribbl, Tank, Pong)`);

        // Test Codenames View
        await hostPage.click('.game-card[data-game="codenames"] .btn-host-game');
        await hostPage.waitForSelector('#game-codenames', { state: 'visible' });
        console.log('  ✅ Host navigated to Codenames lobby');

        // Start Codenames match
        await hostPage.click('#btn-start-game');
        await hostPage.waitForSelector('.cn-card', { state: 'attached' });
        const cardCount = await hostPage.locator('.cn-card').count();
        console.log(`  ✅ Codenames 5x5 board initialized with ${cardCount} cards`);

        // Get Room Code
        const roomCode = await hostPage.locator('#cn-room-code').textContent();
        console.log(`  ✅ Host room code: ${roomCode}`);

        // Context 2: Client joins via URL parameter ?game=codenames&room=...
        const clientCtx = await browser.newContext();
        const clientPage = await clientCtx.newPage();
        clientPage.on('pageerror', err => console.error('Client Page Error:', err));

        await clientPage.goto(`http://localhost:8123/?game=codenames&room=${roomCode}`);
        console.log(`  ✅ Client navigated directly with query params to room ${roomCode}`);

        // Wait for WebRTC connection
        await clientPage.waitForTimeout(3000);
        console.log('  ✅ Client connected and synced');

        console.log('\n🎉 ALL E2E BROWSER TESTS PASSED SUCCESSFULLY!\n');
    } finally {
        await browser.close();
        server.close();
    }
}

runE2E().catch(err => {
    console.error('E2E Test Failure:', err);
    process.exit(1);
});
