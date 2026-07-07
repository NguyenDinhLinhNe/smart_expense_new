from app import app, db
from models.models import User, Category, Transaction, Budget
from werkzeug.security import generate_password_hash
from datetime import datetime, timedelta
import random

def init_database():
    with app.app_context():
        # Drop all tables
        db.drop_all()
        # Create all tables
        db.create_all()
        
        # Create default admin user
        admin = User(
            name="Admin User",
            email="admin@example.com",
            password=generate_password_hash("SecureExpense2026#"),
            role='admin'
        )
        db.session.add(admin)
        db.session.commit()
        
        categories = [
            {'name': 'Food', 'icon': '🍔', 'color': '#FF6B6B', 'type': 'expense'},
            {'name': 'Transport', 'icon': '🚗', 'color': '#4ECDC4', 'type': 'expense'},
            {'name': 'Shopping', 'icon': '🛍️', 'color': '#45B7D1', 'type': 'expense'},
            {'name': 'Entertainment', 'icon': '🎬', 'color': '#96CEB4', 'type': 'expense'},
            {'name': 'Bills', 'icon': '💡', 'color': '#FFEAA7', 'type': 'expense'},
            {'name': 'Salary', 'icon': '💰', 'color': '#10B981', 'type': 'income'},
            {'name': 'Freelance', 'icon': '💻', 'color': '#8B5CF6', 'type': 'income'},
        ]
        
        for cat in categories:
            category = Category(
                name=cat['name'],
                icon=cat['icon'],
                color=cat['color'],
                type=cat['type'],
                user_id=None
            )
            db.session.add(category)
        
        db.session.commit()
        
        # Create sample transactions
        categories_db = Category.query.filter(Category.user_id.is_(None)).all()
        category_dict = {c.name: c for c in categories_db}
        
        sample_transactions = [
            {'amount': 30000000, 'type': 'income', 'category': 'Salary', 'date': datetime.now() - timedelta(days=30), 'note': 'Monthly salary'},
            {'amount': 1200000, 'type': 'expense', 'category': 'Food', 'date': datetime.now() - timedelta(days=28), 'note': 'Groceries'},
            {'amount': 350000, 'type': 'expense', 'category': 'Transport', 'date': datetime.now() - timedelta(days=25), 'note': 'Gas'},
            {'amount': 950000, 'type': 'expense', 'category': 'Shopping', 'date': datetime.now() - timedelta(days=22), 'note': 'Clothes'},
            {'amount': 260000, 'type': 'expense', 'category': 'Entertainment', 'date': datetime.now() - timedelta(days=20), 'note': 'Netflix'},
            {'amount': 600000, 'type': 'expense', 'category': 'Bills', 'date': datetime.now() - timedelta(days=18), 'note': 'Electricity'},
            {'amount': 15000000, 'type': 'income', 'category': 'Freelance', 'date': datetime.now() - timedelta(days=15), 'note': 'Web project'},
            {'amount': 450000, 'type': 'expense', 'category': 'Food', 'date': datetime.now() - timedelta(days=12), 'note': 'Restaurant'},
            {'amount': 120000, 'type': 'expense', 'category': 'Transport', 'date': datetime.now() - timedelta(days=10), 'note': 'Uber'},
            {'amount': 2500000, 'type': 'expense', 'category': 'Shopping', 'date': datetime.now() - timedelta(days=8), 'note': 'Electronics'},
        ]
        
        for trans in sample_transactions:
            category = category_dict.get(trans['category'])
            if category:
                transaction = Transaction(
                    user_id=admin.id,
                    category_id=category.id,
                    amount=trans['amount'],
                    type=trans['type'],
                    note=trans['note'],
                    date=trans['date']
                )
                db.session.add(transaction)
        
        db.session.commit()
        
        print("✅ Database initialized successfully!")
        print("📝 Login credentials:")
        print("   Email: admin@example.com")
        print("   Password: SecureExpense2026#")

if __name__ == '__main__':
    init_database()