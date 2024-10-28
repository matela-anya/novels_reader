let tg = window.Telegram.WebApp;

// Инициализация приложения
tg.expand();
tg.ready();

// Обработка темы Telegram
document.documentElement.className = tg.colorScheme;

let currentMode = 'reader';

function switchMode(mode) {
    currentMode = mode;
    updateContent();
}

function updateContent() {
    const content = document.getElementById('content');
    
    if (currentMode === 'reader') {
        content.innerHTML = `
            <h2>Читалка</h2>
            <div class="novels-list">
                <!-- Здесь будет список новелл -->
                <p>Режим читателя</p>
            </div>
        `;
    } else {
        content.innerHTML = `
            <h2>Кабинет переводчика</h2>
            <div class="translator-tools">
                <!-- Здесь будут инструменты переводчика -->
                <p>Режим переводчика</p>
            </div>
        `;
    }
}

// Инициализация начального контента
updateContent();
