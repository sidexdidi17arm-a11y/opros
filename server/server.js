const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Настройка подключения к PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://opros_user:6Z0ZwUojKtaVL41cxF7mW7YmXgsH9aU2@dpg-d64sigi4d50c73eno980-a/opros',
    ssl: {
        rejectUnauthorized: false
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('../public'));

// Инициализация базы данных
async function initializeDatabase() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS weekly_data (
                id SERIAL PRIMARY KEY,
                date DATE UNIQUE NOT NULL,
                data JSONB NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('База данных инициализирована');
    } catch (error) {
        console.error('Ошибка инициализации базы данных:', error);
    }
}

// API маршруты
app.get('/api/data', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT date, data, EXTRACT(epoch FROM date) * 1000 as timestamp FROM weekly_data ORDER BY date DESC'
        );
        
        const weeklyData = result.rows.map(row => ({
            date: row.date.toISOString().split('T')[0],
            timestamp: parseInt(row.timestamp),
            data: row.data
        }));
        
        res.json(weeklyData);
    } catch (error) {
        console.error('Ошибка получения данных:', error);
        res.status(500).json({ error: 'Ошибка получения данных' });
    }
});

app.post('/api/data', async (req, res) => {
    try {
        const { date, data } = req.body;
        
        // Проверяем, существует ли уже запись за эту дату
        const existing = await pool.query(
            'SELECT id FROM weekly_data WHERE date = $1',
            [date]
        );
        
        if (existing.rows.length > 0) {
            // Обновляем существующую запись
            await pool.query(
                'UPDATE weekly_data SET data = $1 WHERE date = $2',
                [data, date]
            );
        } else {
            // Создаем новую запись
            await pool.query(
                'INSERT INTO weekly_data (date, data) VALUES ($1, $2)',
                [date, data]
            );
        }
        
        res.status(200).json({ message: 'Данные сохранены' });
    } catch (error) {
        console.error('Ошибка сохранения данных:', error);
        res.status(500).json({ error: 'Ошибка сохранения данных' });
    }
});

app.delete('/api/data', async (req, res) => {
    try {
        await pool.query('DELETE FROM weekly_data');
        res.status(200).json({ message: 'Все данные удалены' });
    } catch (error) {
        console.error('Ошибка удаления данных:', error);
        res.status(500).json({ error: 'Ошибка удаления данных' });
    }
});

app.delete('/api/data/:date', async (req, res) => {
    try {
        const { date } = req.params;
        await pool.query('DELETE FROM weekly_data WHERE date = $1', [date]);
        res.status(200).json({ message: 'Данные за указанную дату удалены' });
    } catch (error) {
        console.error('Ошибка удаления данных:', error);
        res.status(500).json({ error: 'Ошибка удаления данных' });
    }
});

// Маршрут для главной страницы
app.get('*', (req, res) => {
    res.sendFile('index.html', { root: '../public' });
});

// Запуск сервера
initializeDatabase().then(() => {
    app.listen(port, () => {
        console.log(`Сервер запущен на порту ${port}`);
    });
});