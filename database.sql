
CREATE DATABASE IF NOT EXISTS expense_tracker;
USE expense_tracker;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL,
    icon VARCHAR(50) DEFAULT '📌',
    color VARCHAR(20) DEFAULT '#6B7280',
    type ENUM('income', 'expense') DEFAULT 'expense',
    user_id INT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id)
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    category_id INT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    type ENUM('income', 'expense') NOT NULL,
    note TEXT,
    date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id),
    INDEX idx_user_date (user_id, date),
    INDEX idx_user_type (user_id, type)
);

-- Budgets table
CREATE TABLE IF NOT EXISTS budgets (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    category_id INT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    month INT NOT NULL,
    year INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id),
    UNIQUE KEY unique_budget (user_id, category_id, month, year),
    INDEX idx_user_month (user_id, month, year)
);

-- Insert default categories (user_id = NULL for global categories)
INSERT INTO categories (name, icon, color, type, user_id) VALUES
('Food & Dining', '🍔', '#FF6B6B', 'expense', NULL),
('Transportation', '🚗', '#4ECDC4', 'expense', NULL),
('Shopping', '🛍️', '#45B7D1', 'expense', NULL),
('Entertainment', '🎬', '#96CEB4', 'expense', NULL),
('Bills & Utilities', '💡', '#FFEAA7', 'expense', NULL),
('Healthcare', '🏥', '#DDA0DD', 'expense', NULL),
('Education', '📚', '#98D8C8', 'expense', NULL),
('Salary', '💰', '#10B981', 'income', NULL),
('Freelance', '💻', '#8B5CF6', 'income', NULL),
('Investment', '📈', '#F59E0B', 'income', NULL);

-- Insert demo user (password: admin123 hashed with werkzeug)
INSERT INTO users (name, email, password) VALUES
('Admin User', 'admin@example.com', 'scrypt:32768:8:1$1Wx9sYk5ZqVtLmNp$8e2f1a3b5c7d9e0f1a2b3c4d5e6f7a8b9c0d1e2f');

-- Sample transactions for demo user (assuming user_id = 1)
INSERT INTO transactions (user_id, category_id, amount, type, note, date) VALUES
(1, 8, 5000.00, 'income', 'Monthly salary', CURDATE() - INTERVAL 30 DAY),
(1, 1, 200.00, 'expense', 'Groceries', CURDATE() - INTERVAL 28 DAY),
(1, 2, 50.00, 'expense', 'Gas', CURDATE() - INTERVAL 25 DAY),
(1, 3, 150.00, 'expense', 'New clothes', CURDATE() - INTERVAL 22 DAY),
(1, 4, 30.00, 'expense', 'Netflix subscription', CURDATE() - INTERVAL 20 DAY),
(1, 5, 100.00, 'expense', 'Electricity bill', CURDATE() - INTERVAL 18 DAY),
(1, 9, 1000.00, 'income', 'Freelance project', CURDATE() - INTERVAL 15 DAY),
(1, 1, 80.00, 'expense', 'Restaurant dinner', CURDATE() - INTERVAL 12 DAY),
(1, 2, 40.00, 'expense', 'Uber ride', CURDATE() - INTERVAL 10 DAY),
(1, 3, 200.00, 'expense', 'Electronics', CURDATE() - INTERVAL 8 DAY);

-- Create indexes for better performance
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_amount ON transactions(amount);
CREATE INDEX idx_budgets_month_year ON budgets(month, year);

-- View for monthly summary
CREATE VIEW monthly_summary AS
SELECT 
    user_id,
    YEAR(date) as year,
    MONTH(date) as month,
    SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as total_income,
    SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as total_expense
FROM transactions
GROUP BY user_id, YEAR(date), MONTH(date);

-- Stored procedure to check budget alerts
DELIMITER //
CREATE PROCEDURE CheckBudgetAlerts(IN p_user_id INT, IN p_month INT, IN p_year INT)
BEGIN
    SELECT 
        c.name as category_name,
        b.amount as budget_amount,
        COALESCE(SUM(t.amount), 0) as spent_amount,
        (COALESCE(SUM(t.amount), 0) / b.amount * 100) as percentage
    FROM budgets b
    JOIN categories c ON b.category_id = c.id
    LEFT JOIN transactions t ON t.category_id = b.category_id 
        AND t.user_id = b.user_id 
        AND MONTH(t.date) = b.month 
        AND YEAR(t.date) = b.year
        AND t.type = 'expense'
    WHERE b.user_id = p_user_id 
        AND b.month = p_month 
        AND b.year = p_year
    GROUP BY b.id;
END//
DELIMITER ;

-- Query to check if any budget is exceeded
SELECT * FROM monthly_summary WHERE total_expense > 0;

