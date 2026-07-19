const fs = require('fs');
const readline = require('readline');
const path = require('path');

const CSV_PATH = path.join(__dirname, 'lichess_db_puzzle.csv');
const OUTPUT_PATH = path.join(__dirname, 'puzzles.json');

const MAX_PUZZLES = 80000;

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += ch;
        }
    }
    result.push(current);
    return result;
}

async function preprocess() {
    const fileStream = fs.createReadStream(CSV_PATH);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    let count = 0;
    let isHeader = true;
    const puzzles = [];

    console.log('Reading CSV...');

    for await (const line of rl) {
        if (isHeader) { isHeader = false; continue; }
        if (count >= MAX_PUZZLES) break;

        const parts = parseCSVLine(line);
        if (parts.length < 8) continue;

        const puzzleId = parts[0];
        const fen = parts[1];
        const moves = parts[2];
        const rating = parseInt(parts[3]) || 1500;
        const themes = parts[7];

        const moveList = moves.split(' ');
        if (moveList.length < 3) continue;

        const fenTurn = fen.split(' ')[1];
        const side = fenTurn === 'w' ? 'b' : 'w';

        puzzles.push([puzzleId, fen, moves, rating, themes, side]);

        count++;
        if (count % 10000 === 0) {
            console.log(`Processed ${count} puzzles`);
        }
    }

    const json = JSON.stringify(puzzles);
    fs.writeFileSync(OUTPUT_PATH, json);
    console.log(`\nDone! Saved ${puzzles.length} puzzles to puzzles.json`);
    console.log(`File size: ${(json.length / 1024 / 1024).toFixed(2)} MB`);
}

preprocess().catch(console.error);
