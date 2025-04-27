document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing story page...');
    
    const storyContainer = document.querySelector('.story-container');
    if (!storyContainer) {
        console.error('Story container not found! Make sure your HTML has an element with class "story-container"');
        return;
    }

    const interactiveSection = document.querySelector('#interactive-section');
    const prevBtn = document.querySelector('#prev-btn');
    const nextBtn = document.querySelector('#next-btn');
    let currentPartIndex = 0;
    let parts = [];
    let storyData = null;
    let interactives = [];

    function showError(message, details = '') {
        console.error('Error:', message, details);
        storyContainer.innerHTML = `
            <div class="error">
                <p>${message}</p>
                <p>Пожалуйста, попробуйте позже или свяжитесь с администратором.</p>
                ${details ? `<p class="error-details">Детали ошибки: ${details}</p>` : ''}
            </div>
        `;
    }

    if (window.location.protocol === 'file:') {
        showError(
            'Для корректной работы приложения требуется веб-сервер.',
            'Запустите приложение через http-server или Live Server в VS Code.'
        );
        return;
    }

    console.log('Fetching interactives from interactives.json...');
    fetch('interactives.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log(`Loaded ${data.interactives?.length || 0} interactives`);
            interactives = data.interactives || [];
            loadStory();
        })
        .catch(error => {
            console.error('Error loading interactives:', error);
            interactives = [];
            loadStory();
        });

    function loadStory() {
        const urlParams = new URLSearchParams(window.location.search);
        const storyIndex = urlParams.get('story');
        console.log(`Raw story parameter from URL: "${storyIndex}"`);

        if (storyIndex === null || storyIndex === '') {
            console.log('No story index provided, redirecting to toc.html');
            window.location.assign('toc.html');
            return;
        }

        const index = parseInt(storyIndex, 10);
        console.log(`Parsed story index: ${index}, type: ${typeof index}`);

        if (isNaN(index) || index < 0) {
            showError('Неверный индекс сказки.', 'Индекс должен быть неотрицательным числом.');
            return;
        }

        console.log(`Fetching stories from stories.json for story index ${index}...`);
        fetch('stories.json')
            .then(response => {
                console.log('Server response:', response.status, response.statusText);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log(`Loaded ${data.stories?.length || 0} stories`);
                console.log('Stories array:', data.stories.map(s => s.title));

                if (!data.stories || !Array.isArray(data.stories) || data.stories.length === 0) {
                    throw new Error('Invalid or empty stories data');
                }

                if (!data.stories[index]) {
                    throw new Error(`Story with index ${index} not found`);
                }

                storyData = data.stories[index];
                console.log(`Selected story: ${storyData.title} (index: ${index})`);

                if (!storyData.title || !storyData.parts) {
                    throw new Error(`Story at index ${index} has invalid structure`);
                }

                storyContainer.innerHTML = '';

                const storyHeader = document.createElement('div');
                storyHeader.className = 'story-header';
                storyHeader.innerHTML = `<h1>${storyData.title}</h1>`;
                storyContainer.appendChild(storyHeader);

                parts = storyData.parts.map((part, partIndex) => {
                    if (!part || !part.text || !Array.isArray(part.text)) {
                        console.warn(`Part ${partIndex} is invalid or has no text:`, part);
                        return null;
                    }

                    const partContainer = document.createElement('div');
                    partContainer.className = 'story-part';
                    partContainer.id = `part-${partIndex}`;

                    part.text.forEach(text => {
                        const p = document.createElement('p');
                        p.textContent = text;
                        partContainer.appendChild(p);
                    });

                    if (part.image) {
                        const img = document.createElement('img');
                        img.src = part.image;
                        img.alt = `Illustration for part ${partIndex + 1}`;
                        img.onerror = () => {
                            img.style.display = 'none';
                            console.warn(`Failed to load image for part ${partIndex + 1}: ${part.image}`);
                        };
                        partContainer.appendChild(img);
                    }

                    if (part.audio) {
                        const audio = document.createElement('audio');
                        audio.controls = true;
                        audio.src = part.audio;
                        audio.onerror = () => {
                            audio.style.display = 'none';
                            console.warn(`Failed to load audio for part ${partIndex + 1}: ${part.audio}`);
                        };
                        partContainer.appendChild(audio);
                    }

                    storyContainer.appendChild(partContainer);
                    return partContainer;
                }).filter(part => part !== null);

                if (parts.length === 0) {
                    throw new Error('No valid parts found for this story');
                }

                showPart(currentPartIndex);

                prevBtn.addEventListener('click', () => {
                    if (currentPartIndex > 0) {
                        currentPartIndex--;
                        showPart(currentPartIndex);
                    }
                });

                nextBtn.addEventListener('click', () => {
                    if (currentPartIndex < parts.length) {
                        currentPartIndex++;
                        showPart(currentPartIndex);
                    }
                });

                console.log(`Story "${storyData.title}" displayed successfully`);
            })
            .catch(error => {
                console.error('Error loading story:', error);
                showError('Не удалось загрузить сказку.', error.message);
            });
    }

    function showPart(partIndex) {
        console.log(`Showing part ${partIndex}, total parts: ${parts.length}`);
        parts.forEach((part, idx) => {
            if (part && part.classList) {
                if (idx === partIndex) {
                    part.classList.add('active');
                } else {
                    part.classList.remove('active');
                }
            } else {
                console.warn(`Part at index ${idx} is invalid or not rendered properly`);
            }
        });

        if (interactiveSection) {
            interactiveSection.classList.remove('active');
        } else {
            console.warn('Interactive section not found in showPart');
        }

        if (partIndex === parts.length) {
            console.log('Reached end of story, calling showInteractive');
            showInteractive();
        } else {
            prevBtn.disabled = partIndex === 0;
            nextBtn.disabled = partIndex === parts.length - 1;
            storyContainer.scrollIntoView({ behavior: 'smooth' });
        }
    }

    function showInteractive() {
        console.log('showInteractive called');
        console.log('interactiveSection:', interactiveSection);
        console.log('storyData.interactiveId:', storyData.interactiveId);
        console.log('interactives:', interactives);

        if (!interactiveSection) {
            console.warn('Interactive section not found');
            return;
        }

        if (!storyData.interactiveId && storyData.interactiveId !== 0) {
            console.warn('No interactive ID specified for this story');
            interactiveSection.innerHTML = `
                <div class="congratulations">
                    <p>Поздравляем с прочтением! 🎉 Интерактив скоро появится!</p>
                </div>
                <p>Пока интерактива нет, но ты можешь вернуться к сказке или выбрать другую!</p>
            `;
            interactiveSection.classList.add('active');
            prevBtn.disabled = false;
            nextBtn.disabled = true;
            interactiveSection.scrollIntoView({ behavior: 'smooth' });
            return;
        }

        const interactive = interactives.find(i => i.id === storyData.interactiveId);
        if (!interactive) {
            console.warn(`Interactive with ID ${storyData.interactiveId} not found`);
            interactiveSection.innerHTML = `
                <div class="congratulations">
                    <p>Поздравляем с прочтением! 🎉</p>
                </div>
                <p>Интерактив не найден. Попробуй другую сказку!</p>
            `;
            interactiveSection.classList.add('active');
            prevBtn.disabled = false;
            nextBtn.disabled = true;
            interactiveSection.scrollIntoView({ behavior: 'smooth' });
            return;
        }

        console.log('Found interactive:', interactive);

        interactiveSection.innerHTML = `
            <div class="congratulations">
                <p>Поздравляем с прочтением! 🎉 Теперь давай поиграем!</p>
            </div>
        `;

        if (interactive.type === 'quiz') {
            renderQuiz(interactive);
        } else if (interactive.type === 'match') {
            renderMatch(interactive);
        } else if (interactive.type === 'coloring') {
            renderColoring(interactive);
        } else {
            interactiveSection.innerHTML += `<p>Интерактив типа "${interactive.type}" пока не поддерживается.</p>`;
        }

        interactiveSection.classList.add('active');
        prevBtn.disabled = false;
        nextBtn.disabled = true;
        interactiveSection.scrollIntoView({ behavior: 'smooth' });
    }

    function renderQuiz(quizData) {
        console.log('Rendering quiz:', quizData);
        interactiveSection.innerHTML = `<h2>${quizData.title}</h2>`;
        let score = 0;
        const totalQuestions = quizData.questions.length;

        quizData.questions.forEach((question, qIndex) => {
            const questionDiv = document.createElement('div');
            questionDiv.className = 'quiz-question';
            questionDiv.innerHTML = `<p>${question.question}</p>`;

            const optionsDiv = document.createElement('div');
            optionsDiv.className = 'quiz-options';

            question.options.forEach((option, oIndex) => {
                const optionBtn = document.createElement('div');
                optionBtn.className = 'quiz-option';
                optionBtn.textContent = option;
                optionBtn.addEventListener('click', () => {
                    if (optionBtn.classList.contains('correct') || optionBtn.classList.contains('incorrect')) {
                        return;
                    }
                    if (oIndex === question.correct) {
                        optionBtn.classList.add('correct');
                        score++;
                    } else {
                        optionBtn.classList.add('incorrect');
                        optionsDiv.childNodes[question.correct].classList.add('correct');
                    }
                    updateScore();
                });
                optionsDiv.appendChild(optionBtn);
            });

            questionDiv.appendChild(optionsDiv);
            interactiveSection.appendChild(questionDiv);
        });

        const resultDiv = document.createElement('div');
        resultDiv.className = 'quiz-result';
        interactiveSection.appendChild(resultDiv);

        function updateScore() {
            resultDiv.textContent = `Твой результат: ${score} из ${totalQuestions}`;
        }
    }

    function renderMatch(matchData) {
        console.log('Rendering match:', matchData);
        interactiveSection.innerHTML = `<h2>${matchData.title}</h2>`;
        const pairs = matchData.pairs;
        const leftItems = pairs.map(p => p.left).sort(() => Math.random() - 0.5);
        const rightItems = pairs.map(p => p.right).sort(() => Math.random() - 0.5);

        const matchContainer = document.createElement('div');
        matchContainer.className = 'match-container';
        matchContainer.style.display = 'flex';
        matchContainer.style.justifyContent = 'space-between';
        matchContainer.style.gap = '1rem';

        const leftColumn = document.createElement('div');
        leftColumn.className = 'match-column';
        const rightColumn = document.createElement('div');
        rightColumn.className = 'match-column';

        let selectedLeft = null;
        let selectedRight = null;
        let matchedPairs = 0;

        leftItems.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'match-item';
            itemDiv.textContent = item;
            itemDiv.style.padding = '0.5rem';
            itemDiv.style.margin = '0.5rem 0';
            itemDiv.style.backgroundColor = '#f0f0f0';
            itemDiv.style.borderRadius = '5px';
            itemDiv.style.cursor = 'pointer';
            itemDiv.addEventListener('click', () => {
                if (itemDiv.classList.contains('matched')) return;
                if (selectedLeft) selectedLeft.style.backgroundColor = '#f0f0f0';
                selectedLeft = itemDiv;
                selectedLeft.style.backgroundColor = '#d0d0d0';
                checkMatch();
            });
            leftColumn.appendChild(itemDiv);
        });

        rightItems.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'match-item';
            itemDiv.textContent = item;
            itemDiv.style.padding = '0.5rem';
            itemDiv.style.margin = '0.5rem 0';
            itemDiv.style.backgroundColor = '#f0f0f0';
            itemDiv.style.borderRadius = '5px';
            itemDiv.style.cursor = 'pointer';
            itemDiv.addEventListener('click', () => {
                if (itemDiv.classList.contains('matched')) return;
                if (selectedRight) selectedRight.style.backgroundColor = '#f0f0f0';
                selectedRight = itemDiv;
                selectedRight.style.backgroundColor = '#d0d0d0';
                checkMatch();
            });
            rightColumn.appendChild(itemDiv);
        });

        matchContainer.appendChild(leftColumn);
        matchContainer.appendChild(rightColumn);
        interactiveSection.appendChild(matchContainer);

        const resultDiv = document.createElement('div');
        resultDiv.className = 'match-result';
        resultDiv.style.marginTop = '1rem';
        interactiveSection.appendChild(resultDiv);

        function checkMatch() {
            if (!selectedLeft || !selectedRight) return;
            const leftText = selectedLeft.textContent;
            const rightText = selectedRight.textContent;
            const pair = pairs.find(p => p.left === leftText && p.right === rightText);
            if (pair) {
                selectedLeft.classList.add('matched');
                selectedRight.classList.add('matched');
                selectedLeft.style.backgroundColor = '#4CAF50';
                selectedRight.style.backgroundColor = '#4CAF50';
                selectedLeft.style.color = 'white';
                selectedRight.style.color = 'white';
                matchedPairs++;
                if (matchedPairs === pairs.length) {
                    resultDiv.textContent = 'Поздравляем! Ты нашёл все пары!';
                }
            } else {
                selectedLeft.style.backgroundColor = '#f44336';
                selectedRight.style.backgroundColor = '#f44336';
                setTimeout(() => {
                    selectedLeft.style.backgroundColor = '#f0f0f0';
                    selectedRight.style.backgroundColor = '#f0f0f0';
                }, 500);
            }
            selectedLeft = null;
            selectedRight = null;
        }
    }

    function renderColoring(coloringData) {
        console.log('Rendering coloring:', coloringData);
        interactiveSection.innerHTML = `<h2>${coloringData.title}</h2>`;
        const container = document.createElement('div');
        container.className = 'coloring-container';

        const canvas = document.createElement('canvas');
        canvas.className = 'coloring-canvas';
        canvas.width = 400;
        canvas.height = 400;
        container.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.src = coloringData.image;
        img.onload = () => {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        };
        img.onerror = () => {
            console.warn(`Failed to load coloring image: ${coloringData.image}`);
            interactiveSection.innerHTML = '<p>Не удалось загрузить изображение для раскрашивания.</p>';
        };

        const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#000000'];
        const palette = document.createElement('div');
        palette.className = 'color-palette';
        
        let selectedColor = colors[0];
        colors.forEach(color => {
            const colorDiv = document.createElement('div');
            colorDiv.className = 'color-option';
            colorDiv.style.backgroundColor = color;
            if (color === selectedColor) {
                colorDiv.classList.add('selected');
            }
            colorDiv.addEventListener('click', () => {
                selectedColor = color;
                palette.querySelectorAll('.color-option').forEach(div => div.classList.remove('selected'));
                colorDiv.classList.add('selected');
            });
            palette.appendChild(colorDiv);
        });
        container.appendChild(palette);

        let isDrawing = false;
        canvas.addEventListener('mousedown', (e) => {
            isDrawing = true;
            draw(e);
        });
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', () => isDrawing = false);
        canvas.addEventListener('mouseout', () => isDrawing = false);

        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            isDrawing = true;
            draw(e);
        });
        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            draw(e);
        });
        canvas.addEventListener('touchend', () => isDrawing = false);

        function draw(e) {
            if (!isDrawing) return;
            const rect = canvas.getBoundingClientRect();
            let x, y;
            if (e.type.startsWith('touch')) {
                x = e.touches[0].clientX - rect.left;
                y = e.touches[0].clientY - rect.top;
            } else {
                x = e.clientX - rect.left;
                y = e.clientY - rect.top;
            }
            ctx.fillStyle = selectedColor;
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, Math.PI * 2);
            ctx.fill();
        }

        interactiveSection.appendChild(container);
    }
});