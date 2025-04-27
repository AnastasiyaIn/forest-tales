import { showError, checkProtocol } from './utils.js';

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing table of contents...');

    const tocContainer = document.querySelector('.toc-container');
    if (!tocContainer) {
        console.error('TOC container not found! Make sure your HTML has an element with class "toc-container"');
        showError(tocContainer, 'Ошибка в структуре страницы.', 'Элемент .toc-container не найден.');
        return;
    }

    // Проверяем протокол (file:// или http://)
    const protocolCheck = checkProtocol();
    if (protocolCheck.isLocal) {
        showError(tocContainer, protocolCheck.error, protocolCheck.details);
        showError(tocContainer, 'Запустите проект через сервер!', 'fetch не работает с file://. Используйте Live Server в VS Code или разверните через Firebase Hosting.');
        return;
    }

    function createStoryCard(story, index) {
        console.log(`Creating card for story: ${story.title} (index: ${index})`);
        console.log(`Cover image path: ${story.cover}`);

        const link = document.createElement('a');
        link.href = `story.html?story=${index}`;
        link.className = 'story-link';
        link.setAttribute('data-story-index', index);

        const card = document.createElement('div');
        card.className = 'story-card';

        card.innerHTML = `
            <div class="story-card-image">
                <img src="${story.cover}" alt="${story.title}" class="story-cover"
                     onerror="this.src='assets/images/placeholder.jpg'; console.warn('Failed to load image for ${story.title}: ${story.cover}');">
            </div>
            <div class="story-card-content">
                <h2>${story.title}</h2>
                <p>${story.description}</p>
                <span class="read-text">ЧИТАТЬ СКАЗКУ</span>
            </div>
        `;

        link.appendChild(card);
        console.log(`Created link for story ${index} with href: ${link.href}`);
        return link;
    }

    console.log('Current URL:', window.location.href);
    console.log('Attempting to fetch stories.json...');
    fetch('stories.json')
        .then(response => {
            console.log('Fetch response:', response);
            console.log('Response status:', response.status, response.statusText);
            console.log('Response URL:', response.url);
            if (!response.ok) {
                throw new Error(`Не удалось загрузить stories.json. Статус: ${response.status} ${response.statusText}. Проверьте, что файл stories.json существует в корневой папке проекта и доступен по пути ${response.url}.`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Parsed JSON data:', data);
            console.log(`Loaded ${data.stories?.length || 0} stories`);

            tocContainer.innerHTML = '';

            if (!data.stories || !Array.isArray(data.stories) || data.stories.length === 0) {
                throw new Error('Файл stories.json пуст или содержит некорректные данные. Убедитесь, что он содержит массив "stories" с полями title, description, cover и parts.');
            }

            data.stories.forEach((story, index) => {
                if (!story.title || !story.description || !story.parts || !story.cover) {
                    console.warn(`Story at index ${index} has invalid structure:`, story);
                    return;
                }

                const card = createStoryCard(story, index);
                tocContainer.appendChild(card);
            });

            if (tocContainer.children.length === 0) {
                throw new Error('Не удалось отобразить сказки. Возможно, все записи в stories.json содержат ошибки. Проверьте структуру данных: каждая сказка должна иметь title, description, cover и parts.');
            }

            console.log('Stories displayed successfully');
        })
        .catch(error => {
            console.error('Error loading stories:', error);
            showError(tocContainer, 'Не удалось загрузить список сказок.', `Детали: ${error.message}`);
        });
});