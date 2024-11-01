// Получаем экземпляр WebApp
const tg = window.Telegram.WebApp;

// Функция для безопасной инициализации приложения
function initializeApp() {
    // Проверяем, что приложение запущено в Telegram
    if (!tg) {
        console.error('Telegram WebApp is not available');
        return;
    }

    // Сообщаем WebApp что приложение готово
    tg.ready();
    // Раскрываем приложение на всю высоту
    tg.expand();

    // Инициализируем хранилище и получаем сохраненные настройки
    initializeStorage().then(() => {
        // После инициализации хранилища загружаем настройки
        loadUserSettings();
    });

    // Настраиваем обработку темы
    initializeTheme();
}

// Функция для работы с CloudStorage
async function initializeStorage() {
    try {
        // Проверяем доступность CloudStorage
        if (!tg.CloudStorage) {
            console.warn('CloudStorage is not available');
            return;
        }

        // Получаем список всех ключей
        await new Promise((resolve) => {
            tg.CloudStorage.getKeys((error, keys) => {
                if (error) {
                    console.error('Failed to get keys from CloudStorage:', error);
                    resolve([]);
                    return;
                }
                console.log('Available keys in CloudStorage:', keys);
                resolve(keys);
            });
        });
    } catch (error) {
        console.error('Error initializing storage:', error);
    }
}

// Функция для загрузки пользовательских настроек
async function loadUserSettings() {
    if (!tg.CloudStorage) return;

    // Загружаем настройки из CloudStorage
    tg.CloudStorage.getItem('userSettings', (error, value) => {
        if (error) {
            console.error('Failed to load settings:', error);
            return;
        }

        if (value) {
            try {
                const settings = JSON.parse(value);
                applyUserSettings(settings);
            } catch (e) {
                console.error('Failed to parse settings:', e);
            }
        }
    });
}

// Функция для применения настроек
function applyUserSettings(settings) {
    const root = document.documentElement;
    
    // Применяем сохраненные настройки, если они есть
    if (settings) {
        if (settings.fontSize) {
            root.style.setProperty('--base-font-size', settings.fontSize + 'px');
        }
        // Можно добавить другие настройки
    }
}

// Функция для инициализации темы
function initializeTheme() {
    const root = document.documentElement;
    
    // Устанавливаем цветовую схему
    root.classList.toggle('dark', tg.colorScheme === 'dark');

    // Применяем цвета из WebApp
    const colors = {
        'bg-color': tg.backgroundColor,
        'text-color': tg.textColor,
        'hint-color': tg.themeParams?.hint_color,
        'link-color': tg.themeParams?.link_color,
        'button-color': tg.themeParams?.button_color,
        'button-text-color': tg.themeParams?.button_text_color,
        'secondary-bg-color': tg.themeParams?.secondary_bg_color
    };

    // Применяем цвета
    Object.entries(colors).forEach(([key, value]) => {
        if (value) {
            root.style.setProperty(`--tg-theme-${key}`, value);
        }
    });

    // Слушаем изменения темы
    tg.onEvent('themeChanged', () => {
        root.classList.toggle('dark', tg.colorScheme === 'dark');
        // Обновляем цвета при изменении темы
        Object.entries(colors).forEach(([key, value]) => {
            if (value) {
                root.style.setProperty(`--tg-theme-${key}`, value);
            }
        });
    });
}

// Функция для сохранения настроек
function saveUserSettings(settings) {
    if (!tg.CloudStorage) return;

    const settingsString = JSON.stringify(settings);
    tg.CloudStorage.setItem('userSettings', settingsString, (error) => {
        if (error) {
            console.error('Failed to save settings:', error);
            return;
        }
        console.log('Settings saved successfully');
    });
}

// Инициализация модального окна переводчика
function initModal() {
    const modal = document.getElementById('translatorModal');
    const openButton = document.querySelector('.become-translator');
    const closeButton = document.querySelector('.modal-close');

    if (openButton) {
        openButton.addEventListener('click', () => {
            modal.classList.add('visible');
            document.body.style.overflow = 'hidden';
            // Показываем главную кнопку Telegram
            tg.MainButton.show();
            tg.MainButton.setParams({
                text: 'Стать переводчиком',
                is_active: true,
                text_color: tg.themeParams?.button_text_color,
                color: tg.themeParams?.button_color,
            });
        });
    }

    if (closeButton) {
        closeButton.addEventListener('click', () => {
            modal.classList.remove('visible');
            document.body.style.overflow = '';
            tg.MainButton.hide();
        });
    }

    // Закрытие по клику на оверлей
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('visible');
                document.body.style.overflow = '';
                tg.MainButton.hide();
            }
        });
    }

    // Предотвращение закрытия WebApp при открытом модальном окне
    tg.enableClosingConfirmation();
}

// Обработчик формы остается прежним, но теперь использует нативные попапы Telegram
const FormHandler = {
    // ... остальной код FormHandler остается тем же ...
    
    async submitForm(formData) {
        try {
            tg.MainButton.showProgress();
            document.body.style.cursor = 'wait';
            
            // Имитация отправки на сервер
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Очищаем сохраненные данные
            localStorage.removeItem('translatorFormData');

            // Закрываем модальное окно
            const modal = document.getElementById('translatorModal');
            modal.classList.remove('visible');
            document.body.style.overflow = '';

            // Используем нативный попап Telegram
            tg.showPopup({
                title: 'Успешно!',
                message: 'Вы стали переводчиком',
                buttons: [{type: 'ok'}]
            });

            // Закрываем WebApp
            tg.close();
        } catch (error) {
            console.error('Error submitting form:', error);
            tg.showPopup({
                title: 'Ошибка',
                message: 'Не удалось отправить форму. Попробуйте позже.',
                buttons: [{type: 'ok'}]
            });
        } finally {
            tg.MainButton.hideProgress();
            document.body.style.cursor = '';
        }
    }
};

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    // Инициализируем приложение
    initializeApp();
    
    // Инициализируем компоненты
    initModal();
    // Остальные инициализации...
});

// Предотвращение открытия контекстного меню
document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});
