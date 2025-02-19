const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Класс для работы с браузером
class Browser {
    constructor() {
        this.browser = null;
        this.page = null;
    }

    // Запуск браузера с увеличенным таймаутом
    async launch() {
        this.browser = await puppeteer.launch({
            executablePath: '/usr/bin/google-chrome',
            headless: false,
            protocolTimeout: 40000000,
        });
        this.page = await this.browser.newPage();
        await this.setupRequestInterception();
    }

    // Настройка перехвата запросов
    async setupRequestInterception() {
        await this.page.setRequestInterception(true);
        this.page.on('request', (request) => {
            const resourceType = request.resourceType();

            // Отключаем ненужные ресурсы
            if (resourceType === 'image' || resourceType === 'stylesheet' || resourceType === 'font' || resourceType === 'media') {
                request.abort();  // Прерываем загрузку
            } else {
                request.continue();  // Продолжаем загрузку других типов ресурсов
            }
        });
    }

    // Закрытие браузера
    async close() {
        await this.browser.close();
    }
}

// Класс для работы с веб-страницей
class WebPage {
    constructor(page) {
        this.page = page;
    }

    // Переход на главную страницу
    async goToHomePage(baseUrl) {
        await this.page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 0 });
    }

    // Нажатие на "Персонажи"
    async clickCharactersButton() {
        await retry(async () => {
            await this.page.waitForSelector('li[data-hash="Персонажи"] a', { visible: true });
            await this.page.click('li[data-hash="Персонажи"] a');
        });

        await new Promise(resolve => setTimeout(resolve, 2000));
        await this.page.waitForSelector('#firstHeading', { timeout: 100000 });
    }

    // Выбор группы
    async clickGroup(groupName) {
        await retry(async () => {
            await this.page.waitForSelector(`li[data-hash="${groupName}"] a`, { visible: true });
            await this.page.click(`li[data-hash="${groupName}"] a`);
        });
        await new Promise(resolve => setTimeout(resolve, 2000));
        await this.page.waitForSelector('#firstHeading', { timeout: 100000 });
    }

    // Сбор данных о персонаже
    async scrapeData(character, group) {
        await retry(async () => {
            await this.page.waitForSelector(`a[title="${character}"]`, { visible: true });
            await this.page.click(`a[title="${character}"]`);
        });
        await new Promise(resolve => setTimeout(resolve, 2000));
        await this.page.waitForSelector('#firstHeading', { timeout: 100000 });

        // Получаем заголовки и описания
        const data = await this.page.evaluate(() => {
            return Array.from(document.querySelectorAll('.mw-parser-output')).map((container, containerIndex) => ({
                containerIndex,
                titles: Array.from(container.querySelectorAll('h2, h3')).map((title, i) => `${containerIndex}.${i}: ${title.innerText.trim()}`),
                descriptions: Array.from(container.querySelectorAll('p')).map((desc, i) => `${containerIndex}.${i}: ${desc.innerText.trim()}`)
            }));
        });

        return data.map(entry => ({ ...entry, group, character }));
    }

    // Переход в "Категория:Прочие"
    async clickAllOthersCategory() {
        await retry(async () => {
            await this.page.waitForSelector('li[data-hash="Персонажи"] a', { visible: true });
            await this.page.click('li[data-hash="Персонажи"] a');
        });

        await retry(async () => {
            await this.page.waitForSelector('li[data-hash="Прочие"] a', { visible: true });
            await this.page.click('li[data-hash="Прочие"] a');
        });

        await retry(async () => {
            await this.page.waitForSelector('a[title="Категория:Персонажи"]', { visible: true });
            await this.page.click('a[title="Категория:Персонажи"]');
        });

        await this.page.waitForSelector('#firstHeading', { timeout: 100000 });
    }
}

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

// Класс для сохранения данных в файл
class DataSaver {
    constructor() {
        this.outputDir = path.join(__dirname, 'output');
        if (!fs.existsSync(this.outputDir)) fs.mkdirSync(this.outputDir);
    }

    // Сохранение данных в файл
    saveData(data) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = path.join(this.outputDir, `data_${timestamp}.json`);
        fs.writeFileSync(filename, JSON.stringify(data, null, 2), 'utf-8');
        console.log(`Данные сохранены в ${filename}`);
    }
}

// Основная функция
(async () => {
    const browser = new Browser();
    await browser.launch();

    const page = new WebPage(browser.page);

    // Основной URL
    const baseUrl = 'https://bones.fandom.com/ru/wiki/%D0%9A%D0%BE%D1%81%D1%82%D0%B8_%D0%92%D0%B8%D0%BA%D0%B8';

    let allData = [];

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

    const Seasons = {
        "1": [
        'Пилотный эпизод',
        'Человек в внедорожнике',
        'Мальчик на дереве',
        'Человек в медведе',
        'Мальчик в кустах',
        'Человек в стене',
        'Смертник',
        'Девушка в холодильнике',
        'Человек в бомбоубежище',
        'Женщина в аэропорту',
        'Женщина в машине',
        'Супергерой в переулке',
        'Женщина в саду',
        'Мужчина на поле для гольфа',
        'Два тела в лаборатории',
        'Женщина в туннеле',
        'Череп в пустыне',
        'Мужчина с костью',
        'Мужчина в морге',
        'Прививка в девочке',
        'Солдат на могиле',
        'Женщина в лимбе'
        ],
        "2": [

        ],
        "3": [

        ],
        "4": [

        ],
        "5": [

        ],
        "6": [

        ],
        "7": [

        ],
        "8": [

        ],
        "9": [

        ],
        "10": [

        ],
        "11": [

        ],
        "12": [

        ]
    };

    const dataSaver = new DataSaver();

    // Переход на главную страницу
    await page.goToHomePage(baseUrl);

    // Перебираем группы и персонажей
    for (const [group, characters] of Object.entries(groups)) {
        await page.clickCharactersButton(); // Нажимаем "Персонажи"
        await page.clickGroup(group); // Выбираем группу

        for (const character of characters) {
            const characterData = await page.scrapeData(character, group);
            allData.push(...characterData);

            await page.goToHomePage(baseUrl); // Возвращаемся на главную
            await page.clickCharactersButton(); // Нажимаем "Персонажи"
            await page.clickGroup(group); // Выбираем группу заново
        }
    }

    // Переход в "Категория:Прочие"
    await page.goToHomePage(baseUrl);
    await page.clickAllOthersCategory();

    for (const character of AllOthers) {
        const characterData = await page.scrapeData(character, "Прочие персонажи");
        allData.push(...characterData);

        await page.goToHomePage(baseUrl);
        await page.clickAllOthersCategory();
    }

    // Сохранение данных
    dataSaver.saveData(allData);

    await browser.close(); // Закрытие браузера
})();
