const game = new Chess();
let board = null;

/* ─── PROGRESS TRACKING (localStorage) ─── */

const TRAINING_PROGRESS_KEY = 'cosmochess_progress';

function getTrainingProgress() {
    try { return JSON.parse(localStorage.getItem(TRAINING_PROGRESS_KEY)) || {}; }
    catch(e) { return {}; }
}

function saveTrainingProgress(p) {
    localStorage.setItem(TRAINING_PROGRESS_KEY, JSON.stringify(p));
}

function markCompleted(id) {
    var p = getTrainingProgress();
    p[id] = true;
    saveTrainingProgress(p);
}

function isCompleted(id) {
    return !!getTrainingProgress()[id];
}

function resetTrainingProgress(group) {
    if (group) {
        var p = getTrainingProgress();
        var changed = false;
        trainingItems.forEach(function(item) {
            if (item.group === group && p[item.id]) { delete p[item.id]; changed = true; }
        });
        if (changed) saveTrainingProgress(p);
    } else {
        localStorage.removeItem(TRAINING_PROGRESS_KEY);
    }
}

function getGroupStats(group) {
    var p = getTrainingProgress();
    var items = trainingItems.filter(function(i) { return i.group === group; });
    var total = items.length;
    var done = items.filter(function(i) { return p[i.id]; }).length;
    return { total: total, done: done };
}
let stockfish = new Worker('stockfish.js');
let engineReady = false;
let engineBusy = false;
let boardSize = 0;

const PIECE_IMG = 'img/chesspieces/wikipedia/{piece}.png';

var groupNames = {};
var groupCategories = {};
var trainingItems = [];
var groupOrder = [];

function loadOpeningsFromServer(callback) {
    fetch('/api/openings').then(function(r) { return r.json(); }).then(function(items) {
        trainingItems.length = 0;
        var seen = {};
        items.forEach(function(item) {
            trainingItems.push(item);
            if (!seen[item.group]) {
                seen[item.group] = true;
                groupOrder.push(item.group);
                groupNames[item.group] = item.openingName;
                groupCategories[item.group] = 'Дебюты';
            }
        });
        if (callback) callback();
    }).catch(function() {
        if (callback) callback();
    });
}

const training = { active: false, item: null, moveIndex: 0, hintsOn: true };
let isPuzzleMode = false;
var trainingTimer = null;

let currentEval = 0;
let isAnalyzing = false;

const review = { active: false, moves: [], currentIdx: -1, origPgn: '' };
let isReviewQuery = false;

let evalBeforeUserMove = 0;
let lastUserSan = '';
const moveLog = [];

let userColor = 'w';
let lastMoveFrom = '';
let lastMoveTo = '';

let isHintQuery = false;
let hintBestMove = null;
let hintFen = '';
let trainingHighlight = { from: '', to: '' };
let dragMode = false;

/* ─── SETTINGS PERSISTENCE ─── */

const SETTINGS_KEY = 'cosmochess_settings';

function loadSettings() {
    var s;
    try { s = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch(e) { s = {}; }
    ['difficulty', 'colorSelect', 'puzzleDifficulty', 'puzzleTheme'].forEach(function(id) {
        var el = document.getElementById(id);
        if (s[id] && el) el.value = s[id];
    });
    if (s.dragMode !== undefined) {
        dragMode = s.dragMode;
        var dt = document.getElementById('dragToggle');
        if (dt) {
            dt.textContent = dragMode ? '\u270B Drag' : '\uD83D\uDC0D Click';
            dt.classList.toggle('active', dragMode);
        }
    }
    if (s.hintCheck !== undefined) {
        var hc = document.getElementById('hintCheck');
        if (hc) hc.checked = s.hintCheck;
    }
    userColor = (s.colorSelect || 'w');
}

function saveSettings() {
    var s = {
        difficulty: document.getElementById('difficulty').value,
        colorSelect: document.getElementById('colorSelect').value,
        puzzleDifficulty: document.getElementById('puzzleDifficulty').value,
        puzzleTheme: document.getElementById('puzzleTheme').value,
        dragMode: dragMode,
        hintCheck: document.getElementById('hintCheck').checked
    };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

function squareClass(sq) {
    return 'square-' + sq;
}

function clearLegalMoves() {
    $('.legal-move, .legal-capture').removeClass('legal-move legal-capture');
}

/* ─── STOCKFISH ─── */

stockfish.onmessage = function(event) {
    if (event.data === 'uciok') { stockfish.postMessage('isready'); return; }
    if (event.data === 'readyok') {
        engineReady = true;
        var initElo = parseInt(document.getElementById('difficulty').value, 10);
        stockfish.postMessage('setoption name UCI_LimitStrength value true');
        stockfish.postMessage('setoption name UCI_Elo value ' + initElo);
        updateEvalBar();
        setTimeout(function() { if (!training.active && !review.active) analyzePosition(); }, 300);
        return;
    }

    const m = event.data.match(/info.*\bscore\s+(cp|mate)\s+(-?\d+)/);
    if (m) {
        if (m[1] === 'cp') {
            currentEval = parseInt(m[2], 10) / 100.0;
        } else if (m[1] === 'mate') {
            const v = parseInt(m[2], 10);
            currentEval = v > 0 ? 99.99 + v : -(99.99 + Math.abs(v));
        }
        updateEvalBar();
    }

    if (event.data.startsWith('bestmove')) {
        const bestMove = event.data.split(' ')[1];

        if (isHintQuery) {
            isHintQuery = false;
            if (bestMove && bestMove !== '(none)' && game.fen() === hintFen) {
                showHintOnBoard(bestMove);
            } else if (bestMove && bestMove !== '(none)') {
                showToast('Позиция изменилась, попробуйте снова');
            } else {
                showToast('Не удалось найти ход');
            }
            document.getElementById('hintBtn').disabled = false;
            updateStatus();
            return;
        }

        if (isReviewQuery) {
            isReviewQuery = false;
            engineBusy = false;
            const info = document.getElementById('reviewInfo');
            if (bestMove && bestMove !== '(none)') {
                const clone = new Chess(game.fen());
                const m2 = clone.move({ from: bestMove.substring(0,2), to: bestMove.substring(2,4), promotion: bestMove.substring(4,5)||'q' });
                const bestSan = m2 ? m2.san : bestMove;
                info.innerHTML = 'Лучший ход: <b>' + bestSan + '</b> | Оценка: <b>' + formatEval(currentEval) + '</b>';
            } else {
                info.innerHTML = 'Оценка: <b>' + formatEval(currentEval) + '</b>';
            }
            return;
        }

        if (isAnalyzing) {
            isAnalyzing = false;
            return;
        }

        if (!engineBusy) return;

        if (!bestMove || bestMove === '(none)') { engineBusy = false; return; }

        const from = bestMove.substring(0, 2);
        const to = bestMove.substring(2, 4);
        const promotion = bestMove.substring(4, 5) || 'q';
        const move = game.move({ from, to, promotion });
        if (move) {
            engineBusy = false;
            lastMoveFrom = from;
            lastMoveTo = to;

            if (!training.active && !review.active && lastUserSan) {
                const swing = currentEval - evalBeforeUserMove;
                let flag = '';
                if (swing < -2.0) flag = '??';
                else if (swing < -1.0) flag = '?';
                else if (swing > 1.0) flag = '!';
                if (flag) {
                    moveLog.push({ san: lastUserSan, moveIdx: game.history().length - 1, flag: flag, evalBefore: evalBeforeUserMove, evalAfter: currentEval });
                }
                lastUserSan = '';
            }

            board.position(game.fen());
            updateStatus();
            if (!game.game_over() && !training.active && !review.active) {
                setTimeout(function() { analyzePosition(); }, 200);
            }
            highlightLastMove();
        }
    }
};
stockfish.postMessage('uci');

/* ─── EVAL BAR & HIGHLIGHT ─── */

function updateEvalBar() {
    const whiteFill = document.getElementById('evalFillWhite');
    const blackFill = document.getElementById('evalFillBlack');
    const text = document.getElementById('evalText');
    if (!whiteFill) return;
    const pct = Math.max(0, Math.min(50, Math.abs(currentEval) * 8));
    if (currentEval >= 0) {
        whiteFill.style.height = pct + '%';
        blackFill.style.height = '0%';
    } else {
        whiteFill.style.height = '0%';
        blackFill.style.height = pct + '%';
    }
    text.textContent = formatEval(currentEval);
}

function formatEval(ev) {
    if (Math.abs(ev) > 99) {
        return (ev > 0 ? 'M' : '-M') + Math.abs(Math.round(ev - (ev > 0 ? 100 : -100)));
    }
    if (Math.abs(ev) < 0.01) return '0.00';
    return (ev > 0 ? '+' : '') + ev.toFixed(2);
}

function analyzePosition() {
    if (game.game_over()) return;
    if (!engineReady) return;
    if (engineBusy) return;
    if (game.turn() !== userColor) return;
    if (training.active) return;
    if (review.active) return;
    if (isAnalyzing) return;
    isAnalyzing = true;
    stockfish.postMessage('setoption name UCI_LimitStrength value false');
    stockfish.postMessage('position fen ' + game.fen());
    stockfish.postMessage('go depth 8');
}

function highlightLastMove() {
    $('.highlight-last').removeClass('highlight-last');
    if (!lastMoveFrom || !lastMoveTo) return;
    $('#board .' + squareClass(lastMoveFrom)).addClass('highlight-last');
    $('#board .' + squareClass(lastMoveTo)).addClass('highlight-last');
}

function restoreTrainingHighlight() {
    if (!training.active) return;
    if (trainingHighlight.from && trainingHighlight.to && isPlayerMove(training.moveIndex, training.item.side)) {
        $('.highlight-train-prev').removeClass('highlight-train-prev');
        $('#board .' + squareClass(trainingHighlight.from)).addClass('highlight-train-prev');
        $('#board .' + squareClass(trainingHighlight.to)).addClass('highlight-train-prev');
    } else {
        $('.highlight-train-prev').removeClass('highlight-train-prev');
    }
}

function showBestMoveHint() {
    if (game.game_over()) { showToast('Игра завершена'); return; }
    if (review.active) { showToast('Сначала выйдите из разбора'); return; }
    if (engineBusy) { showToast('Двигатель занят, подождите...'); return; }
    if (isHintQuery) return;
    clearLegalMoves();
    $('.highlight-hint').removeClass('highlight-hint');
    isAnalyzing = false;
    isHintQuery = true;
    hintBestMove = null;
    hintFen = game.fen();
    document.getElementById('hintBtn').disabled = true;
    document.getElementById('status').innerText = 'Поиск лучшего хода...';
    stockfish.postMessage('setoption name UCI_LimitStrength value false');
    stockfish.postMessage('position fen ' + hintFen);
    stockfish.postMessage('go depth 16');
}

function showHintOnBoard(uci) {
    hintBestMove = uci;
    const from = uci.substring(0, 2);
    const to = uci.substring(2, 4);
    $('.highlight-hint').removeClass('highlight-hint');
    $('#board .' + squareClass(from)).addClass('highlight-hint');
    $('#board .' + squareClass(to)).addClass('highlight-hint');
    const clone = new Chess(game.fen());
    const m = clone.move({ from, to, promotion: uci.substring(4, 5) || 'q' });
    const san = m ? m.san : uci;
    showToast('Лучший ход: ' + san);
    document.getElementById('status').innerText = 'Подсказка: ' + san + ' (зелёный)';
}

function clearHint() {
    hintBestMove = null;
    $('.highlight-hint').removeClass('highlight-hint');
}

/* ─── REVIEW MODE ─── */

function enterReviewMode() {
    if (training.active) { showToast('Сначала выйдите из обучения'); return; }
    if (review.active) return;
    selectedSquare = null;
    clearLegalMoves();
    clearHint();
    $('.highlight-train-prev').removeClass('highlight-train-prev');
    const moves = game.history({ verbose: true });
    if (!moves.length) { showToast('Нет ходов для разбора'); return; }
    review.active = true;
    review.moves = moves.slice();
    review.currentIdx = moves.length - 1;
    review.origPgn = game.pgn();
    document.getElementById('reviewControls').classList.remove('hidden');
    document.getElementById('reviewBtn').disabled = true;
    document.getElementById('reviewBtn').innerText = 'Разбор...';
    document.getElementById('board').style.pointerEvents = 'none';
    updateReviewUI();
    reviewQueryStockfish();
}

function exitReviewMode() {
    if (!review.active) return;
    review.active = false;
    review.moves = [];
    review.currentIdx = -1;
    document.getElementById('reviewControls').classList.add('hidden');
    document.getElementById('reviewBtn').disabled = false;
    document.getElementById('reviewBtn').innerText = 'Разобрать партию';
    document.getElementById('board').style.pointerEvents = '';
    document.getElementById('reviewInfo').innerText = '';
    if (review.origPgn) {
        try { game.load_pgn(review.origPgn); } catch(e) { game.reset(); }
    } else {
        game.reset();
    }
    initBoard(game.fen());
    updateStatus();
    if (!game.game_over()) setTimeout(function() { analyzePosition(); }, 300);
}

function reviewGoTo(idx) {
    if (!review.active) return;
    if (idx < -1 || idx >= review.moves.length) return;
    review.currentIdx = idx;
    game.reset();
    for (var i = 0; i <= idx; i++) {
        try { game.move(review.moves[i].san); } catch(e) { break; }
    }
    if (idx >= 0 && review.moves[idx]) {
        lastMoveFrom = review.moves[idx].from;
        lastMoveTo = review.moves[idx].to;
    } else {
        lastMoveFrom = lastMoveTo = '';
    }
    board.position(game.fen());
    highlightLastMove();
    updateReviewUI();
    reviewQueryStockfish();
}

function reviewNext() {
    if (!review.active) return;
    reviewGoTo(review.currentIdx + 1);
}

function reviewPrev() {
    if (!review.active) return;
    reviewGoTo(review.currentIdx - 1);
}

function updateReviewUI() {
    const total = review.moves.length;
    const cur = review.currentIdx;
    document.getElementById('reviewPos').innerText = (cur + 1) + '/' + total;
    document.getElementById('reviewPrev').disabled = cur <= 0;
    document.getElementById('reviewNext').disabled = cur >= total - 1;
}

function reviewQueryStockfish() {
    if (game.game_over()) {
        document.getElementById('reviewInfo').innerText = 'Игра завершена';
        return;
    }
    isReviewQuery = true;
    engineBusy = true;
    stockfish.postMessage('setoption name UCI_LimitStrength value false');
    stockfish.postMessage('position fen ' + game.fen());
    stockfish.postMessage('go depth 12');
}

/* ─── BOARD ─── */

function getBoardSize() {
    const ww = window.innerWidth - 32;
    const wh = window.innerHeight - 320;
    return Math.max(200, Math.min(400, ww, wh));
}

function setBoardElementWidth() {
    boardSize = getBoardSize();
    document.getElementById('board').style.width = boardSize + 'px';
    var evalBar = document.getElementById('evalBar');
    if (evalBar) evalBar.style.height = boardSize + 'px';
}

function makeBoardConfig(position, orientation) {
    return {
        draggable: true,
        position: position || 'start',
        pieceTheme: PIECE_IMG,
        orientation: orientation || (userColor === 'b' ? 'black' : 'white'),
        onDragStart: onDragStart,
        onDrop: onDrop,
        onSnapEnd: onSnapEnd
    };
}

function initBoard(position, orientation) {
    if (board) board.destroy();
    setBoardElementWidth();
    board = Chessboard('board', makeBoardConfig(position, orientation));
    ensureBoardSvg();
    boardClickAttached = false;
    attachBoardClick();
}

/* ─── ARROW OVERLAY ─── */

function ensureBoardSvg() {
    var svg = document.getElementById('boardArrows');
    if (svg) return svg;
    var boardEl = document.getElementById('board');
    if (!boardEl) return null;
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('id', 'boardArrows');
    svg.setAttribute('style', 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10;');
    boardEl.appendChild(svg);
    return svg;
}

function squareCenter(sq) {
    var boardEl = document.getElementById('board');
    if (!boardEl) return null;
    var sqEl = boardEl.querySelector('.square-' + sq);
    if (!sqEl) return null;
    var boardRect = boardEl.getBoundingClientRect();
    var sqRect = sqEl.getBoundingClientRect();
    return {
        x: sqRect.left - boardRect.left + sqRect.width / 2,
        y: sqRect.top - boardRect.top + sqRect.height / 2
    };
}

function drawTrainingArrow(from, to) {
    clearTrainingArrows();
    if (isPuzzleMode) return;
    var svg = ensureBoardSvg();
    if (!svg) return;
    var fromP = squareCenter(from);
    var toP = squareCenter(to);
    if (!fromP || !toP) return;

    var dx = toP.x - fromP.x;
    var dy = toP.y - fromP.y;
    var len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) return;
    var nx = dx / len;
    var ny = dy / len;
    var headLen = Math.min(14, len * 0.35);
    var headW = 5;

    // Arrow line (stop short of destination)
    var lineEndX = toP.x - headLen * 0.4 * nx;
    var lineEndY = toP.y - headLen * 0.4 * ny;

    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M' + fromP.x + ',' + fromP.y + ' L' + lineEndX + ',' + lineEndY);
    path.setAttribute('stroke', '#FFD700');
    path.setAttribute('stroke-width', '3.5');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('class', 'training-arrow');
    svg.appendChild(path);

    // Arrowhead
    var bx = toP.x - headLen * nx;
    var by = toP.y - headLen * ny;
    var px = -ny * headW;
    var py = nx * headW;

    var poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    poly.setAttribute('points',
        toP.x + ',' + toP.y + ' ' +
        (bx + px) + ',' + (by + py) + ' ' +
        (bx - px) + ',' + (by - py));
    poly.setAttribute('fill', '#FFD700');
    poly.setAttribute('stroke', '#FFD700');
    poly.setAttribute('stroke-width', '1');
    poly.setAttribute('class', 'training-arrow');
    svg.appendChild(poly);
}

function clearTrainingArrows() {
    var svg = document.getElementById('boardArrows');
    if (!svg) return;
    var arr = svg.querySelectorAll('.training-arrow');
    for (var i = arr.length - 1; i >= 0; i--) arr[i].remove();
}

/* ─── TRAINING ─── */

function isPlayerMove(idx, side) {
    if (isPuzzleMode) return idx % 2 === 0;
    return (side === 'w' && idx % 2 === 0) || (side === 'b' && idx % 2 === 1);
}

function hintIdx(idx, side) {
    if (isPuzzleMode) return Math.floor(idx / 2);
    return side === 'w' ? idx / 2 : (idx - 1) / 2;
}

function clearTrainingTimer() {
    if (trainingTimer !== null) { clearTimeout(trainingTimer); trainingTimer = null; }
}

function scheduleTrainingComputerMove() {
    clearTrainingTimer();
    if (!training.active) return;
    if (training.moveIndex >= training.item.ucis.length) { finishTraining(); return; }
    if (isPlayerMove(training.moveIndex, training.item.side)) return;
    clearHint();
    document.getElementById('status').innerText = 'Ход соперника...';
    trainingTimer = setTimeout(function() {
        trainingTimer = null;
        if (!training.active) return;
        var uci = training.item.ucis[training.moveIndex];
        var move = game.move({ from: uci.substring(0,2), to: uci.substring(2,4), promotion: uci.substring(4,5)||'q' });
        if (move) {
            lastMoveFrom = uci.substring(0,2);
            lastMoveTo = uci.substring(2,4);
            trainingHighlight.from = uci.substring(0,2);
            trainingHighlight.to = uci.substring(2,4);
            board.position(game.fen());
            highlightLastMove();
            restoreTrainingHighlight();
            training.moveIndex++;
            if (training.moveIndex >= training.item.ucis.length) { updateTrainingUI(); finishTraining(); }
            else if (isPlayerMove(training.moveIndex, training.item.side)) { updateTrainingUI(); }
            else scheduleTrainingComputerMove();
        }
    }, 600);
}

function startTraining(id) {
    var item = trainingItems.find(function(o) { return o.id === id; });
    if (!item) return;
    if (review.active) exitReviewMode();
    clearTrainingTimer();
    moveLog.length = 0;
    game.reset();
    training.active = true;
    training.item = item;
    training.moveIndex = 0;
    training.hintsOn = document.getElementById('hintCheck').checked;
    document.getElementById('startTrainingBtn').disabled = true;
    document.getElementById('stopTrainingBtn').disabled = false;
    document.getElementById('trainingSelect').disabled = true;
    document.getElementById('trainingToggle').textContent = '\u{1F393} ' + (groupNames[item.group] || item.group) + ': ' + item.name;
    document.getElementById('trainingToggle').classList.add('active');
    var startPos = item.fen || 'start';
    initBoard(startPos, item.side === 'b' ? 'black' : 'white');
    if (item.fen) game.load(item.fen);
    updateTrainingUI();
    if (!isPlayerMove(0, item.side)) scheduleTrainingComputerMove();
}

function stopTraining() {
    clearTrainingTimer();
    clearTrainingArrows();
    var wasPuzzle = isPuzzleMode;
    training.active = false;
    training.item = null;
    training.moveIndex = 0;
    trainingHighlight.from = '';
    trainingHighlight.to = '';
    selectedSquare = null;
    $('.highlight-train-prev').removeClass('highlight-train-prev');
    clearHint();
    document.getElementById('startTrainingBtn').disabled = false;
    document.getElementById('stopTrainingBtn').disabled = true;
    document.getElementById('trainingSelect').disabled = false;
    document.getElementById('trainingToggle').textContent = '\u{1F393} Обучение';
    document.getElementById('trainingToggle').classList.remove('active');
    document.getElementById('trainingHint').classList.add('hidden');
    document.getElementById('evalAnnotation').classList.add('hidden');
    document.getElementById('moveEval').classList.add('hidden');
    document.getElementById('openingDesc').innerText = '';
    document.getElementById('trainingProgress').style.width = '0%';
    document.getElementById('trainingProgressText').innerText = 'Не начато';
    if (wasPuzzle) {
        isPuzzleMode = false;
        document.getElementById('getPuzzleBtn').disabled = false;
        document.getElementById('getPuzzleBtn').innerText = 'Получить задачу';
        document.getElementById('stopPuzzleBtn').disabled = true;
        document.getElementById('puzzleToggle').textContent = '\u{1F3AF} Задачи';
        document.getElementById('puzzleToggle').classList.remove('active');
        document.getElementById('puzzleInfo').classList.add('hidden');
        document.getElementById('puzzleProgress').classList.add('hidden');
    }
    game.reset();
    initBoard('start', userColor === 'b' ? 'black' : 'white');
    updateStatus();
}

function finishTraining() {
    clearTrainingTimer();
    clearTrainingArrows();
    if (!training.active) return;
    markCompleted(training.item.id);
    training.active = false;
    trainingHighlight.from = '';
    trainingHighlight.to = '';
    selectedSquare = null;
    $('.highlight-train-prev').removeClass('highlight-train-prev');
    $('.highlight-hint').removeClass('highlight-hint');
    document.getElementById('startTrainingBtn').disabled = false;
    document.getElementById('stopTrainingBtn').disabled = true;
    document.getElementById('trainingSelect').disabled = false;
    document.getElementById('trainingToggle').textContent = '\u{1F393} Обучение';
    document.getElementById('trainingToggle').classList.remove('active');
    document.getElementById('trainingHint').classList.add('hidden');
    document.getElementById('evalAnnotation').classList.add('hidden');
    document.getElementById('moveEval').classList.add('hidden');
    if (isPuzzleMode) {
        isPuzzleMode = false;
        document.getElementById('getPuzzleBtn').disabled = false;
        document.getElementById('getPuzzleBtn').innerText = 'Получить задачу';
        document.getElementById('stopPuzzleBtn').disabled = true;
        document.getElementById('puzzleToggle').textContent = '\u{1F3AF} Задачи';
        document.getElementById('puzzleToggle').classList.remove('active');
        document.getElementById('puzzleProgress').classList.add('hidden');
        showToast('\u{1F389} Задача решена!');
        document.getElementById('status').innerText = 'Задача решена! Возьмите следующую.';
    } else {
        showToast('\u{1F389} Отлично! ' + training.item.name + ' \u2014 выполнено!');
        document.getElementById('status').innerText = 'Обучение завершено! Выберите другой дебют или задачу.';
        populateTrainingSelect();
        updateGroupProgressDisplay();
    }
}

function updateTrainingUI() {
    if (!training.active || !training.item) {
        document.getElementById('openingDesc').innerText = '';
        document.getElementById('trainingHint').classList.add('hidden');
        document.getElementById('evalAnnotation').classList.add('hidden');
        return;
    }
    var o = training.item;
    document.getElementById('openingDesc').innerText = o.desc;
    var total = o.ucis.length;
    var cur = training.moveIndex;
    var pct = Math.min(100, Math.round((cur / total) * 100));
    document.getElementById('trainingProgress').style.width = pct + '%';
    document.getElementById('trainingProgressText').innerText = cur >= total ? 'Завершено!' : 'Ход ' + Math.floor(cur / 2 + 1) + ' из ' + Math.ceil(total / 2);
    if (isPuzzleMode) {
        document.getElementById('puzzleProgressFill').style.width = pct + '%';
        document.getElementById('puzzleProgressText').innerText = cur >= total ? 'Завершено!' : 'Ход ' + Math.floor(cur / 2 + 1) + ' из ' + Math.ceil(total / 2);
    }

    // Show annotation from rich data
    var annotEl = document.getElementById('evalAnnotation');
    if (o.annotations && cur < o.annotations.length && o.annotations[cur]) {
        annotEl.innerHTML = '\uD83D\uDCA1 ' + o.annotations[cur];
        annotEl.classList.remove('hidden');
    } else if (o.annotations && cur > 0 && cur - 1 < o.annotations.length && o.annotations[cur - 1]) {
        annotEl.innerHTML = '\uD83D\uDCA1 ' + o.annotations[cur - 1];
        annotEl.classList.remove('hidden');
    } else {
        annotEl.classList.add('hidden');
    }

    // Show evaluation
    var evalEl = document.getElementById('moveEval');
    if (o.evaluations && cur < o.evaluations.length) {
        var ev = o.evaluations[cur];
        if (typeof ev === 'number' && !isNaN(ev)) {
            evalEl.textContent = (ev >= 0 ? '+' : '') + ev.toFixed(2);
            evalEl.style.color = ev >= 0 ? '#8BC34A' : '#ff8a80';
            evalEl.classList.remove('hidden');
        } else {
            evalEl.classList.add('hidden');
        }
    } else {
        evalEl.classList.add('hidden');
    }

    if (isPlayerMove(cur, o.side) && training.hintsOn && cur < o.ucis.length) {
        var hi = hintIdx(cur, o.side);
        if (o.hints && o.hints[hi]) {
            document.getElementById('trainingHint').classList.remove('hidden');
            document.getElementById('trainingHint').innerHTML = '\u25B6 ' + o.hints[hi];
        }
        // Draw arrow on board
        var uci = o.ucis[cur];
        drawTrainingArrow(uci.substring(0, 2), uci.substring(2, 4));
    } else {
        document.getElementById('trainingHint').classList.add('hidden');
        clearTrainingArrows();
    }
    updateStatus();
}

/* ─── CLICK-TO-MOVE ─── */

let selectedSquare = null;
let boardClickAttached = false;

function showLegalMoves(sq) {
    clearLegalMoves();
    var moves = game.moves({ square: sq, verbose: true });
    for (var i = 0; i < moves.length; i++) {
        var target = moves[i].to;
        var cls = moves[i].captured ? 'legal-capture' : 'legal-move';
        var el = $('#board .' + squareClass(target));
        if (el.length) el.addClass(cls);
    }
}

function selectSquare(sq) {
    if (selectedSquare === sq) { clearSelection(); return; }
    clearSelection();
    selectedSquare = sq;
    showLegalMoves(sq);
    $('#board .' + squareClass(sq)).addClass('highlight-select');
}

function clearSelection() {
    selectedSquare = null;
    clearLegalMoves();
    $('.highlight-select').removeClass('highlight-select');
}

function makeMove(source, target) {
    selectedSquare = null;
    clearLegalMoves();
    $('.highlight-select').removeClass('highlight-select');
    isHintQuery = false;
    document.getElementById('hintBtn').disabled = false;
    clearHint();

    if (training.active && isPlayerMove(training.moveIndex, training.item.side)) {
        var expected = training.item.ucis[training.moveIndex];
        if (source + target !== expected) {
            if (training.hintsOn) {
                var hi = hintIdx(training.moveIndex, training.item.side);
                showToast('\u2717 ' + training.item.hints[hi]);
            } else {
                showToast('\u2717 Неверный ход, попробуй снова!');
            }
            restoreTrainingHighlight();
            board.position(game.fen());
            return;
        }
    }

    evalBeforeUserMove = currentEval;
    var move = game.move({ from: source, to: target, promotion: 'q' });
    if (move === null) {
        board.position(game.fen());
        showToast('Недопустимый ход');
        return;
    }

    lastMoveFrom = source;
    lastMoveTo = target;
    lastUserSan = move.san;

    board.position(game.fen());
    highlightLastMove();
    restoreTrainingHighlight();
    updateStatus();

    if (training.active) {
        training.moveIndex++;
        if (training.moveIndex < training.item.ucis.length && !isPlayerMove(training.moveIndex, training.item.side)) {
            trainingHighlight.from = lastMoveFrom;
            trainingHighlight.to = lastMoveTo;
        } else {
            trainingHighlight.from = '';
            trainingHighlight.to = '';
        }
        updateTrainingUI();
        if (training.moveIndex >= training.item.ucis.length) finishTraining();
        else if (!isPlayerMove(training.moveIndex, training.item.side)) scheduleTrainingComputerMove();
    } else {
        makeEngineMove();
    }
}

function onDragStart(source, piece, pos, orientation) {
    if (!dragMode) return false;
    if (review.active || game.game_over()) return false;
    if (training.active) {
        var pc = training.item.side === 'w' ? 'w' : 'b';
        if (piece.charAt(0) !== pc || game.turn() !== pc || !isPlayerMove(training.moveIndex, training.item.side)) return false;
        return true;
    }
    if (piece.charAt(0) !== userColor || game.turn() !== userColor) return false;
    return true;
}
function onDrop(source, target) { makeMove(source, target); }
function onSnapEnd() {
    board.position(game.fen());
    clearLegalMoves();
    $('.highlight-select').removeClass('highlight-select');
    highlightLastMove();
    restoreTrainingHighlight();
}

function attachBoardClick() {
    if (boardClickAttached) return;
    boardClickAttached = true;
    var boardEl = document.getElementById('board');
    if (!boardEl) return;

    boardEl.addEventListener('click', function(e) {
        var sq = posToSq(e);
        if (sq) handleSquareClick(sq);
    });

    boardEl.addEventListener('touchend', function(e) {
        var t = e.changedTouches[0];
        var sq = posToSq({ clientX: t.clientX, clientY: t.clientY });
        if (sq) {
            e.preventDefault();
            handleSquareClick(sq);
        }
    }, { passive: false });
}

function posToSq(e) {
    var boardEl = document.getElementById('board');
    if (!boardEl || !board) return null;
    var rect = boardEl.getBoundingClientRect();
    var sz = rect.width / 8;
    var col = Math.floor((e.clientX - rect.left) / sz);
    var row = Math.floor((e.clientY - rect.top) / sz);
    if (col < 0 || col > 7 || row < 0 || row > 7) return null;
    var flipped = board.orientation() === 'black';
    var file = String.fromCharCode(97 + (flipped ? 7 - col : col));
    var rank = flipped ? row + 1 : 8 - row;
    return file + rank;
}

function handleSquareClick(sq) {
    if (review.active || game.game_over()) { clearSelection(); return; }

    if (!selectedSquare) {
        var piece = game.get(sq);
        if (!piece) return;
        if (training.active) {
            var pc = training.item.side === 'w' ? 'w' : 'b';
            if (piece.color !== pc || game.turn() !== pc || !isPlayerMove(training.moveIndex, training.item.side)) return;
        } else {
            if (piece.color !== userColor || game.turn() !== userColor) return;
        }
        selectSquare(sq);
        return;
    }

    if (sq === selectedSquare) { clearSelection(); return; }

    var moves = game.moves({ square: selectedSquare, verbose: true });
    for (var i = 0; i < moves.length; i++) {
        if (moves[i].to === sq) { makeMove(selectedSquare, sq); return; }
    }

    var piece = game.get(sq);
    if (piece) {
        if (training.active) {
            var pc = training.item.side === 'w' ? 'w' : 'b';
            if (piece.color === pc && game.turn() === pc && isPlayerMove(training.moveIndex, training.item.side)) {
                selectSquare(sq); return;
            }
        } else {
            if (piece.color === userColor && game.turn() === userColor) {
                selectSquare(sq); return;
            }
        }
    }
    clearSelection();
}

attachBoardClick();

function makeEngineMove() {
    if (game.game_over()) return;
    if (game.turn() === userColor) return;
    if (isAnalyzing) isAnalyzing = false;
    document.getElementById('status').innerText = 'Думает...';
    engineBusy = true;
    clearLegalMoves();
    clearHint();
    var elo = parseInt(document.getElementById('difficulty').value, 10);
    stockfish.postMessage('setoption name UCI_LimitStrength value true');
    stockfish.postMessage('setoption name UCI_Elo value ' + elo);
    stockfish.postMessage('position fen ' + game.fen());
    stockfish.postMessage('go depth 15');
}

/* ─── UI ─── */

function updateStatus() {
    if (review.active) {
        var mIdx = review.currentIdx + 1;
        document.getElementById('status').innerText = 'Разбор: ход ' + mIdx + '/' + review.moves.length;
        return;
    }
    if (training.active && training.item) {
        var o = training.item;
        var cur = training.moveIndex;
        var isPlayer = isPlayerMove(cur, o.side);
        if (isPuzzleMode) {
            document.getElementById('status').innerText = 'Задача ' + o.rating + ' | ' + (isPlayer ? 'Ваш ход' : 'Ход соперника...');
        } else {
            document.getElementById('status').innerText = 'Обучение: ' + o.name + ' | ' + (isPlayer ? 'Ваш ход' : 'Ход соперника...');
        }
        updatePGNDisplay();
        return;
    }
    var status = '';
    if (game.in_checkmate()) status = 'Игра окончена, ' + (game.turn() === 'w' ? 'черные' : 'белые') + ' победили матом.';
    else if (game.in_draw()) status = 'Игра окончена, ничья.';
    else {
        if (game.turn() === userColor) {
            status = 'Ваш ход';
            if (game.in_check()) status += ', Шах!';
        } else {
            status = 'Ход соперника...';
        }
    }
    document.getElementById('status').innerText = status;
    updatePGNDisplay();
}

function updatePGNDisplay() {
    var history = game.history({ verbose: true });
    var html = '';
    for (var i = 0; i < history.length; i++) {
        var h = history[i];
        var moveNum = Math.floor(i / 2) + 1;
        if (i % 2 === 0) html += '<span class="pgn-move">' + moveNum + '. ';
        html += h.san;
        var flagged = null;
        for (var j = 0; j < moveLog.length; j++) {
            if (moveLog[j].moveIdx === i + 1) { flagged = moveLog[j]; break; }
        }
        if (flagged) {
            var cls = flagged.flag === '??' ? 'flag-blunder' : flagged.flag === '?' ? 'flag-mistake' : 'flag-good';
            html += '<span class="' + cls + '">' + flagged.flag + '</span>';
        }
        html += ' ';
        if (i % 2 === 1) html += '</span>';
    }
    if (history.length % 2 === 1) html += '</span>';
    document.getElementById('pgn').innerHTML = html || '';
}

function createStars() {
    var count = 140;
    var frag = document.createDocumentFragment();
    for (var i = 0; i < count; i++) {
        var star = document.createElement('div');
        star.className = 'star';
        var size = Math.random() * 2.5 + 0.5;
        star.style.width = size + 'px';
        star.style.height = size + 'px';
        star.style.left = Math.random() * 100 + '%';
        star.style.top = Math.random() * 100 + '%';
        star.style.animationDelay = (Math.random() * 6) + 's';
        star.style.animationDuration = (Math.random() * 3 + 3) + 's';
        frag.appendChild(star);
    }
    document.body.appendChild(frag);
}
createStars();

function showToast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(function() { t.classList.remove('show'); }, 2500);
}

function populateTrainingSelect() {
    var sel = document.getElementById('trainingSelect');
    sel.innerHTML = '';
    var progress = getTrainingProgress();
    var catSeen = {};
    groupOrder.forEach(function(g) {
        var items = trainingItems.filter(function(i) { return i.group === g; });
        if (!items.length) return;
        var cat = groupCategories[g];
        if (!catSeen[cat]) {
            var hr = document.createElement('option');
            hr.disabled = true;
            hr.textContent = '\u2500 ' + cat + ' \u2500';
            sel.appendChild(hr);
            catSeen[cat] = true;
        }
        var stats = getGroupStats(g);
        var optgroup = document.createElement('optgroup');
        optgroup.label = groupNames[g] + ' (' + stats.done + '/' + stats.total + ')';
        items.forEach(function(item) {
            var opt = document.createElement('option');
            opt.value = item.id;
            var done = progress[item.id] ? '\u2713 ' : '   ';
            opt.textContent = done + item.name;
            if (progress[item.id]) opt.style.color = '#4caf50';
            optgroup.appendChild(opt);
        });
        sel.appendChild(optgroup);
    });
    var puzzleItems = trainingItems.filter(function(i) { return i.group === 'puzzles'; });
    if (puzzleItems.length) {
        var stats = getGroupStats('puzzles');
        var optgroup = document.createElement('optgroup');
        optgroup.label = 'Задачи (' + stats.done + '/' + stats.total + ')';
        puzzleItems.forEach(function(item) {
            var opt = document.createElement('option');
            opt.value = item.id;
            var done = progress[item.id] ? '\u2713 ' : '   ';
            opt.textContent = done + item.name;
            if (progress[item.id]) opt.style.color = '#4caf50';
            optgroup.appendChild(opt);
        });
        sel.appendChild(optgroup);
    }
}

window.addEventListener('focus', function() {
    if (board && game) {
        board.position(game.fen());
        highlightLastMove();
        restoreTrainingHighlight();
    }
});

/* ─── RESIZE ─── */

var resizeTimer;
window.addEventListener('resize', function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function() {
        var newSize = getBoardSize();
        if (Math.abs(newSize - boardSize) > 5) {
            setBoardElementWidth();
            if (board && board.resize) board.resize();
            else initBoard(game.fen(), board ? board.orientation() : undefined);
        }
    }, 250);
});

/* ─── INIT ─── */

loadSettings();
loadOpeningsFromServer(function() {
    populateTrainingSelect();
    updateGroupProgressDisplay();
});
initBoard('start', 'white');
updateStatus();

/* ─── EVENT LISTENERS ─── */

document.getElementById('resetBtn').addEventListener('click', function() {
    if (training.active) stopTraining();
    if (review.active) exitReviewMode();
    moveLog.length = 0;
    lastMoveFrom = lastMoveTo = '';
    selectedSquare = null;
    clearLegalMoves();
    $('.highlight-hint').removeClass('highlight-hint');
    hintBestMove = null;
    var sel = document.getElementById('colorSelect');
    userColor = sel.value;
    game.reset();
    var orientation = userColor === 'b' ? 'black' : 'white';
    initBoard('start', orientation);
    updateStatus();
    if (userColor === 'b' && !game.game_over()) {
        setTimeout(function() { makeEngineMove(); }, 500);
    }
});

document.getElementById('flipBtn').addEventListener('click', function() {
    if (board) board.flip();
});

document.getElementById('reviewBtn').addEventListener('click', function() {
    if (training.active) { showToast('Сначала выйдите из обучения'); return; }
    if (game.history().length === 0) { showToast('Нет ходов для разбора'); return; }
    enterReviewMode();
});

document.getElementById('reviewPrev').addEventListener('click', reviewPrev);
document.getElementById('reviewNext').addEventListener('click', reviewNext);
document.getElementById('reviewExit').addEventListener('click', exitReviewMode);

document.getElementById('copyBtn').addEventListener('click', function() {
    var pgn = game.pgn();
    if (!pgn) { showToast('Нет ходов для копирования'); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(pgn).then(function() { showToast('Ходы скопированы!'); }).catch(function() { fallbackCopy(pgn); });
    } else { fallbackCopy(pgn); }
});

function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); showToast('Ходы скопированы!'); } catch (e) { showToast('Не удалось скопировать'); }
    document.body.removeChild(ta);
}

document.getElementById('hintBtn').addEventListener('click', showBestMoveHint);

document.getElementById('dragToggle').addEventListener('click', function() {
    if (training.active) { showToast('Сначала выйдите из обучения'); return; }
    if (review.active) { showToast('Сначала выйдите из разбора'); return; }
    dragMode = !dragMode;
    this.textContent = dragMode ? '\u270B Drag' : '\uD83D\uDC0D Click';
    this.classList.toggle('active');
    initBoard(game.fen(), board ? board.orientation() : undefined);
    highlightLastMove();
    updateStatus();
    saveSettings();
    showToast(dragMode ? 'Режим перетаскивания' : 'Режим щелчков');
});

document.getElementById('difficulty').addEventListener('change', function() {
    if (engineReady) {
        stockfish.postMessage('setoption name UCI_Elo value ' + parseInt(this.value, 10));
    }
    saveSettings();
    showToast('Уровень сложности изменён');
});

document.getElementById('colorSelect').addEventListener('change', function() {
    saveSettings();
    showToast('Вы играете за ' + (this.value === 'w' ? 'белых' : 'чёрных'));
});

document.getElementById('trainingToggle').addEventListener('click', function() {
    document.getElementById('trainingPanel').classList.toggle('hidden');
});
document.getElementById('startTrainingBtn').addEventListener('click', function() {
    startTraining(document.getElementById('trainingSelect').value);
});
document.getElementById('stopTrainingBtn').addEventListener('click', function() { stopTraining(); });
document.getElementById('hintCheck').addEventListener('change', function() {
    training.hintsOn = this.checked;
    saveSettings();
    if (training.active) updateTrainingUI();
});
document.getElementById('trainingSelect').addEventListener('change', function() {
    updateGroupProgressDisplay();
    var id = this.value;
    var item = trainingItems.find(function(o) { return o.id === id; });
    document.getElementById('openingDesc').innerText = item ? item.desc : '';
});
document.getElementById('resetProgressBtn').addEventListener('click', function() {
    if (confirm('Сбросить весь прогресс обучения?')) {
        resetTrainingProgress();
        populateTrainingSelect();
        updateGroupProgressDisplay();
        showToast('Прогресс сброшен!');
    }
});

function updateGroupProgressDisplay() {
    var sel = document.getElementById('trainingSelect');
    var id = sel.value;
    var item = trainingItems.find(function(o) { return o.id === id; });
    var el = document.getElementById('groupProgress');
    if (item && item.group && groupNames[item.group]) {
        var stats = getGroupStats(item.group);
        var pct = stats.total > 0 ? Math.round(stats.done / stats.total * 100) : 0;
        el.innerHTML = '<b>' + groupNames[item.group] + '</b>: ' + stats.done + '/' + stats.total + ' изучено (' + pct + '%)';
        el.className = 'group-progress';
        if (stats.done === stats.total && stats.total > 0) el.style.color = '#4caf50';
        else el.style.color = '#8bc34a';
    } else {
        el.className = 'group-progress hidden';
    }
}

document.getElementById('pgnToggle').addEventListener('click', function() {
    document.getElementById('pgnPanel').classList.toggle('hidden');
});
document.getElementById('pgnLoadBtn').addEventListener('click', function() {
    var pgn = document.getElementById('pgnText').value.trim();
    if (!pgn) { showToast('Введите PGN'); return; }
    if (training.active) stopTraining();
    try {
        game.load_pgn(pgn);
    } catch(e) {
        showToast('Ошибка: неверный формат PGN');
        return;
    }
    initBoard(game.fen(), 'white');
    updateStatus();
    document.getElementById('pgnPanel').classList.add('hidden');
    enterReviewMode();
});

/* ─── PUZZLES ─── */

function applyFirstMove(fen, uci) {
    var c = new Chess(fen);
    c.move({ from: uci.substring(0,2), to: uci.substring(2,4), promotion: uci.substring(4,5)||'q' });
    return c.fen();
}

document.getElementById('puzzleToggle').addEventListener('click', function() {
    document.getElementById('puzzlePanel').classList.toggle('hidden');
    if (!document.getElementById('puzzleTheme').options.length > 1) {
        fetch('/api/puzzle-meta').then(function(r) { return r.json(); }).then(function(data) {
            var sel = document.getElementById('puzzleTheme');
            data.themes.forEach(function(t) {
                var opt = document.createElement('option');
                opt.value = t;
                opt.textContent = t;
                sel.appendChild(opt);
            });
        }).catch(function() {});
    }
});

document.getElementById('puzzleDifficulty').addEventListener('change', saveSettings);
document.getElementById('puzzleTheme').addEventListener('change', saveSettings);

document.getElementById('getPuzzleBtn').addEventListener('click', function() {
    if (review.active) { showToast('Сначала выйдите из разбора'); return; }
    if (training.active) stopTraining();
    isPuzzleMode = true;

    var diff = document.getElementById('puzzleDifficulty').value;
    var parts = diff.split('-');
    var theme = document.getElementById('puzzleTheme').value;

    document.getElementById('getPuzzleBtn').disabled = true;
    document.getElementById('getPuzzleBtn').innerText = 'Загрузка...';

    var params = '?limit=1&minRating=' + parts[0] + '&maxRating=' + parts[1];
    if (theme) params += '&theme=' + encodeURIComponent(theme);

    fetch('/api/puzzles' + params).then(function(r) { return r.json(); }).then(function(puzzles) {
        if (!puzzles || puzzles.length === 0) {
            showToast('Не найдено задач по вашему запросу');
            document.getElementById('getPuzzleBtn').disabled = false;
            document.getElementById('getPuzzleBtn').innerText = 'Получить задачу';
            isPuzzleMode = false;
            return;
        }
        var puzzle = puzzles[0];
        startPuzzle(puzzle);
    }).catch(function() {
        showToast('Ошибка загрузки задачи');
        document.getElementById('getPuzzleBtn').disabled = false;
        document.getElementById('getPuzzleBtn').innerText = 'Получить задачу';
        isPuzzleMode = false;
    });
});

function startPuzzle(puzzle) {
    var moves = puzzle.moves.split(' ');
    var fenAfterFirst = applyFirstMove(puzzle.fen, moves[0]);
    var solutionMoves = moves.slice(1);

    clearTrainingTimer();
    moveLog.length = 0;
    game.reset();
    game.load(fenAfterFirst);

    training.active = true;
    training.item = {
        group: 'puzzles',
        id: puzzle.puzzleId,
        name: puzzle.puzzleId,
        desc: '\u2B50 Рейтинг: ' + puzzle.rating + ' | \uD83C\uDF1F ' + puzzle.themes,
        fen: fenAfterFirst,
        side: puzzle.side,
        ucis: solutionMoves,
        hints: [],
        rating: puzzle.rating,
        themes: puzzle.themes
    };
    training.moveIndex = 0;
    training.hintsOn = document.getElementById('hintCheck').checked;

    document.getElementById('getPuzzleBtn').innerText = 'Получить задачу';
    document.getElementById('stopPuzzleBtn').disabled = false;
    document.getElementById('puzzleToggle').textContent = '\u{1F3AF} Задача #' + puzzle.puzzleId;
    document.getElementById('puzzleToggle').classList.add('active');

    document.getElementById('puzzleInfo').classList.remove('hidden');
    document.getElementById('puzzleRating').textContent = '\u2B50 ' + puzzle.rating;
    document.getElementById('puzzleThemes').textContent = puzzle.themes;
    document.getElementById('puzzleProgress').classList.remove('hidden');

    initBoard(fenAfterFirst, puzzle.side === 'b' ? 'black' : 'white');
    updateTrainingUI();
    if (!isPlayerMove(0, puzzle.side)) scheduleTrainingComputerMove();
}

document.getElementById('stopPuzzleBtn').addEventListener('click', function() {
    if (training.active && isPuzzleMode) stopTraining();
});
