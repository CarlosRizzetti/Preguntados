import defaultQuestions from '../public/preguntas.json';

/**
 * StudyLab - Engine de Test de Estudio en JSON
 * Permite cargar preguntas desde preguntas.json (VS Code) o subir archivos dinámicamente.
 */

// Estado global de la aplicación
const state = {
  questionsBank: defaultQuestions || [],
  quizQuestions: [],
  currentIndex: 0,
  score: 0,
  userAnswers: [], // { question, selectedIndex, isCorrect, correctIndex }
  mode: 'practice', // 'practice' | 'exam'
  soundEnabled: true,
  timerSeconds: 0,
  timerInterval: null,
  activeJsonName: 'preguntas.json',
  isAnswered: false,
};

// Web Audio API Synth para efectos de sonido sin archivos externos
class SoundEffects {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playCorrect() {
    if (!state.soundEnabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'triangle';

    // Acorde C5 -> E5 -> G5
    osc1.frequency.setValueAtTime(523.25, now); // C5
    osc1.frequency.exponentialRampToValueAtTime(659.25, now + 0.1); // E5
    osc1.frequency.exponentialRampToValueAtTime(783.99, now + 0.2); // G5

    osc2.frequency.setValueAtTime(261.63, now);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.4);
    osc2.stop(now + 0.4);
  }

  playIncorrect() {
    if (!state.soundEnabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.25);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.3);
  }
}

const audio = new SoundEffects();

// Elementos del DOM
const DOM = {
  // Pantallas
  screenStart: document.getElementById('screen-start'),
  screenQuiz: document.getElementById('screen-quiz'),
  screenResults: document.getElementById('screen-results'),
  
  // Header
  btnLoadJson: document.getElementById('btn-load-json'),
  btnToggleSound: document.getElementById('btn-toggle-sound'),
  btnToggleTheme: document.getElementById('btn-toggle-theme'),
  iconSoundOn: document.querySelector('.icon-sound-on'),
  iconSoundOff: document.querySelector('.icon-sound-off'),
  iconSun: document.querySelector('.icon-sun'),
  iconMoon: document.querySelector('.icon-moon'),
  
  // Screen Start
  bankCountLabel: document.getElementById('bank-count-label'),
  statTotalQuestions: document.getElementById('stat-total-questions'),
  statCategoriesCount: document.getElementById('stat-categories-count'),
  btnStartQuiz: document.getElementById('btn-start-quiz'),
  activeJsonFilename: document.getElementById('active-json-filename'),
  modeCards: document.querySelectorAll('.mode-card'),
  
  // Screen Quiz
  quizQuestionNumber: document.getElementById('quiz-question-number'),
  quizCategoryPill: document.getElementById('quiz-category-pill'),
  quizTimerText: document.getElementById('quiz-timer-text'),
  quizProgressFill: document.getElementById('quiz-progress-fill'),
  questionText: document.getElementById('question-text'),
  optionsGrid: document.getElementById('options-grid'),
  explanationBox: document.getElementById('explanation-box'),
  explanationStatusIcon: document.getElementById('explanation-status-icon'),
  explanationStatusTitle: document.getElementById('explanation-status-title'),
  explanationText: document.getElementById('explanation-text'),
  btnQuitQuiz: document.getElementById('btn-quit-quiz'),
  btnNextQuestion: document.getElementById('btn-next-question'),
  
  // Screen Results
  scoreRingFill: document.getElementById('score-ring-fill'),
  resultsScorePercent: document.getElementById('results-score-percent'),
  resultsScoreFraction: document.getElementById('results-score-fraction'),
  resultsBadgeTitle: document.getElementById('results-badge-title'),
  resultsMessage: document.getElementById('results-message'),
  metricCorrectCount: document.getElementById('metric-correct-count'),
  metricIncorrectCount: document.getElementById('metric-incorrect-count'),
  metricTotalTime: document.getElementById('metric-total-time'),
  reviewList: document.getElementById('review-list'),
  btnRestartQuiz: document.getElementById('btn-restart-quiz'),
  btnBackHome: document.getElementById('btn-back-home'),
  
  // Modal JSON
  jsonModal: document.getElementById('json-modal'),
  btnCloseModal: document.getElementById('btn-close-modal'),
  btnModalCancel: document.getElementById('btn-modal-cancel'),
  dropZone: document.getElementById('drop-zone'),
  fileInputJson: document.getElementById('file-input-json'),
  jsonValidationStatus: document.getElementById('json-validation-status'),
  btnResetDefaultJson: document.getElementById('btn-reset-default-json'),
};

// Inicialización de la aplicación
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  setupEventListeners();
  if (defaultQuestions && Array.isArray(defaultQuestions) && defaultQuestions.length > 0) {
    processAndSetQuestions(defaultQuestions, 'preguntas.json', true);
  }
  loadInitialQuestions('./preguntas.json');
});

// Cargar preguntas.json por defecto
async function loadInitialQuestions(path) {
  try {
    const response = await fetch(path);
    if (!response.ok) return;
    const data = await response.json();
    processAndSetQuestions(data, 'preguntas.json', true);
  } catch (error) {
    console.log('Usando banco de preguntas integrado en el sistema.');
  }
}

// Normalización y Validación del JSON
function processAndSetQuestions(data, filename, isSilent = false) {
  if (!Array.isArray(data)) {
    if (!isSilent) showJsonError('El archivo JSON debe contener un arreglo [...] de preguntas.');
    return false;
  }

  if (data.length === 0) {
    if (!isSilent) showJsonError('El archivo JSON está vacío.');
    return false;
  }

  const validQuestions = [];
  data.forEach((q, index) => {
    const preguntaText = q.pregunta || q.question || q.prompt;
    const opcionesList = q.opciones || q.options || q.choices;
    let correcta = q.respuestaCorrecta !== undefined ? q.respuestaCorrecta : q.answerIndex !== undefined ? q.answerIndex : q.correct;

    if (!preguntaText || !Array.isArray(opcionesList) || opcionesList.length < 2) {
      console.warn(`Pregunta invalida en el índice ${index}:`, q);
      return;
    }

    // Normalizar la respuesta correcta si viene como string
    let correctIndex = 0;
    if (typeof correcta === 'string') {
      const foundIdx = opcionesList.findIndex(opt => opt.trim().toLowerCase() === correcta.trim().toLowerCase());
      correctIndex = foundIdx !== -1 ? foundIdx : 0;
    } else if (typeof correcta === 'number') {
      correctIndex = correcta;
    }

    validQuestions.push({
      id: q.id || index + 1,
      categoria: q.categoria || q.category || 'General',
      pregunta: preguntaText,
      opciones: opcionesList,
      respuestaCorrecta: correctIndex,
      explicacion: q.explicacion || q.explanation || ''
    });
  });

  if (validQuestions.length === 0) {
    if (!isSilent) showJsonError('No se encontraron preguntas válidas en el formato correcto.');
    return false;
  }

  state.questionsBank = validQuestions;
  state.activeJsonName = filename;

  // Actualizar UI de inicio
  DOM.bankCountLabel.textContent = `${validQuestions.length} preguntas listas para estudiar`;
  DOM.statTotalQuestions.textContent = validQuestions.length;
  
  const categories = new Set(validQuestions.map(q => q.categoria));
  DOM.statCategoriesCount.textContent = categories.size;
  DOM.activeJsonFilename.textContent = filename;
  DOM.btnStartQuiz.disabled = false;

  if (!isSilent) {
    showJsonSuccess(`¡Éxito! Se cargaron ${validQuestions.length} preguntas correctamente.`);
  }
  return true;
}

// Algoritmo de mezcla Fisher-Yates
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Iniciar un nuevo Cuestionario
function startQuiz() {
  if (state.questionsBank.length === 0) return;

  // Seleccionar 10 preguntas al azar (o todas si hay menos de 10)
  const shuffled = shuffleArray(state.questionsBank);
  state.quizQuestions = shuffled.slice(0, 10);
  state.currentIndex = 0;
  state.score = 0;
  state.userAnswers = [];
  state.timerSeconds = 0;
  state.isAnswered = false;

  // Obtener modo seleccionado
  const selectedMode = document.querySelector('input[name="quiz-mode"]:checked');
  state.mode = selectedMode ? selectedMode.value : 'practice';

  // Iniciar timer
  startTimer();

  // Mostrar pantalla de quiz
  switchScreen(DOM.screenQuiz);
  renderCurrentQuestion();
}

// Timer
function startTimer() {
  clearInterval(state.timerInterval);
  state.timerSeconds = 0;
  updateTimerUI();
  state.timerInterval = setInterval(() => {
    state.timerSeconds++;
    updateTimerUI();
  }, 1000);
}

function stopTimer() {
  clearInterval(state.timerInterval);
}

function updateTimerUI() {
  const mins = Math.floor(state.timerSeconds / 60).toString().padStart(2, '0');
  const secs = (state.timerSeconds % 60).toString().padStart(2, '0');
  DOM.quizTimerText.textContent = `${mins}:${secs}`;
}

// Renderizar la pregunta actual
function renderCurrentQuestion() {
  const question = state.quizQuestions[state.currentIndex];
  state.isAnswered = false;

  // Progreso
  const total = state.quizQuestions.length;
  const currentNum = state.currentIndex + 1;
  DOM.quizQuestionNumber.textContent = `Pregunta ${currentNum} de ${total}`;
  DOM.quizCategoryPill.textContent = question.categoria;
  DOM.quizProgressFill.style.width = `${(currentNum / total) * 100}%`;

  // Pregunta
  DOM.questionText.textContent = question.pregunta;

  // Opciones
  DOM.optionsGrid.innerHTML = '';
  DOM.explanationBox.classList.add('hidden');
  DOM.btnNextQuestion.disabled = true;
  DOM.btnNextQuestion.classList.add('disabled');

  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];

  question.opciones.forEach((opcionText, index) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.setAttribute('data-index', index);

    btn.innerHTML = `
      <div class="option-content">
        <span class="option-letter">${letters[index] || index + 1}</span>
        <span class="option-text">${escapeHtml(opcionText)}</span>
      </div>
      <div class="option-icon">
        <svg class="icon-check" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        <svg class="icon-cross" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </div>
    `;

    btn.addEventListener('click', () => handleOptionSelect(index));
    DOM.optionsGrid.appendChild(btn);
  });
}

// Selección de opción
function handleOptionSelect(selectedIndex) {
  if (state.isAnswered) return;
  state.isAnswered = true;

  const currentQ = state.quizQuestions[state.currentIndex];
  const isCorrect = selectedIndex === currentQ.respuestaCorrecta;

  if (isCorrect) state.score++;

  state.userAnswers.push({
    question: currentQ,
    selectedIndex,
    isCorrect,
    correctIndex: currentQ.respuestaCorrecta
  });

  const optionBtns = DOM.optionsGrid.querySelectorAll('.option-btn');

  optionBtns.forEach((btn, idx) => {
    btn.classList.add('disabled');
    if (idx === selectedIndex) {
      btn.classList.add(isCorrect ? 'selected-correct' : 'selected-incorrect');
    }
  });

  if (state.mode === 'practice') {
    // En modo práctica, mostrar la respuesta correcta y la explicación de inmediato
    if (!isCorrect) {
      const correctBtn = optionBtns[currentQ.respuestaCorrecta];
      if (correctBtn) correctBtn.classList.add('show-correct');
    }

    // Efecto de sonido
    if (isCorrect) audio.playCorrect();
    else audio.playIncorrect();

    // Explicación
    DOM.explanationBox.classList.remove('hidden');
    if (isCorrect) {
      DOM.explanationStatusTitle.textContent = '¡Respuesta Correcta!';
      DOM.explanationStatusTitle.className = 'status-title status-correct';
    } else {
      const correctText = currentQ.opciones[currentQ.respuestaCorrecta];
      DOM.explanationStatusTitle.textContent = `Incorrecto. La respuesta correcta era: "${correctText}"`;
      DOM.explanationStatusTitle.className = 'status-title status-incorrect';
    }

    DOM.explanationText.textContent = currentQ.explicacion || 'Sin explicación adicional.';
  }

  // Activar botón Siguiente
  DOM.btnNextQuestion.disabled = false;
  DOM.btnNextQuestion.classList.remove('disabled');

  if (state.currentIndex === state.quizQuestions.length - 1) {
    DOM.btnNextQuestion.querySelector('span').textContent = 'Ver Resultados Finales';
  } else {
    DOM.btnNextQuestion.querySelector('span').textContent = 'Siguiente Pregunta';
  }
}

// Avanzar a la siguiente pregunta
function nextQuestion() {
  if (state.currentIndex < state.quizQuestions.length - 1) {
    state.currentIndex++;
    renderCurrentQuestion();
  } else {
    finishQuiz();
  }
}

// Finalizar Cuestionario
function finishQuiz() {
  stopTimer();
  switchScreen(DOM.screenResults);

  const total = state.quizQuestions.length;
  const score = state.score;
  const percentage = Math.round((score / total) * 100);

  // Animación del anillo de puntaje
  const circumference = 326.72;
  const offset = circumference - (percentage / 100) * circumference;
  DOM.scoreRingFill.style.strokeDashoffset = offset;

  DOM.resultsScorePercent.textContent = `${percentage}%`;
  DOM.resultsScoreFraction.textContent = `${score} de ${total}`;

  // Título y Badge según rendimiento
  if (percentage === 100) {
    DOM.resultsBadgeTitle.textContent = '🏆 ¡Puntaje Perfecto!';
    DOM.resultsMessage.textContent = '¡Impresionante! Has dominado todas las preguntas del test.';
  } else if (percentage >= 70) {
    DOM.resultsBadgeTitle.textContent = '🌟 ¡Excelente Trabajo!';
    DOM.resultsMessage.textContent = 'Has demostrado un gran conocimiento de la materia.';
  } else if (percentage >= 50) {
    DOM.resultsBadgeTitle.textContent = '👍 Test Aprobado';
    DOM.resultsMessage.textContent = 'Buen trabajo, pero aún puedes seguir repasando.';
  } else {
    DOM.resultsBadgeTitle.textContent = '📚 Necesita Repaso';
    DOM.resultsMessage.textContent = 'Te recomendamos volver a estudiar los conceptos y reintentar.';
  }

  // Métricas
  DOM.metricCorrectCount.textContent = score;
  DOM.metricIncorrectCount.textContent = total - score;
  
  const mins = Math.floor(state.timerSeconds / 60).toString().padStart(2, '0');
  const secs = (state.timerSeconds % 60).toString().padStart(2, '0');
  DOM.metricTotalTime.textContent = `${mins}:${secs}`;

  // Desglose de preguntas
  renderReviewList();
}

// Renderizar el desglose de respuestas al final
function renderReviewList() {
  DOM.reviewList.innerHTML = '';

  state.userAnswers.forEach((ans, index) => {
    const item = document.createElement('div');
    item.className = 'review-item';

    const q = ans.question;
    const userSelectedText = q.opciones[ans.selectedIndex] || 'Sin responder';
    const correctText = q.opciones[ans.correctIndex];

    item.innerHTML = `
      <div class="review-item-header">
        <span class="review-q-num">Pregunta ${index + 1} • ${escapeHtml(q.categoria)}</span>
        <span class="review-badge ${ans.isCorrect ? 'correct' : 'incorrect'}">
          ${ans.isCorrect ? '✓ Correcta' : '✕ Incorrecta'}
        </span>
      </div>
      <div class="review-q-text">${escapeHtml(q.pregunta)}</div>
      <div class="review-details">
        <div class="review-user-ans">Tu respuesta: <strong>${escapeHtml(userSelectedText)}</strong></div>
        ${!ans.isCorrect ? `<div class="review-correct-ans">Respuesta correcta: <strong>${escapeHtml(correctText)}</strong></div>` : ''}
        ${q.explicacion ? `<div style="font-size: 0.8rem; margin-top: 4px; opacity: 0.8;">💡 ${escapeHtml(q.explicacion)}</div>` : ''}
      </div>
    `;

    DOM.reviewList.appendChild(item);
  });
}

// Navegación entre Pantallas
function switchScreen(targetScreen) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  targetScreen.classList.add('active');
}

// Manejo del Modal de JSON
function showModal() { DOM.jsonModal.classList.remove('hidden'); }
function hideModal() { DOM.jsonModal.classList.add('hidden'); }

function showJsonError(msg) {
  DOM.jsonValidationStatus.className = 'validation-status error';
  DOM.jsonValidationStatus.textContent = `❌ ${msg}`;
  DOM.jsonValidationStatus.classList.remove('hidden');
}

function showJsonSuccess(msg) {
  DOM.jsonValidationStatus.className = 'validation-status success';
  DOM.jsonValidationStatus.textContent = `✓ ${msg}`;
  DOM.jsonValidationStatus.classList.remove('hidden');
  setTimeout(() => hideModal(), 1800);
}

// Drag and Drop & File Reader
function setupDragAndDrop() {
  const zone = DOM.dropZone;

  ['dragenter', 'dragover'].forEach(eventName => {
    zone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.add('drag-over');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    zone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.remove('drag-over');
    });
  });

  zone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0) readJsonFile(files[0]);
  });

  DOM.fileInputJson.addEventListener('change', (e) => {
    if (e.target.files.length > 0) readJsonFile(e.target.files[0]);
  });
}

function readJsonFile(file) {
  if (!file.name.endsWith('.json')) {
    showJsonError('Por favor selecciona un archivo con extensión .json');
    return;
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const parsed = JSON.parse(event.target.result);
      processAndSetQuestions(parsed, file.name);
    } catch (err) {
      showJsonError(`Sintaxis JSON inválida: ${err.message}`);
    }
  };
  reader.readAsText(file);
}

// Event Listeners Globales
function setupEventListeners() {
  DOM.btnStartQuiz.addEventListener('click', startQuiz);
  DOM.btnNextQuestion.addEventListener('click', nextQuestion);
  DOM.btnQuitQuiz.addEventListener('click', () => switchScreen(DOM.screenStart));
  DOM.btnRestartQuiz.addEventListener('click', startQuiz);
  DOM.btnBackHome.addEventListener('click', () => switchScreen(DOM.screenStart));

  // Modal
  DOM.btnLoadJson.addEventListener('click', showModal);
  DOM.btnCloseModal.addEventListener('click', hideModal);
  DOM.btnModalCancel.addEventListener('click', hideModal);
  
  DOM.btnResetDefaultJson.addEventListener('click', () => {
    loadInitialQuestions('./preguntas.json');
  });

  // Sound toggle
  DOM.btnToggleSound.addEventListener('click', () => {
    state.soundEnabled = !state.soundEnabled;
    DOM.iconSoundOn.classList.toggle('hidden', !state.soundEnabled);
    DOM.iconSoundOff.classList.toggle('hidden', state.soundEnabled);
  });

  // Theme toggle
  DOM.btnToggleTheme.addEventListener('click', toggleTheme);

  // Setup drag & drop
  setupDragAndDrop();
}

// Manejo de Tema (Oscuro/Claro)
function initTheme() {
  const savedTheme = localStorage.getItem('studylab_theme') || 'dark';
  setTheme(savedTheme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  setTheme(next);
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('studylab_theme', theme);
  
  if (theme === 'dark') {
    DOM.iconSun.classList.add('hidden');
    DOM.iconMoon.classList.remove('hidden');
  } else {
    DOM.iconSun.classList.remove('hidden');
    DOM.iconMoon.classList.add('hidden');
  }
}

// Escapar texto para prevenir HTML Injection
function escapeHtml(text) {
  if (typeof text !== 'string') return text;
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
