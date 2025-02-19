const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
    // Запуск браузера с увеличенным таймаутом
    const browser = await puppeteer.launch({
        executablePath: '/usr/bin/google-chrome',
        headless: false,
        protocolTimeout: 40000000,
    });
    const page = await browser.newPage();


    // Отключаем ненужные факторы для быстрой загрузки сайта    
    // Включаем перехват запросов
    await page.setRequestInterception(true);

    page.on('request', (request) => {
        const url = request.url();
        const resourceType = request.resourceType();

        // Отключаем ненужные ресурсы
        if (resourceType === 'image' || resourceType === 'stylesheet' || resourceType === 'font' || resourceType === 'media') {
            request.abort();  // Прерываем загрузку
        } else {
            request.continue();  // Продолжаем загрузку других типов ресурсов
        }
    });

    // Основной URL
    const baseUrl = 'https://bones.fandom.com/ru/wiki/%D0%9A%D0%BE%D1%81%D1%82%D0%B8_%D0%92%D0%B8%D0%BA%D0%B8';

    // Группы персонажей
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
            "Дейзи Вик",
            "Колин Фишер",
            "Арасту Вазири"
        ],
        "Преступники": [
            "Макс Кинан",
            "Говард Эпс",
            "Гормогон",
            "Кристофер Пеллант"
        ]
        
    };

    const AllOthers = [
    "Алекс Радзивилл",
    "Анджела Монтенегро",
    "Артур Грейвс",
    "Бет Майер",
    "Венделл Брэй",
    "Винсент Найджел-Мюррей",
    "Гордон Гордон Уайт",
    "Грейсон Бараса",
    "Джаред Бут",
    "Джеймс Обри",
    "Джессика Уоррен",
    "Джеффри Ходжинс",
    "Зак Эдди",
    "Иосип Радик",
    "Кевин Холлингс",
    "Кристина Бут",
    "Кристофер Пелант",
    "Кэмилла Сароян",
    "Кэролайн Джулиан",
    "Марианна Бут",
    "Михир Рошан",
    "Падми Даладж",
    "Паркер Бут",
    "Рассел Бреннан",
    "Рокси Лайон",
    "Рут Кинан",
    "Рэй Баксли",
    "Сара Коскоф",
    "Томас Вега",
    "Тони",
    "Хэнк Бут Младший",
    "Эдвин Бут",
    "Эми Холлистер"
    ];

    // Функция с повторными попытками
    const retry = async (fn, retries = 3) => {
        for (let i = 0; i < retries; i++) {
            try {
                return await fn();
            } catch (error) {
                console.log(`Ошибка, попытка ${i + 1}...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        throw new Error("Не удалось выполнить действие после 3 попыток");
    };

    // Функция для перехода на главную страницу
    const goToHomePage = async () => {
        await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 0 });
    };

    // Функция для нажатия на "Персонажи"
    const clickCharactersButton = async () => {
        await retry(async () => {
            await page.waitForSelector('li[data-hash="Персонажи"] a', { visible: true });
            await page.click('li[data-hash="Персонажи"] a');
        });

        await new Promise(resolve => setTimeout(resolve, 2000));
        await page.waitForSelector('#firstHeading', { timeout: 100000 });
    };

    // Функция для выбора группы
    const clickGroup = async (groupName) => {
        await retry(async () => {
            await page.waitForSelector(`li[data-hash="${groupName}"] a`, { visible: true });
            await page.click(`li[data-hash="${groupName}"] a`);
        });
        await new Promise(resolve => setTimeout(resolve, 2000));
        await page.waitForSelector('#firstHeading', { timeout: 100000 });
    };

    // Функция сбора данных о персонаже
    const scrapeData = async (character, group) => {
        await retry(async () => {
            await page.waitForSelector(`a[title="${character}"]`, { visible: true });
            await page.click(`a[title="${character}"]`);
        });
        await new Promise(resolve => setTimeout(resolve, 2000));
        await page.waitForSelector('#firstHeading', { timeout: 100000 });

        // Получаем заголовки и описания
        const data = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('.mw-parser-output')).map((container, containerIndex) => ({
                containerIndex,
                titles: Array.from(container.querySelectorAll('h2, h3')).map((title, i) => `${containerIndex}.${i}: ${title.innerText.trim()}`),
                descriptions: Array.from(container.querySelectorAll('p')).map((desc, i) => `${containerIndex}.${i}: ${desc.innerText.trim()}`)
            }));
        });

        return data.map(entry => ({ ...entry, group, character }));
    };

    // Создание папки для сохранения
    const outputDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

    // Формирование имени файла
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = path.join(outputDir, `data_${timestamp}.json`);

    let allData = [];

    await goToHomePage(); // Переход на главную страницу

    // Перебираем группы и персонажей
    for (const [group, characters] of Object.entries(groups)) {
        await clickCharactersButton(); // Нажимаем "Персонажи"
        await clickGroup(group); // Выбираем группу

        for (const character of characters) {
            const characterData = await scrapeData(character, group);
            allData.push(...characterData);

            await goToHomePage(); // Возвращаемся на главную
            await clickCharactersButton(); // Нажимаем "Персонажи"
            await clickGroup(group); // Выбираем группу заново
        }
    }

    // Функция для перехода в "Категория:Прочие"
    const clickAllOthersCategory = async () => {
        await retry(async () => {
            await page.waitForSelector('li[data-hash="Персонажи"] a', { visible: true });
            await page.click('li[data-hash="Персонажи"] a');
        });

        await retry(async () => {
            await page.waitForSelector('li[data-hash="Прочие"] a', { visible: true });
            await page.click('li[data-hash="Прочие"] a');
        });

        await retry(async () => {
            await page.waitForSelector('a[title="Категория:Персонажи"]', { visible: true });
            await page.click('a[title="Категория:Персонажи"]');
        });

        await page.waitForSelector('#firstHeading', { timeout: 100000 });
    };

    await goToHomePage();
    await clickAllOthersCategory();

    for (const character of AllOthers) {
        const characterData = await scrapeData(character, "Прочие персонажи");
        allData.push(...characterData);

        await goToHomePage();
        await clickAllOthersCategory();
    }

    // Сохранение данных
    fs.writeFileSync(filename, JSON.stringify(allData, null, 2), 'utf-8');
    console.log(`Данные сохранены в ${filename}`);

    await browser.close(); // Закрытие браузера
})();
