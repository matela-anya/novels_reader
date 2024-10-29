// Инициализация Telegram WebApp
document.addEventListener('DOMContentLoaded', function() {
    // Проверяем, доступен ли объект Telegram
    if (window.Telegram && window.Telegram.WebApp) {
        let tg = window.Telegram.WebApp;
        
        // Инициализация веб-приложения
        tg.ready();
        tg.expand();

        // Применяем тему Telegram
        document.documentElement.className = tg.colorScheme;

        // Настраиваем основной цвет для кнопок и активных элементов
        if (tg.themeParams && tg.themeParams.button_color) {
            document.documentElement.style.setProperty('--tg-theme-button-color', tg.themeParams.button_color);
        }
    } else {
        console.log('Telegram WebApp не доступен');
        // Запасной вариант оформления
        document.documentElement.className = 'light';
    }
});

// Объект для работы с формой
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
        },
        discord: {
            patternMismatch: 'Неверный формат Discord ID'
        },
        vk: {
            patternMismatch: 'Неверный формат ссылки VK'
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
        const counter = field.parentElement.querySelector('.character-counter');
        if (counter) {
            const current = field.value.length;
            const max = field.maxLength;
            counter.textContent = `${current}/${max}`;
            counter.classList.toggle('limit', current >= max);
        }
    },

    async submitForm(formData) {
        const loadingOverlay = document.getElementById('loadingOverlay');
        loadingOverlay.style.display = 'flex';

        try {
            // Имитация отправки на сервер
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Очищаем сохраненные данные
            localStorage.removeItem('translatorFormData');

            // Закрываем модальное окно
            document.getElementById('translatorModal').style.display = 'none';

            // Показываем вкладку переводчика
            document.querySelector('[data-mode="translator"]').style.display = 'block';

            // Уведомляем пользователя
            if (window.Telegram && window.Telegram.WebApp) {
                window.Telegram.WebApp.showPopup({
                    title: 'Успешно!',
                    message: 'Вы стали переводчиком',
                    buttons: [{type: 'ok'}]
                });
            }
        } catch (error) {
            console.error('Error submitting form:', error);
            if (window.Telegram && window.Telegram.WebApp) {
                window.Telegram.WebApp.showPopup({
                    title: 'Ошибка',
                    message: 'Не удалось отправить форму. Попробуйте позже.',
                    buttons: [{type: 'ok'}]
                });
            }
        } finally {
            loadingOverlay.style.display = 'none';
        }
    }
};

// Объект для работы с аватаром
const AvatarHandler = {
    cropper: null,
    
    async initCropper(image) {
        return new Cropper(image, {
            aspectRatio: 1,
            viewMode: 1,
            dragMode: 'move',
            autoCropArea: 1,
            restore: false,
            guides: true,
            center: true,
            highlight: false,
            cropBoxMovable: false,
            cropBoxResizable: false,
            toggleDragModeOnDblclick: false,
        });
    },

    async processFile(file) {
        if (!file.type.startsWith('image/')) {
            throw new Error('Пожалуйста, выберите изображение');
        }

        if (file.size > 1024 * 1024) {
            throw new Error('Размер файла не должен превышать 1MB');
        }

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },

    async cropImage(cropper) {
        return cropper.getCroppedCanvas({
            width: 200,
            height: 200
        }).toDataURL('image/jpeg', 0.8);
    }
};

// Инициализация обработчиков событий
document.addEventListener('DOMContentLoaded', function() {
    // Инициализация формы
    const form = document.getElementById('translatorForm');
    const avatarInput = document.getElementById('avatarInput');
    const cropModal = document.getElementById('cropModal');
    
    // Обработка полей формы
    form.querySelectorAll('.form-input').forEach(input => {
        input.addEventListener('input', () => {
            FormHandler.validateField(input);
            FormHandler.updateCharacterCount(input);
        });

        input.addEventListener('blur', () => {
            FormHandler.validateField(input);
        });
    });

    // Обработка загрузки аватара
    avatarInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const imageData = await AvatarHandler.processFile(file);
            document.getElementById('cropImage').src = imageData;
            cropModal.style.display = 'block';
            
            if (AvatarHandler.cropper) {
                AvatarHandler.cropper.destroy();
            }
            AvatarHandler.cropper = await AvatarHandler.initCropper(document.getElementById('cropImage'));
        } catch (error) {
            if (window.Telegram && window.Telegram.WebApp) {
                window.Telegram.WebApp.showPopup({
                    title: 'Ошибка',
                    message: error.message,
                    buttons: [{type: 'ok'}]
                });
            }
        }
    });

    // Обработка отправки формы
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        let isValid = true;
        form.querySelectorAll('.form-input[required]').forEach(field => {
            if (!FormHandler.validateField(field)) {
                isValid = false;
            }
        });

        if (!isValid) return;

        const formData = new FormData(form);
        if (window.currentAvatarData) {
            formData.append('avatar', window.currentAvatarData);
        }

        await FormHandler.submitForm(formData);
    });
});
