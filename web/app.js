let tg = window.Telegram.WebApp;
tg.expand();
tg.ready();

// Применяем тему Telegram
document.documentElement.className = tg.colorScheme;

// Обработка переключения табов
const tabs = document.querySelectorAll('.tg-tab');
let currentMode = 'reader';

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        // Убираем активный класс у всех табов
        tabs.forEach(t => t.classList.remove('active'));
        // Добавляем активный класс выбранному табу
        tab.classList.add('active');
        // Обновляем контент
        currentMode = tab.dataset.mode;
        updateContent();
    });
});

function updateContent() {
    const content = document.getElementById('content');
    
    if (currentMode === 'reader') {
        content.innerHTML = `
            <div class="tg-card">
                <h3>Популярные новеллы</h3>
                <p>Здесь будет список популярных новелл</p>
            </div>
            <div class="tg-card">
                <h3>Продолжить чтение</h3>
                <p>Здесь будут новеллы, которые вы читаете</p>
            </div>
        `;
    } else {
        content.innerHTML = `
            <div class="tg-card">
                <h3>Мои переводы</h3>
                <p>Здесь будет список ваших переводов</p>
            </div>
            <div class="tg-card">
                <h3>Статистика</h3>
                <p>Здесь будет статистика ваших переводов</p>
            </div>
        `;
    }
}

// Инициализация начального контента
updateContent();
