console.log('interactive.js loaded'); // Проверка загрузки скрипта

import { showError, checkProtocol } from './utils.js';

// Функция загрузки позиций из маски (нужна для игры "Ручей")
async function loadMaskPositions(maskUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.src = maskUrl;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            console.log(`Mask loaded: ${maskUrl}, size: ${img.width}x${img.height}`);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            const positions = [];
            let nonWhitePixels = 0;
            for (let y = 0; y < canvas.height; y++) {
                for (let x = 0; x < canvas.width; x++) {
                    const index = (y * canvas.width + x) * 4;
                    const r = data[index];
                    const g = data[index + 1];
                    const b = data[index + 2];
                    if (r === 255 && g === 255 && b === 255) {
                        positions.push({ x, y });
                    } else {
                        nonWhitePixels++;
                        if (nonWhitePixels <= 5) {
                            console.log(`Non-white pixel at (${x}, ${y}): r=${r}, g=${g}, b=${b}`);
                        }
                    }
                }
            }

            console.log(`Found ${positions.length} valid positions in mask: ${maskUrl}`);
            console.log(`Non-white pixels: ${nonWhitePixels}`);
            if (positions.length === 0) {
                console.warn(`No valid positions found in mask: ${maskUrl}`);
            }
            resolve(positions);
        };
        img.onerror = () => {
            reject(new Error(`Failed to load mask image: ${maskUrl}`));
        };
    });
}

async function displayMaze(interactive, step, interactiveContainer, storyIndex, interactiveId) {
    console.log('Displaying maze game:', interactive, 'Step:', step);

    if (!step.levels || !Array.isArray(step.levels) || step.levels.length === 0) {
        throw new Error('В интерактиве типа "maze" отсутствует или некорректно поле "steps[0].levels". Ожидается массив уровней с полями rows, cols, layout, start, end.');
    }

    const mazeContainer = document.createElement('div');
    mazeContainer.className = 'maze-container';

    // Описание
    const description = document.createElement('p');
    description.className = 'interactive-description';
    mazeContainer.appendChild(description);

    // Получаем уровень из URL
    const urlParams = new URLSearchParams(window.location.search);
    const levelIndex = parseInt(urlParams.get('level')) || 0;
    const selectedLevel = step.levels[Math.min(levelIndex, step.levels.length - 1)];

    // Проверяем структуру уровня
    if (!selectedLevel.rows || !selectedLevel.cols || !selectedLevel.layout || !selectedLevel.start || !selectedLevel.end) {
        throw new Error('В уровне лабиринта отсутствуют обязательные поля: rows, cols, layout, start, end.');
    }

    // Обновляем описание
    const totalLevels = step.levels.length;
    function updateDescription() {
        description.textContent = `Помоги зверьку найти сундук! Уровень ${levelIndex + 1}/${totalLevels}`;
    }
    updateDescription();

    // Создаём сетку лабиринта
    const mazeGrid = document.createElement('div');
    mazeGrid.className = 'maze-grid';
    mazeGrid.style.gridTemplateRows = `repeat(${selectedLevel.rows}, 60px)`; // Фиксируем размер клеток
    mazeGrid.style.gridTemplateColumns = `repeat(${selectedLevel.cols}, 60px)`;

    // Текущая позиция персонажа
    let playerPosition = { row: selectedLevel.start.row, col: selectedLevel.start.col };
    let playerElement = null;

    // Копия layout для безопасного изменения
    const layoutCopy = JSON.parse(JSON.stringify(selectedLevel.layout));

    // Обрабатываем препятствия из selectedLevel.obstacles
    if (selectedLevel.obstacles && Array.isArray(selectedLevel.obstacles)) {
        selectedLevel.obstacles.forEach(obstacle => {
            const { row, col } = obstacle;
            // Проверяем корректность данных
            if (row === undefined || col === undefined) {
                console.warn(`Недопустимые данные препятствия:`, obstacle);
                return;
            }
            if (row < 0 || row >= selectedLevel.rows || col < 0 || col >= selectedLevel.cols) {
                console.warn(`Позиция препятствия выходит за границы: row=${row}, col=${col}`);
                return;
            }
            // Обновляем layoutCopy
            layoutCopy[row][col] = 1;
        });
    }

    // Заполняем сетку
    for (let row = 0; row < selectedLevel.rows; row++) {
        for (let col = 0; col < selectedLevel.cols; col++) {
            const cell = document.createElement('div');
            cell.className = 'maze-cell';
            cell.setAttribute('data-row', row);
            cell.setAttribute('data-col', col);

            // Проверяем, что layout корректен
            if (!layoutCopy[row] || layoutCopy[row][col] === undefined) {
                throw new Error(`Некорректный layout в уровне ${levelIndex}: отсутствует строка ${row} или столбец ${col}.`);
            }

            const cellType = layoutCopy[row][col];

            if (cellType === 1) {
                // Стена или препятствие
                cell.classList.add('wall');

                // Выбираем изображение: чередуем wallImage и secondaryWallImage для всех клеток с cellType === 1
                const wallImage = Math.random() < 0.5 && selectedLevel.secondaryWallImage
                    ? selectedLevel.secondaryWallImage
                    : (selectedLevel.wallImage || 'assets/images/wall1.png');

                const img = document.createElement('img');
                img.src = wallImage;
                img.alt = 'Стена или препятствие';
                img.onerror = () => {
                    console.warn(`Не удалось загрузить изображение: ${wallImage}`);
                    img.src = 'assets/images/placeholder.jpg';
                };
                cell.appendChild(img);
            } else {
                // Путь
                cell.classList.add('path');
                if (selectedLevel.pathImage) {
                    const img = document.createElement('img');
                    img.src = selectedLevel.pathImage;
                    img.alt = 'Путь';
                    img.onerror = () => {
                        console.warn(`Не удалось загрузить изображение пути: ${selectedLevel.pathImage}`);
                        img.src = 'assets/images/placeholder.jpg';
                    };
                    cell.appendChild(img);
                }

                // Стартовая позиция
                if (row === selectedLevel.start.row && col === selectedLevel.start.col) {
                    playerElement = document.createElement('div');
                    playerElement.className = 'maze-player';
                    const img = document.createElement('img');
                    img.src = selectedLevel.character || 'assets/images/placeholder.jpg';
                    img.alt = 'Персонаж';
                    img.onerror = () => {
                        console.warn(`Не удалось загрузить изображение персонажа: ${selectedLevel.character}`);
                        img.src = 'assets/images/placeholder.jpg';
                    };
                    playerElement.appendChild(img);
                    cell.appendChild(playerElement);
                }

                // Финиш
                if (row === selectedLevel.end.row && col === selectedLevel.end.col) {
                    cell.classList.add('end');
                    if (selectedLevel.endImage) {
                        const img = document.createElement('img');
                        img.src = selectedLevel.endImage;
                        img.alt = 'Финиш';
                        img.onerror = () => {
                            console.warn(`Не удалось загрузить конечное изображение: ${selectedLevel.endImage}`);
                            img.src = 'assets/images/placeholder.jpg';
                        };
                        cell.appendChild(img);
                    }
                }
            }
            mazeGrid.appendChild(cell);
        }
    }

    mazeContainer.appendChild(mazeGrid);
    interactiveContainer.appendChild(mazeContainer);

    // Управление персонажем
    function movePlayer(direction) {
        let newRow = playerPosition.row;
        let newCol = playerPosition.col;

        switch (direction) {
            case 'up':
                newRow--;
                break;
            case 'down':
                newRow++;
                break;
            case 'left':
                newCol--;
                break;
            case 'right':
                newCol++;
                break;
            default:
                return;
        }

        // Проверяем, не выходит ли новая позиция за пределы сетки
        if (newRow < 0 || newRow >= selectedLevel.rows || newCol < 0 || newCol >= selectedLevel.cols) {
            const bumpSound = new Audio('assets/audio/bump.mp3');
            bumpSound.play().catch(error => console.error('Failed to play bump sound:', error));
            return;
        }

        // Проверяем, не стена ли на новой позиции (используем layoutCopy)
        console.log(`Проверка движения на (${newRow}, ${newCol}): layoutCopy[${newRow}][${newCol}] = ${layoutCopy[newRow][newCol]}`);
        if (layoutCopy[newRow][newCol] === 1) {
            console.log('Обнаружена стена, движение заблокировано.');
            const bumpSound = new Audio('assets/audio/bump.mp3');
            bumpSound.play().catch(error => console.error('Failed to play bump sound:', error));
            return;
        }

        // Проигрываем звук шага
        const stepSound = new Audio('assets/audio/step.mp3');
        stepSound.play().catch(error => console.error('Failed to play step sound:', error));

        // Обновляем позицию
        playerPosition.row = newRow;
        playerPosition.col = newCol;

        // Перемещаем персонажа в DOM
        const newCell = mazeGrid.querySelector(`.maze-cell[data-row="${newRow}"][data-col="${newCol}"]`);
        newCell.appendChild(playerElement);

        // Проверяем победу
        if (playerPosition.row === selectedLevel.end.row && playerPosition.col === selectedLevel.end.col) {
            const resultDiv = document.createElement('div');
            resultDiv.className = 'maze-result';
            resultDiv.innerHTML = `<p>Поздравляем! Ты нашёл сундук!</p>`;

            const celebrationSound = new Audio('assets/audio/celebration.mp3');
            celebrationSound.play().catch(error => {
                console.error('Failed to play celebration sound:', error);
            });

            const buttonContainer = document.createElement('div');
            buttonContainer.className = 'result-buttons';

            if (levelIndex + 1 < step.levels.length) {
                // Переход на следующий уровень
                setTimeout(() => {
                    window.location.href = `interactive.html?story=${storyIndex}&interactive=${interactiveId}&level=${levelIndex + 1}`;
                }, 2000);
            } else {
                // Последний уровень — кнопка "Играть ещё раз"
                const restartButton = document.createElement('button');
                restartButton.className = 'restart-button';
                restartButton.textContent = 'Играть ещё раз';
                restartButton.addEventListener('click', () => {
                    window.location.href = `interactive.html?story=${storyIndex}&interactive=${interactiveId}&level=0`;
                });
                buttonContainer.appendChild(restartButton);
            }

            resultDiv.appendChild(buttonContainer);
            interactiveContainer.appendChild(resultDiv);
        }
    }

    // Управление клавишами
    document.addEventListener('keydown', (e) => {
        switch (e.key) {
            case 'ArrowUp':
            case 'w':
                movePlayer('up');
                break;
            case 'ArrowDown':
            case 's':
                movePlayer('down');
                break;
            case 'ArrowLeft':
            case 'a':
                movePlayer('left');
                break;
            case 'ArrowRight':
            case 'd':
                movePlayer('right');
                break;
        }
    });

    // Управление свайпами (для мобильных устройств)
    let touchStartX = 0;
    let touchStartY = 0;

    mazeContainer.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    }, { passive: false });

    mazeContainer.addEventListener('touchend', (e) => {
        if (!e.changedTouches || e.changedTouches.length !== 1) return;
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;

        const deltaX = touchEndX - touchStartX;
        const deltaY = touchEndY - touchStartY;

        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            // Горизонтальный свайп
            if (deltaX > 50) {
                movePlayer('right');
            } else if (deltaX < -50) {
                movePlayer('left');
            }
        } else {
            // Вертикальный свайп
            if (deltaY > 50) {
                movePlayer('down');
            } else if (deltaY < -50) {
                movePlayer('up');
            }
        }
    }, { passive: false });
}

// Основная функция инициализации
async function initInteractivePage() {
    console.log('DOM loaded, initializing interactive page...');

    const interactiveContainer = document.querySelector('#interactive-content');
    const interactiveTitleElement = document.querySelector('#interactive-title');

    if (!interactiveContainer || !interactiveTitleElement) {
        console.error('Required elements not found!');
        showError(interactiveContainer, 'Ошибка в структуре страницы.', 'Не найдены элементы: interactive-content или interactive-title.');
        return;
    }

    const protocolCheck = checkProtocol();
    if (protocolCheck.isLocal) {
        showError(interactiveContainer, protocolCheck.error, protocolCheck.details);
        showError(interactiveContainer, 'Запустите проект через сервер!', 'fetch не работает с file://. Используйте Live Server в VS Code или разверните через Firebase Hosting.');
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const storyIndex = parseInt(urlParams.get('story'), 10);
    const interactiveId = parseInt(urlParams.get('interactive'), 10);
    console.log('Story index:', storyIndex, 'Interactive ID:', interactiveId);

    if (isNaN(storyIndex) || isNaN(interactiveId)) {
        showError(interactiveContainer, 'Ошибка загрузки интерактива.', 'Не указаны или некорректны параметры story и interactive в URL.');
        return;
    }

    try {
        console.log('Fetching interactives.json...');
        const response = await fetch('interactives.json');
        console.log('Fetch response:', response);
        console.log('Response status:', response.status, response.statusText);
        console.log('Response URL:', response.url);

        if (!response.ok) {
            throw new Error(`Не удалось загрузить interactives.json. Статус: ${response.status} ${response.statusText}.`);
        }

        const data = await response.json();
        console.log('Parsed JSON data:', data);

        if (!data.interactives || !Array.isArray(data.interactives) || data.interactives.length === 0) {
            throw new Error('Файл interactives.json пуст или содержит некорректные данные.');
        }

        if (interactiveId < 0 || interactiveId >= data.interactives.length) {
            throw new Error(`Интерактив с ID ${interactiveId} не найден. Всего интерактивов: ${data.interactives.length}.`);
        }

        const interactive = data.interactives[interactiveId];
        console.log('Loaded interactive data:', interactive);

        if (interactive.type === 'quiz') {
            interactiveTitleElement.textContent = 'Викторина: ответь правильно на вопросы';
        } else if (interactive.type === 'match') {
            interactiveTitleElement.textContent = 'Найди пары';
            const description = document.createElement('p');
            description.className = 'interactive-description';
            description.textContent = 'Соедини одинаковые карточки, чтобы найти все пары!';
            interactiveContainer.appendChild(description);
        } else if (interactive.type === 'evolution') {
            interactiveTitleElement.textContent = 'Лесная эволюция';
        } else if (interactive.type === 'puzzle') {
            interactiveTitleElement.textContent = 'Собери лесной пазл';
            const description = document.createElement('p');
            description.className = 'interactive-description';
            description.textContent = 'Перетаскивай кусочки пазла, чтобы собрать картинку!';
            interactiveContainer.appendChild(description);
        } else if (interactive.type === 'river-cleanup') {
            interactiveTitleElement.textContent = 'Помоги реке стать чистой';
            const description = document.createElement('p');
            description.className = 'interactive-description';
            description.textContent = 'Убери весь мусор из реки, но не трогай рыбок и лилии!';
            interactiveContainer.appendChild(description);
        } else if (interactive.type === 'maze') {
            interactiveTitleElement.textContent = 'Пройди лабиринт';
        } else {
            interactiveTitleElement.textContent = 'Интерактивная игра';
        }

        if (!interactive.steps || !Array.isArray(interactive.steps) || interactive.steps.length === 0) {
            throw new Error('В интерактиве отсутствует или некорректно поле "steps". Ожидается массив с данными интерактива.');
        }

        if (interactive.type === 'quiz') {
            displayQuiz(interactive, interactive.steps);
        } else if (interactive.type === 'match') {
            const step = interactive.steps[0];
            displayMatch(interactive, step);
        } else if (interactive.type === 'evolution') {
            const step = interactive.steps[0];
            displayEvolution(interactive, step);
        } else if (interactive.type === 'puzzle') {
            const step = interactive.steps[0];
            displayPuzzle(interactive, step);
        } else if (interactive.type === 'river-cleanup') {
            const step = interactive.steps[0];
            await displayRiverCleanup(interactive, step);
        } else if (interactive.type === 'maze') {
            const step = interactive.steps[0];
            await displayMaze(interactive, step, interactiveContainer, storyIndex, interactiveId);
        } else {
            throw new Error(`Неизвестный тип интерактива: ${interactive.type}. Поддерживаются: quiz, match, evolution, puzzle, river-cleanup, maze.`);
        }
    } catch (error) {
        console.error('Error loading interactive:', error);
        showError(interactiveContainer, 'Не удалось загрузить интерактив.', `Детали: ${error.message}`);
    }

    function displayQuiz(interactive, questions) {
        console.log('Displaying quiz:', interactive);
        console.log('Questions data:', questions);

        if (!Array.isArray(questions)) {
            throw new Error('В интерактиве типа "quiz" поле "steps" должно быть массивом вопросов.');
        }

        if (questions.length === 0) {
            throw new Error('В интерактиве типа "quiz" отсутствуют вопросы в поле "steps". Ожидается массив вопросов с полями question, options, correct и explanation.');
        }

        const shuffledQuestions = questions.sort(() => Math.random() - 0.5);
        const selectedQuestions = shuffledQuestions.slice(0, 3);

        const quizContainer = document.createElement('div');
        quizContainer.className = 'quiz-question';

        let correctAnswers = 0;

        const tapSound = new Audio('assets/audio/tap.mp3');
        tapSound.load();

        selectedQuestions.forEach((question, qIndex) => {
            console.log(`Processing question ${qIndex}:`, question);

            if (!question.question || !Array.isArray(question.options) || question.options.length === 0 || question.correct === undefined) {
                console.warn(`Question at index ${qIndex} has invalid structure:`, question);
                return;
            }

            const questionDiv = document.createElement('div');
            questionDiv.className = 'quiz-question';
            questionDiv.style.display = qIndex === 0 ? 'block' : 'none';
            questionDiv.setAttribute('data-question-index', qIndex);

            const questionText = document.createElement('p');
            questionText.textContent = question.question;
            questionDiv.appendChild(questionText);

            const optionsDiv = document.createElement('div');
            optionsDiv.className = 'quiz-options';

            question.options.forEach((option, oIndex) => {
                const optionBtn = document.createElement('button');
                optionBtn.className = 'quiz-option';
                optionBtn.textContent = option;
                optionBtn.addEventListener('click', () => {
                    tapSound.currentTime = 0;
                    tapSound.play().catch(error => {
                        console.error('Failed to play tap sound:', error);
                    });
                    handleQuizAnswer(qIndex, oIndex, question.correct, selectedQuestions.length, question.explanation, (isCorrect) => {
                        if (isCorrect) correctAnswers++;
                    });
                });
                optionsDiv.appendChild(optionBtn);
            });

            questionDiv.appendChild(optionsDiv);
            quizContainer.appendChild(questionDiv);
        });

        if (quizContainer.children.length === 0) {
            throw new Error('Не удалось отобразить викторину: все вопросы имеют некорректную структуру.');
        }

        interactiveContainer.appendChild(quizContainer);

        function handleQuizAnswer(questionIndex, selectedIndex, correctIndex, totalQuestions, explanation, callback) {
            console.log(`Quiz answer: question ${questionIndex}, selected ${selectedIndex}, correct ${correctIndex}`);
            const questionDiv = quizContainer.querySelector(`.quiz-question[data-question-index="${questionIndex}"]`);
            const options = questionDiv.querySelectorAll('.quiz-option');

            const isCorrect = selectedIndex === correctIndex;
            callback(isCorrect);

            options.forEach((option, index) => {
                if (index === correctIndex) {
                    option.classList.add('correct');
                } else if (index === selectedIndex) {
                    option.classList.add('incorrect');
                }
                option.disabled = true;
            });

            const resultDiv = document.createElement('div');
            resultDiv.className = 'quiz-result';
            const resultText = document.createElement('p');
            resultText.textContent = isCorrect ? 'Правильно!' : 'Неправильно, попробуй ещё раз!';
            resultDiv.appendChild(resultText);

            if (explanation) {
                const explanationText = document.createElement('p');
                explanationText.textContent = explanation;
                explanationText.style.fontStyle = 'italic';
                resultDiv.appendChild(explanationText);
            }

            if (questionIndex < totalQuestions - 1) {
                const nextButton = document.createElement('button');
                nextButton.className = 'next-button';
                nextButton.textContent = 'Дальше';
                nextButton.addEventListener('click', () => {
                    questionDiv.style.display = 'none';
                    const nextQuestion = quizContainer.querySelector(`.quiz-question[data-question-index="${questionIndex + 1}"]`);
                    if (nextQuestion) {
                        nextQuestion.style.display = 'block';
                    }
                });
                resultDiv.appendChild(nextButton);
            } else {
                const finishText = document.createElement('p');
                finishText.textContent = `Молодец, ты прошёл викторину! Твой результат: ${correctAnswers} из ${totalQuestions} правильных ответов!`;
                resultDiv.appendChild(finishText);

                const celebrationSound = new Audio('assets/audio/celebration.mp3');
                celebrationSound.play().catch(error => {
                    console.error('Failed to play celebration sound:', error);
                });

                const buttonContainer = document.createElement('div');
                buttonContainer.className = 'result-buttons';

                const restartButton = document.createElement('button');
                restartButton.className = 'restart-button';
                restartButton.textContent = 'Играть ещё раз';
                restartButton.addEventListener('click', () => {
                    window.location.reload();
                });
                buttonContainer.appendChild(restartButton);

                resultDiv.appendChild(buttonContainer);
            }

            questionDiv.appendChild(resultDiv);
        }
    }

    function displayMatch(interactive, step) {
        console.log('Displaying match game:', interactive, 'Step:', step);

        if (!step.pairs || !Array.isArray(step.pairs) || step.pairs.length === 0) {
            throw new Error('В интерактиве типа "match" отсутствует или некорректно поле "steps[0].pairs". Ожидается массив пар с полями id и image.');
        }

        const matchContainer = document.createElement('div');
        matchContainer.className = 'match-container';

        const pairs = [...step.pairs, ...step.pairs];
        pairs.sort(() => Math.random() - 0.5);

        let firstCard = null;
        let secondCard = null;
        let lockBoard = false;

        const tapSound = new Audio('assets/audio/tap.mp3');
        tapSound.load();

        pairs.forEach((pair, index) => {
            if (!pair.id || !pair.image) {
                console.warn(`Pair at index ${index} has invalid structure:`, pair);
                return;
            }

            const card = document.createElement('div');
            card.className = 'match-card';
            card.setAttribute('data-id', pair.id);

            const cardInner = document.createElement('div');
            cardInner.className = 'match-card-inner';

            const cardFront = document.createElement('div');
            cardFront.className = 'match-card-front';

            const cardBack = document.createElement('div');
            cardBack.className = 'match-card-back';

            const img = document.createElement('img');
            img.src = pair.image;
            img.alt = `Карточка ${pair.id}`;
            img.onerror = () => {
                console.warn(`Failed to load image: ${pair.image}`);
                img.src = 'assets/images/placeholder.jpg';
            };
            cardBack.appendChild(img);

            cardInner.appendChild(cardFront);
            cardInner.appendChild(cardBack);
            card.appendChild(cardInner);

            card.addEventListener('click', () => {
                if (lockBoard || card.classList.contains('open') || card.classList.contains('matched')) return;

                tapSound.currentTime = 0;
                tapSound.play().catch(error => {
                    console.error('Failed to play tap sound:', error);
                });

                card.classList.add('open');

                if (!firstCard) {
                    firstCard = card;
                } else {
                    secondCard = card;
                    lockBoard = true;

                    const firstId = firstCard.getAttribute('data-id');
                    const secondId = secondCard.getAttribute('data-id');

                    if (firstId === secondId) {
                        firstCard.classList.add('matched');
                        secondCard.classList.add('matched');
                        resetBoard();
                    } else {
                        setTimeout(() => {
                            firstCard.classList.remove('open');
                            secondCard.classList.remove('open');
                            resetBoard();
                        }, 1000);
                    }

                    const allMatched = matchContainer.querySelectorAll('.match-card.matched').length === pairs.length;
                    if (allMatched) {
                        const resultDiv = document.createElement('div');
                        resultDiv.className = 'match-result';
                        resultDiv.innerHTML = `
                            <p>Поздравляем! Ты нашёл все пары!</p>
                        `;

                        const celebrationSound = new Audio('assets/audio/celebration.mp3');
                        celebrationSound.play().catch(error => {
                            console.error('Failed to play celebration sound:', error);
                        });

                        const buttonContainer = document.createElement('div');
                        buttonContainer.className = 'result-buttons';

                        const restartButton = document.createElement('button');
                        restartButton.className = 'restart-button';
                        restartButton.textContent = 'Играть ещё раз';
                        restartButton.addEventListener('click', () => {
                            window.location.reload();
                        });
                        buttonContainer.appendChild(restartButton);

                        resultDiv.appendChild(buttonContainer);
                        interactiveContainer.appendChild(resultDiv);
                    }
                }
            });

            matchContainer.appendChild(card);
        });

        if (matchContainer.children.length === 0) {
            throw new Error('Не удалось отобразить игру "Найди пару": все пары имеют некорректную структуру.');
        }

        function resetBoard() {
            firstCard = null;
            secondCard = null;
            lockBoard = false;
        }

        interactiveContainer.appendChild(matchContainer);
    }

    function displayEvolution(interactive, step) {
        console.log('Displaying evolution game:', interactive, 'Step:', step);

        if (!step.levels || !Array.isArray(step.levels) || step.levels.length === 0) {
            throw new Error('В интерактиве типа "evolution" отсутствует или некорректно поле "steps[0].levels". Ожидается массив уровней с полями characters.');
        }

        const evolutionContainer = document.createElement('div');
        evolutionContainer.className = 'evolution-container';

        // Создаём описание с указанием уровня
        const description = document.createElement('p');
        description.className = 'interactive-description';
        evolutionContainer.appendChild(description);

        // Создаём контейнеры для маленьких и взрослых героев
        const miniGrid = document.createElement('div');
        miniGrid.className = 'evolution-grid mini-grid';

        const adultGrid = document.createElement('div');
        adultGrid.className = 'evolution-grid adult-grid';

        // Выбираем уровень на основе параметра URL
        const urlParams = new URLSearchParams(window.location.search);
        const levelIndex = parseInt(urlParams.get('level')) || 0;
        const selectedLevel = step.levels[Math.min(levelIndex, step.levels.length - 1)];

        if (!selectedLevel.characters || !Array.isArray(selectedLevel.characters) || selectedLevel.characters.length === 0) {
            throw new Error('В интерактиве типа "evolution" отсутствует или некорректно поле "steps[0].levels[-1].characters". Ожидается массив персонажей с полями id, mini, adult и count.');
        }

        // Устанавливаем атрибут data-level для управления расположением карточек
        miniGrid.setAttribute('data-level', levelIndex);

        // Обновляем описание с уровнем
        const totalLevels = step.levels.length;
        function updateDescription() {
            description.textContent = `Объедини одинаковых героев, чтобы они выросли! Уровень ${levelIndex + 1}/${totalLevels}`;
        }
        updateDescription();

        const cells = [];
        const selectedCharacters = {};

        // Собираем все клетки для проверки проходимости
        const allCharacters = [];
        selectedLevel.characters.forEach(character => {
            if (!character.id || !character.mini || !character.adult || !character.count) {
                console.warn(`Character has invalid structure:`, character);
                return;
            }
            for (let i = 0; i < character.count; i++) {
                allCharacters.push({ ...character, uniqueId: `${character.id}-${i}` });
            }
        });

        // Проверяем проходимость расклада
        const characterCounts = {};
        allCharacters.forEach(char => {
            characterCounts[char.id] = (characterCounts[char.id] || 0) + 1;
        });
        const isPlayable = Object.values(characterCounts).every(count => count % 2 === 0);
        if (!isPlayable) {
            throw new Error('Расклад непроходим: количество героев каждого типа должно быть чётным.');
        }

        // Перемешиваем героев
        const shuffledCharacters = allCharacters.sort(() => Math.random() - 0.5);

        shuffledCharacters.forEach(character => {
            const cellDiv = document.createElement('div');
            cellDiv.className = 'evolution-cell mini';
            cellDiv.setAttribute('data-character-id', character.id);
            cellDiv.setAttribute('data-cell-id', character.uniqueId);

            const img = document.createElement('img');
            img.src = character.mini;
            img.alt = `Персонаж ${character.id}`;
            img.onerror = () => {
                console.warn(`Failed to load image: ${character.mini}`);
                img.src = 'assets/images/placeholder.jpg';
            };
            cellDiv.appendChild(img);

            cellDiv.addEventListener('click', () => {
                if (cellDiv.classList.contains('evolving') || cellDiv.classList.contains('hidden')) return;

                // Проверяем, не была ли эта карточка уже выбрана
                selectedCharacters[character.id] = selectedCharacters[character.id] || [];
                const alreadySelected = selectedCharacters[character.id].some(cell => cell.getAttribute('data-cell-id') === character.uniqueId);
                if (alreadySelected) return; // Игнорируем повторный клик по той же карточке

                // Добавляем подсветку выбранной карточки
                cellDiv.classList.add('selected');
                selectedCharacters[character.id].push(cellDiv);

                if (selectedCharacters[character.id].length === 2) {
                    const [firstCell, secondCell] = selectedCharacters[character.id];

                    firstCell.classList.add('evolving');
                    secondCell.classList.add('evolving');

                    // Убираем подсветку перед анимацией
                    firstCell.classList.remove('selected');
                    secondCell.classList.remove('selected');

                    // Воспроизводим звук
                    if (step.sound) {
                        const audio = new Audio(step.sound);
                        audio.play().catch(err => console.warn('Failed to play audio:', err));
                    }

                    setTimeout(() => {
                        firstCell.classList.add('hidden');
                        secondCell.classList.add('hidden');

                        const adultCell = document.createElement('div');
                        adultCell.className = 'evolution-cell adult';
                        adultCell.setAttribute('data-character-id', character.id);

                        const adultImg = document.createElement('img');
                        adultImg.src = character.adult;
                        adultImg.alt = `Взрослый ${character.id}`;
                        adultImg.onerror = () => {
                            console.warn(`Failed to load image: ${character.adult}`);
                            img.src = 'assets/images/placeholder.jpg';
                        };
                        adultCell.appendChild(adultImg);

                        // Добавляем анимацию появления
                        adultCell.classList.add('appear');

                        adultGrid.appendChild(adultCell);
                        cells.push(adultCell);

                        selectedCharacters[character.id] = [];

                        const allMiniCells = miniGrid.querySelectorAll('.evolution-cell:not(.hidden)');
                        if (allMiniCells.length === 0) {
                            const resultDiv = document.createElement('div');
                            resultDiv.className = 'evolution-result';
                            const levelNames = ['1 пара', '3 пары', '5 пар'];
                            const currentLevel = levelNames[Math.min(levelIndex, levelNames.length - 1)];
                            resultDiv.innerHTML = `
                                <p>Поздравляем! Все герои выросли!</p>
                            `;

                            // Добавляем звук победы на последнем уровне
                            if (levelIndex + 1 === step.levels.length) {
                                const celebrationSound = new Audio('assets/audio/celebration.mp3');
                                celebrationSound.play().catch(error => {
                                    console.error('Failed to play celebration sound:', error);
                                });
                            }

                            const buttonContainer = document.createElement('div');
                            buttonContainer.className = 'result-buttons';

                            // Если это не последний уровень, переходим автоматически
                            if (levelIndex + 1 < step.levels.length) {
                                setTimeout(() => {
                                    window.location.href = `interactive.html?story=${storyIndex}&interactive=${interactiveId}&level=${levelIndex + 1}`;
                                }, 2000);
                            } else {
                                // На последнем уровне показываем кнопку "Играть ещё раз"
                                const restartButton = document.createElement('button');
                                restartButton.className = 'restart-button';
                                restartButton.textContent = 'Играть ещё раз';
                                restartButton.addEventListener('click', () => {
                                    window.location.href = `interactive.html?story=${storyIndex}&interactive=${interactiveId}&level=0`;
                                });
                                buttonContainer.appendChild(restartButton);
                            }

                            resultDiv.appendChild(buttonContainer);
                            interactiveContainer.appendChild(resultDiv);
                        }
                    }, 1000);

                    // Улучшенный эффект с частицами
                    const particles = document.createElement('div');
                    particles.className = 'particles';
                    for (let i = 0; i < 20; i++) {
                        const particle = document.createElement('div');
                        particle.className = 'particle';
                        particle.style.setProperty('--x', `${Math.random() * 120 - 60}px`);
                        particle.style.setProperty('--y', `${Math.random() * 120 - 60}px`);
                        particle.style.backgroundColor = `hsl(${Math.random() * 360}, 70%, 60%)`;
                        particles.appendChild(particle);
                    }
                    firstCell.appendChild(particles);
                    secondCell.appendChild(particles);
                }
            });

            cells.push(cellDiv);
            miniGrid.appendChild(cellDiv);
        });

        if (cells.length === 0) {
            throw new Error('Не удалось отобразить игру "Эволюция": все персонажи имеют некорректную структуру.');
        }

        evolutionContainer.appendChild(miniGrid);
        evolutionContainer.appendChild(adultGrid);
        interactiveContainer.appendChild(evolutionContainer);
    }

    function displayPuzzle(interactive, step) {
        console.log('Displaying puzzle game:', interactive, 'Step:', step);

        if (!step.images || !Array.isArray(step.images) || !step.rows || !step.cols) {
            throw new Error('В интерактиве типа "puzzle" отсутствуют обязательные поля: images (массив), rows, cols.');
        }

        // Получаем imageIndex из URL или используем 0 по умолчанию
        const urlParams = new URLSearchParams(window.location.search);
        let imageIndex = parseInt(urlParams.get('imageIndex')) || 0;
        if (isNaN(imageIndex) || imageIndex < 0 || imageIndex >= step.images.length) {
            imageIndex = 0;
        }
        const selectedImage = step.images[imageIndex];

        const puzzleContainer = document.createElement('div');
        puzzleContainer.className = 'puzzle-container';

        // Создаём область для кусочков
        const piecesContainer = document.createElement('div');
        piecesContainer.className = 'puzzle-pieces';

        // Создаём сетку для пазла
        const puzzleGrid = document.createElement('div');
        puzzleGrid.className = 'puzzle-grid';
        puzzleGrid.style.gridTemplateRows = `repeat(${step.rows}, 1fr)`;
        puzzleGrid.style.gridTemplateColumns = `repeat(${step.cols}, 1fr)`;

        const totalPieces = step.rows * step.cols;

        // Размер кусочка фиксирован в CSS (100px)
        const pieceSize = 100;
        const gridWidth = pieceSize * step.cols; // Ширина сетки = размер кусочка * количество колонок

        const pieces = [];
        const correctPositions = {};

        // Создаём ячейки сетки
        for (let i = 0; i < totalPieces; i++) {
            const cell = document.createElement('div');
            cell.className = 'puzzle-cell';
            cell.setAttribute('data-index', i);
            cell.setAttribute('droppable', 'true');

            // Десктоп: Поддержка drag and drop
            cell.addEventListener('dragover', (e) => {
                e.preventDefault();
            });

            cell.addEventListener('drop', (e) => {
                e.preventDefault();
                const pieceId = e.dataTransfer.getData('text/plain');
                const piece = document.getElementById(pieceId);
                if (piece && !cell.hasChildNodes()) {
                    cell.appendChild(piece);
                    piece.classList.remove('dragging');

                    const pieceIndex = parseInt(piece.getAttribute('data-correct-index'));
                    const cellIndex = parseInt(cell.getAttribute('data-index'));
                    if (pieceIndex === cellIndex) {
                        piece.setAttribute('data-placed', 'true');
                        piece.style.borderColor = '#2e7d32';
                    } else {
                        piece.setAttribute('data-placed', 'false');
                        piece.style.borderColor = '#d9534f';
                    }

                    checkPuzzleCompletion();
                }
            });

            puzzleGrid.appendChild(cell);
            correctPositions[i] = i;
        }

        // Делаем область piecesContainer целью для возврата кусочков
        piecesContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        piecesContainer.addEventListener('drop', (e) => {
            e.preventDefault();
            const pieceId = e.dataTransfer.getData('text/plain');
            const piece = document.getElementById(pieceId);
            if (piece && piece.parentNode.classList.contains('puzzle-cell')) {
                piece.parentNode.innerHTML = '';
                piece.classList.remove('dragging');
                piece.style.borderColor = '#2e7d32';
                piece.setAttribute('data-placed', 'false');
                piecesContainer.appendChild(piece);
                checkPuzzleCompletion();
            }
        });

        piecesContainer.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (!e.touches || e.touches.length === 0) return;
            const touch = e.touches[0];
            const target = touch.target.closest('.puzzle-piece');
            if (target && target.parentNode.classList.contains('puzzle-cell')) {
                target.parentNode.innerHTML = '';
                target.classList.remove('dragging');
                target.style.borderColor = '#2e7d32';
                target.setAttribute('data-placed', 'false');
                piecesContainer.appendChild(target);
                checkPuzzleCompletion();
            }
        }, { passive: false });

        // Создаём кусочки пазла
        for (let row = 0; row < step.rows; row++) {
            for (let col = 0; col < step.cols; col++) {
                const index = row * step.cols + col;
                const piece = document.createElement('div');
                piece.className = 'puzzle-piece';
                piece.id = `piece-${index}`;
                piece.setAttribute('data-placed', 'false');
                piece.setAttribute('draggable', 'true');
                piece.style.width = `${pieceSize}px`;
                piece.style.height = `${pieceSize}px`;
                piece.style.backgroundImage = `url(${selectedImage})`;
                piece.style.backgroundSize = `${gridWidth}px ${gridWidth}px`;
                piece.style.backgroundPosition = `-${col * pieceSize}px -${row * pieceSize}px`;
                piece.setAttribute('data-correct-index', index);

                // Десктоп: Drag events
                piece.addEventListener('dragstart', (e) => {
                    e.dataTransfer.setData('text/plain', piece.id);
                    piece.classList.add('dragging');
                });

                piece.addEventListener('dragend', () => {
                    piece.classList.remove('dragging');
                });

                // Мобильные устройства: Touch events
                piece.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    if (!e.touches || e.touches.length === 0) {
                        return;
                    }
                    const touchPiece = piece;
                    touchPiece.classList.add('dragging');

                    // Отключаем скроллинг на время перетаскивания
                    document.body.style.overflow = 'hidden';

                    const touch = e.touches[0];
                    const rect = touchPiece.getBoundingClientRect();
                    const startX = touch.clientX - rect.left;
                    const startY = touch.clientY - rect.top;

                    // Перемещаем сам кусочек
                    touchPiece.style.position = 'fixed';
                    touchPiece.style.zIndex = '1000';
                    touchPiece.style.opacity = '0.8';
                    touchPiece.style.left = `${touch.clientX - startX}px`;
                    touchPiece.style.top = `${touch.clientY - startY}px`;
                    document.body.appendChild(touchPiece); // Перемещаем кусочек в body

                    let lastTouchX = touch.clientX;
                    let lastTouchY = touch.clientY;

                    const moveHandler = (moveEvent) => {
                        moveEvent.preventDefault();
                        if (!moveEvent.touches || moveEvent.touches.length === 0) {
                            return;
                        }
                        const touchMove = moveEvent.touches[0];
                        lastTouchX = touchMove.clientX;
                        lastTouchY = touchMove.clientY;
                        touchPiece.style.left = `${lastTouchX - startX}px`;
                        touchPiece.style.top = `${lastTouchY - startY}px`;
                    };

                    const endHandler = (endEvent) => {
                        endEvent.preventDefault();
                        touchPiece.style.opacity = '1';
                        touchPiece.classList.remove('dragging');
                        document.removeEventListener('touchmove', moveHandler);
                        document.removeEventListener('touchend', endHandler);
                        document.body.style.overflow = ''; // Восстанавливаем скроллинг

                        // Получаем текущие координаты кусочка
                        const pieceRect = touchPiece.getBoundingClientRect();

                        // Ищем ячейку, с которой кусочек пересекается
                        const cells = puzzleGrid.querySelectorAll('.puzzle-cell');
                        let targetCell = null;

                        cells.forEach(cell => {
                            if (cell.hasChildNodes()) return; // Пропускаем занятую ячейку
                            const cellRect = cell.getBoundingClientRect();
                            const intersects = !(
                                pieceRect.right < cellRect.left ||
                                pieceRect.left > cellRect.right ||
                                pieceRect.bottom < cellRect.top ||
                                pieceRect.top > cellRect.bottom
                            );
                            if (intersects) {
                                targetCell = cell;
                            }
                        });

                        if (targetCell) {
                            targetCell.appendChild(touchPiece);
                            const pieceIndex = parseInt(touchPiece.getAttribute('data-correct-index'));
                            const cellIndex = parseInt(targetCell.getAttribute('data-index'));
                            if (pieceIndex === cellIndex) {
                                touchPiece.setAttribute('data-placed', 'true');
                                touchPiece.style.borderColor = '#2e7d32';
                            } else {
                                touchPiece.setAttribute('data-placed', 'false');
                                touchPiece.style.borderColor = '#d9534f';
                            }
                            checkPuzzleCompletion();
                        } else {
                            touchPiece.style.borderColor = '#2e7d32';
                            touchPiece.setAttribute('data-placed', 'false');
                            piecesContainer.appendChild(touchPiece);
                        }

                        // Сбрасываем стили position
                        touchPiece.style.position = '';
                        touchPiece.style.left = '';
                        touchPiece.style.top = '';
                        touchPiece.style.zIndex = '';
                    };

                    document.addEventListener('touchmove', moveHandler, { passive: false });
                    document.addEventListener('touchend', endHandler, { passive: false });
                }, { passive: false });

                pieces.push(piece);
            }
        }

        // Перемешиваем кусочки только один раз при инициализации
        const shuffledPieces = [...pieces].sort(() => Math.random() - 0.5);
        shuffledPieces.forEach(piece => piecesContainer.appendChild(piece));

        // Сначала добавляем puzzleGrid, затем piecesContainer
        puzzleContainer.appendChild(puzzleGrid);
        puzzleContainer.appendChild(piecesContainer);
        interactiveContainer.appendChild(puzzleContainer);

        function checkPuzzleCompletion() {
            const cells = puzzleGrid.querySelectorAll('.puzzle-cell');
            let allCorrect = true;
            let allPlaced = true;

            cells.forEach(cell => {
                const piece = cell.firstChild;
                if (!piece) {
                    allPlaced = false;
                    allCorrect = false;
                    return;
                }
                const pieceIndex = parseInt(piece.getAttribute('data-correct-index'));
                const cellIndex = parseInt(cell.getAttribute('data-index'));
                if (pieceIndex !== cellIndex) {
                    allCorrect = false;
                }
            });

            if (allPlaced && allCorrect) {
                puzzleGrid.classList.add('completed');
                if (step.sound) {
                    const audio = new Audio(step.sound);
                    if (audio) {
                        audio.play().catch(err => console.warn('Failed to play audio:', err));
                    }
                }

                const resultDiv = document.createElement('div');
                resultDiv.className = 'puzzle-result';
                resultDiv.innerHTML = `
                    <p>Поздравляем! Ты собрал пазл!</p>
                `;

                const buttonContainer = document.createElement('div');
                buttonContainer.className = 'result-buttons';

                const restartButton = document.createElement('button');
                restartButton.className = 'restart-button';
                restartButton.textContent = 'Играть ещё раз';
                // Переходим к следующей картинке
                const nextImageIndex = (imageIndex + 1) % step.images.length;
                restartButton.addEventListener('click', () => {
                    window.location.href = `interactive.html?story=${storyIndex}&interactive=${interactiveId}&imageIndex=${nextImageIndex}`;
                });
                buttonContainer.appendChild(restartButton);

                resultDiv.appendChild(buttonContainer);
                interactiveContainer.appendChild(resultDiv);
            }
        }
    }

    async function displayRiverCleanup(interactive, step) {
        console.log('Displaying river cleanup game:', interactive, 'Step:', step);

        if (!step.backgrounds || !step.items || !Array.isArray(step.items) || !step.masks) {
            throw new Error('В интерактиве типа "river-cleanup" отсутствуют обязательные поля: backgrounds (с dirty и clean), items (массив), masks.');
        }

        const riverContainer = document.createElement('div');
        riverContainer.className = 'river-container';

        riverContainer.style.backgroundImage = `url('${step.backgrounds.dirty}')`;

        interactiveContainer.appendChild(riverContainer);
        await new Promise(resolve => {
            const checkRender = () => {
                if (riverContainer.clientWidth > 0 && riverContainer.clientHeight > 0) {
                    resolve();
                } else {
                    requestAnimationFrame(checkRender);
                }
            };
            requestAnimationFrame(checkRender);
        });

        const containerWidth = riverContainer.clientWidth;
        const containerHeight = riverContainer.clientHeight;
        console.log(`Container size: ${containerWidth}x${containerHeight}`);

        if (Math.abs(containerWidth - containerHeight) > 1) {
            console.warn(`Container is not square: ${containerWidth}x${containerHeight}`);
        }

        const baseSize = 600;
        const scale = containerWidth / baseSize;
        console.log(`Scale factor: ${scale}`);

        const allItems = [];
        step.items.forEach(item => {
            if (!item.type || !item.image || !item.count || !item.placementMask) {
                console.warn(`Item has invalid structure:`, item);
                return;
            }
            if (!step.masks[item.placementMask]) {
                console.warn(`Mask "${item.placementMask}" not found for item:`, item);
                return;
            }
            for (let i = 0; i < item.count; i++) {
                allItems.push({ ...item, uniqueId: `${item.type}-${i}` });
            }
        });

        const trashCount = allItems.filter(item => item.type === 'trash').length;
        const natureCount = allItems.filter(item => item.type === 'nature').length;
        console.log(`Total items to place: ${allItems.length}, Trash: ${trashCount}, Nature: ${natureCount}`);

        const shuffledItems = allItems.sort(() => Math.random() - 0.5);

        let placedTrash = 0;
        let placedNature = 0;

        const tapSound = new Audio('assets/audio/tap.mp3');
        tapSound.load();
        const netSound = new Audio('assets/audio/net.mp3');
        netSound.load();

        const maskPositions = {};
        const maskSizes = {};
        const maskCanvases = {};
        for (const maskType of Object.keys(step.masks)) {
            const maskUrl = step.masks[maskType].dirty;
            const positions = await loadMaskPositions(maskUrl);
            maskPositions[maskType] = positions;

            const img = new Image();
            img.src = maskUrl;
            await new Promise(resolve => {
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d', { willReadFrequently: true });
                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx.drawImage(img, 0, 0);
                    maskCanvases[maskType] = canvas;
                    maskSizes[maskType] = { width: img.width, height: img.height };
                    resolve();
                };
                img.onerror = () => {
                    console.error(`Failed to load mask for size detection: ${maskUrl}`);
                    maskSizes[maskType] = { width: baseSize, height: baseSize };
                    maskCanvases[maskType] = null;
                    resolve();
                };
            });
        }

        const occupiedAreas = [];
        const itemElements = [];

        function isPixelWhite(maskType, x, y) {
            const canvas = maskCanvases[maskType];
            if (!canvas) return false;
            if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) {
                console.log(`Coordinates out of bounds for mask ${maskType}: (${x}, ${y})`);
                return false;
            }
            const ctx = canvas.getContext('2d');
            const pixel = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
            const r = pixel[0];
            const g = pixel[1];
            const b = pixel[2];
            const isWhite = r === 255 && g === 255 && b === 255;
            if (!isWhite) {
                console.log(`Pixel at (${Math.floor(x)}, ${Math.floor(y)}) in mask ${maskType} is not white: r=${r}, g=${g}, b=${b}`);
            }
            return isWhite;
        }

        function isItemFullyInWhiteArea(maskType, maskX, maskY, itemSizeInMask) {
            const halfSize = itemSizeInMask / 2;
            const corners = [
                { x: maskX - halfSize, y: maskY - halfSize },
                { x: maskX + halfSize, y: maskY - halfSize },
                { x: maskX - halfSize, y: maskY + halfSize },
                { x: maskX + halfSize, y: maskY + halfSize },
            ];

            for (const corner of corners) {
                if (!isPixelWhite(maskType, corner.x, corner.y)) {
                    console.log(`Corner at (${corner.x}, ${corner.y}) in mask ${maskType} is not white`);
                    return false;
                }
            }
            return true;
        }

        for (const item of shuffledItems) {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'river-item';
            itemDiv.setAttribute('data-type', item.type);
            itemDiv.setAttribute('data-id', item.uniqueId);

            const img = document.createElement('img');
            img.src = item.image;
            img.alt = item.type === 'trash' ? 'Мусор' : 'Природа';
            img.onerror = () => {
                console.warn(`Failed to load image: ${item.image}`);
                img.src = 'assets/images/placeholder.jpg';
            };
            itemDiv.appendChild(img);

            const availablePositions = maskPositions[item.placementMask];
            if (!availablePositions || availablePositions.length === 0) {
                console.warn(`No available positions for mask "${item.placementMask}"`);
                continue;
            }

            const baseItemSize = 60;
            const itemWidth = baseItemSize * scale;
            const itemHeight = baseItemSize * scale;
            itemDiv.style.width = `${itemWidth}px`;
            itemDiv.style.height = `${itemHeight}px`;

            const itemSizeInMask = baseItemSize;

            let position = null;
            let attempts = 0;
            const maxAttempts = 100;
            const maskSize = maskSizes[item.placementMask];
            const maskWidth = maskSize.width;
            const maskHeight = maskSize.height;

            while (attempts < maxAttempts) {
                const randomIndex = Math.floor(Math.random() * availablePositions.length);
                const pos = availablePositions[randomIndex];
                let posX = pos.x;
                let posY = pos.y;

                posX = (posX / maskWidth) * baseSize;
                posY = (posY / maskHeight) * baseSize;

                let percentX = (posX / baseSize) * 100;
                let percentY = (posY / baseSize) * 100;

                const adjustedX = Math.max(0, Math.min(percentX, 100 - (itemWidth / containerWidth) * 100));
                const adjustedY = Math.max(0, Math.min(percentY, 100 - (itemHeight / containerHeight) * 100));

                const maskX = (adjustedX / 100) * maskWidth;
                const maskY = (adjustedY / 100) * maskHeight;

                console.log(`Attempt ${attempts + 1} for ${item.uniqueId}: Checking position (${adjustedX}%, ${adjustedY}%) which maps to mask (${maskX}, ${maskY})`);

                if (!isItemFullyInWhiteArea(item.placementMask, maskX, maskY, itemSizeInMask)) {
                    attempts++;
                    continue;
                }

                const itemRect = {
                    left: posX - baseItemSize / 2,
                    right: posX + baseItemSize / 2,
                    top: posY - baseItemSize / 2,
                    bottom: posY + baseItemSize / 2
                };

                const overlaps = occupiedAreas.some(area => {
                    return !(
                        itemRect.right < area.left ||
                        itemRect.left > area.right ||
                        itemRect.bottom < area.top ||
                        itemRect.top > area.bottom
                    );
                });

                if (!overlaps) {
                    position = { x: adjustedX, y: adjustedY };
                    occupiedAreas.push({
                        left: posX - baseItemSize / 2,
                        right: posX + baseItemSize / 2,
                        top: posY - baseItemSize / 2,
                        bottom: posY + baseItemSize / 2
                    });
                    break;
                }

                attempts++;
            }

            if (!position) {
                console.warn(`Could not find a non-overlapping position for item within mask:`, item);
                continue;
            }

            console.log(`Placing item ${item.uniqueId} at ${position.x}% x ${position.y}%`);
            itemDiv.style.left = `${position.x}%`;
            itemDiv.style.top = `${position.y}%`;

            if (item.type === 'trash') {
                placedTrash++;
            } else if (item.type === 'nature') {
                placedNature++;
            }

            itemDiv.addEventListener('click', () => {
                if (itemDiv.classList.contains('removed')) return;

                resetInactivityTimer();

                if (item.type === 'trash') {
                    tapSound.currentTime = 0;
                    tapSound.play().catch(error => {
                        console.error('Failed to play tap sound:', error);
                    });
                } else {
                    netSound.currentTime = 0;
                    netSound.play().catch(error => {
                        console.error('Failed to play net sound:', error);
                    });
                }

                if (item.type === 'trash') {
                    itemDiv.classList.add('removed');
                    trashRemoved++;
                    console.log(`Trash removed: ${trashRemoved}/${totalTrash}`);

                    if (trashRemoved === totalTrash) {
                        clearTimeout(inactivityTimeout);

                        riverContainer.style.backgroundImage = `url('${step.backgrounds.clean}')`;
                        const resultDiv = document.createElement('div');
                        resultDiv.className = 'river-result';
                        resultDiv.innerHTML = `
                            <p>Поздравляем! Река снова чистая!</p>
                        `;

                        if (step.sound) {
                            const celebrationSound = new Audio(step.sound);
                            celebrationSound.play().catch(error => {
                                console.error('Failed to play celebration sound:', error);
                            });
                        }

                        const buttonContainer = document.createElement('div');
                        buttonContainer.className = 'result-buttons';

                        const restartButton = document.createElement('button');
                        restartButton.className = 'restart-button';
                        restartButton.textContent = 'Играть ещё раз';
                        restartButton.addEventListener('click', () => {
                            window.location.reload();
                        });
                        buttonContainer.appendChild(restartButton);

                        resultDiv.appendChild(buttonContainer);
                        interactiveContainer.appendChild(resultDiv);
                    }
                } else {
                    itemDiv.classList.add('incorrect');
                }
            });

            riverContainer.appendChild(itemDiv);
            itemElements.push(itemDiv);
        }

        const totalTrash = placedTrash;
        let trashRemoved = 0;
        console.log(`Placed items: Trash: ${placedTrash}, Nature: ${placedNature}, Total Trash to remove: ${totalTrash}`);

        if (totalTrash === 0) {
            console.warn('No trash items were placed! Game cannot be completed.');
            const errorDiv = document.createElement('div');
            errorDiv.className = 'river-error';
            errorDiv.innerHTML = `<p>Ошибка: не удалось разместить мусор. Проверьте маску и настройки.</p>`;
            interactiveContainer.appendChild(errorDiv);
            return;
        }

        if (riverContainer.children.length === 0) {
            throw new Error('Не удалось отобразить игру "Помоги реке стать чистой": не удалось разместить элементы.');
        }

        let inactivityTimeout;
        const inactivityDelay = 4000;

        function startInactivityTimer() {
            inactivityTimeout = setTimeout(() => {
                itemElements.forEach(item => {
                    if (item.getAttribute('data-type') === 'trash' && !item.classList.contains('removed')) {
                        item.classList.add('wiggle');
                    }
                });
            }, inactivityDelay);
        }

        function resetInactivityTimer() {
            clearTimeout(inactivityTimeout);
            itemElements.forEach(item => {
                item.classList.remove('wiggle');
            });
            startInactivityTimer();
        }

        startInactivityTimer();

        interactiveContainer.addEventListener('click', resetInactivityTimer);
        interactiveContainer.addEventListener('touchstart', resetInactivityTimer);
    }
}

document.addEventListener('DOMContentLoaded', initInteractivePage);