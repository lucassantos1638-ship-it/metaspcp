const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();

    // Capturar todos os logs de console
    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));

    // Capturar erros do react e página
    page.on('pageerror', err => console.log('BROWSER ERROR:', err.toString()));

    console.log("Acessando a página local...");
    try {
        // Acesse o painel. Vamos bater direto na página 1 de lote, ou na home pra ver se carrega.
        await page.goto('http://localhost:5173', { waitUntil: 'networkidle2', timeout: 8000 });
        console.log("Página carregada sem crash de servidor.");
    } catch (e) {
        console.log("Erro ao carregar URL:", e.message);
    }

    await browser.close();
})();
