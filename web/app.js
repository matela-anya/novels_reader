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
            <div class="tg-section">
                <div class="tg-card">
                    <div class="tg-card-header">
                        <h3>Мои подписки</h3>
                    </div>
                    <div class="tg-card-content">
                        <div class="novel-item">
                            <div class="novel-info">
                                <h4>Возрождение после смерти</h4>
                                <p>Последняя глава: 156</p>
                            </div>
                            <button class="tg-button">Читать</button>
                        </div>
                        <div class="novel-item">
                            <div class="novel-info">
                                <h4>Монарх упадка</h4>
                                <p>Последняя глава: 89</p>
                            </div>
                            <button class="tg-button">Читать</button>
                        </div>
                    </div>
                </div>

                <div class="tg-card">
                    <div class="tg-card-header">
                        <h3>Новые главы</h3>
                    </div>
                    <div class="tg-card-content">
                        <div class="chapter-item">
                            <div class="chapter-info">
                                <h4>Глава 156: Начало конца</h4>
                                <p>Возрождение после смерти</p>
                            </div>
                            <span class="chapter-date">Сегодня</span>
                        </div>
                        <div class="chapter-item">
                            <div class="chapter-info">
                                <h4>Глава 89: Последний бой</h4>
                                <p>Монарх упадка</p>
                            </div>
                            <span class="chapter-date">Вчера</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    } else {
        content.innerHTML = `
            <div class="tg-section">
                <div class="tg-card">
                    <div class="tg-card-header">
                        <h3>Мои переводы</h3>
                    </div>
                    <div class="tg-card-content">
                        <div class="novel-item">
                            <div class="novel-info">
                                <h4>Возрождение после смерти</h4>
                                <p>Активных читателей: 1.2K</p>
                            </div>
                            <button class="tg-button">Редактировать</button>
                        </div>
                    </div>
                </div>

                <div class="tg-card">
                    <div class="tg-card-header">
                        <h3>Статистика</h3>
                    </div>
                    <div class="tg-card-content">
                        <div class="chapter-item">
                            <div class="chapter-info">
                                <h4>Всего подписчиков</h4>
                                <p>1,543</p>
                            </div>
                        </div>
                        <div class="chapter-item">
                            <div class="chapter-info">
                                <h4>Глав переведено</h4>
                                <p>156</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
}

// Инициализация начального контента
updateContent();

// Обработка ошибок
window.addEventListener('error', function(e) {
    console.error('Error:', e.error);
    const content = document.getElementById('content');
    content.innerHTML = `
        <div class="error">
            Произошла ошибка. Пожалуйста, попробуйте позже.
        </div>
    `;
});
