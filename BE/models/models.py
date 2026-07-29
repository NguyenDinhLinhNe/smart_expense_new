from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from flask_jwt_extended import create_access_token

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), default='user')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # OTP fields for forgot password
    otp_code = db.Column(db.String(6), nullable=True)
    otp_expiry = db.Column(db.DateTime, nullable=True)
    
    # Relationships
    transactions = db.relationship('Transaction', backref='user', lazy=True)
    budgets = db.relationship('Budget', backref='user', lazy=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'role': self.role,
            'created_at': self.created_at.isoformat()
        }
    
    def get_token(self):
        return create_access_token(identity=str(self.id), additional_claims={'role': self.role})

class Category(db.Model):
    __tablename__ = 'categories'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    icon = db.Column(db.String(50), default='📌')
    color = db.Column(db.String(20), default='#6B7280')
    type = db.Column(db.Enum('income', 'expense', name='category_type'), default='expense')
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    
    # Relationship
    transactions = db.relationship('Transaction', backref='category', lazy=True)
    budgets = db.relationship('Budget', backref='category', lazy=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'icon': self.icon,
            'color': self.color,
            'type': self.type,
            'user_id': self.user_id
        }

class Transaction(db.Model):
    __tablename__ = 'transactions'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey('categories.id'), nullable=False)
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    type = db.Column(db.Enum('income', 'expense', name='transaction_type'), nullable=False)
    note = db.Column(db.Text)
    date = db.Column(db.Date, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'category_id': self.category_id,
            'category_name': self.category.name if self.category else None,
            'category_icon': self.category.icon if self.category else None,
            'amount': float(self.amount),
            'type': self.type,
            'note': self.note,
            'date': self.date.isoformat()
        }

class Budget(db.Model):
    __tablename__ = 'budgets'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey('categories.id'), nullable=False)
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    month = db.Column(db.Integer, nullable=False)  # 1-12
    year = db.Column(db.Integer, nullable=False)
    week = db.Column(db.Integer, default=1, nullable=False) # 1-5
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'category_id': self.category_id,
            'category_name': self.category.name if self.category else None,
            'amount': float(self.amount),
            'month': self.month,
            'year': self.year,
            'week': self.week
        }

class RecurringTransaction(db.Model):
    __tablename__ = 'recurring_transactions'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey('categories.id'), nullable=False)
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    type = db.Column(db.Enum('income', 'expense', name='recurring_type'), nullable=False)
    description = db.Column(db.String(255), nullable=True)
    frequency = db.Column(db.String(20), nullable=False, default='monthly')
    day_of_period = db.Column(db.Integer, nullable=False, default=1)
    last_executed = db.Column(db.Date, nullable=True)
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    user_rel = db.relationship('User', backref=db.backref('recurring_transactions_rel', lazy=True))
    category_rel = db.relationship('Category', backref=db.backref('recurring_transactions_rel', lazy=True))

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'category_id': self.category_id,
            'category_name': self.category_rel.name if self.category_rel else None,
            'category_icon': self.category_rel.icon if self.category_rel else None,
            'amount': float(self.amount),
            'type': self.type,
            'description': self.description,
            'frequency': self.frequency,
            'day_of_period': self.day_of_period,
            'last_executed': self.last_executed.isoformat() if self.last_executed else None,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat()
        }

class SentReport(db.Model):
    __tablename__ = 'sent_reports'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    report_type = db.Column(db.String(20), nullable=False)
    sent_date = db.Column(db.Date, nullable=False)