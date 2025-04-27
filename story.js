import { showError, checkProtocol } from './utils.js';

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing story page...');

    const storyContainer = document.querySelector('#story-content');
    const storyTitleElement = document.querySelector('#story-title');
    const prevBtn = document.querySelector('#prev-btn');
    const nextBtn = document.querySelector('#next-btn');
    const pageCounter = document.querySelector('#page-counter');

    if (!storyContainer || !storyTitleElement || !prevBtn || !nextBtn || !pageCounter) {
        console.error('Required elements not found!');
        showError(storyContainer, 'Ошибка в структуре страницы.', 'Не найдены элементы: story-content, story-title, prev-btn, next-btn или page-counter.');
        return;
    }

    // Проверяем протокол
    const protocolCheck = checkProtocol();
    if (protocolCheck.isLocal) {
        showError(storyContainer, protocolCheck.error, protocolCheck.details);
        showError(storyContainer, 'Запустите проект через сервер!', 'fetch не работает с file://. Используйте Live Server в VS Code или разверните через Firebase Hosting.');
        return;
    }

    // Получаем индекс сказки из URL
    const urlParams = new URLSearchParams(window.location.search);
    const storyIndex = parseInt(urlParams.get('story'), 10);
    console.log('Story index from URL:', storyIndex);

    if (isNaN(storyIndex)) {
        showError(storyContainer, 'Ошибка загрузки сказки.', 'Не указан или некорректен индекс сказки в URL (параметр "story").');
        return;
    }

    let currentPart = 0;
    let storyData = null;
    let totalParts = 0;

    function displayPart(partIndex) {
        console.log(`Displaying part ${partIndex} of story ${storyIndex}`);
        if (!storyData || !storyData.parts || partIndex < 0 || partIndex >= storyData.parts.length) {
            console.warn('Invalid part index or story data:', { partIndex, storyData });
            return;
        }

        // Показываем заголовок только на первой странице
        if (partIndex === 0) {
            storyTitleElement.style.display = 'block';
        } else {
            storyTitleElement.style.display = 'none';
        }

        // Удаляем предыдущую активную часть
        const activePart = storyContainer.querySelector('.story-part.active');
        if (activePart) {
            activePart.classList.remove('active');
        }

        // Создаём или показываем текущую часть
        let partElement = storyContainer.querySelector(`.story-part[data-part="${partIndex}"]`);
        if (!partElement) {
            partElement = document.createElement('div');
            partElement.className = 'story-part';
            partElement.setAttribute('data-part', partIndex);

            const part = storyData.parts[partIndex];
            console.log('Part data:', part);

            // Добавляем текст
            part.text.forEach(paragraph => {
                const p = document.createElement('p');
                p.textContent = paragraph;
                partElement.appendChild(p);
            });

            // Добавляем изображение
            if (part.image) {
                const img = document.createElement('img');
                img.src = part.image;
                img.alt = `Иллюстрация к части ${partIndex + 1}`;
                img.onerror = () => {
                    console.warn(`Failed to load image: ${part.image}`);
                    img.src = 'assets/images/placeholder.jpg';
                };
                partElement.appendChild(img);
            }

            // Добавляем аудио
            if (part.audio) {
                const audio = document.createElement('audio');
                audio.controls = true;
                audio.src = part.audio;
                audio.onerror = () => console.warn(`Failed to load audio: ${part.audio}`);
                partElement.appendChild(audio);
            }

            storyContainer.appendChild(partElement);
        }

        partElement.classList.add('active');

        // Прокрутка к началу текста
        partElement.scrollIntoView({ behavior: 'smooth', block: 'start' });

        // Обновляем нумерацию страниц
        pageCounter.textContent = `${partIndex + 1}/${totalParts}`;

        // Обновляем состояние кнопок
        prevBtn.disabled = partIndex === 0;
        nextBtn.disabled = partIndex === storyData.parts.length - 1 && storyData.interactiveId === undefined;

        // Настройка кнопки "Далее"
        if (partIndex === storyData.parts.length - 1 && storyData.interactiveId !== undefined) {
            nextBtn.innerHTML = `Играть <span class="nav-icon nav-icon-next"></span>`;
            nextBtn.disabled = false;
            nextBtn.onclick = () => {
                console.log(`Navigating to interactive with ID ${storyData.interactiveId}`);
                window.location.href = `interactive.html?story=${storyIndex}&interactive=${storyData.interactiveId}`;
            };
        } else {
            nextBtn.innerHTML = `Далее <span class="nav-icon nav-icon-next"></span>`;
            nextBtn.onclick = () => {
                if (currentPart < storyData.parts.length - 1) {
                    currentPart++;
                    displayPart(currentPart);
                }
            };
        }
    }

    // Загружаем данные сказки
    console.log('Fetching stories.json...');
    fetch('stories.json')
        .then(response => {
            console.log('Fetch response:', response);
            console.log('Response status:', response.status, response.statusText);
            console.log('Response URL:', response.url);
            if (!response.ok) {
                throw new Error(`Не удалось загрузить stories.json. Статус: ${response.status} ${response.statusText}.`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Parsed JSON data:', data);
            if (!data.stories || !Array.isArray(data.stories) || data.stories.length === 0) {
                throw new Error('Файл stories.json пуст или содержит некорректные данные.');
            }

            if (storyIndex < 0 || storyIndex >= data.stories.length) {
                throw new Error(`Сказка с индексом ${storyIndex} не найдена. Всего сказок: ${data.stories.length}.`);
            }

            storyData = data.stories[storyIndex];
            console.log('Loaded story data:', storyData);

            // Устанавливаем общее количество частей
            totalParts = storyData.parts?.length || 0;
            if (totalParts === 0) {
                throw new Error('У сказки нет частей для отображения.');
            }

            // Обновляем заголовок (название главы)
            storyTitleElement.textContent = storyData.title;

            // Отображаем первую часть
            displayPart(currentPart);
        })
        .catch(error => {
            console.error('Error loading story:', error);
            showError(storyContainer, 'Не удалось загрузить сказку.', `Детали: ${error.message}`);
        });

    // Навигация "Назад"
    prevBtn.addEventListener('click', () => {
        if (currentPart > 0) {
            currentPart--;
            displayPart(currentPart);
        }
    });

    // Навигация "Далее" уже обрабатывается в displayPart
});