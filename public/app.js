const game = new Chess();
let board = null;
let stockfish = new Worker('stockfish.js');
let engineReady = false;
let engineBusy = false;
let currentRotation = 0;
let boardSize = 0;

const PIECE_IMG = 'img/chesspieces/wikipedia/{piece}.png';

const trainingItems = [
    { category: 'Дебюты', id: 'london', name: 'Лондонская система', desc: 'Надёжный дебют 1.d4 с выходом слона на f4.', fen: '', side: 'w',
        ucis: ['d2d4','d7d5','c1f4','g8f6','e2e3','e7e6','g1f3','c7c5','c2c3','b8c6','b1d2'],
        hints: ['1. d4 — захвати центр','2. Bf4 — развитие слона','3. e3 — поддержка центра','4. Nf3 — развитие коня','5. c3 — контроль d4','6. Nbd2 — заверши развитие'] },
    { category: 'Дебюты', id: 'italian', name: 'Итальянская партия', desc: 'Классическое начало 1.e4 с выходом слона на c4.', fen: '', side: 'w',
        ucis: ['e2e4','e7e5','g1f3','b8c6','f1c4','f8c5','c2c3','g8f6','d2d3','d7d6','e1g1'],
        hints: ['1. e4 — захвати центр','2. Nf3 — развитие коня','3. Bc4 — слон на c4','4. c3 — контроль d4','5. d3 — поддержка центра','6. O-O — рокировка'] },
    { category: 'Дебюты', id: 'queensgambit', name: 'Ферзевый гамбит', desc: 'Классический дебют: 1.d4 d5 2.c4.', fen: '', side: 'w',
        ucis: ['d2d4','d7d5','c2c4','e7e6','b1c3','g8f6','c1g5','f8e7','e2e3','e8g8','g1f3'],
        hints: ['1. d4 — захвати центр','2. c4 — ферзевый гамбит','3. Nc3 — развитие коня','4. Bg5 — связка коня','5. e3 — поддержка центра','6. Nf3 — развитие коня'] },
    { category: 'Дебюты', id: 'sicilian', name: 'Сицилианская защита', desc: 'Вы играете чёрными. 1.e4 c5.', fen: '', side: 'b',
        ucis: ['e2e4','c7c5','g1f3','d7d6','d2d4','c5d4','f3d4','g8f6','b1c3','g7g6','c1e3','f8g7'],
        hints: ['1... c5 — сицилианская','2... d6 — подготовка e5','3... cxd4 — размен','4... Nf6 — развитие коня','5... g6 — подготовка Bg7','6... Bg7 — фианкетто'] },
    { category: 'Дебюты', id: 'carokann', name: 'Защита Каро-Канн', desc: 'Вы играете чёрными. Надёжная защита на 1.e4.', fen: '', side: 'b',
        ucis: ['e2e4','c7c6','d2d4','d7d5','e4e5','c8f5','g1f3','e7e6','f1e2','c6c5','e1g1','b8c6'],
        hints: ['1... c6 — Каро-Канн','2... d5 — атака центра','3... Bf5 — развитие слона','4... e6 — поддержка','5... c5 — контратака','6... Nc6 — развитие'] },
    { category: 'Дебюты', id: 'french', name: 'Французская защита', desc: 'Вы играете чёрными. 1.e4 e6.', fen: '', side: 'b',
        ucis: ['e2e4','e7e6','d2d4','d7d5','e4e5','c7c5','c2c3','b8c6','g1f3','d8b6','a2a3','c5c4'],
        hints: ['1... e6 — французская','2... d5 — атака центра','3... c5 — контратака','4... Nc6 — развитие','5... Qb6 — давление на b2','6... c4 — закрытие позиции'] },
    { category: 'Дебюты', id: 'kingsindian', name: 'Староиндийская защита', desc: 'Вы играете чёрными. Гибкая защита на 1.d4.', fen: '', side: 'b',
        ucis: ['d2d4','g8f6','c2c4','g7g6','b1c3','f8g7','e2e4','d7d6','g1f3','e8g8','f1e2','e7e5'],
        hints: ['1... Nf6 — староиндийская','2... g6 — подготовка Bg7','3... Bg7 — фианкетто','4... d6 — поддержка центра','5... O-O — рокировка','6... e5 — контратака'] },

    { category: 'Задачи', id: 'scholar', name: 'Детский мат', desc: 'Найдите мат в 1 ход.', fen: 'r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 0 4', side: 'w',
        ucis: ['d1f7'], hints: ['Ферзь на f7 — мат!'] },
    { category: 'Задачи', id: 'legal', name: 'Мат Легаля', desc: 'Найдите мат в 1 ход.', fen: 'r2qkb1r/ppp2Bpp/3p4/8/4N3/2N5/PPPP1bPP/R1BQK2R w KQkq - 0 7', side: 'w',
        ucis: ['e4d5'], hints: ['Конь на d5 — спёртый мат!'] },
    { category: 'Задачи', id: 'qmate', name: 'Мат ферзём', desc: 'Поставьте мат ферзём в 1 ход.', fen: '8/8/8/8/8/1Q6/1K6/k7 w - - 0 1', side: 'w',
        ucis: ['b3a3'], hints: ['Ферзь на a3 — мат!'] },
    { category: 'Задачи', id: 'smothered', name: 'Спёртый мат', desc: 'Спёртый мат конём в 2 хода.', fen: '5rk1/ppp2ppp/8/8/8/5N2/PPPP1PPP/RNB1K3 w Q - 0 1', side: 'w',
        ucis: ['f3g5','f8e8','g5f7'], hints: ['Конь на g5 — подготовка','Конь на f7 — спёртый мат!'] },
    { category: 'Задачи', id: 'fork', name: 'Вилка конём', desc: 'Найдите двойной удар конём.', fen: '2r3k1/5ppp/8/3N4/8/8/5PPP/6K1 w - - 0 1', side: 'w',
        ucis: ['d5f6'], hints: ['Nf6+ — атакует короля и ладью!'] },
    { category: 'Задачи', id: 'bishop-sac', name: 'Жертва слона', desc: 'Пожертвуйте слона для атаки на короля.', fen: 'r1bq1rk1/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQ1RK1 w - - 0 5', side: 'w',
        ucis: ['c4f7'], hints: ['Bxf7+! Разрушая укрытие короля'] },
    { category: 'Задачи', id: 'backrank', name: 'Мат на проходной', desc: 'Используйте слабость последней горизонтали.', fen: 'r1b2rk1/pppp1ppp/2n5/4P3/2B5/2NP4/PPP2PPP/R1BqK2R w KQ - 0 8', side: 'w',
        ucis: ['d1d8'], hints: ['Ферзь на d8 — мат! Ладья не защищает из-за связки.'] },
    { category: 'Задачи', id: 'pin', name: 'Связка', desc: 'Используйте связку для выигрыша фигуры.', fen: 'r1bqk2r/pppp1ppp/2n2n2/4p3/2B1P3/2N5/PPPP1PPP/R1BQK2R w KQkq - 0 5', side: 'w',
        ucis: ['c1g5'], hints: ['Bg5 — связывает коня!'] },
    { category: 'Задачи', id: 'discovered', name: 'Открытый шах', desc: 'Найдите открытый шах с выигрышем фигуры.', fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/2N5/PPPP1PPP/R1BQK2R w KQkq - 0 4', side: 'w',
        ucis: ['c3d5'], hints: ['Nd5 — открывает шах слоном и атакует ферзя!'] },
    { category: 'Задачи', id: 'skewer', name: 'Сквозной удар', desc: 'Атакуйте короля, за ним стоит фигура.', fen: '4k3/8/8/8/8/8/2r5/R3K3 w - - 0 1', side: 'w',
        ucis: ['a1e1'], hints: ['Re1+ — за королём ладья!'] },
];

const training = { active: false, item: null, moveIndex: 0, hintsOn: true };
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
    function alg(sq) { return 'square-' + (9 - parseInt(sq[1], 10)) + (sq.charCodeAt(0) - 96); }
    $('#board .' + alg(lastMoveFrom)).addClass('highlight-last');
    $('#board .' + alg(lastMoveTo)).addClass('highlight-last');
}

/* ─── REVIEW MODE ─── */

function enterReviewMode() {
    if (training.active) { showToast('Сначала выйдите из обучения'); return; }
    if (review.active) return;
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
    rebuildBoard(game.fen());
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

function createBoard(position, orientation) {
    setBoardElementWidth();
    var config = {
        draggable: true,
        position: position || 'start',
        pieceTheme: PIECE_IMG,
        orientation: orientation || (userColor === 'b' ? 'black' : 'white'),
        onDragStart: onDragStart, onDrop: onDrop, onSnapEnd: onSnapEnd
    };
    board = Chessboard('board', config);
}

function rebuildBoard(position, orientation) {
    if (board) board.destroy();
    setBoardElementWidth();
    var config = {
        draggable: true,
        position: position || game.fen(),
        pieceTheme: PIECE_IMG,
        orientation: orientation || (userColor === 'b' ? 'black' : 'white'),
        onDragStart: onDragStart, onDrop: onDrop, onSnapEnd: onSnapEnd
    };
    board = Chessboard('board', config);
}

/* ─── TRAINING ─── */

function isPlayerMove(idx, side) {
    return (side === 'w' && idx % 2 === 0) || (side === 'b' && idx % 2 === 1);
}

function hintIdx(idx, side) {
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
    document.getElementById('status').innerText = 'Ход соперника...';
    trainingTimer = setTimeout(function() {
        trainingTimer = null;
        if (!training.active) return;
        var uci = training.item.ucis[training.moveIndex];
        var move = game.move({ from: uci.substring(0,2), to: uci.substring(2,4), promotion: uci.substring(4,5)||'q' });
        if (move) {
            lastMoveFrom = uci.substring(0,2);
            lastMoveTo = uci.substring(2,4);
            board.position(game.fen());
            highlightLastMove();
            training.moveIndex++;
            if (training.moveIndex >= training.item.ucis.length) { updateTrainingUI(); finishTraining(); }
            else if (isPlayerMove(training.moveIndex, training.item.side)) updateStatus();
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
    document.getElementById('trainingToggle').textContent = '\u{1F393} ' + item.category + ': ' + item.name;
    document.getElementById('trainingToggle').classList.add('active');
    if (board) board.destroy();
    setBoardElementWidth();
    var startPos = item.fen || 'start';
    var config = {
        draggable: true, position: startPos, pieceTheme: PIECE_IMG,
        orientation: item.side === 'b' ? 'black' : 'white',
        onDragStart: onDragStart, onDrop: onDrop, onSnapEnd: onSnapEnd
    };
    board = Chessboard('board', config);
    if (item.fen) game.load(item.fen);
    updateTrainingUI();
    if (!isPlayerMove(0, item.side)) scheduleTrainingComputerMove();
}

function stopTraining() {
    clearTrainingTimer();
    training.active = false;
    training.item = null;
    training.moveIndex = 0;
    document.getElementById('startTrainingBtn').disabled = false;
    document.getElementById('stopTrainingBtn').disabled = true;
    document.getElementById('trainingSelect').disabled = false;
    document.getElementById('trainingToggle').textContent = '\u{1F393} Обучение';
    document.getElementById('trainingToggle').classList.remove('active');
    document.getElementById('trainingHint').classList.add('hidden');
    document.getElementById('openingDesc').innerText = '';
    document.getElementById('trainingProgress').style.width = '0%';
    document.getElementById('trainingProgressText').innerText = 'Не начато';
    game.reset();
    if (board) {
        board.destroy();
        setBoardElementWidth();
        board = Chessboard('board', { draggable: true, position: 'start', pieceTheme: PIECE_IMG, orientation: userColor === 'b' ? 'black' : 'white', onDragStart: onDragStart, onDrop: onDrop, onSnapEnd: onSnapEnd });
    }
    updateStatus();
}

function finishTraining() {
    clearTrainingTimer();
    if (!training.active) return;
    training.active = false;
    document.getElementById('startTrainingBtn').disabled = false;
    document.getElementById('stopTrainingBtn').disabled = true;
    document.getElementById('trainingSelect').disabled = false;
    document.getElementById('trainingToggle').textContent = '\u{1F393} Обучение';
    document.getElementById('trainingToggle').classList.remove('active');
    document.getElementById('trainingHint').classList.add('hidden');
    showToast('\u{1F389} Отлично! ' + training.item.name + ' \u2014 выполнено!');
    document.getElementById('status').innerText = 'Обучение завершено! Выберите другой дебют или задачу.';
}

function updateTrainingUI() {
    if (!training.active || !training.item) {
        document.getElementById('openingDesc').innerText = '';
        document.getElementById('trainingHint').classList.add('hidden');
        return;
    }
    var o = training.item;
    document.getElementById('openingDesc').innerText = o.desc;
    var total = o.ucis.length;
    var cur = training.moveIndex;
    var pct = Math.min(100, Math.round((cur / total) * 100));
    document.getElementById('trainingProgress').style.width = pct + '%';
    document.getElementById('trainingProgressText').innerText = cur >= total ? 'Завершено!' : 'Ход ' + Math.floor(cur / 2 + 1) + ' из ' + Math.ceil(total / 2);
    if (isPlayerMove(cur, o.side) && training.hintsOn && cur < o.ucis.length) {
        var hi = hintIdx(cur, o.side);
        if (o.hints[hi]) {
            document.getElementById('trainingHint').classList.remove('hidden');
            document.getElementById('trainingHint').innerText = '\u25B6 ' + o.hints[hi];
        }
    } else {
        document.getElementById('trainingHint').classList.add('hidden');
    }
    updateStatus();
}

/* ─── DRAG & DROP ─── */

function onDragStart(source, piece, position, orientation) {
    if (review.active) return false;
    if (game.game_over()) return false;
    if (training.active) {
        var pColor = piece[0];
        var playerColor = training.item.side === 'w' ? 'w' : 'b';
        if (pColor !== playerColor) return false;
        if (game.turn() !== playerColor) return false;
        if (!isPlayerMove(training.moveIndex, training.item.side)) return false;
        return true;
    }
    if (piece[0] !== userColor) return false;
    if (game.turn() !== userColor) return false;
}

function onDrop(source, target) {
    if (review.active) return 'snapback';
    if (training.active && isPlayerMove(training.moveIndex, training.item.side)) {
        var expected = training.item.ucis[training.moveIndex];
        if (source + target !== expected) {
            if (training.hintsOn) {
                var hi = hintIdx(training.moveIndex, training.item.side);
                showToast('\u2717 ' + training.item.hints[hi]);
            } else {
                showToast('\u2717 Неверный ход, попробуй снова!');
            }
            return 'snapback';
        }
    }
    evalBeforeUserMove = currentEval;
    var move = game.move({ from: source, to: target, promotion: 'q' });
    if (move === null) return 'snapback';
    lastMoveFrom = source;
    lastMoveTo = target;
    lastUserSan = move.san;
    updateStatus();
    if (training.active) {
        training.moveIndex++;
        updateTrainingUI();
        if (training.moveIndex >= training.item.ucis.length) finishTraining();
        else if (!isPlayerMove(training.moveIndex, training.item.side)) scheduleTrainingComputerMove();
    } else {
        makeEngineMove();
    }
}

function onSnapEnd() {
    board.position(game.fen());
    highlightLastMove();
}

function makeEngineMove() {
    if (game.game_over()) return;
    if (game.turn() === userColor) return;
    if (isAnalyzing) isAnalyzing = false;
    document.getElementById('status').innerText = 'Думает...';
    engineBusy = true;
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
        document.getElementById('status').innerText = 'Обучение: ' + o.name + ' | ' + (isPlayer ? 'Ваш ход' : 'Ход соперника...');
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

function applyRotation(deg) {
    if (training.active) stopTraining();
    currentRotation = deg;
    var boardEl = document.getElementById('board');
    boardEl.style.transform = deg ? 'rotate(' + deg + 'deg)' : '';
    boardEl.style.transformOrigin = 'center center';
    rebuildBoard();
}

function showToast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(function() { t.classList.remove('show'); }, 2500);
}

function populateTrainingSelect() {
    var sel = document.getElementById('trainingSelect');
    sel.innerHTML = '';
    var groups = {};
    trainingItems.forEach(function(item) {
        if (!groups[item.category]) groups[item.category] = [];
        groups[item.category].push(item);
    });
    Object.keys(groups).forEach(function(cat) {
        var optgroup = document.createElement('optgroup');
        optgroup.label = cat;
        groups[cat].forEach(function(item) {
            var opt = document.createElement('option');
            opt.value = item.id;
            opt.textContent = item.name;
            optgroup.appendChild(opt);
        });
        sel.appendChild(optgroup);
    });
}

/* ─── RESIZE ─── */

var resizeTimer;
window.addEventListener('resize', function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function() {
        var newSize = getBoardSize();
        if (Math.abs(newSize - boardSize) > 5) {
            setBoardElementWidth();
            if (board && board.resize) board.resize();
            else rebuildBoard();
        }
    }, 250);
});

/* ─── INIT ─── */

populateTrainingSelect();
createBoard('start', 'white');
updateStatus();

/* ─── EVENT LISTENERS ─── */

document.getElementById('resetBtn').addEventListener('click', function() {
    if (training.active) stopTraining();
    if (review.active) exitReviewMode();
    moveLog.length = 0;
    lastMoveFrom = lastMoveTo = '';
    var sel = document.getElementById('colorSelect');
    userColor = sel.value;
    game.reset();
    var orientation = userColor === 'b' ? 'black' : 'white';
    rebuildBoard('start', orientation);
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

document.getElementById('rotate90').addEventListener('click', function() { applyRotation(currentRotation === 90 ? 0 : 90); });
document.getElementById('rotate180').addEventListener('click', function() { applyRotation(currentRotation === 180 ? 0 : 180); });
document.getElementById('rotateReset').addEventListener('click', function() { applyRotation(0); });
document.getElementById('difficulty').addEventListener('change', function() {
    if (engineReady) {
        stockfish.postMessage('setoption name UCI_Elo value ' + parseInt(this.value, 10));
    }
    showToast('Уровень сложности изменён');
});

document.getElementById('colorSelect').addEventListener('change', function() {
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
    if (training.active) updateTrainingUI();
});

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
    if (board) board.destroy();
    setBoardElementWidth();
    board = Chessboard('board', { draggable: true, position: game.fen(), pieceTheme: PIECE_IMG, orientation: 'white', onDragStart: onDragStart, onDrop: onDrop, onSnapEnd: onSnapEnd });
    updateStatus();
    document.getElementById('pgnPanel').classList.add('hidden');
    enterReviewMode();
});
