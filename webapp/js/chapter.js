// Состояние приложения
const state = {
    currentFontSize: 18,
    currentTheme: 'light',
    settingsVisible: false,
    chapterContent: null,
    progress: 0,
    chapterId: null, // ID текущей главы
    novelId: null    // ID новеллы
};

// Получаем экземпляр WebApp
const tg = window.Telegram.WebApp;

// Защита контента
const ContentProtection = {
    init() {
        // Запрещаем выделение текста
        document.querySelector('.chapter-content').style.userSelect = 'none';
        
        // Блокируем сочетания клавиш
        document.addEventListener('keydown', (e) => {
            // Блокируем Ctrl+C, Ctrl+V, Ctrl+A
            if (e.ctrlKey && ['c', 'v', 'a'].includes(e.key.toLowerCase())) {
                e.preventDefault();
            }
            // Блокируем PrintScreen
            if (e.key === 'PrintScreen') {
                e.preventDefault();
            }
        });

        // Блокируем контекстное меню
        document.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });

        // Блокируем перетаскивание
        document.addEventListener('dragstart', (e) => {
            e.preventDefault();
        });
    }
};

// Менеджер настроек чтения
const SettingsManager = {
    async init() {
        await this.loadSavedSettings();
        this.initSettingsPanel();
        this.initFontSizeControls();
        this.initThemeControls();
    },

    async loadSavedSettings() {
        if (!tg.CloudStorage) {
            console.warn('CloudStorage is not available');
            return;
        }

        await new Promise((resolve) => {
            tg.CloudStorage.getItem('readingSettings', (error, value) => {
                if (error) {
                    console.error('Failed to load settings:', error);
                    resolve();
                    return;
                }
                
                if (value) {
                    try {
                        const settings = JSON.parse(value);
                        state.currentFontSize = settings.fontSize || 18;
                        state.currentTheme = settings.theme || 'light';
                        this.applyFontSize();
                        this.applyTheme();
                    } catch (e) {
                        console.error('Failed to parse settings:', e);
                    }
                }
                resolve();
            });
        });
    },

    saveSettings() {
        if (!tg.CloudStorage) return;

        const settings = {
            fontSize: state.currentFontSize,
            theme: state.currentTheme
        };

        tg.CloudStorage.setItem('readingSettings', JSON.stringify(settings), (error) => {
            if (error) {
                console.error('Failed to save settings:', error);
            }
        });
    },

    // ... остальные методы SettingsManager остаются теми же ...
};

// Менеджер прогресса чтения
const ProgressManager = {
    init() {
        this.initScrollProgress();
        // Загружаем сохраненный прогресс
        this.loadProgress();
    },

    initScrollProgress() {
        const progressBar = document.querySelector('.progress-bar');
        
        window.addEventListener('scroll', () => {
            const windowHeight = document.documentElement.clientHeight;
            const fullHeight = document.documentElement.scrollHeight - windowHeight;
            const scrolled = window.scrollY;
            
            const progress = Math.round((scrolled / fullHeight) * 100);
            progressBar.style.width = `${progress}%`;
            state.progress = progress;

            // Сохраняем прогресс при изменении
            this.saveProgress();
        });
    },

    async loadProgress() {
        if (!tg.CloudStorage) return;

        const key = `progress_${state.chapterId}`;
        await new Promise((resolve) => {
            tg.CloudStorage.getItem(key, (error, value) => {
                if (error) {
                    console.error('Failed to load progress:', error);
                    resolve();
                    return;
                }

                if (value) {
                    const savedProgress = parseInt(value);
                    if (!isNaN(savedProgress)) {
                        // Восстанавливаем позицию прокрутки
                        const fullHeight = document.documentElement.scrollHeight - window.innerHeight;
                        const scrollPosition = (savedProgress / 100) * fullHeight;
                        window.scrollTo(0, scrollPosition);
                    }
                }
                resolve();
            });
        });
    },

    saveProgress() {
        if (!tg.CloudStorage) return;

        const key = `progress_${state.chapterId}`;
        tg.CloudStorage.setItem(key, state.progress.toString(), (error) => {
            if (error) {
                console.error('Failed to save progress:', error);
            }
        });
    }
};

// Менеджер навигации
const NavigationManager = {
    init() {
        this.initChapterNavigation();
        this.setupBackButton();
    },

    initChapterNavigation() {
        const prevButton = document.getElementById('prevChapter');
        const nextButton = document.getElementById('nextChapter');

        // Получаем параметры из URL
        const urlParams = new URLSearchParams(window.location.search);
        state.chapterId = urlParams.get('chapterId');
        state.novelId = urlParams.get('novelId');

        if (prevButton) {
            prevButton.addEventListener('click', () => {
                // Здесь будет логика перехода к предыдущей главе
                tg.showPopup({
                    title: 'Переход к предыдущей главе',
                    message: 'Загрузка...',
                    buttons: [{type: 'ok'}]
                });
            });
        }

        if (nextButton) {
            nextButton.addEventListener('click', () => {
                // Здесь будет логика перехода к следующей главе
                tg.showPopup({
                    title: 'Переход к следующей главе',
                    message: 'Загрузка...',
                    buttons: [{type: 'ok'}]
                });
            });
        }
    },

    setupBackButton() {
        // Показываем кнопку "Назад" в шапке WebApp
        tg.BackButton.show();
        tg.BackButton.onClick(() => {
            // Возвращаемся на страницу новеллы
            window.location.href = `/novel.html?id=${state.novelId}`;
        });
    }
};

// Инициализация приложения
document.addEventListener('DOMContentLoaded', async function() {
    // Проверяем, что приложение запущено в Telegram
    if (!tg) {
        console.error('Telegram WebApp is not available');
        return;
    }

    tg.ready();
    tg.expand();

    // Применяем тему Telegram
    document.documentElement.className = tg.colorScheme;

    // Загрузка контента главы (пример)
    state.chapterContent = document.querySelector('.chapter-content');
    if (state.chapterContent) {
        state.chapterContent.innerHTML = `
            <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
            <p>Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>
            <p>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.</p>
            <p>Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</p>
        `;
    }

    // Инициализация менеджеров
    ContentProtection.init();
    await SettingsManager.init();
    NavigationManager.init();
    ProgressManager.init();
});
