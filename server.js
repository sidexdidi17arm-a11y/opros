require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
const database = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public'));

// Подключение к базе данных
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Инициализация базы данных
async function initDatabase() {
    try {
        await database.init(pool);
        console.log('База данных инициализирована');
    } catch (error) {
        console.error('Ошибка инициализации базы данных:', error);
    }
}

// Middleware для проверки соединения с БД
app.use(async (req, res, next) => {
    try {
        await pool.query('SELECT 1');
        next();
    } catch (error) {
        console.error('Ошибка подключения к базе данных:', error);
        res.status(500).json({ error: 'Ошибка подключения к базе данных' });
    }
});

// API: Получение всех данных
app.get('/api/data', async (req, res) => {
    try {
        const result = await database.getAllData(pool);
        res.json(result);
    } catch (error) {
        console.error('Ошибка получения данных:', error);
        res.status(500).json({ error: 'Ошибка получения данных' });
    }
});

// API: Сохранение данных
app.post('/api/data', async (req, res) => {
    try {
        const weekData = req.body;
        
        // Валидация данных
        if (!weekData || !weekData.date || !weekData.data) {
            return res.status(400).json({ error: 'Неверный формат данных' });
        }
        
        const result = await database.saveData(pool, weekData);
        res.json(result);
    } catch (error) {
        console.error('Ошибка сохранения данных:', error);
        res.status(500).json({ error: 'Ошибка сохранения данных' });
    }
});

// API: Удаление всех данных
app.delete('/api/data', async (req, res) => {
    try {
        const result = await database.deleteAllData(pool);
        res.json(result);
    } catch (error) {
        console.error('Ошибка удаления данных:', error);
        res.status(500).json({ error: 'Ошибка удаления данных' });
    }
});

// API: Получение данных за конкретную дату
app.get('/api/data/:date', async (req, res) => {
    try {
        const date = req.params.date;
        const result = await database.getDataByDate(pool, date);
        
        if (result) {
            res.json(result);
        } else {
            res.status(404).json({ error: 'Данные за указанную дату не найдены' });
        }
    } catch (error) {
        console.error('Ошибка получения данных:', error);
        res.status(500).json({ error: 'Ошибка получения данных' });
    }
});

// API: Удаление данных за конкретную дату
app.delete('/api/data/:date', async (req, res) => {
    try {
        const date = req.params.date;
        const result = await database.deleteDataByDate(pool, date);
        res.json(result);
    } catch (error) {
        console.error('Ошибка удаления данных:', error);
        res.status(500).json({ error: 'Ошибка удаления данных' });
    }
});

// API: Получение статистики
app.get('/api/stats', async (req, res) => {
    try {
        const result = await database.getStats(pool);
        res.json(result);
    } catch (error) {
        console.error('Ошибка получения статистики:', error);
        res.status(500).json({ error: 'Ошибка получения статистики' });
    }
});

// API: Экспорт всех данных в JSON
app.get('/api/export/json', async (req, res) => {
    try {
        const data = await database.getAllData(pool);
        
        // Настройка заголовков для скачивания файла
        res.setHeader('Content-Disposition', 'attachment; filename="survey_data_export.json"');
        res.setHeader('Content-Type', 'application/json');
        
        res.json(data);
    } catch (error) {
        console.error('Ошибка экспорта данных:', error);
        res.status(500).json({ error: 'Ошибка экспорта данных' });
    }
});

// API: Экспорт всех данных в CSV
app.get('/api/export/csv', async (req, res) => {
    try {
        const data = await database.getAllData(pool);
        
        let csvContent = "Дата,ФЭС,Всего ПУ,ПУ в опросе,ПУ не в опросе,% опроса,СПОДЭС ПУ,СПОДЭС в опросе,СПОДЭС не в опросе,% СПОДЭС,Примечание\n";
        
        data.forEach(week => {
            const formattedDate = new Date(week.date).toLocaleDateString('ru-RU');
            week.data.forEach(item => {
                const note = item.isPsRes ? "не в общем %" : "";
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
                csvContent += row.join(",") + "\n";
            });
        });
        
        res.setHeader('Content-Disposition', 'attachment; filename="survey_data_export.csv"');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.send(csvContent);
    } catch (error) {
        console.error('Ошибка экспорта данных:', error);
        res.status(500).json({ error: 'Ошибка экспорта данных' });
    }
});

// API: Получение истории изменений
app.get('/api/history', async (req, res) => {
    try {
        const result = await database.getHistory(pool);
        res.json(result);
    } catch (error) {
        console.error('Ошибка получения истории:', error);
        res.status(500).json({ error: 'Ошибка получения истории' });
    }
});

// API: Проверка здоровья сервера
app.get('/api/health', async (req, res) => {
    try {
        const dbCheck = await pool.query('SELECT 1');
        res.json({
            status: 'healthy',
            database: 'connected',
            timestamp: new Date().toISOString(),
            version: '1.0.0'
        });
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            database: 'disconnected',
            error: error.message
        });
    }
});

// Обслуживание HTML файла
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Обработка 404
app.use((req, res) => {
    res.status(404).json({ error: 'Маршрут не найден' });
});

// Обработка ошибок
app.use((err, req, res, next) => {
    console.error('Ошибка сервера:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

// Запуск сервера
async function startServer() {
    await initDatabase();
    
    app.listen(PORT, () => {
        console.log(`🚀 Сервер запущен на порту ${PORT}`);
        console.log(`📊 База данных: ${process.env.DATABASE_URL ? 'Подключена' : 'Не подключена'}`);
        console.log(`🌐 Доступ к приложению: http://localhost:${PORT}`);
        console.log(`📁 Папка статических файлов: ${path.join(__dirname, 'public')}`);
    });
}

startServer().catch(console.error);

// Обработка graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM получен, завершение работы...');
    await pool.end();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('SIGINT получен, завершение работы...');
    await pool.end();
    process.exit(0);
});