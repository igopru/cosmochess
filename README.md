# ♟ Cosmochess — шахматный тренажёр

**Бесплатно. Без рекламы. Полностью в браузере. Stockfish.**

Игра против Stockfish, обучение дебютам (366 вариаций из 18 дебютов),
тактические задачи (80 000 из базы Lichess). Работает на компьютере,
планшете и телефоне — без установки, регистрации и интернета
(после загрузки страницы).

## Возможности

| | |
|---|---|
| **Игра против Stockfish** | 5 уровней сложности, движок в браузере |
| **Обучение дебютам** | 18 дебютов, 366 вариаций с аннотациями и оценками от chessboss.ru |
| **Тактические задачи** | 80 000 задач из Lichess с фильтром по рейтингу и теме |
| **Drag-and-Drop** | перетаскивание фигур или режим щелчков (кнопка Click/Drag) |
| **Подсказки на доске** | золотая стрелка показывает следующий ход в обучении |
| **Аннотации и оценка** | пошаговые пояснения и оценка позиции при обучении |
| **Eval Bar** | оценка позиции в реальном времени от Stockfish |
| **Разбор партий** | пошаговый просмотр с оценкой каждого хода |
| **Импорт PGN** | загрузи любую партию для анализа |
| **Индикация легальных ходов** | точки на доступные ходы выбранной фигуры |
| **Адаптивный интерфейс** | оптимизирован для телефонов, планшетов и десктопа |
| **100% приватность** | ни один ход не покидает браузер, нет трекеров и аккаунтов |

## Установка и запуск

```bash
git clone <репозиторий>
cd cosmochess
npm install
node server.js
```

Откройте `http://localhost:3000`.

Для игры с телефона узнайте IP компьютера в сети:
```bash
ip addr show | grep inet
```
и откройте `http://ВАШ_IP:3000` в браузере телефона.

## Тактические задачи (Lichess)

По умолчанию в репозитории уже есть `puzzles.json` с 80 000 задач.
Файл можно скачать или обновить:

1. Скачайте CSV с задачами с [Lichess Open Database](https://database.lichess.org/#puzzles):
   ```bash
   wget https://database.lichess.org/lichess_db_puzzle.csv.zst
   zstd -d lichess_db_puzzle.csv.zst
   ```
2. Запустите конвертацию:
   ```bash
   node preprocess-puzzles.js
   ```
   Это создаст `puzzles.json` (первые 80 000 задач из CSV, ~11 MB).

## Дебюты (обучение)

Данные получены парсингом бесплатных уроков с [chessboss.ru](https://chessboss.ru/) —
скрипт `scrape-openings.js` извлекает 366 вариаций из 18 дебютов.

Каждая вариация содержит:
- **uci** — последовательность ходов в формате UCI
- **annotations** — аннотации для каждого хода (с HTML-разметкой)
- **evaluations** — числовая оценка позиции после каждого хода
- **hints** — текстовые подсказки для игрока
- **desc** — краткое описание вариации

Для обновления данных:
```bash
node scrape-openings.js
```

## Структура проекта

```
cosmochess/
├── server.js                    — Express-сервер (API задач и дебютов)
├── package.json                 — зависимости (express)
├── preprocess-puzzles.js        — конвертация CSV Lichess → puzzles.json
├── scrape-openings.js           — парсинг дебютов с chessboss.ru
├── puzzles.json                 — 80 000 задач (сгенерированный, в .gitignore)
├── openings.json                — 366 дебютных вариаций
├── public/
│   ├── index.html               — интерфейс
│   ├── style.css                — стили (адаптивная вёрстка)
│   ├── app.js                   — логика игры, обучения, задач
│   ├── stockfish.js             — движок Stockfish (Web Worker)
│   ├── vendor/                  — локальные CDN-зависимости
│   │   ├── jquery-3.5.1.min.js
│   │   ├── chess-0.10.3.min.js
│   │   ├── chessboard-1.0.0.min.js
│   │   └── chessboard-1.0.0.min.css
│   └── img/
│       ├── chesspieces/wikipedia/  — фигуры Wikipedia (public domain)
│       └── icon-*.png              — иконки PWA
└── .gitignore
```

## API эндпоинты

| GET | Описание |
|---|---|
| `/api/openings` | Все дебютные вариации |
| `/api/openings?group=london` | Фильтр по группе |
| `/api/openings/groups` | Список групп с количеством |
| `/api/puzzles?limit=1&minRating=1600&maxRating=2000` | Случайная задача |
| `/api/puzzles?theme=pin` | Фильтр по теме |
| `/api/puzzle-meta` | Метаданные (список тем, диапазон рейтинга) |

## Используемые библиотеки

- [Stockfish](https://stockfishchess.org) — шахматный движок (GPL v3)
- [chess.js](https://github.com/jhlywa/chess.js) — правила шахмат (MIT)
- [chessboardjs](https://chessboardjs.com) — отрисовка доски (MIT)
- [jQuery](https://jquery.com) — DOM-манипуляции (MIT)
- Фигуры — [Wikipedia / Wikimedia Commons](https://commons.wikimedia.org) (public domain)
- Задачи — [Lichess Open Database](https://database.lichess.org/) (CC0)
- Дебюты — [chessboss.ru](https://chessboss.ru/)

## Лицензия

MIT. См. файл [LICENSE](LICENSE).
Stockfish распространяется по GNU General Public License v3.
