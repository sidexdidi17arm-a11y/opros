const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs-extra');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Обслуживаем статические файлы из папки public
app.use(express.static(path.join(__dirname, '../public')));

// Инициализация файла данных
async function initializeDataFile() {
    if (!await fs.pathExists(DATA_FILE)) {
        await fs.writeJson(DATA_FILE, []);
    }
}

// API Endpoints

// Получить все данные
app.get('/api/data', async (req, res) => {
    try {
        await initializeDataFile();
        const data = await fs.readJson(DATA_FILE);
        res.json(data);
    } catch (error) {
        console.error('Error reading data:', error);
        res.status(500).json({ error: 'Ошибка чтения данных' });
    }
});

// Сохранить новые данные
app.post('/api/data', async (req, res) => {
    try {
        await initializeDataFile();
        const newData = req.body;
        
        // Валидация данных
        if (!newData.date || !newData.data) {
            return res.status(400).json({ error: 'Неверный формат данных' });
        }
        
        // Добавляем timestamp
        newData.timestamp = new Date().getTime();
        
        // Читаем существующие данные
        const allData = await fs.readJson(DATA_FILE);
        
        // Проверяем, нет ли уже данных за эту дату
        const existingIndex = allData.findIndex(item => item.date === newData.date);
        
        if (existingIndex !== -1) {
            // Обновляем существующую запись
            allData[existingIndex] = newData;
        } else {
            // Добавляем новую запись
            allData.unshift(newData);
        }
        
        // Сортируем по дате (новые первыми)
        allData.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // Сохраняем
        await fs.writeJson(DATA_FILE, allData);
        
        res.json({ 
            success: true, 
            message: 'Данные успешно сохранены',
            totalRecords: allData.length 
        });
    } catch (error) {
        console.error('Error saving data:', error);
        res.status(500).json({ error: 'Ошибка сохранения данных' });
    }
});

// Удалить все данные
app.delete('/api/data', async (req, res) => {
    try {
        await fs.writeJson(DATA_FILE, []);
        res.json({ success: true, message: 'Все данные удалены' });
    } catch (error) {
        console.error('Error deleting data:', error);
        res.status(500).json({ error: 'Ошибка удаления данных' });
    }
});

// Экспорт в CSV
app.get('/api/export/csv', async (req, res) => {
    try {
        await initializeDataFile();
        const data = await fs.readJson(DATA_FILE);
        
        if (data.length === 0) {
            return res.status(404).json({ error: 'Нет данных для экспорта' });
        }
        
        // Генерируем CSV
        let csvContent = "Дата,ФЭС,Всего ПУ,ПУ в опросе,ПУ не в опросе,% опроса,СПОДЭС ПУ,СПОДЭС в опросе,СПОДЭС не в опросе,% СПОДЭС,Примечание\n";
        
        data.forEach(week => {
            const formattedDate = formatDate(new Date(week.date));
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
        
        res.header('Content-Type', 'text/csv');
        res.header('Content-Disposition', 'attachment; filename="опрос_фес_экспорт.csv"');
        res.send(csvContent);
    } catch (error) {
        console.error('Error exporting CSV:', error);
        res.status(500).json({ error: 'Ошибка экспорта CSV' });
    }
});

// Экспорт в JSON
app.get('/api/export/json', async (req, res) => {
    try {
        await initializeDataFile();
        const data = await fs.readJson(DATA_FILE);
        
        if (data.length === 0) {
            return res.status(404).json({ error: 'Нет данных для экспорта' });
        }
        
        const exportData = {
            version: '2.0.0',
            exportedAt: new Date().toISOString(),
            totalWeeks: data.length,
            data: data
        };
        
        res.header('Content-Type', 'application/json');
        res.header('Content-Disposition', 'attachment; filename="опрос_фес_экспорт.json"');
        res.json(exportData);
    } catch (error) {
        console.error('Error exporting JSON:', error);
        res.status(500).json({ error: 'Ошибка экспорта JSON' });
    }
});

// Проверка здоровья сервера
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        service: 'Survey Statistics API'
    });
});

// Статистика сервера
app.get('/api/stats', async (req, res) => {
    try {
        await initializeDataFile();
        const data = await fs.readJson(DATA_FILE);
        
        const stats = {
            totalWeeks: data.length,
            firstRecord: data.length > 0 ? data[data.length - 1].date : null,
            lastRecord: data.length > 0 ? data[0].date : null,
            totalRESRecords: data.reduce((sum, week) => sum + week.data.length, 0),
            lastUpdate: new Date().toISOString()
        };
        
        res.json(stats);
    } catch (error) {
        console.error('Error getting stats:', error);
        res.status(500).json({ error: 'Ошибка получения статистики' });
    }
});

// Вспомогательная функция
function formatDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
}

// Для всех остальных маршрутов - возвращаем index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Static files from: ${path.join(__dirname, '../public')}`);
    initializeDataFile().then(() => {
        console.log('Data file initialized');
    });
});