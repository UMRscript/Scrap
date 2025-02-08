const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
    // Запуск браузера в видимом режиме
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    // Основной URL страницы
    const baseUrl = 'https://bones.fandom.com/ru/wiki/%D0%9A%D0%BE%D1%81%D1%82%D0%B8_%D0%92%D0%B8%D0%BA%D0%B8';

    // Группы персонажей и их имена
    const groups = {
        "Специалисты_Джефферсона": [
            "Темперанс Бреннан",
            "Джек Ходжинс",
            "Энджела Монтенегро",
            "Кэмила Сероян",
            "Закари Урия Эдди"
        ],
        "ФБР": [
            "Сили Бут",
            "Лэнс Свитс",
            "Тим Салливан",
            "Пэйтон Перотта",
            "Дженни Шоу",
            "Сэм Каллен"
        ],
        "Интерны_Джефферсона": [
            "Кларк Эдисон",
            "Винсент Мюррей",
            "Вэндал Брэй",
            "Финн Абернети",
            "Дэйзи Вик",
            "Колин Фишер",
            "Абрасту Вазири"
        ],
        "Преступники": [
            "Макс Кинан",
            "Говард Эпс",
            "Гормогон",
            "Кристофер Пеллант"
        ],
        "Прочие": [
            "Джаред Бут",
            "Паркер Бут",
            "Гордон Гордон Уайт",
            "Кэролайн Джулиан",
            "Расселл Бреннан",
            "Рэй Баксли"
        ],

    };

    // Функция для перехода на главную страницу
    const goToHomePage = async () => {
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 100000 });
    };

    // Функция для клика по группе персонажей
    const clickGroup = async (groupName) => {
        await page.waitForSelector(`li[data-hash="${groupName}"] a`, { visible: true });
        await page.click(`li[data-hash="${groupName}"] a`);
        await page.waitForSelector('#firstHeading', { timeout: 100000 });
    };

    // Функция для сбора данных о персонаже
    const scrapeData = async (character, group) => {
        // Ждём появления ссылки на персонажа и кликаем по ней
        await page.waitForSelector(`a[title="${character}"]`, { visible: true });
        await page.click(`a[title="${character}"]`);
        await page.waitForSelector('#firstHeading', { timeout: 100000 });

        // Извлекаем заголовки и описания
        const data = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('.mw-parser-output')).map((container, containerIndex) => ({
                containerIndex,
                titles: Array.from(container.querySelectorAll('h2, h3')).map((title, i) => `${containerIndex}.${i}: ${title.innerText.trim()}`),
                descriptions: Array.from(container.querySelectorAll('p')).map((desc, i) => `${containerIndex}.${i}: ${desc.innerText.trim()}`)
            }));
        });

        // Добавляем информацию о группе и имени персонажа
        return data.map(entry => ({ ...entry, group, character }));
    };

    // Создание папки для хранения данных, если её нет
    const outputDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

    // Формирование имени файла с текущей датой
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = path.join(outputDir, `data_${timestamp}.json`);

    let allData = [];

    await goToHomePage(); // Открываем главную страницу

    // Перебираем все группы и их персонажей
    for (const [group, characters] of Object.entries(groups)) {
        await clickGroup(group); // Кликаем по группе

        for (const character of characters) {
            const characterData = await scrapeData(character, group); // Собираем данные персонажа
            allData.push(...characterData);

            await goToHomePage();  // Возвращаемся на главную страницу
            await clickGroup(group); // Заново кликаем на группу, чтобы найти следующего персонажа
        }
    }

    // Сохраняем данные в JSON-файл
    fs.writeFileSync(filename, JSON.stringify(allData, null, 2), 'utf-8');
    console.log(`Данные сохранены в ${filename}`);

    await browser.close(); // Закрываем браузер
})();
