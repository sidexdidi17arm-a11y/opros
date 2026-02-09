-- Создание таблицы для хранения еженедельных данных
CREATE TABLE IF NOT EXISTS weekly_data (
    id SERIAL PRIMARY KEY,
    date DATE UNIQUE NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Создание индекса для быстрого поиска по дате
CREATE INDEX IF NOT EXISTS idx_weekly_data_date ON weekly_data(date);

-- Создание индекса для поиска в JSON данных
CREATE INDEX IF NOT EXISTS idx_weekly_data_json ON weekly_data USING gin(data);