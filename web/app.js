let tg = window.Telegram.WebApp;

// Инициализация приложения
tg.expand();
tg.ready();

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
            </div>
        `;
    } else {
        content.innerHTML = `
            <h2>Кабинет переводчика</h2>
            <div class="translator-tools">
                <!-- Здесь будут инструменты переводчика -->
            </div>
        `;
    }
}

// Инициализация начального контента
updateContent();
