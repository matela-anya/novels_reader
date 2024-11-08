import api from './api.js';
import storage from './storage.js';

/**
 * Класс для страницы чтения главы
 */
class ChapterPage {
    constructor() {
        // Инициализация Telegram WebApp
        this.telegram = window.Telegram?.WebApp;
        if (!this.telegram) {
            throw new Error('Telegram WebApp is not available');
        }

        // Состояние страницы
        this.state = {
            novelId: null,
            chapterId: null,
            novel: null,
            chapter: null,
            nextChapterId: null,
            prevChapterId: null,
            readingSettings: {
                fontSize: 18,
                theme: 'light',
                position: 0
            },
            isSettingsVisible: false,
            progress: 0,
            lastSaveTime: 0,
            saveInterval: 5000, // Сохраняем прогресс каждые 5 секунд
            isLoading: false
        };

        // Привязка методов
        this.handleNavigation = this.handleNavigation.bind(this);
        this.handleScroll = this.handleScroll.bind(this);
        this.handleMenu = this.handleMenu.bind(this);
        this.changeFontSize = this.changeFontSize.bind(this);
        this.changeTheme = this.changeTheme.bind(this);
        this.saveProgress = this.saveProgress.bind(this);
    }

    async init() {
        try {
            // Инициализируем WebApp
            this.telegram.ready();
            this.telegram.expand();
            
            // Получаем параметры из URL
            const params = new URLSearchParams(window.location.search);
            this.state.novelId = params.get('novelId');
            this.state.chapterId = params.get('chapterId');

            if (!this.state.novelId || !this.state.chapterId) {
                throw new Error('Не указаны параметры главы');
            }

            // Загружаем настройки чтения
            await this.loadReadingSettings();
            
            // Инициализируем компоненты
            this.initTheme();
            this.initNavigation();
            this.initReadingSettings();
            this.initChapterMenu();
            this.initSwipeNavigation();
            this.initProgressTracking();
            this.initContentProtection();

            // Загружаем контент главы
            await this.loadChapterContent();

            // Восстанавливаем позицию прокрутки
            await this.restoreScrollPosition();

            // Добавляем в историю прочитанного
            await storage.addLastRead(this.state.novelId, this.state.chapterId);
        } catch (error) {
            console.error('Initialization error:', error);
            this.showError('Не удалось загрузить главу');
        }
    }

    async loadReadingSettings() {
        const settings = await storage.getReadingSettings();
        this.state.readingSettings = {
            ...this.state.readingSettings,
            ...settings
        };
        
        // Применяем настройки
        this.applyReadingSettings();
    }

    async loadChapterContent() {
        try {
            // Загружаем информацию о новелле и главе
            [this.state.novel, this.state.chapter] = await Promise.all([
                api.getNovel(this.state.novelId),
                api.getChapter(this.state.novelId, this.state.chapterId)
            ]);

            if (!this.state.novel || !this.state.chapter) {
                throw new Error('Не удалось загрузить данные');
            }

            // Получаем ID соседних глав
            const chapters = await api.getChapters(this.state.novelId);
            const currentIndex = chapters.findIndex(ch => ch.id === parseInt(this.state.chapterId));
            
            if (currentIndex > 0) {
                this.state.prevChapterId = chapters[currentIndex - 1].id;
            }
            if (currentIndex < chapters.length - 1) {
                this.state.nextChapterId = chapters[currentIndex + 1].id;
            }

            // Обновляем UI
            this.updateChapterUI();
            
            // Обновляем просмотры
            await api.incrementChapterViews(this.state.novelId, this.state.chapterId);
        } catch (error) {
            console.error('Error loading chapter:', error);
            throw error;
        }
    }

    updateChapterUI() {
        // Обновляем заголовки
        document.querySelector('.novel-name').textContent = this.state.novel.title;
        document.querySelector('.chapter-title').textContent = this.state.chapter.title;
        document.title = `${this.state.chapter.title} - ${this.state.novel.title}`;

        // Обновляем контент
        document.querySelector('.chapter-content').innerHTML = this.state.chapter.content;

        // Обновляем навигацию
        const prevBtn = document.querySelector('.prev-chapter');
        const nextBtn = document.querySelector('.next-chapter');

        if (prevBtn) {
            prevBtn.disabled = !this.state.prevChapterId;
        }
        if (nextBtn) {
            nextBtn.disabled = !this.state.nextChapterId;
        }
    }

    initTheme() {
        document.documentElement.setAttribute('data-theme', this.state.readingSettings.theme);

        // Подписываемся на изменения темы Telegram
        this.telegram.onEvent('themeChanged', () => {
            if (this.state.readingSettings.theme === 'light' || this.state.readingSettings.theme === 'dark') {
                this.changeTheme(this.telegram.colorScheme);
            }
        });
    }

    initNavigation() {
        // Кнопки навигации между главами
        document.querySelector('.prev-chapter')?.addEventListener('click', () => 
            this.handleNavigation('prev'));
        document.querySelector('.next-chapter')?.addEventListener('click', () => 
            this.handleNavigation('next'));

        // Кнопка "Назад"
        this.telegram.BackButton.show();
        this.telegram.BackButton.onClick(() => {
            this.confirmExit();
        });
    }

    initReadingSettings() {
        // Размер шрифта
        document.querySelectorAll('.font-size-controls .control-button').forEach(button => {
            button.addEventListener('click', () => {
                const action = button.classList.contains('font-size-increase') ? 'increase' :
                              button.classList.contains('font-size-decrease') ? 'decrease' : 'reset';
                
                this.changeFontSize(action);
                this.telegram.HapticFeedback.impactOccurred('light');
            });
        });

        // Тема чтения
        document.querySelectorAll('.theme-controls .control-button').forEach(button => {
            button.addEventListener('click', () => {
                const theme = button.classList.contains('theme-light') ? 'light' :
                             button.classList.contains('theme-sepia') ? 'sepia' : 'dark';
                
                this.changeTheme(theme);
                this.telegram.HapticFeedback.impactOccurred('light');
            });
        });

        // Показываем/скрываем настройки по свайпу
        let touchStartY = 0;
        document.addEventListener('touchstart', (e) => {
            touchStartY = e.touches[0].clientY;
        });

        document.addEventListener('touchmove', (e) => {
            const touchY = e.touches[0].clientY;
            const diff = touchStartY - touchY;

            if (Math.abs(diff) > 50) {
                this.state.isSettingsVisible = diff > 0;
                document.querySelector('.reading-settings')
                    ?.classList.toggle('visible', this.state.isSettingsVisible);
            }
        });
    }

    initChapterMenu() {
        const menuBtn = document.querySelector('.chapter-menu');
        if (!menuBtn) return;

        menuBtn.addEventListener('click', () => {
            this.telegram.HapticFeedback.impactOccurred('light');
            this.showMenu();
        });
    }

    showMenu() {
        this.telegram.showPopup({
            title: 'Меню главы',
            message: 'Выберите действие:',
            buttons: [
                {id: 'settings', type: 'default', text: 'Настройки чтения'},
                {id: 'report', type: 'destructive', text: 'Сообщить об ошибке'},
                {id: 'close', type: 'cancel'}
            ]
        }, (buttonId) => {
            switch (buttonId) {
                case 'settings':
                    this.state.isSettingsVisible = !this.state.isSettingsVisible;
                    document.querySelector('.reading-settings')
                        ?.classList.toggle('visible', this.state.isSettingsVisible);
                    break;
                case 'report':
                    this.reportChapter();
                    break;
            }
        });
    }

    initSwipeNavigation() {
        let touchStartX = 0;
        let touchStartY = 0;

        document.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        });

        document.addEventListener('touchend', (e) => {
            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;
            
            const diffX = touchStartX - touchEndX;
            const diffY = Math.abs(touchStartY - touchEndY);

            // Проверяем, что свайп был горизонтальным
            if (Math.abs(diffX) > 100 && diffY < 50) {
                if (diffX > 0 && this.state.nextChapterId) {
                    this.handleNavigation('next');
                } else if (diffX < 0 && this.state.prevChapterId) {
                    this.handleNavigation('prev');
                }
            }
        });
    }

    initProgressTracking() {
        // Отслеживаем прокрутку для прогресс-бара
        window.addEventListener('scroll', () => {
            const windowHeight = window.innerHeight;
            const fullHeight = document.documentElement.scrollHeight - windowHeight;
            const scrolled = window.scrollY;
            
            this.state.progress = Math.round((scrolled / fullHeight) * 100);
            
            // Обновляем прогресс-бар
            const progressBar = document.querySelector('.progress-bar');
            if (progressBar) {
                progressBar.style.width = `${this.state.progress}%`;
            }

            // Сохраняем прогресс с дебаунсом
            const now = Date.now();
            if (now - this.state.lastSaveTime > this.state.saveInterval) {
                this.state.lastSaveTime = now;
                this.saveProgress();
            }
        });
    }

    initContentProtection() {
        const content = document.querySelector('.chapter-content');
        if (!content) return;

        // Запрещаем выделение текста
        content.style.userSelect = 'none';
        content.style.webkitUserSelect = 'none';

        // Блокируем контекстное меню
        content.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });

        // Блокируем сохранение страницы
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && (e.key === 's' || e.key === 'S')) {
                e.preventDefault();
            }
        });
    }

    async handleNavigation(direction) {
        if (this.state.isLoading) return;

        const chapterId = direction === 'next' ? 
            this.state.nextChapterId : this.state.prevChapterId;

        if (!chapterId) return;

        // Сохраняем прогресс перед переходом
        await this.saveProgress();

        // Переходим к новой главе
        window.location.href = `chapter.html?novelId=${this.state.novelId}&chapterId=${chapterId}`;
    }

    async saveProgress() {
        try {
            await storage.saveReadingProgress(
                this.state.novelId,
                this.state.chapterId,
                window.scrollY
            );
        } catch (error) {
            console.error('Error saving progress:', error);
        }
    }

    async restoreScrollPosition() {
        try {
            const progress = await storage.getReadingProgress(this.state.novelId);
            if (progress && progress.lastChapter === this.state.chapterId && progress.position) {
                window.scrollTo(0, progress.position);
            }
        } catch (error) {
            console.error('Error restoring scroll position:', error);
        }
    }

    async changeFontSize(action) {
        const content = document.querySelector('.chapter-content');
        if (!content) return;

        switch (action) {
            case 'increase':
                this.state.readingSettings.fontSize = 
                    Math.min(24, this.state.readingSettings.fontSize + 2);
                break;
            case 'decrease':
                this.state.readingSettings.fontSize = 
                    Math.max(14, this.state.readingSettings.fontSize - 2);
                break;
            default:
                this.state.readingSettings.fontSize = 18;
        }

        content.style.fontSize = `${this.state.readingSettings.fontSize}px`;
        await storage.saveReadingSettings(this.state.readingSettings);
        
        // Обновляем UI
        this.updateSettingsUI();
    }

    async changeTheme(theme) {
        this.state.readingSettings.theme = theme;
        document.documentElement.setAttribute('data-theme', theme);
        await storage.saveReadingSettings(this.state.readingSettings);
        
        // Обновляем UI
        this.updateSettingsUI();
    }

    updateSettingsUI() {
        // Обновляем кнопки размера шрифта
        document.querySelectorAll('.font-size-controls .control-button').forEach(button => {
            button.classList.remove('active');
            if (
                (button.classList.contains('font-size-default') && this.state.readingSettings.fontSize === 18) ||
                (button.classList.contains('font-size-decrease') && this.state.readingSettings.fontSize < 18) ||
                (button.classList.contains('font-size-increase') && this.state.readingSettings.fontSize > 18)
            ) {
                button.classList.add('active');
            }
        });

        // Обновляем кнопки темы
        document.querySelectorAll('.theme-controls .control-button').forEach(button => {
            button.classList.remove('active');
            if (
                (button.classList.contains('theme-light') && this.state.readingSettings.theme === 'light') ||
                (button.classList.contains('theme-sepia') && this.state.readingSettings.theme === 'sepia') ||
                (button.classList.contains('theme-dark') && this.state.readingSettings.theme === 'dark')
            ) {
                button.classList.add('active');
            }
        });
    }

    reportChapter() {
        this.telegram.HapticFeedback.impactOccurred('light');
        this.telegram.showPopup({
            title: 'Сообщить об ошибке',
            message: 'Выберите тип ошибки:',
            buttons: [
                {id: 'typo', type: 'default', text: 'Опечатка'},
                {id: 'missing', type: 'default', text: 'Пропущенный текст'},
                {id: 'other', type: 'default', text: 'Другое'},
                {id: 'cancel', type: 'cancel'}
            ]
        }, async (buttonId) => {
            if (buttonId !== 'cancel') {
                try {
                    await api.reportChapter(this.state.novelId, this.state.chapterId, buttonId);
                    this.telegram.HapticFeedback.notificationOccurred('success');
                    this.showSuccess('Спасибо! Мы проверим сообщение об ошибке.');
                } catch (error) {
                    console.error('Error reporting chapter:', error);
                    this.showError('Не удалось отправить сообщение об ошибке');
                }
            }
        });
    }

    confirmExit() {
        // Сохраняем прогресс перед выходом
        this.saveProgress().then(() => {
            window.location.href = `novel.html?id=${this.state.novelId}`;
        });
    }

    showError(message) {
        this.telegram.HapticFeedback.notificationOccurred('error');
        this.telegram.showPopup({
            title: 'Ошибка',
            message: message,
            buttons: [{type: 'close'}]
        });
    }

    showSuccess(message) {
        this.telegram.HapticFeedback.notificationOccurred('success');
        this.telegram.showPopup({
            title: 'Успешно',
            message: message,
            buttons: [{type: 'close'}]
        });
    }
}

// Создаем и инициализируем страницу
document.addEventListener('DOMContentLoaded', () => {
    try {
        const page = new ChapterPage();
        page.init();

        // Делаем доступным глобально для отладки
        window.chapterPage = page;
    } catch (error) {
        console.error('Failed to initialize chapter page:', error);
        if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.showPopup({
                title: 'Ошибка',
                message: 'Не удалось загрузить страницу',
                buttons: [{type: 'close'}]
            });
        }
    }
});

export default ChapterPage;
