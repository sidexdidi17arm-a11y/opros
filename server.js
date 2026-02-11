// server.js
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'public', 'data.json');

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Убедимся, что папка public существует
async function ensurePublicFolder() {
    const publicDir = path.join(__dirname, 'public');
    try {
        await fs.access(publicDir);
    } catch (error) {
        await fs.mkdir(publicDir, { recursive: true });
        console.log('📁 Папка public создана');
    }
}

// Инициализация файла данных
async function initializeDataFile() {
    try {
        await fs.access(DATA_FILE);
        console.log('📄 Файл data.json найден');
    } catch (error) {
        // Создаем пустой массив данных
        await fs.writeFile(DATA_FILE, JSON.stringify([], null, 2));
        console.log('📄 Создан новый файл data.json');
    }
}

// Маршруты API

// Получение всех данных
app.get('/api/data', async (req, res) => {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        const jsonData = JSON.parse(data);
        res.json(jsonData);
    } catch (error) {
        console.error('Ошибка чтения данных:', error);
        res.status(500).json({ error: 'Ошибка чтения данных' });
    }
});

// Сохранение данных
app.post('/api/data', async (req, res) => {
    try {
        const newData = req.body;
        
        // Проверяем наличие обязательных полей
        if (!newData.date || !newData.timestamp || !newData.data) {
            return res.status(400).json({ error: 'Неверный формат данных' });
        }

        // Читаем текущие данные
        let currentData = [];
        try {
            const fileContent = await fs.readFile(DATA_FILE, 'utf8');
            currentData = JSON.parse(fileContent);
        } catch (error) {
            // Если файл пустой или поврежден, начинаем с пустого массива
            currentData = [];
        }

        // Проверяем, есть ли уже данные за эту дату
        const existingIndex = currentData.findIndex(item => item.date === newData.date);
        
        if (existingIndex !== -1) {
            // Обновляем существующую запись
            currentData[existingIndex] = newData;
            console.log(`📝 Обновлены данные за ${newData.date}`);
        } else {
            // Добавляем новую запись
            currentData.push(newData);
            console.log(`➕ Добавлены данные за ${newData.date}`);
        }

        // Сортируем по дате (сначала новые)
        currentData.sort((a, b) => b.timestamp - a.timestamp);

        // Сохраняем в файл
        await fs.writeFile(DATA_FILE, JSON.stringify(currentData, null, 2));
        
        res.status(200).json({ 
            success: true, 
            message: 'Данные успешно сохранены',
            data: newData
        });
    } catch (error) {
        console.error('Ошибка сохранения данных:', error);
        res.status(500).json({ error: 'Ошибка сохранения данных' });
    }
});

// Удаление всех данных
app.delete('/api/data', async (req, res) => {
    try {
        await fs.writeFile(DATA_FILE, JSON.stringify([], null, 2));
        console.log('🗑️ Все данные удалены');
        res.status(200).json({ success: true, message: 'Все данные удалены' });
    } catch (error) {
        console.error('Ошибка удаления данных:', error);
        res.status(500).json({ error: 'Ошибка удаления данных' });
    }
});

// Восстановление данных из резервной копии
app.post('/api/data/restore', async (req, res) => {
    try {
        const restoreData = req.body;
        
        if (!Array.isArray(restoreData)) {
            return res.status(400).json({ error: 'Неверный формат данных для восстановления' });
        }

        // Валидация данных
        const isValid = restoreData.every(item => 
            item.date && 
            item.timestamp && 
            Array.isArray(item.data) &&
            item.data.length > 0
        );

        if (!isValid) {
            return res.status(400).json({ error: 'Данные повреждены или имеют неверный формат' });
        }

        // Сортируем по дате
        restoreData.sort((a, b) => b.timestamp - a.timestamp);

        // Сохраняем в файл
        await fs.writeFile(DATA_FILE, JSON.stringify(restoreData, null, 2));
        
        console.log(`🔄 Восстановлено ${restoreData.length} записей из резервной копии`);
        res.status(200).json({ 
            success: true, 
            message: `Восстановлено ${restoreData.length} записей`,
            count: restoreData.length
        });
    } catch (error) {
        console.error('Ошибка восстановления данных:', error);
        res.status(500).json({ error: 'Ошибка восстановления данных' });
    }
});

// Проверка здоровья сервера
app.get('/api/health', (req, res) => {
    res.status(200).json({ 
        status: 'ok', 
        message: 'Сервер работает',
        timestamp: new Date().toISOString()
    });
});

// Экспорт в JSON
app.get('/api/export/json', async (req, res) => {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        const jsonData = JSON.parse(data);
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=survey_data_export_${new Date().toISOString().split('T')[0]}.json`);
        res.send(JSON.stringify(jsonData, null, 2));
    } catch (error) {
        console.error('Ошибка экспорта JSON:', error);
        res.status(500).json({ error: 'Ошибка экспорта данных' });
    }
});

// Экспорт в CSV
app.get('/api/export/csv', async (req, res) => {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        const jsonData = JSON.parse(data);
        
        let csvContent = 'Дата,ФЭС,Всего ПУ,В опросе,Не в опросе,% опроса,СПОДЭС ПУ,СПОДЭС в опросе,СПОДЭС не в опросе,% СПОДЭС,Примечание\n';
        
        jsonData.forEach(week => {
            const formattedDate = new Date(week.date).toLocaleDateString('ru-RU');
            week.data.forEach(item => {
                const note = item.isPsRes ? 'не в общем %' : '';
                const row = [
                    formattedDate,
                    `"${item.name}"`,
                    item.total,
                    item.survey,
                    item.notInSurvey,
                    (item.percent * 100).toFixed(2),
                    item.totalSpo,
                    item.surveySpo,
                    item.spoNotInSurvey,
                    (item.percentSpo * 100).toFixed(2),
                    note
                ];
                csvContent += row.join(',') + '\n';
            });
        });
        
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=survey_data_${new Date().toISOString().split('T')[0]}.csv`);
        res.send('\uFEFF' + csvContent); // Добавляем BOM для UTF-8
    } catch (error) {
        console.error('Ошибка экспорта CSV:', error);
        res.status(500).json({ error: 'Ошибка экспорта данных' });
    }
});

// Статистика
app.get('/api/stats', async (req, res) => {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        const jsonData = JSON.parse(data);
        
        const stats = {
            totalRecords: jsonData.length,
            firstRecord: jsonData.length > 0 ? jsonData[jsonData.length - 1].date : null,
            lastRecord: jsonData.length > 0 ? jsonData[0].date : null,
            totalWeeks: jsonData.length,
            databaseSize: (await fs.stat(DATA_FILE)).size
        };
        
        res.json(stats);
    } catch (error) {
        console.error('Ошибка получения статистики:', error);
        res.status(500).json({ error: 'Ошибка получения статистики' });
    }
});

// Запуск сервера
async function startServer() {
    await ensurePublicFolder();
    await initializeDataFile();
    
    app.listen(PORT, () => {
        console.log(`\n🚀 Сервер запущен на порту ${PORT}`);
        console.log(`📁 Файл данных: ${DATA_FILE}`);
        console.log(`🌐 Локальный доступ: http://localhost:${PORT}`);
        console.log(`🔗 API Endpoints:`);
        console.log(`   GET  /api/data - получить все данные`);
        console.log(`   POST /api/data - сохранить данные`);
        console.log(`   DELETE /api/data - удалить все данные`);
        console.log(`   POST /api/data/restore - восстановить данные`);
        console.log(`   GET  /api/health - проверка сервера`);
        console.log(`   GET  /api/export/json - экспорт JSON`);
        console.log(`   GET  /api/export/csv - экспорт CSV`);
        console.log(`   GET  /api/stats - статистика`);
        console.log('\n📊 Приложение готово к работе!\n');
    });
}

startServer().catch(console.error);