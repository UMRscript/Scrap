const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
    const browser = await puppeteer.launch({
        headless: false,
        protocolTimeout: 40000000
    });
    const page = await browser.newPage();

    // Повторение попыток достучаться до нужного селектора
    const retry = async (fn, retries = 3) => {
        for (let i = 0; i < retries; i++) {
            try {
                return await fn();
            } catch (error) {
                console.log(`⚠️ Ошибка: ${error.message}. Попытка ${i + 1} из ${retries}...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        throw new Error("❌ Не удалось выполнить действие после нескольких попыток!");
    };

    // 🔹 Блокируем загрузку ненужных ресурсов
    await page.setRequestInterception(true);
    page.on('request', (request) => {
        const blockTypes = ['image', 'font', 'media', 'stylesheet'];
        if (blockTypes.includes(request.resourceType())) {
            request.abort();
        } else {
            request.continue();
        }
    });

    const baseUrl = 'https://bones.fandom.com/ru/wiki/%D0%9A%D0%BE%D1%81%D1%82%D0%B8_%D0%92%D0%B8%D0%BA%D0%B8';

    // Оптимизация страницы (удаление лишних элементов)
    const optimizePage = async () => {
        await page.evaluate(() => {
            // Удаляем рекламу и ненужные элементы
            const elementsToRemove = [
                'div[id^="ad-"]',  // Блоки с рекламой
                '.ads', 
                '.advertisement',
                '.sidebar',  // Боковые панели
                '.rail', 
                'footer',  // Футер
                'video',   // Видео
                'iframe'   // Встроенные блоки (YouTube и т.д.)
            ];
            elementsToRemove.forEach(selector => {
                document.querySelectorAll(selector).forEach(el => el.remove());
            });

            // Отключаем анимации и переходы
            const style = document.createElement('style');
            style.innerHTML = '* { animation: none !important; transition: none !important; }';
            document.head.appendChild(style);
        });
        console.log("✅ Страница оптимизирована!");
    };

    // Доходим до нужного контента 
    const clickAnother = async () => {
        await retry(async () => {
            const selectors = [
                'li[data-hash="Персонажи"] a',
                'li[data-hash="Прочие"] a',
                'a[title="Категория:Персонажи"]'
            ];
            
            for (const selector of selectors) {
                await page.waitForSelector(selector, { visible: true });
                await page.click(selector);
            }
        }, 3);
    };

    // Работа с сохранением данных в json файл
    const scrapeData = async () => {
        await retry(async () => {
            await page.waitForSelector('#firstHeading', { timeout: 10000 });

            const data = await page.evaluate(() => {
                const heading = document.querySelector("#firstHeading");
                return heading ? heading.innerText.trim() : null;
            });

            if (!data) throw new Error("Не удалось найти заголовок!");

            const now = new Date();
            const formattedDate = now.toISOString().replace(/:/g, '-');
            const dirPath = path.join(__dirname, 'source');

            if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });

            const filePath = path.join(dirPath, `data_${formattedDate}.json`);
            fs.writeFileSync(filePath, JSON.stringify({ title: data, date: formattedDate }, null, 2), 'utf-8');

            console.log(`✅ Данные успешно сохранены в: ${filePath}`);
        }, 3);
    };

    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await optimizePage(); // ⚡ Оптимизируем страницу
    await clickAnother();
    await scrapeData();

    try {
        await browser.close();
        console.log("🛑 Браузер закрыт");
    } catch (error) {
        console.error("❌ Ошибка при закрытии браузера:", error);
    }
})();
