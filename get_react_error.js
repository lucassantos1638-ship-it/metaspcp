import puppeteer from 'puppeteer';

(async () => {
    try {
        const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();

        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log('BROWSER CONSOLE ERROR:', msg.text());
            }
        });

        page.on('pageerror', err => {
            console.log('BROWSER PAGE ERROR:', err.toString());
        });

        console.log('Navigating to local server...');
        await page.goto('http://localhost:8000/lotes/afab90cf-82b7-4316-ada4-3a904c55c18c', { waitUntil: 'networkidle0', timeout: 15000 });

        // Esperar um pouco pelo render do componente async
        await new Promise(r => setTimeout(r, 4000));
        console.log('[Puppeteer] Test concluded.');

        await browser.close();
    } catch (err) {
        console.error('Puppeteer Failed:', err);
        process.exit(1);
    }
})();
