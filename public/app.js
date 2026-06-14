const game = new Chess();
let board = null;
let stockfish = new Worker('stockfish.js');
let engineReady = false;
let engineBusy = false;
let currentRotation = 0;
let boardSize = 0;

const PIECE_IMG = 'img/chesspieces/wikipedia/{piece}.png';

const trainingItems = [
    // ─── ДЕБЮТЫ ───
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

    // ─── ЗАДАЧИ ───
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

stockfish.onmessage = function(event) {
    if (event.data === 'uciok') { stockfish.postMessage('isready'); return; }
    if (event.data === 'readyok') { engineReady = true; return; }
    if (event.data.startsWith('bestmove')) {
        if (!engineBusy) return;
        engineBusy = false;
        const bestMove = event.data.split(' ')[1];
        if (!bestMove) return;
        const from = bestMove.substring(0, 2);
        const to = bestMove.substring(2, 4);
        const promotion = bestMove.substring(4, 5) || 'q';
        const move = game.move({ from, to, promotion });
        if (move) { board.position(game.fen()); updateStatus(); }
    }
};
stockfish.postMessage('uci');

function getBoardSize() {
    const ww = window.innerWidth - 32;
    const wh = window.innerHeight - 320;
    return Math.max(200, Math.min(400, ww, wh));
}

function setBoardElementWidth() {
    boardSize = getBoardSize();
    document.getElementById('board').style.width = boardSize + 'px';
}

function createBoard(position, orientation) {
    setBoardElementWidth();
    const config = {
        draggable: true,
        position: position || 'start',
        pieceTheme: PIECE_IMG,
        orientation: orientation || 'white',
        onDragStart: onDragStart, onDrop: onDrop, onSnapEnd: onSnapEnd
    };
    board = Chessboard('board', config);
}

function rebuildBoard(position, orientation) {
    if (board) board.destroy();
    setBoardElementWidth();
    const config = {
        draggable: true,
        position: position || game.fen(),
        pieceTheme: PIECE_IMG,
        orientation: orientation || 'white',
        onDragStart: onDragStart, onDrop: onDrop, onSnapEnd: onSnapEnd
    };
    board = Chessboard('board', config);
}

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
        const uci = training.item.ucis[training.moveIndex];
        const move = game.move({ from: uci.substring(0,2), to: uci.substring(2,4), promotion: uci.substring(4,5)||'q' });
        if (move) {
            board.position(game.fen());
            training.moveIndex++;
            if (training.moveIndex >= training.item.ucis.length) { updateTrainingUI(); finishTraining(); }
            else if (isPlayerMove(training.moveIndex, training.item.side)) updateStatus();
            else scheduleTrainingComputerMove();
        }
    }, 600);
}

function startTraining(id) {
    const item = trainingItems.find(function(o) { return o.id === id; });
    if (!item) return;
    clearTrainingTimer();
    game.reset();
    training.active = true;
    training.item = item;
    training.moveIndex = 0;
    training.hintsOn = document.getElementById('hintCheck').checked;
    document.getElementById('startTrainingBtn').disabled = true;
    document.getElementById('stopTrainingBtn').disabled = false;
    document.getElementById('trainingSelect').disabled = true;
    document.getElementById('trainingToggle').textContent = '🎓 ' + item.category + ': ' + item.name;
    document.getElementById('trainingToggle').classList.add('active');
    if (board) board.destroy();
    setBoardElementWidth();
    const startPos = item.fen || 'start';
    const config = {
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
    document.getElementById('trainingToggle').textContent = '🎓 Обучение';
    document.getElementById('trainingToggle').classList.remove('active');
    document.getElementById('trainingHint').classList.add('hidden');
    document.getElementById('openingDesc').innerText = '';
    document.getElementById('trainingProgress').style.width = '0%';
    document.getElementById('trainingProgressText').innerText = 'Не начато';
    game.reset();
    if (board) {
        board.destroy();
        setBoardElementWidth();
        board = Chessboard('board', { draggable: true, position: 'start', pieceTheme: PIECE_IMG, orientation: 'white', onDragStart: onDragStart, onDrop: onDrop, onSnapEnd: onSnapEnd });
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
    document.getElementById('trainingToggle').textContent = '🎓 Обучение';
    document.getElementById('trainingToggle').classList.remove('active');
    document.getElementById('trainingHint').classList.add('hidden');
    showToast('🎉 Отлично! ' + training.item.name + ' — выполнено!');
    document.getElementById('status').innerText = 'Обучение завершено! Выберите другой дебют или задачу.';
}

function updateTrainingUI() {
    if (!training.active || !training.item) {
        document.getElementById('openingDesc').innerText = '';
        document.getElementById('trainingHint').classList.add('hidden');
        return;
    }
    const o = training.item;
    document.getElementById('openingDesc').innerText = o.desc;
    const total = o.ucis.length;
    const cur = training.moveIndex;
    const pct = Math.min(100, Math.round((cur / total) * 100));
    document.getElementById('trainingProgress').style.width = pct + '%';
    document.getElementById('trainingProgressText').innerText = cur >= total ? 'Завершено!' : 'Ход ' + Math.floor(cur / 2 + 1) + ' из ' + Math.ceil(total / 2);
    if (isPlayerMove(cur, o.side) && training.hintsOn && cur < o.ucis.length) {
        const hi = hintIdx(cur, o.side);
        if (o.hints[hi]) {
            document.getElementById('trainingHint').classList.remove('hidden');
            document.getElementById('trainingHint').innerText = '▶ ' + o.hints[hi];
        }
    } else {
        document.getElementById('trainingHint').classList.add('hidden');
    }
    updateStatus();
}

function onDragStart(source, piece, position, orientation) {
    if (game.game_over()) return false;
    if (training.active) {
        const pColor = piece[0];
        const playerColor = training.item.side === 'w' ? 'w' : 'b';
        if (pColor !== playerColor) return false;
        if (game.turn() !== playerColor) return false;
        if (!isPlayerMove(training.moveIndex, training.item.side)) return false;
        return true;
    }
    if (game.turn() === 'b') return false;
    if ((game.turn() === 'w' && piece.search(/^b/) !== -1) ||
        (game.turn() === 'b' && piece.search(/^w/) !== -1)) return false;
}

function onDrop(source, target) {
    if (training.active && isPlayerMove(training.moveIndex, training.item.side)) {
        const expected = training.item.ucis[training.moveIndex];
        if (source + target !== expected) {
            if (training.hintsOn) {
                const hi = hintIdx(training.moveIndex, training.item.side);
                showToast('✗ ' + training.item.hints[hi]);
            } else {
                showToast('✗ Неверный ход, попробуй снова!');
            }
            return 'snapback';
        }
    }
    const move = game.move({ from: source, to: target, promotion: 'q' });
    if (move === null) return 'snapback';
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

function onSnapEnd() { board.position(game.fen()); }

function makeEngineMove() {
    if (game.game_over()) return;
    if (game.turn() !== 'b') return;
    document.getElementById('status').innerText = 'Думает...';
    engineBusy = true;
    stockfish.postMessage('position fen ' + game.fen());
    stockfish.postMessage('go depth ' + parseInt(document.getElementById('difficulty').value, 10));
}

function updateStatus() {
    if (training.active && training.item) {
        const o = training.item;
        const cur = training.moveIndex;
        const isPlayer = isPlayerMove(cur, o.side);
        const s = 'Обучение: ' + o.name + ' | ' + (isPlayer ? 'Ваш ход' : 'Ход соперника...');
        document.getElementById('status').innerText = s;
        return;
    }
    let status = '';
    const mc = game.turn() === 'w' ? 'Ход белых' : 'Ход черных';
    if (game.in_checkmate()) status = 'Игра окончена, ' + (game.turn() === 'w' ? 'черные' : 'белые') + ' победили матом.';
    else if (game.in_draw()) status = 'Игра окончена, ничья.';
    else { status = mc; if (game.in_check()) status += ', Шах!'; }
    document.getElementById('status').innerText = status;
    document.getElementById('pgn').innerText = game.pgn();
}

function applyRotation(deg) {
    if (training.active) stopTraining();
    currentRotation = deg;
    const boardEl = document.getElementById('board');
    boardEl.style.transform = deg ? 'rotate(' + deg + 'deg)' : '';
    boardEl.style.transformOrigin = 'center center';
    rebuildBoard();
}

function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(function() { t.classList.remove('show'); }, 2500);
}

function populateTrainingSelect() {
    const sel = document.getElementById('trainingSelect');
    sel.innerHTML = '';
    const groups = {};
    trainingItems.forEach(function(item) {
        if (!groups[item.category]) groups[item.category] = [];
        groups[item.category].push(item);
    });
    Object.keys(groups).forEach(function(cat) {
        const optgroup = document.createElement('optgroup');
        optgroup.label = cat;
        groups[cat].forEach(function(item) {
            const opt = document.createElement('option');
            opt.value = item.id;
            opt.textContent = item.name;
            optgroup.appendChild(opt);
        });
        sel.appendChild(optgroup);
    });
}

let resizeTimer;
window.addEventListener('resize', function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function() {
        const newSize = getBoardSize();
        if (Math.abs(newSize - boardSize) > 5) {
            setBoardElementWidth();
            if (board && board.resize) board.resize();
            else rebuildBoard();
        }
    }, 250);
});

populateTrainingSelect();
createBoard('start', 'white');
updateStatus();

document.getElementById('resetBtn').addEventListener('click', function() {
    if (training.active) stopTraining();
    game.reset();
    rebuildBoard('start', 'white');
    updateStatus();
});

document.getElementById('flipBtn').addEventListener('click', function() {
    if (board) board.flip();
});

document.getElementById('copyBtn').addEventListener('click', function() {
    const pgn = game.pgn();
    if (!pgn) { showToast('Нет ходов для копирования'); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(pgn).then(function() { showToast('Ходы скопированы!'); }).catch(function() { fallbackCopy(pgn); });
    } else { fallbackCopy(pgn); }
});

function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); showToast('Ходы скопированы!'); } catch (e) { showToast('Не удалось скопировать'); }
    document.body.removeChild(ta);
}

document.getElementById('rotate90').addEventListener('click', function() { applyRotation(currentRotation === 90 ? 0 : 90); });
document.getElementById('rotate180').addEventListener('click', function() { applyRotation(currentRotation === 180 ? 0 : 180); });
document.getElementById('rotateReset').addEventListener('click', function() { applyRotation(0); });
document.getElementById('difficulty').addEventListener('change', function() { showToast('Уровень сложности изменён'); });

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
