from flask import request, jsonify, Blueprint
from flask_jwt_extended import jwt_required, get_jwt_identity
from models.models import db, Budget, Category, Transaction
from sqlalchemy import func
from datetime import datetime, date, timedelta
import calendar
from models.models import User

budget_bp = Blueprint('budgets', __name__)

@budget_bp.route('', methods=['GET'])
@jwt_required()
def get_budgets():
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 401
        
        month = request.args.get('month', datetime.now().month, type=int)
        year = request.args.get('year', datetime.now().year, type=int)
        week_param = request.args.get('week')
        
        # Calculate full calendar weeks (Monday to Sunday) overlapping the month
        first_day = date(year, month, 1)
        if month == 12:
            last_day = date(year, 12, 31)
        else:
            last_day = date(year, month + 1, 1) - timedelta(days=1)
            
        start_monday = first_day - timedelta(days=first_day.isoweekday() - 1)
        end_sunday = last_day + timedelta(days=7 - last_day.isoweekday())
        
        weeks = []
        current_monday = start_monday
        while current_monday <= end_sunday:
            week_sunday = current_monday + timedelta(days=6)
            weeks.append({
                'start': current_monday,
                'end': week_sunday,
                'start_str': current_monday.strftime('%d/%m'),
                'end_str': week_sunday.strftime('%d/%m')
            })
            current_monday = week_sunday + timedelta(days=1)
            
        # Find which week corresponds to the current date today
        today = date.today()
        current_week_index = 1
        for i, w in enumerate(weeks):
            if w['start'] <= today <= w['end']:
                current_week_index = i + 1
                break

        if week_param is None or week_param == '' or week_param == 'null':
            week = current_week_index
        else:
            try:
                week = int(week_param)
            except ValueError:
                week = current_week_index
            
        # Get date range for the selected week
        if week < 1 or week > len(weeks):
            week = 1
            
        selected_week_data = weeks[week - 1]
        start_date = selected_week_data['start']
        end_date = selected_week_data['end']
        
        budgets = Budget.query.filter_by(
            user_id=user_id,
            month=month,
            year=year,
            week=week
        ).all()
        
        # Synchronize any missing category budgets from other weeks of this month
        all_month_budgets = Budget.query.filter_by(
            user_id=user_id,
            month=month,
            year=year
        ).all()
        
        if all_month_budgets:
            category_amounts = {}
            for b in all_month_budgets:
                category_amounts[b.category_id] = float(b.amount)
                
            existing_categories = {b.category_id for b in budgets}
            missing_categories = set(category_amounts.keys()) - existing_categories
            
            if missing_categories:
                for cat_id in missing_categories:
                    new_b = Budget(
                        user_id=user_id,
                        category_id=cat_id,
                        amount=category_amounts[cat_id],
                        month=month,
                        year=year,
                        week=week
                    )
                    db.session.add(new_b)
                db.session.commit()
                budgets = Budget.query.filter_by(
                    user_id=user_id,
                    month=month,
                    year=year,
                    week=week
                ).all()
        
        result = []
        for budget in budgets:
            spent = db.session.query(func.sum(Transaction.amount)).filter(
                Transaction.user_id == user_id,
                Transaction.category_id == budget.category_id,
                Transaction.type == 'expense',
                Transaction.date >= start_date,
                Transaction.date <= end_date
            ).scalar() or 0
            
            result.append({
                **budget.to_dict(),
                'spent': float(spent),
                'remaining': float(budget.amount) - float(spent),
                'percentage': (float(spent) / float(budget.amount)) * 100 if budget.amount > 0 else 0
            })
            
        return jsonify({
            'budgets': result,
            'weeks': [{
                'week': i + 1,
                'start_str': w['start_str'],
                'end_str': w['end_str']
            } for i, w in enumerate(weeks)],
            'active_week': week
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@budget_bp.route('', methods=['POST'])
@jwt_required()
def create_budget():
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        required = ['category_id', 'amount', 'month', 'year']
        for field in required:
            if field not in data:
                return jsonify({'error': f'Missing {field}'}), 400
                
        month = int(data['month'])
        year = int(data['year'])
        category_id = int(data['category_id'])
        amount = float(data['amount'])
        
        # Calculate full calendar weeks (Monday to Sunday) overlapping the month
        first_day = date(year, month, 1)
        if month == 12:
            last_day = date(year, 12, 31)
        else:
            last_day = date(year, month + 1, 1) - timedelta(days=1)
            
        start_monday = first_day - timedelta(days=first_day.isoweekday() - 1)
        end_sunday = last_day + timedelta(days=7 - last_day.isoweekday())
        
        num_weeks = 0
        current_monday = start_monday
        while current_monday <= end_sunday:
            num_weeks += 1
            current_monday = current_monday + timedelta(days=7)
            
        created_or_updated = []
        for w in range(1, num_weeks + 1):
            existing = Budget.query.filter_by(
                user_id=user_id,
                category_id=category_id,
                month=month,
                year=year,
                week=w
            ).first()
            
            if existing:
                existing.amount = amount
                created_or_updated.append(existing.to_dict())
            else:
                budget = Budget(
                    user_id=user_id,
                    category_id=category_id,
                    amount=amount,
                    month=month,
                    year=year,
                    week=w
                )
                db.session.add(budget)
                db.session.flush()
                created_or_updated.append(budget.to_dict())
                
        db.session.commit()
        
        return jsonify({
            'message': 'Budget created and applied to all weeks in the month successfully',
            'budgets': created_or_updated
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@budget_bp.route('/<int:budget_id>', methods=['PUT'])
@jwt_required()
def update_budget(budget_id):
    try:
        user_id = get_jwt_identity()
        budget = Budget.query.filter_by(id=budget_id, user_id=user_id).first()
        
        if not budget:
            return jsonify({'error': 'Budget not found'}), 404
        
        data = request.get_json()
        amount = data.get('amount')
        
        if amount is not None:
            amount = float(amount)
            # Find and update all budgets for this category in the same month/year
            all_weeks_budgets = Budget.query.filter_by(
                user_id=user_id,
                category_id=budget.category_id,
                month=budget.month,
                year=budget.year
            ).all()
            
            for b in all_weeks_budgets:
                b.amount = amount
                
            db.session.commit()
            return jsonify({
                'message': 'Budget updated for all weeks successfully',
                'budget': budget.to_dict()
            }), 200
            
        return jsonify({'error': 'No changes provided'}), 400
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@budget_bp.route('/<int:budget_id>', methods=['DELETE'])
@jwt_required()
def delete_budget(budget_id):
    try:
        user_id = get_jwt_identity()
        budget = Budget.query.filter_by(id=budget_id, user_id=user_id).first()
        
        if not budget:
            return jsonify({'error': 'Budget not found'}), 404
            
        # Delete all budgets for this category, month, and year across all weeks
        Budget.query.filter_by(
            user_id=user_id,
            category_id=budget.category_id,
            month=budget.month,
            year=budget.year
        ).delete()
        
        db.session.commit()
        return jsonify({'message': 'Budget deleted for all weeks successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500