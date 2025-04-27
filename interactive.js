console.log('interactive.js loaded'); // Проверка загрузки скрипта

import { showError, checkProtocol } from './utils.js';

// Объявляем функцию как async, чтобы использовать await
async function initInteractivePage() {
    console.log('DOM loaded, initializing interactive page...');

    const interactiveContainer = document.querySelector('#interactive-content');
    const interactiveTitleElement = document.querySelector('#interactive-title');

    if (!interactiveContainer || !interactiveTitleElement) {
        console.error('Required elements not found!');
        showError(interactiveContainer, 'Ошибка в структуре страницы.', 'Не найдены элементы: interactive-content или interactive-title.');
        return;
    }

    // Проверяем протокол
    const protocolCheck = checkProtocol();
    if (protocolCheck.isLocal) {
        showError(interactiveContainer, protocolCheck.error, protocolCheck.details);
        showError(interactiveContainer, 'Запустите проект через сервер!', 'fetch не работает с file://. Используйте Live Server в VS Code или разверните через Firebase Hosting.');
        return;
    }

    // Получаем параметры из URL
    const urlParams = new URLSearchParams(window.location.search);
    const storyIndex = parseInt(urlParams.get('story'), 10);
    const interactiveId = parseInt(urlParams.get('interactive'), 10);
    console.log('Story index:', storyIndex, 'Interactive ID:', interactiveId);

    if (isNaN(storyIndex) || isNaN(interactiveId)) {
        showError(interactiveContainer, 'Ошибка загрузки интерактива.', 'Не указаны или некорректны параметры story и interactive в URL.');
        return;
    }

    // Загружаем данные интерактива с использованием async/await
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

        // Обновляем заголовок в зависимости от типа интерактива
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
        } else {
            interactiveTitleElement.textContent = 'Интерактивная игра';
        }

        // Проверяем наличие steps
        if (!interactive.steps || !Array.isArray(interactive.steps) || interactive.steps.length === 0) {
            throw new Error('В интерактиве отсутствует или некорректно поле "steps". Ожидается массив с данными интерактива.');
        }

        // Для quiz: steps — это уже массив вопросов
        // Для match, evolution и puzzle: steps[0] содержит нужные данные
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
        } else {
            throw new Error(`Неизвестный тип интерактива: ${interactive.type}. Поддерживаются: quiz, match, evolution, puzzle.`);
        }
    } catch (error) {
        console.error('Error loading interactive:', error);
        showError(interactiveContainer, 'Не удалось загрузить интерактив.', `Детали: ${error.message}`);
    }

    function displayQuiz(interactive, questions) {
        console.log('Displaying quiz:', interactive);
        console.log('Questions data:', questions);

        // Проверяем, является ли questions массивом
        if (!Array.isArray(questions)) {
            throw new Error('В интерактиве типа "quiz" поле "steps" должно быть массивом вопросов.');
        }

        // Проверяем наличие вопросов
        if (questions.length === 0) {
            throw new Error('В интерактиве типа "quiz" отсутствуют вопросы в поле "steps". Ожидается массив вопросов с полями question, options, correct и explanation.');
        }

        // Выбираем 3 случайных вопроса без повторов
        const shuffledQuestions = questions.sort(() => Math.random() - 0.5);
        const selectedQuestions = shuffledQuestions.slice(0, 3);

        const quizContainer = document.createElement('div');
        quizContainer.className = 'quiz-question';

        let correctAnswers = 0; // Счётчик правильных ответов

        // Загружаем звук для клика по ответу
        const tapSound = new Audio('assets/audio/tap.mp3');
        tapSound.load();

        selectedQuestions.forEach((question, qIndex) => {
            console.log(`Processing question ${qIndex}:`, question);

            // Проверяем структуру вопроса
            if (!question.question || !Array.isArray(question.options) || question.options.length === 0 || question.correct === undefined) {
                console.warn(`Question at index ${qIndex} has invalid structure:`, question);
                return; // Пропускаем некорректный вопрос
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
                    // Воспроизводим звук при выборе ответа
                    tapSound.currentTime = 0; // Сбрасываем звук
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
        console.log('Quiz container appended to DOM');

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

                // Воспроизводим звук победы
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

        // Загружаем звук
        const tapSound = new Audio('assets/audio/tap.mp3');
        tapSound.load();
        console.log('Tap sound loaded:', tapSound);

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

                // Воспроизводим звук при клике
                tapSound.currentTime = 0; // Сбрасываем звук
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

                        // Воспроизводим звук победы
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
                Translator: console.warn(`Failed to load image: ${character.mini}`);
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
}

// Запускаем инициализацию
document.addEventListener('DOMContentLoaded', () => {
    initInteractivePage();
});