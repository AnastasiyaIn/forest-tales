export function showError(container, message, details = '') {
    console.error('Error:', message, details);
    container.innerHTML = `
        <div class="error">
            <p>${message}</p>
            <p>Пожалуйста, попробуйте позже или свяжитесь с администратором.</p>
            ${details ? `<p class="error-details">Детали ошибки: ${details}</p>` : ''}
        </div>
    `;
}

export function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

export function checkProtocol() {
    if (window.location.protocol === 'file:') {
        return {
            isLocal: true,
            error: 'Для корректной работы приложения требуется веб-сервер.',
            details: 'Запустите приложение через http-server или Live Server in VS Code.'
        };
    }
    return { isLocal: false };
}