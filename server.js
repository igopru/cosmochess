const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Раздаем статические файлы из папки public
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
    console.log(`♟ Шахматный тренажёр запущен: http://localhost:${PORT}`);
});
