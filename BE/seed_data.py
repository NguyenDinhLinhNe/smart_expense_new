from app import app
from models.models import db, User, Category, Transaction
from werkzeug.security import generate_password_hash
from datetime import datetime, timedelta
import random

with app.app_context():
    print("🗄️  Clearing existing data...")
    # Xóa dữ liệu cũ
    Transaction.query.delete()
    Category.query.delete() # Xóa toàn bộ danh mục bao gồm cả global để seed lại sạch sẽ
    User.query.delete()
    db.session.commit()
    
    print("👤 Creating admin user...")
    # Tạo admin user
    admin = User(
        name='Admin User',
        email='admin@example.com',
        password=generate_password_hash('SecureExpense2026#'),
        role='admin'
    )
    db.session.add(admin)
    db.session.commit()
    
    print("📁 Creating categories...")
    # Tạo categories mặc định với user_id = None (Global Categories)
    default_categories = [
        {'name': 'Food & Dining', 'icon': '🍔', 'color': '#FF6B6B', 'type': 'expense', 'user_id': None},
        {'name': 'Transportation', 'icon': '🚗', 'color': '#4ECDC4', 'type': 'expense', 'user_id': None},
        {'name': 'Shopping', 'icon': '🛍️', 'color': '#45B7D1', 'type': 'expense', 'user_id': None},
        {'name': 'Entertainment', 'icon': '🎬', 'color': '#96CEB4', 'type': 'expense', 'user_id': None},
        {'name': 'Bills & Utilities', 'icon': '💡', 'color': '#FFEAA7', 'type': 'expense', 'user_id': None},
        {'name': 'Healthcare', 'icon': '🏥', 'color': '#DDA0DD', 'type': 'expense', 'user_id': None},
        {'name': 'Education', 'icon': '📚', 'color': '#98D8C8', 'type': 'expense', 'user_id': None},
        {'name': 'Salary', 'icon': '💰', 'color': '#10B981', 'type': 'income', 'user_id': None},
        {'name': 'Freelance', 'icon': '💻', 'color': '#8B5CF6', 'type': 'income', 'user_id': None},
        {'name': 'Investment', 'icon': '📈', 'color': '#F59E0B', 'type': 'income', 'user_id': None},
    ]
    
    for cat_data in default_categories:
        cat = Category(**cat_data)
        db.session.add(cat)
    
    db.session.commit()
    
    print("💰 Creating sample transactions...")
    # Lấy categories vừa tạo (tìm theo user_id is None)
    categories = {c.name: c for c in Category.query.filter(Category.user_id.is_(None)).all()}
    
    # Tạo transactions mẫu
    today = datetime.now().date()
    sample_transactions = [
        # Income
        {'amount': 5000000, 'type': 'income', 'category': 'Salary', 'date': today - timedelta(days=30), 'note': 'Lương tháng 12'},
        {'amount': 2000000, 'type': 'income', 'category': 'Freelance', 'date': today - timedelta(days=15), 'note': 'Dự án web'},
        {'amount': 500000, 'type': 'income', 'category': 'Investment', 'date': today - timedelta(days=5), 'note': 'Cổ tức'},
        
        # Expense - Food
        {'amount': 350000, 'type': 'expense', 'category': 'Food & Dining', 'date': today - timedelta(days=28), 'note': 'Siêu thị'},
        {'amount': 180000, 'type': 'expense', 'category': 'Food & Dining', 'date': today - timedelta(days=20), 'note': 'Nhà hàng'},
        {'amount': 120000, 'type': 'expense', 'category': 'Food & Dining', 'date': today - timedelta(days=10), 'note': 'Đồ ăn nhanh'},
        {'amount': 250000, 'type': 'expense', 'category': 'Food & Dining', 'date': today - timedelta(days=3), 'note': 'Lẩu'},
        
        # Expense - Transport
        {'amount': 200000, 'type': 'expense', 'category': 'Transportation', 'date': today - timedelta(days=25), 'note': 'Xăng xe'},
        {'amount': 50000, 'type': 'expense', 'category': 'Transportation', 'date': today - timedelta(days=12), 'note': 'Grab'},
        {'amount': 150000, 'type': 'expense', 'category': 'Transportation', 'date': today - timedelta(days=2), 'note': 'Bảo dưỡng'},
        
        # Expense - Shopping
        {'amount': 500000, 'type': 'expense', 'category': 'Shopping', 'date': today - timedelta(days=22), 'note': 'Quần áo'},
        {'amount': 300000, 'type': 'expense', 'category': 'Shopping', 'date': today - timedelta(days=8), 'note': 'Giày'},
        
        # Expense - Entertainment
        {'amount': 150000, 'type': 'expense', 'category': 'Entertainment', 'date': today - timedelta(days=18), 'note': 'Xem phim'},
        {'amount': 80000, 'type': 'expense', 'category': 'Entertainment', 'date': today - timedelta(days=4), 'note': 'Netflix'},
        
        # Expense - Bills
        {'amount': 400000, 'type': 'expense', 'category': 'Bills & Utilities', 'date': today - timedelta(days=15), 'note': 'Tiền điện'},
        {'amount': 250000, 'type': 'expense', 'category': 'Bills & Utilities', 'date': today - timedelta(days=10), 'note': 'Tiền nước'},
        {'amount': 300000, 'type': 'expense', 'category': 'Bills & Utilities', 'date': today - timedelta(days=5), 'note': 'Internet'},
        
        # Expense - Healthcare
        {'amount': 200000, 'type': 'expense', 'category': 'Healthcare', 'date': today - timedelta(days=14), 'note': 'Khám bệnh'},
        {'amount': 100000, 'type': 'expense', 'category': 'Healthcare', 'date': today - timedelta(days=2), 'note': 'Thuốc'},
        
        # Expense - Education
        {'amount': 500000, 'type': 'expense', 'category': 'Education', 'date': today - timedelta(days=7), 'note': 'Sách'},
    ]
    
    for trans_data in sample_transactions:
        category = categories.get(trans_data['category'])
        if category:
            transaction = Transaction(
                user_id=admin.id,
                category_id=category.id,
                amount=trans_data['amount'],
                type=trans_data['type'],
                note=trans_data['note'],
                date=trans_data['date']
            )
            db.session.add(transaction)
    
    db.session.commit()
    
    print("\n✅ Database seeded successfully!")
    print("📊 Statistics:")
    print(f"   - Users: {User.query.count()}")
    print(f"   - Categories: {Category.query.count()}")
    print(f"   - Transactions: {Transaction.query.count()}")
    print("\n🔐 Login credentials:")
    print("   Email: admin@example.com")
    print("   Password: SecureExpense2026#")