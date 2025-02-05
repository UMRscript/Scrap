const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    await page.goto('https://bones.fandom.com/ru/wiki/%D0%9A%D0%BE%D1%81%D1%82%D0%B8_%D0%92%D0%B8%D0%BA%D0%B8', { waitUntil: 'domcontentloaded', timeout: 120000 });

    await page.waitForSelector('a[title="Темперанс Бреннан"]');
    await page.click('a[title="Темперанс Бреннан"]');

    await page.waitForSelector('#firstHeading');

    const data = await page.evaluate(() => {
        const results = [];
        document.querySelectorAll('.mw-parser-output').forEach((container, containerIndex) => { 
            const titles = [];
            const descriptions = [];

            container.querySelectorAll('h2, h3').forEach((title, i) => {
                titles.push(`${containerIndex}.${i}: ${title.innerText.trim()}`);
            });

            container.querySelectorAll('p').forEach((desc, i) => {
                descriptions.push(`${containerIndex}.${i}: ${desc.innerText.trim()}`);
            });

            results.push({ containerIndex, titles, descriptions });
        });
        return results;
    });

    // Создаём папку для файлов, если она не существует
    const outputDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
    }

    // Генерируем уникальное имя файла с таймстампом
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = path.join(outputDir, `data_${timestamp}.json`);

    fs.writeFileSync(filename, JSON.stringify(data, null, 2), 'utf-8');

    console.log(`Данные сохранены в ${filename}`);

    await browser.close();
})();
