from flask import Blueprint
from models.models import Category
from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, create_access_token
from werkzeug.security import generate_password_hash, check_password_hash
from models.models import db, User
import re

auth_bp = Blueprint('auth', __name__)

def validate_email(email):
    pattern = r'^[\w\.-]+@[\w\.-]+\.\w+$'
    return re.match(pattern, email) is not None

@auth_bp.route('/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        
        # Validate input
        if not data.get('name') or not data.get('email') or not data.get('password'):
            return jsonify({'error': 'Missing required fields'}), 400
        
        if not validate_email(data['email']):
            return jsonify({'error': 'Invalid email format'}), 400
        
        if len(data['password']) < 6:
            return jsonify({'error': 'Password must be at least 6 characters'}), 400
        
        # Check if user exists
        if User.query.filter_by(email=data['email']).first():
            return jsonify({'error': 'Email already registered'}), 409
        
        # Create user
        hashed_password = generate_password_hash(data['password'])
        user = User(
            name=data['name'],
            email=data['email'],
            password=hashed_password
        )
        
        db.session.add(user)
        db.session.commit()
        
        # We do not create duplicate custom categories for each user anymore since they inherit Global Categories (user_id = None)
        
        return jsonify({
            'message': 'User created successfully',
            'user': user.to_dict(),
            'token': user.get_token()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        
        if not data.get('email') or not data.get('password'):
            return jsonify({'error': 'Email and password required'}), 400
        
        user = User.query.filter_by(email=data['email']).first()
        
        if not user or not check_password_hash(user.password, data['password']):
            return jsonify({'error': 'Invalid credentials'}), 401
        
        return jsonify({
            'message': 'Login successful',
            'user': user.to_dict(),
            'token': user.get_token()
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/reset-password', methods=['POST'])
def reset_password():
    try:
        data = request.get_json()
        email = data.get('email')
        new_password = data.get('new_password')
        
        if not email or not new_password:
            return jsonify({'error': 'Email and new password required'}), 400
            
        if len(new_password) < 6:
            return jsonify({'error': 'Password must be at least 6 characters'}), 400
            
        user = User.query.filter_by(email=email).first()
        if not user:
            return jsonify({'error': 'Email address not found in system'}), 404
            
        user.password = generate_password_hash(new_password)
        db.session.commit()
        
        return jsonify({'message': 'Password has been reset successfully!'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/profile', methods=['GET'])
@jwt_required()
def get_profile():
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        return jsonify({'user': user.to_dict()}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/users', methods=['GET'])
@jwt_required()
def get_users():
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id)
        
        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Unauthorized. Admin access required.'}), 403
            
        users = User.query.all()
        return jsonify({'users': [u.to_dict() for u in users]}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def create_default_categories(user_id):
    default_categories = [
        {'name': 'Food & Dining', 'icon': '🍔', 'color': '#FF6B6B', 'type': 'expense'},
        {'name': 'Transportation', 'icon': '🚗', 'color': '#4ECDC4', 'type': 'expense'},
        {'name': 'Shopping', 'icon': '🛍️', 'color': '#45B7D1', 'type': 'expense'},
        {'name': 'Entertainment', 'icon': '🎬', 'color': '#96CEB4', 'type': 'expense'},
        {'name': 'Bills & Utilities', 'icon': '💡', 'color': '#FFEAA7', 'type': 'expense'},
        {'name': 'Healthcare', 'icon': '🏥', 'color': '#DDA0DD', 'type': 'expense'},
        {'name': 'Education', 'icon': '📚', 'color': '#98D8C8', 'type': 'expense'},
        {'name': 'Salary', 'icon': '💰', 'color': '#B5EAD7', 'type': 'income'},
        {'name': 'Freelance', 'icon': '💻', 'color': '#C7CEEA', 'type': 'income'},
        {'name': 'Investment', 'icon': '📈', 'color': '#E2F0CB', 'type': 'income'}
    ]
    
    for cat in default_categories:
        category = Category(
            name=cat['name'],
            icon=cat['icon'],
            color=cat['color'],
            type=cat['type'],
            user_id=user_id
        )
        db.session.add(category)
    
    db.session.commit()