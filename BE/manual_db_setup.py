import mysql.connector
from mysql.connector import Error
import os

# Cấu hình kết nối
db_config = {
    'host': 'localhost',
    'user': 'root',
    'password': ''  # Thay bằng mật khẩu của bạn
}

# SQL script để tạo database và tables
sql_script = """
-- Tạo database
CREATE DATABASE IF NOT EXISTS expense_tracker;
USE expense_tracker;

-- Bảng users
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bảng categories
CREATE TABLE IF NOT EXISTS categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL,
    icon VARCHAR(50) DEFAULT '📌',
    color VARCHAR(20) DEFAULT '#6B7280',
    type ENUM('income', 'expense') DEFAULT 'expense',
    user_id INT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Bảng transactions
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
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- Bảng budgets
CREATE TABLE IF NOT EXISTS budgets (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    category_id INT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    month INT NOT NULL,
    year INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- Insert default categories
INSERT IGNORE INTO categories (name, icon, color, type, user_id) VALUES
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
"""

def create_database():
    try:
        # Kết nối MySQL server
        connection = mysql.connector.connect(**db_config)
        cursor = connection.cursor()
        
        # Chạy từng câu lệnh SQL
        for statement in sql_script.split(';'):
            if statement.strip():
                try:
                    cursor.execute(statement)
                    print(f"✅ Executed: {statement[:50]}...")
                except Error as e:
                    print(f"⚠️ Warning: {e}")
        
        connection.commit()
        print("\n🎉 Database created successfully!")
        
        cursor.close()
        connection.close()
        
    except Error as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    create_database()