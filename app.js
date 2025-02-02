const puppeteer = require('puppeteer');

(async () => {
    // Запускаем браузер
    const browser = await puppeteer.launch({ headless: false }); 
    const page = await browser.newPage();

    // Переходим на сайт
    await page.goto('https://bones.fandom.com/ru/wiki/%D0%9A%D0%BE%D1%81%D1%82%D0%B8_%D0%92%D0%B8%D0%BA%D0%B8', { waitUntil: 'load', timeout: 120000 });

    // Нажимаем на элемент
    await page.click('.page > .tabber wds-tabber > .ls-is-cached lazyloaded');

    // Ждём загрузки новой страницы
    await page.waitForSelector('CSS_СЕЛЕКТОР_ЗАГОЛОВКОВ');

    // Получаем заголовки и описания
    const data = await page.evaluate(() => {
        const items = [];
        document.querySelectorAll('CSS_СЕЛЕКТОР_БЛОКА').forEach(block => {
            const title = block.querySelector('CSS_СЕЛЕКТОР_ЗАГОЛОВКА')?.innerText.trim() || 'Нет заголовка';
            const description = block.querySelector('CSS_СЕЛЕКТОР_ОПИСАНИЯ')?.innerText.trim() || 'Нет описания';
            items.push({ title, description });
        });
        return items;
    });

    console.log(data);

    // Закрываем браузер
    await browser.close();
})();
