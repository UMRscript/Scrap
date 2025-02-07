const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
    // Запуск браузера в не-головном режиме (видимом)
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    
    // Основной URL вики-страницы
    const baseUrl = 'https://bones.fandom.com/ru/wiki/%D0%9A%D0%BE%D1%81%D1%82%D0%B8_%D0%92%D0%B8%D0%BA%D0%B8';
    
    // Группы специалистов
    const groups = {
        "Специалисты_Джефферсона": [
            "Темперанс Бреннан",
            "Джек Ходжинс",
            "Энджела Монтенегро",
            "Кэмила Сероян",
            "Закари Урия Эдди"
        ],
        "ФБР": [
            "Сили Бут"
        ]
    };

    // Функция для перехода на главную страницу
    const goToHomePage = async () => {
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 100000000 });
    };

    // Функция для клика по группе персонажей
    const clickGroup = async (groupName) => {
        const element = await page.waitForSelector(`li[data-hash="${groupName}"] a`, { visible: true, timeout: 10000000 });
        await element.click();
        await page.waitForSelector('#firstHeading', { timeout: 100000000 });
    };

    // Функция для сбора данных с конкретной страницы персонажа
    const scrapeData = async (character, group) => {
        await page.waitForSelector(`a[title="${character}"]`);
        await page.click(`a[title="${character}"]`);
        await page.waitForSelector('#firstHeading', { timeout: 100000000 });
        
        // Извлечение заголовков и описаний
        const data = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('.mw-parser-output')).map((container, containerIndex) => ({
                containerIndex,
                titles: Array.from(container.querySelectorAll('h2, h3')).map((title, i) => `${containerIndex}.${i}: ${title.innerText.trim()}`),
                descriptions: Array.from(container.querySelectorAll('p')).map((desc, i) => `${containerIndex}.${i}: ${desc.innerText.trim()}`)
            }));
        });
        
        await goToHomePage(); // Возвращаемся на главную страницу
        return data.map(entry => ({ ...entry, group, character }));
    };

    // Создание директории для сохранения файлов, если она не существует
    const outputDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);
    
    // Генерация уникального имени файла с таймстампом
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = path.join(outputDir, `data_${timestamp}.json`);
    
    let allData = [];
    
    await goToHomePage(); // Начинаем с главной страницы

    // Проход по группам специалистов и сбор информации
    for (const [group, characters] of Object.entries(groups)) {
        await clickGroup(group); // Кликаем по группе
        for (const character of characters) {
            const characterData = await scrapeData(character, group);
            allData.push(...characterData);
        }
    }
    
    // Сохранение данных в JSON-файл
    fs.writeFileSync(filename, JSON.stringify(allData, null, 2), 'utf-8');
    console.log(`Данные сохранены в ${filename}`);
    
    // Закрытие браузера
    await browser.close();
})();
