// Состояние приложения
const state = {
    currentFontSize: 18,
    currentTheme: 'light',
    settingsVisible: false,
    chapterContent: null, // Будет заполнено при загрузке
    progress: 0
};

// Менеджер настроек чтения
const SettingsManager = {
    init() {
        this.loadSavedSettings();
        this.initSettingsPanel();
        this.initFontSizeControls();
        this.initThemeControls();
    },

    loadSavedSettings() {
        const savedSettings = JSON.parse(localStorage.getItem('readingSettings') || '{}');
        state.currentFontSize = savedSettings.fontSize || 18;
        state.currentTheme = savedSettings.theme || 'light';
        
        // Применяем сохраненные настройки
        this.applyFontSize();
        this.applyTheme();
    },

    saveSettings() {
        const settings = {
            fontSize: state.currentFontSize,
            theme: state.currentTheme
        };
        localStorage.setItem('readingSettings', JSON.stringify(settings));
    },

    initSettingsPanel() {
        const settingsButton = document.getElementById('showSettings');
        const readingSettings = document.getElementById('readingSettings');

        settingsButton.addEventListener('click', () => {
            state.settingsVisible = !state.settingsVisible;
            readingSettings.classList.toggle('visible', state.settingsVisible);
        });
    },

    initFontSizeControls() {
        document.getElementById('increaseFontSize').addEventListener('click', () => {
            if (state.currentFontSize < 24) {
                state.currentFontSize += 2;
                this.applyFontSize();
            }
        });

        document.getElementById('decreaseFontSize').addEventListener('click', () => {
            if (state.currentFontSize > 14) {
                state.currentFontSize -= 2;
                this.applyFontSize();
            }
        });

        document.getElementById('resetFontSize').addEventListener('click', () => {
            state.currentFontSize = 18;
            this.applyFontSize();
        });
    },

    applyFontSize() {
        document.querySelector('.chapter-content').style.fontSize = `${state.currentFontSize}px`;
        this.saveSettings();
    },

    initThemeControls() {
        const themeButtons = document.querySelectorAll('.theme-controls .control-button');
        
        themeButtons.forEach(button => {
            button.addEventListener('click', () => {
                // Убираем активный класс у всех кнопок
                themeButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');

                // Определяем и применяем тему
                if (button.id === 'darkTheme') state.currentTheme = 'dark';
                else if (button.id === 'sepiaTheme') state.currentTheme = 'sepia';
                else state.currentTheme = 'light';

                this.applyTheme();
            });
        });
    },

    applyTheme() {
        document.body.classList.remove('dark-theme', 'sepia-theme');
        if (state.currentTheme !== 'light') {
            document.body.classList.add(`${state.currentTheme}-theme`);
        }
        this.saveSettings();
    }
};

// Менеджер навигации
const NavigationManager = {
    init() {
        this.initChapterNavigation();
    },

    initChapterNavigation() {
        const prevButton = document.getElementById('prevChapter');
        const nextButton = document.getElementById('nextChapter');

        prevButton.addEventListener('click', () => {
            // Здесь будет логика перехода к предыдущей главе
            if (window.Telegram && window.Telegram.WebApp) {
                window.Telegram.WebApp.showAlert('Переход к предыдущей главе');
            }
        });

        nextButton.addEventListener('click', () => {
            // Здесь будет логика перехода к следующей главе
            if (window.Telegram && window.Telegram.WebApp) {
                window.Telegram.WebApp.showAlert('Переход к следующей главе');
            }
        });
    }
};

// Менеджер прогресса чтения
const ProgressManager = {
    init() {
        this.initScrollProgress();
    },

    initScrollProgress() {
        const progressBar = document.querySelector('.progress-bar');
        
        window.addEventListener('scroll', () => {
            const windowHeight = document.documentElement.clientHeight;
            const fullHeight = document.documentElement.scrollHeight - windowHeight;
            const scrolled = window.scrollY;
            
            const progress = (scrolled / fullHeight) * 100;
            progressBar.style.width = `${progress}%`;
            state.progress = progress;

            // Сохраняем прогресс чтения
            this.saveProgress();
        });
    },

    saveProgress() {
        // Здесь будет логика сохранения прогресса чтения
        localStorage.setItem('chapterProgress', state.progress);
    }
};

// Инициализация приложения
document.addEventListener('DOMContentLoaded', function() {
    // Инициализация Telegram WebApp
    if (window.Telegram && window.Telegram.WebApp) {
        let tg = window.Telegram.WebApp;
        tg.ready();
        tg.expand();

        // Применяем тему Telegram
        document.documentElement.className = tg.colorScheme;
    }

    // Загрузка контента главы (пример)
    state.chapterContent = document.querySelector('.chapter-content');
    state.chapterContent.innerHTML = `
        <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
        <p>Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>
        <p>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.</p>
        <p>Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</p>
    `;

    // Инициализация менеджеров
    SettingsManager.init();
    NavigationManager.init();
    ProgressManager.init();
});
