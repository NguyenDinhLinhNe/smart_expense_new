from flask import request, jsonify, Blueprint
from flask_jwt_extended import jwt_required, get_jwt_identity
from models.models import db, Category
from models.models import User

category_bp = Blueprint('categories', __name__)

@category_bp.route('', methods=['GET'])
@jwt_required()
def get_categories():
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 401
        
        categories = Category.query.filter(
            (Category.user_id == user_id) | (Category.user_id.is_(None))
        ).all()
        
        return jsonify({
            'categories': [c.to_dict() for c in categories]
        }), 200
        
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@category_bp.route('', methods=['POST'])
@jwt_required()
def create_category():
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        print("=" * 50)
        print("Received data:", data)
        print("User ID:", user_id)
        print("=" * 50)
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        if not data.get('name'):
            return jsonify({'error': 'Category name is required'}), 400
        
        # Validate - CHỈ CẦN NAME LÀ BẮT BUỘC
        if not data.get('name'):
            return jsonify({'error': 'Category name is required'}), 400
        
        # Xử lý color nếu thiếu
        color = data.get('color')
        if not color:
            # Tạo màu ngẫu nhiên nếu không có
            import random
            color = "#{:06x}".format(random.randint(0, 0xFFFFFF))
        
        # Determine if creating a global category
        is_global = data.get('is_global', False)
        target_user_id = None
        
        if is_global:
            current_user = User.query.get(user_id)
            if not current_user or current_user.role != 'admin':
                return jsonify({'error': 'Unauthorized. Only admins can create global categories.'}), 403
            target_user_id = None
        else:
            target_user_id = user_id
            
        # Kiểm tra trùng
        existing = Category.query.filter_by(
            name=data['name'],
            user_id=target_user_id
        ).first()
        
        if existing:
            return jsonify({'error': 'Category already exists'}), 400
        
        # Tạo category với đầy đủ fields
        category = Category(
            name=data['name'],
            icon=data.get('icon', '📌'),
            color=color,
            type=data.get('type', 'expense'),
            user_id=target_user_id
        )
        
        db.session.add(category)
        db.session.commit()
        
        return jsonify({
            'message': 'Category created successfully',
            'category': category.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        print("❌ Error:", str(e))
        return jsonify({'error': str(e)}), 500

@category_bp.route('/<int:category_id>', methods=['PUT'])
@jwt_required()
def update_category(category_id):
    try:
        user_id = get_jwt_identity()
        current_user = User.query.get(user_id)
        if not current_user:
            return jsonify({'error': 'User not found'}), 401
            
        category = Category.query.get(category_id)
        if not category:
            return jsonify({'error': 'Category not found'}), 404
            
        # Check permissions
        if category.user_id is None:
            if current_user.role != 'admin':
                return jsonify({'error': 'Unauthorized. Only admins can modify global categories.'}), 403
        else:
            if category.user_id != current_user.id and current_user.role != 'admin':
                return jsonify({'error': 'Unauthorized to modify this category.'}), 403
        
        data = request.get_json()
        
        if 'name' in data:
            category.name = data['name']
        if 'icon' in data:
            category.icon = data['icon']
        if 'color' in data:
            category.color = data['color']
        if 'type' in data:
            category.type = data['type']
        
        db.session.commit()
        
        return jsonify({
            'message': 'Category updated successfully',
            'category': category.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@category_bp.route('/<int:category_id>', methods=['DELETE'])
@jwt_required()
def delete_category(category_id):
    try:
        user_id = get_jwt_identity()
        current_user = User.query.get(user_id)
        if not current_user:
            return jsonify({'error': 'User not found'}), 401
            
        category = Category.query.get(category_id)
        if not category:
            return jsonify({'error': 'Category not found'}), 404
            
        # Check permissions
        if category.user_id is None:
            if current_user.role != 'admin':
                return jsonify({'error': 'Unauthorized. Only admins can delete global categories.'}), 403
        else:
            if category.user_id != current_user.id and current_user.role != 'admin':
                return jsonify({'error': 'Unauthorized to delete this category.'}), 403
        
        # Check if category has transactions
        if category.transactions:
            return jsonify({'error': 'Cannot delete category with existing transactions'}), 400
        
        db.session.delete(category)
        db.session.commit()
        
        return jsonify({'message': 'Category deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500