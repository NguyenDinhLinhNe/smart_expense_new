from flask import request, jsonify, Blueprint
from flask_jwt_extended import jwt_required, get_jwt_identity
from models.models import db, RecurringTransaction, Category, Transaction
from datetime import datetime, date, timedelta
from sqlalchemy import and_

recurring_bp = Blueprint('recurring', __name__)

@recurring_bp.route('', methods=['GET'])
@jwt_required()
def get_recurring():
    try:
        user_id = get_jwt_identity()
        recurrings = RecurringTransaction.query.filter_by(user_id=user_id).all()
        return jsonify({
            'recurring_transactions': [r.to_dict() for r in recurrings]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@recurring_bp.route('', methods=['POST'])
@jwt_required()
def create_recurring():
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        required = ['category_id', 'amount', 'type', 'frequency', 'day_of_period']
        for field in required:
            if field not in data:
                return jsonify({'error': f'Missing {field}'}), 400
                
        recurring = RecurringTransaction(
            user_id=user_id,
            category_id=int(data['category_id']),
            amount=float(data['amount']),
            type=data['type'],
            description=data.get('description', ''),
            frequency=data['frequency'],
            day_of_period=int(data['day_of_period']),
            is_active=data.get('is_active', True)
        )
        
        db.session.add(recurring)
        db.session.commit()
        
        return jsonify({
            'message': 'Recurring transaction created successfully',
            'recurring_transaction': recurring.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@recurring_bp.route('/<int:recurring_id>', methods=['PUT'])
@jwt_required()
def update_recurring(recurring_id):
    try:
        user_id = get_jwt_identity()
        recurring = RecurringTransaction.query.filter_by(id=recurring_id, user_id=user_id).first()
        if not recurring:
            return jsonify({'error': 'Recurring transaction not found'}), 404
            
        data = request.get_json()
        if 'category_id' in data:
            recurring.category_id = int(data['category_id'])
        if 'amount' in data:
            recurring.amount = float(data['amount'])
        if 'type' in data:
            recurring.type = data['type']
        if 'description' in data:
            recurring.description = data['description']
        if 'frequency' in data:
            recurring.frequency = data['frequency']
        if 'day_of_period' in data:
            recurring.day_of_period = int(data['day_of_period'])
        if 'is_active' in data:
            recurring.is_active = bool(data['is_active'])
            
        db.session.commit()
        return jsonify({
            'message': 'Recurring transaction updated successfully',
            'recurring_transaction': recurring.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@recurring_bp.route('/<int:recurring_id>', methods=['DELETE'])
@jwt_required()
def delete_recurring(recurring_id):
    try:
        user_id = get_jwt_identity()
        recurring = RecurringTransaction.query.filter_by(id=recurring_id, user_id=user_id).first()
        if not recurring:
            return jsonify({'error': 'Recurring transaction not found'}), 404
            
        db.session.delete(recurring)
        db.session.commit()
        return jsonify({'message': 'Recurring transaction deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

def check_and_execute_recurrings():
    """Scan and generate recurring transactions if today matches their schedule"""
    try:
        today = date.today()
        active_rules = RecurringTransaction.query.filter_by(is_active=True).all()
        
        for rule in active_rules:
            should_run = False
            last_run = rule.last_executed
            
            if not last_run:
                should_run = True
            else:
                days_since = (today - last_run).days
                if rule.frequency == 'daily' and days_since >= 1:
                    should_run = True
                elif rule.frequency == 'weekly' and days_since >= 7:
                    if today.weekday() == rule.day_of_period:
                        should_run = True
                elif rule.frequency == 'monthly':
                    if today.day == rule.day_of_period and days_since >= 25:
                        should_run = True
                        
            if should_run:
                tx = Transaction(
                    user_id=rule.user_id,
                    category_id=rule.category_id,
                    amount=rule.amount,
                    type=rule.type,
                    note=f"[Auto-recurring] {rule.description or ''}".strip(),
                    date=today
                )
                db.session.add(tx)
                rule.last_executed = today
                
        db.session.commit()
    except Exception as e:
        print("Error executing recurrings:", e)
        db.session.rollback()
