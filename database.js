// Файл для работы с PostgreSQL базой данных

class DatabaseService {
    // Инициализация базы данных
    async init(pool) {
        try {
            // Создание таблицы weekly_data
            await pool.query(`
                CREATE TABLE IF NOT EXISTS weekly_data (
                    id SERIAL PRIMARY KEY,
                    date DATE NOT NULL UNIQUE,
                    timestamp BIGINT NOT NULL,
                    data JSONB NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Создание индексов для ускорения поиска
            await pool.query('CREATE INDEX IF NOT EXISTS idx_weekly_data_date ON weekly_data(date)');
            await pool.query('CREATE INDEX IF NOT EXISTS idx_weekly_data_timestamp ON weekly_data(timestamp DESC)');

            console.log('Таблицы базы данных инициализированы');
        } catch (error) {
            console.error('Ошибка инициализации базы данных:', error);
            throw error;
        }
    }

    // Получение всех данных
    async getAllData(pool) {
        try {
            const result = await pool.query(
                'SELECT date, timestamp, data FROM weekly_data ORDER BY timestamp DESC'
            );
            
            return result.rows.map(row => ({
                date: row.date.toISOString().split('T')[0],
                timestamp: parseInt(row.timestamp),
                data: row.data
            }));
        } catch (error) {
            console.error('Ошибка получения всех данных:', error);
            throw error;
        }
    }

    // Сохранение данных
    async saveData(pool, weekData) {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // Проверяем, есть ли данные за эту дату
            const existing = await client.query(
                'SELECT id FROM weekly_data WHERE date = $1',
                [weekData.date]
            );
            
            if (existing.rows.length > 0) {
                // Обновляем существующие данные
                await client.query(
                    `UPDATE weekly_data 
                     SET timestamp = $1, data = $2, updated_at = CURRENT_TIMESTAMP 
                     WHERE date = $3`,
                    [weekData.timestamp, JSON.stringify(weekData.data), weekData.date]
                );
            } else {
                // Вставляем новые данные
                await client.query(
                    `INSERT INTO weekly_data (date, timestamp, data) 
                     VALUES ($1, $2, $3)`,
                    [weekData.date, weekData.timestamp, JSON.stringify(weekData.data)]
                );
            }
            
            await client.query('COMMIT');
            
            return {
                success: true,
                message: 'Данные успешно сохранены в базу данных',
                date: weekData.date,
                action: existing.rows.length > 0 ? 'updated' : 'created'
            };
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Ошибка сохранения данных:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    // Удаление всех данных
    async deleteAllData(pool) {
        try {
            await pool.query('DELETE FROM weekly_data');
            
            // Сбрасываем sequence
            await pool.query('ALTER SEQUENCE weekly_data_id_seq RESTART WITH 1');
            
            return {
                success: true,
                message: 'Все данные удалены из базы данных',
                count: 0
            };
        } catch (error) {
            console.error('Ошибка удаления всех данных:', error);
            throw error;
        }
    }

    // Получение данных по дате
    async getDataByDate(pool, date) {
        try {
            const result = await pool.query(
                'SELECT date, timestamp, data FROM weekly_data WHERE date = $1',
                [date]
            );
            
            if (result.rows.length === 0) {
                return null;
            }
            
            const row = result.rows[0];
            return {
                date: row.date.toISOString().split('T')[0],
                timestamp: parseInt(row.timestamp),
                data: row.data
            };
        } catch (error) {
            console.error('Ошибка получения данных по дате:', error);
            throw error;
        }
    }

    // Удаление данных по дате
    async deleteDataByDate(pool, date) {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // Получаем количество записей до удаления
            const countBefore = await client.query('SELECT COUNT(*) FROM weekly_data');
            
            // Удаляем данные
            await client.query('DELETE FROM weekly_data WHERE date = $1', [date]);
            
            // Получаем количество записей после удаления
            const countAfter = await client.query('SELECT COUNT(*) FROM weekly_data');
            
            await client.query('COMMIT');
            
            return {
                success: true,
                message: `Данные за ${date} удалены из базы данных`,
                deleted: parseInt(countBefore.rows[0].count) - parseInt(countAfter.rows[0].count),
                remaining: parseInt(countAfter.rows[0].count)
            };
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Ошибка удаления данных по дате:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    // Получение статистики
    async getStats(pool) {
        try {
            const result = await pool.query(
                'SELECT COUNT(*) as total_weeks, MAX(date) as latest_date FROM weekly_data'
            );
            
            const stats = {
                totalWeeks: parseInt(result.rows[0].total_weeks) || 0,
                latestDate: result.rows[0].latest_date ? 
                    result.rows[0].latest_date.toISOString().split('T')[0] : null
            };
            
            // Получаем последние 4 недели данных
            if (stats.totalWeeks > 0) {
                const recentData = await pool.query(
                    'SELECT date, timestamp, data FROM weekly_data ORDER BY timestamp DESC LIMIT 4'
                );
                
                stats.recentData = recentData.rows.map(row => ({
                    date: row.date.toISOString().split('T')[0],
                    timestamp: parseInt(row.timestamp),
                    data: row.data
                }));
            } else {
                stats.recentData = [];
            }
            
            return stats;
        } catch (error) {
            console.error('Ошибка получения статистики:', error);
            throw error;
        }
    }

    // Получение истории изменений
    async getHistory(pool) {
        try {
            const result = await pool.query(
                `SELECT 
                    date, 
                    timestamp, 
                    data,
                    created_at,
                    updated_at,
                    EXTRACT(EPOCH FROM (updated_at - created_at)) as edit_time_seconds
                 FROM weekly_data 
                 ORDER BY timestamp DESC`
            );
            
            return result.rows.map(row => ({
                date: row.date.toISOString().split('T')[0],
                timestamp: parseInt(row.timestamp),
                data: row.data,
                created_at: row.created_at,
                updated_at: row.updated_at,
                edit_time_seconds: row.edit_time_seconds,
                was_edited: row.updated_at > row.created_at
            }));
        } catch (error) {
            console.error('Ошибка получения истории:', error);
            throw error;
        }
    }

    // Получение данных за период
    async getDataByPeriod(pool, startDate, endDate) {
        try {
            const result = await pool.query(
                `SELECT date, timestamp, data 
                 FROM weekly_data 
                 WHERE date >= $1 AND date <= $2 
                 ORDER BY date ASC`,
                [startDate, endDate]
            );
            
            return result.rows.map(row => ({
                date: row.date.toISOString().split('T')[0],
                timestamp: parseInt(row.timestamp),
                data: row.data
            }));
        } catch (error) {
            console.error('Ошибка получения данных за период:', error);
            throw error;
        }
    }

    // Получение сводки по ФЭС
    async getRESSummary(pool, resId) {
        try {
            const result = await pool.query(
                `SELECT 
                    date,
                    (data->jsonb_array_elements(data->'data')->>'percent')::float as percent,
                    (data->jsonb_array_elements(data->'data')->>'percentSpo')::float as percent_spo
                 FROM weekly_data 
                 WHERE data->'data' @? '$[*] ? (@.id == $resId)'
                 ORDER BY date DESC`,
                [resId]
            );
            
            return result.rows.map(row => ({
                date: row.date.toISOString().split('T')[0],
                percent: row.percent * 100,
                percent_spo: row.percent_spo * 100
            }));
        } catch (error) {
            console.error('Ошибка получения сводки по ФЭС:', error);
            throw error;
        }
    }
}

module.exports = new DatabaseService();