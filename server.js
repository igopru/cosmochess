const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

let puzzlesCache = null;
let puzzlesMeta = null;

function loadPuzzles() {
    const p = path.join(__dirname, 'puzzles.json');
    if (!fs.existsSync(p)) return;
    const data = fs.readFileSync(p, 'utf8');
    puzzlesCache = JSON.parse(data);

    const themeSet = new Set();
    let minR = 9999, maxR = 0;
    for (const pz of puzzlesCache) {
        const themes = pz[4].split(' ');
        for (const t of themes) {
            if (t) themeSet.add(t);
        }
        if (pz[3] < minR) minR = pz[3];
        if (pz[3] > maxR) maxR = pz[3];
    }
    puzzlesMeta = {
        themes: Array.from(themeSet).sort(),
        ratingRange: { min: minR, max: maxR },
        total: puzzlesCache.length
    };
    console.log(`Загружено ${puzzlesCache.length} задач, тем: ${puzzlesMeta.themes.length}`);
}

app.get('/api/puzzles', (req, res) => {
    if (!puzzlesCache) {
        return res.json({ error: 'Puzzles not loaded' });
    }

    const theme = (req.query.theme || '').toLowerCase();
    const minRating = parseInt(req.query.minRating) || 0;
    const maxRating = parseInt(req.query.maxRating) || 9999;
    const limit = Math.min(parseInt(req.query.limit) || 100, 100);

    let pool = puzzlesCache;
    if (theme) {
        pool = pool.filter(p => p[4].toLowerCase().includes(theme));
    }
    pool = pool.filter(p => p[3] >= minRating && p[3] <= maxRating);

    // Fisher-Yates shuffle
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = pool[i];
        pool[i] = pool[j];
        pool[j] = tmp;
    }

    const result = pool.slice(0, limit).map(p => ({
        puzzleId: p[0],
        fen: p[1],
        moves: p[2],
        rating: p[3],
        themes: p[4],
        side: p[5]
    }));

    res.json(result);
});

app.get('/api/puzzle-meta', (req, res) => {
    if (!puzzlesMeta) return res.json({ error: 'Not loaded' });
    res.json(puzzlesMeta);
});

let openingsCache = null;

function loadOpenings() {
    const p = path.join(__dirname, 'openings.json');
    if (!fs.existsSync(p)) return;
    const data = fs.readFileSync(p, 'utf8');
    openingsCache = JSON.parse(data);
    console.log(`Загружено ${openingsCache.length} дебютных вариаций из ${new Set(openingsCache.map(o => o.openingName)).size} дебютов`);
}

app.get('/api/openings', (req, res) => {
    if (!openingsCache) return res.json({ error: 'Not loaded' });
    const group = req.query.group || '';
    if (group) {
        res.json(openingsCache.filter(o => o.group === group));
    } else {
        res.json(openingsCache);
    }
});

app.get('/api/openings/groups', (req, res) => {
    if (!openingsCache) return res.json({ error: 'Not loaded' });
    const seen = {};
    const groups = [];
    for (const o of openingsCache) {
        if (!seen[o.group]) {
            seen[o.group] = true;
            groups.push({ group: o.group, name: o.openingName, count: openingsCache.filter(x => x.group === o.group).length });
        }
    }
    res.json(groups);
});

loadPuzzles();
loadOpenings();

app.listen(PORT, () => {
    console.log(`♟ Шахматный тренажёр запущен: http://localhost:${PORT}`);
});
