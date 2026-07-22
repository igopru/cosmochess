const fs = require('fs');
const path = require('path');
const https = require('https');

const SOURCE = 'https://chessboss.ru';
const OUTPUT = path.join(__dirname, 'openings.json');

function fetch(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => resolve(d));
        }).on('error', reject);
    });
}

function extractData(html) {
    const scripts = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g);
    if (!scripts) return null;

    for (const script of scripts) {
        if (!script.includes('const data = [[')) continue;

        const start = script.indexOf('const data = [[');
        let depth = 0, inStr = false, end = start + 14;
        for (let i = start + 14; i < script.length; i++) {
            const ch = script[i];
            if (inStr) { if (ch === "'" && script[i-1] !== '\\') inStr = false; continue; }
            if (ch === "'") { inStr = true; continue; }
            if (ch === '[') depth++;
            if (ch === ']') { if (depth === 0) { end = i + 1; break; } depth--; }
        }

        const expr = script.substring(start + 12, end);
        try { return new Function('return (' + expr + ')')(); }
        catch (e) { console.error('Parse error:', e.message.substring(0, 100)); return null; }
    }
    return null;
}

function extractMeta(html) {
    const m = html.match(/const openingName\s*=\s*'([^']+)'/);
    const name = m ? m[1] : '';
    const p = html.match(/const playing\s*=\s*'([^']+)'/);
    const playing = p ? p[1] : 'white';
    return { name, playing };
}

function convertToTraining(data, slug, meta) {
    const items = [];
    for (let i = 1; i < data.length; i++) {
        const moves = data[i];
        const metaInfo = data[0][i - 1] || {};

        const startText = metaInfo.s === '%' ? (data[0][0] ? data[0][0].s : '') : (metaInfo.s || '');
        const finishText = metaInfo.f || '';

        const ucis = [];
        const annotations = [];
        const evaluations = [];
        const arrows = [];
        const moveAnnotations = [];

        for (let j = 0; j < moves.length; j++) {
            const mv = moves[j];

            const uci = mv.u1 + mv.u2;
            ucis.push(uci);

            let annot = mv.t || '';
            if (annot === '%' && data[1] && data[1][j]) annot = data[1][j].t || '';
            else if (annot.match(/^%\d+$/)) {
                const refIdx = parseInt(annot.substring(1));
                if (data[refIdx] && data[refIdx][j]) annot = data[refIdx][j].t || '';
            }
            annotations.push(annot);

            const eu = parseFloat(mv.eu);
            evaluations.push(isNaN(eu) ? 0 : eu);

            moveAnnotations.push({
                from: mv.u1,
                to: mv.u2,
                annotation: annot,
                eval: eu
            });

            if (mv.c1 && mv.c2 && mv.c2 !== '#') {
                const uci2 = mv.c1 + mv.c2;
                ucis.push(uci2);

                const ec = parseFloat(mv.ec);
                evaluations.push(isNaN(ec) ? 0 : ec);

                let annot2 = '';
                annotations.push(annot2);
                moveAnnotations.push({
                    from: mv.c1,
                    to: mv.c2,
                    annotation: annot2,
                    eval: ec,
                    isComputer: true
                });
            }

            if (mv.da && mv.da !== '%') {
                arrows.push(mv.da);
            }
        }

        const name = startText.replace(/<[^>]+>/g, '').substring(0, 60) || ('Вариант ' + i);

        items.push({
            id: slug + '-' + String(i).padStart(2, '0'),
            group: slug,
            name: name,
            desc: startText.replace(/<[^>]+>/g, '').substring(0, 120),
            fen: '',
            side: meta.playing === 'black' ? 'b' : 'w',
            ucis: ucis,
            hints: annotations.filter(a => a),
            annotations: annotations,
            evaluations: evaluations,
            arrows: arrows,
            moveAnnotations: moveAnnotations,
            startText: startText,
            finishText: finishText,
            openingName: meta.name
        });
    }
    return items;
}

const OPENING_SLUGS = [
    'bishops-opening', 'ponziani', 'fried-liver-attack', 'scotch-game',
    'vienna-gambit', 'vienna-game', 'london', 'jobava-london',
    'danish-gambit', 'italian-game', 'spanish-game', 'kings-gambit',
    'queens-gambit-accepted', 'queens-gambit-declined', 'greek-gift-sacrifice',
    'alapin-sicilian', 'english', 'scholars-mate'
];

async function scrapeAll() {
    const allItems = [];

    for (const slug of OPENING_SLUGS) {
        console.log('Fetching', slug + '...');
        try {
            const html = await fetch(SOURCE + '/openings/' + slug);
            const data = extractData(html);
            if (!data) { console.log('  No data found'); continue; }

            const meta = extractMeta(html);
            console.log('  Opening:', meta.name, '| Variations:', data.length - 1);

            const items = convertToTraining(data, slug, meta);
            allItems.push(...items);
            console.log('  Converted:', items.length, 'items');
        } catch (e) {
            console.log('  Error:', e.message);
        }
    }

    fs.writeFileSync(OUTPUT, JSON.stringify(allItems, null, 2));
    console.log('\nDone! Total items:', allItems.length);
    console.log('Saved to:', OUTPUT);
}

scrapeAll().catch(console.error);
