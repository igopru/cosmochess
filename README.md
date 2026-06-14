# ♟ Шахматный тренажёр

**Бесплатно. Без рекламы. Свободный движок Stockfish.**

Полноценный шахматный тренажёр для браузера: игра против Stockfish, обучение дебютам,
тактические задачи. Работает на компьютере, планшете и телефоне — без установки, регистрации и интернета (после загрузки страницы).

## Возможности

| | |
|---|---|
| **Игра против Stockfish** | 3 уровня сложности (легкий / средний / сложный) |
| **Обучение дебютам** | 7 дебютов: Лондонская система, Итальянская партия, Ферзевый гамбит, Сицилианская защита, Каро-Канн, Французская защита, Староиндийская защита |
| **Тактические задачи** | 10 задач — мат в 1-2 хода, вилка, связка, жертва, сквозной удар |
| **Подсказки** | можно включить/отключить отображение правильного хода |
| **Верификация ходов** | неверный ход возвращается; в режиме подсказок показывается правильный |
| **Поворот доски** | 90°, 180° — удобно на телефоне в landscape |
| **Копирование PGN** | скопировать все ходы в буфер обмена |
| **Адаптивный интерфейс** | оптимизирован под телефоны и планшеты (Android / iOS) |

## Зачем это?

Этот проект — пример того, как **свободное программное обеспечение** может
составить конкуренцию коммерческим шахматным приложениям:

- **Нет рекламы** — приложение не следит за вами и не продаёт ваш экран
- **Нет регистрации** — никаких аккаунтов, email'ов и сбора данных
- **Свободный движок** — Stockfish распространяется по лицензии GPL v3
- **Работает офлайн** — загрузите страницу один раз и играйте без интернета
- **Открытый исходный код** — можно форкнуть, изменить, улучшить

## Установка и запуск

```bash
npm install
node server.js
```

Откройте `http://localhost:3000`

Для игры с телефона узнайте IP компьютера в сети:
```bash
ip addr show | grep inet
```
и откройте `http://ВАШ_IP:3000`

## Структура проекта

```
public/
  index.html       — интерфейс
  style.css        — стили (адаптивная вёрстка)
  app.js           — логика игры, обучения, задач
  stockfish.js     — движок Stockfish (скомпилирован в JavaScript, Web Worker)
  img/chesspieces/wikipedia/  — изображения шахматных фигур (Wikipedia, общественное достояние)
server.js          — Express-сервер
package.json       — зависимости
```

## Благодарности

- [Stockfish](https://stockfishchess.org) — свободный шахматный движок (GNU GPL v3).
  Скомпилирован в JavaScript [Niklas Fiekas](https://github.com/niklasf/stockfish.js).
- [chess.js](https://github.com/jhlywa/chess.js) — библиотека для работы с шахматными правилами (MIT).
- [chessboardjs](https://chessboardjs.com) — отрисовка шахматной доски (MIT).
- Изображения фигур — [Wikipedia / Wikimedia Commons](https://commons.wikimedia.org) (общественное достояние).

## Используйте свободные программы

Этот проект собран исключительно из свободных и открытых компонентов.
Поддерживайте разработку свободного ПО — используйте GNU/Linux, LibreOffice,
GIMP, VLC, Firefox и тысячи других проектов, которые уважают вашу свободу.

[Фонд свободного программного обеспечения](https://www.fsf.org) · [GNU Project](https://www.gnu.org)

## Лицензия

```
MIT License

Copyright (c) 2026

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

*Stockfish распространяется отдельно по лицензии GNU General Public License v3.*
