// Получаем экземпляр WebApp
const tg = window.Telegram.WebApp;

// Инициализация приложения
function initializeApp() {
    // Сообщаем WebApp что приложение готово
    tg.ready();
    // Раскрываем приложение на всю высоту
    tg.expand();

    // Настраиваем цветовую схему
    const root = document.documentElement;
    root.classList.toggle('dark', tg.colorScheme === 'dark');

    // Устанавливаем цвета из WebApp
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

    // Инициализируем главную кнопку
    initMainButton();
}

// Настройка главной кнопки Telegram
function initMainButton() {
    tg.MainButton.setParams({
        text: 'Стать переводчиком',
        color: tg.themeParams?.button_color,
        text_color: tg.themeParams?.button_text_color,
        is_visible: false
    });

    // Добавляем обработчик на нажатие главной кнопки
    tg.MainButton.onClick(() => {
        const form = document.getElementById('translatorForm');
        if (form) {
            form.dispatchEvent(new Event('submit'));
        }
    });
}

// Обработчик формы
const FormHandler = {
    errorMessages: {
        translatorName: {
            valueMissing: 'Пожалуйста, введите имя переводчика',
            tooShort: 'Имя должно содержать минимум 2 символа',
            patternMismatch: 'Имя может содержать только буквы, цифры, пробелы и дефис'
        },
        description: {
            valueMissing: 'Пожалуйста, добавьте описание',
            tooShort: 'Описание должно содержать минимум 50 символов'
        },
        telegram: {
            patternMismatch: 'Неверный формат username Telegram'
        }
    },

    validateField(field) {
        const errorElement = document.querySelector(`[data-error="${field.name}"]`);
        field.classList.remove('error', 'valid');
        errorElement.classList.remove('visible');

        if (!field.checkValidity()) {
            field.classList.add('error');
            for (const type in this.errorMessages[field.name]) {
                if (field.validity[type]) {
                    errorElement.textContent = this.errorMessages[field.name][type];
                    errorElement.classList.add('visible');
                    break;
                }
            }
            return false;
        } else {
            field.classList.add('valid');
            return true;
        }
    },

    updateCharacterCount(field) {
        const counter = field.closest('.form-group').querySelector('.character-counter');
        if (counter && field.maxLength) {
            const current = field.value.length;
            counter.textContent = `${current}/${field.maxLength}`;
            counter.classList.toggle('limit', current >= field.maxLength);
        }
    },

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

            // Уведомляем пользователя
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

// Обработчик аватара
const AvatarHandler = {
    maxSize: 1024 * 1024, // 1MB

    async processFile(file) {
        if (!file.type.startsWith('image/')) {
            throw new Error('Пожалуйста, выберите изображение');
        }

        if (file.size > this.maxSize) {
            throw new Error('Размер файла не должен превышать 1MB');
        }

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },

    removeAvatar() {
        const preview = document.getElementById('avatarPreview');
        if (preview) {
            preview.src = '/api/placeholder/80/80';
        }
        
        const input = document.getElementById('avatarInput');
        if (input) {
            input.value = '';
        }
    }
};

// Инициализация модального окна
function initModal() {
    const modal = document.getElementById('translatorModal');
    const openButton = document.querySelector('.become-translator');
    const closeButton = document.querySelector('.modal-close');

    if (openButton) {
        openButton.addEventListener('click', () => {
            modal.classList.add('visible');
            document.body.style.overflow = 'hidden';
            tg.MainButton.show();
        });
    }

    if (closeButton) {
        closeButton.addEventListener('click', () => {
            modal.classList.remove('visible');
            document.body.style.overflow = '';
            tg.MainButton.hide();
        });
    }

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('visible');
                document.body.style.overflow = '';
                tg.MainButton.hide();
            }
        });
    }
}

// Инициализация формы
function initForm() {
    const form = document.getElementById('translatorForm');
    if (!form) return;

    // Обработка полей формы
    form.querySelectorAll('.form-input').forEach(input => {
        // Валидация при вводе
        input.addEventListener('input', () => {
            FormHandler.validateField(input);
            FormHandler.updateCharacterCount(input);
        });

        // Валидация при потере фокуса
        input.addEventListener('blur', () => {
            FormHandler.validateField(input);
        });

        // Инициализация счетчика символов
        if (input.maxLength) {
            FormHandler.updateCharacterCount(input);
        }
    });

    // Обработка отправки формы
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Проверяем валидность всех обязательных полей
        let isValid = true;
        form.querySelectorAll('.form-input[required]').forEach(field => {
            if (!FormHandler.validateField(field)) {
                isValid = false;
            }
        });

        if (!isValid) {
            tg.showPopup({
                title: 'Ошибка',
                message: 'Пожалуйста, заполните все обязательные поля',
                buttons: [{type: 'ok'}]
            });
            return;
        }

        // Отправляем форму
        const formData = new FormData(form);
        await FormHandler.submitForm(formData);
    });

    // Обработка аватара
    const avatarInput = document.getElementById('avatarInput');
    const removeAvatarButton = document.getElementById('removeAvatar');

    if (avatarInput) {
        avatarInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const imageUrl = await AvatarHandler.processFile(file);
                document.getElementById('avatarPreview').src = imageUrl;
            } catch (error) {
                tg.showPopup({
                    title: 'Ошибка',
                    message: error.message,
                    buttons: [{type: 'ok'}]
                });
            }
        });
    }

    if (removeAvatarButton) {
        removeAvatarButton.addEventListener('click', AvatarHandler.removeAvatar);
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    // Инициализируем приложение
    initializeApp();
    
    // Инициализируем компоненты
    initModal();
    initForm();
});
