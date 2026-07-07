from flask import request, jsonify, Blueprint, send_file
from models.models import db
from flask_jwt_extended import jwt_required, get_jwt_identity
from models.models import Transaction, Category
from sqlalchemy import func, extract
from datetime import datetime, timedelta, date
import pandas as pd
import io
import csv

report_bp = Blueprint('reports', __name__)

@report_bp.route('/dashboard', methods=['GET'])
@jwt_required()
def get_dashboard_data():
    try:
        user_id = get_jwt_identity()
        
        # Get current month and year
        now = datetime.now()
        current_month = now.month
        current_year = now.year
        
        # Total income and expense for current month
        total_income = db.session.query(func.sum(Transaction.amount)).filter(
            Transaction.user_id == user_id,
            Transaction.type == 'income',
            extract('month', Transaction.date) == current_month,
            extract('year', Transaction.date) == current_year
        ).scalar() or 0
        
        total_expense = db.session.query(func.sum(Transaction.amount)).filter(
            Transaction.user_id == user_id,
            Transaction.type == 'expense',
            extract('month', Transaction.date) == current_month,
            extract('year', Transaction.date) == current_year
        ).scalar() or 0
        
        # Recent transactions
        recent_transactions = Transaction.query.filter_by(user_id=user_id)\
            .order_by(Transaction.date.desc())\
            .limit(5)\
            .all()
        
        # Monthly trend (last 6 months)
        trend_data = []
        for i in range(5, -1, -1):
            month_date = now - timedelta(days=30*i)
            month = month_date.month
            year = month_date.year
            
            monthly_income = db.session.query(func.sum(Transaction.amount)).filter(
                Transaction.user_id == user_id,
                Transaction.type == 'income',
                extract('month', Transaction.date) == month,
                extract('year', Transaction.date) == year
            ).scalar() or 0
            
            monthly_expense = db.session.query(func.sum(Transaction.amount)).filter(
                Transaction.user_id == user_id,
                Transaction.type == 'expense',
                extract('month', Transaction.date) == month,
                extract('year', Transaction.date) == year
            ).scalar() or 0
            
            trend_data.append({
                'month': f'{month}/{year}',
                'income': float(monthly_income),
                'expense': float(monthly_expense)
            })
        
        # Category breakdown
        category_spending = db.session.query(
            Category.name, Category.icon, func.sum(Transaction.amount).label('total')
        ).join(Transaction).filter(
            Transaction.user_id == user_id,
            Transaction.type == 'expense',
            extract('month', Transaction.date) == current_month,
            extract('year', Transaction.date) == current_year
        ).group_by(Category.id).all()
        
        return jsonify({
            'summary': {
                'total_income': float(total_income),
                'total_expense': float(total_expense),
                'balance': float(total_income - total_expense)
            },
            'recent_transactions': [t.to_dict() for t in recent_transactions],
            'trend_data': trend_data,
            'category_data': {
                'labels': [c[1] + ' ' + c[0] for c in category_spending],
                'data': [float(c[2]) for c in category_spending]
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@report_bp.route('', methods=['GET'])
@jwt_required()
def get_monthly_report():
    try:
        user_id = get_jwt_identity()
        month = request.args.get('month', type=int)
        year = request.args.get('year', type=int)
        
        if not month or not year:
            now = datetime.now()
            month = now.month
            year = now.year
        
        # Get all transactions for the month
        transactions = Transaction.query.filter(
            Transaction.user_id == user_id,
            extract('month', Transaction.date) == month,
            extract('year', Transaction.date) == year
        ).all()
        
        # Calculate statistics
        total_income = sum(t.amount for t in transactions if t.type == 'income')
        total_expense = sum(t.amount for t in transactions if t.type == 'expense')
        
        # Group by category
        category_stats = {}
        income_category_stats = {}
        for t in transactions:
            cat_name = t.category.name if t.category else 'Uncategorized'
            if t.type == 'expense':
                if cat_name not in category_stats:
                    category_stats[cat_name] = 0
                category_stats[cat_name] += float(t.amount)
            elif t.type == 'income':
                if cat_name not in income_category_stats:
                    income_category_stats[cat_name] = 0
                income_category_stats[cat_name] += float(t.amount)
        
        return jsonify({
            'month': month,
            'year': year,
            'total_income': float(total_income),
            'total_expense': float(total_expense),
            'balance': float(total_income - total_expense),
            'transactions': [t.to_dict() for t in transactions],
            'category_breakdown': category_stats,
            'income_category_breakdown': income_category_stats,
            'transaction_count': len(transactions)
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@report_bp.route('/export/csv', methods=['GET'])
@jwt_required()
def export_csv():
    try:
        user_id = get_jwt_identity()
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        query = Transaction.query.filter_by(user_id=user_id)
        
        if start_date:
            query = query.filter(Transaction.date >= start_date)
        if end_date:
            query = query.filter(Transaction.date <= end_date)
        
        transactions = query.order_by(Transaction.date.desc()).all()
        
        # Create CSV
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['Date', 'Type', 'Category', 'Amount', 'Note'])
        
        for t in transactions:
            writer.writerow([
                t.date,
                t.type,
                t.category.name if t.category else 'Uncategorized',
                t.amount,
                t.note or ''
            ])
        
        output.seek(0)
        
        return send_file(
            io.BytesIO(output.getvalue().encode('utf-8')),
            mimetype='text/csv',
            as_attachment=True,
            download_name=f'expense_report_{datetime.now().strftime("%Y%m%d")}.csv'
        )
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@report_bp.route('/weekly', methods=['GET'])
@jwt_required()
def get_weekly_report():
    try:
        user_id = get_jwt_identity()
        month = request.args.get('month', type=int)
        year = request.args.get('year', type=int)
        
        if not month or not year:
            now = datetime.now()
            month = now.month
            year = now.year
            
        # Compute first day of the month
        first_day = date(year, month, 1)
        
        # Compute last day of the month
        if month == 12:
            last_day = date(year, 12, 31)
        else:
            last_day = date(year, month + 1, 1) - timedelta(days=1)
            
        # Get start Monday (Monday of the week containing first_day)
        start_monday = first_day - timedelta(days=first_day.isoweekday() - 1)
        
        # Get end Sunday (Sunday of the week containing last_day)
        end_sunday = last_day + timedelta(days=7 - last_day.isoweekday())
        
        # Query all transactions within this full calendar week range
        transactions = Transaction.query.filter(
            Transaction.user_id == user_id,
            Transaction.date >= start_monday,
            Transaction.date <= end_sunday
        ).order_by(Transaction.date.asc()).all()
        
        # Generate the weekly intervals
        weeks = []
        current_monday = start_monday
        while current_monday <= end_sunday:
            week_sunday = current_monday + timedelta(days=6)
            weeks.append({
                'label': f"Week {len(weeks) + 1}",
                'start': current_monday,
                'end': week_sunday,
                'start_str': current_monday.strftime('%d/%m'),
                'end_str': week_sunday.strftime('%d/%m'),
                'income': 0.0,
                'expense': 0.0,
                'transactions': []
            })
            current_monday = week_sunday + timedelta(days=1)
            
        # Distribute transactions into the calculated weeks
        for t in transactions:
            t_date = t.date
            for w in weeks:
                if w['start'] <= t_date <= w['end']:
                    amount = float(t.amount)
                    if t.type == 'income':
                        w['income'] += amount
                    else:
                        w['expense'] += amount
                    w['transactions'].append(t.to_dict())
                    break
                    
        # Serialize weeks data for JSON response (remove date objects)
        serialized_weeks = []
        total_income = 0.0
        total_expense = 0.0
        for w in weeks:
            total_income += w['income']
            total_expense += w['expense']
            serialized_weeks.append({
                'label': w['label'],
                'start': w['start'].isoformat(),
                'end': w['end'].isoformat(),
                'start_str': w['start_str'],
                'end_str': w['end_str'],
                'income': w['income'],
                'expense': w['expense'],
                'transactions': w['transactions']
            })
            
        return jsonify({
            'month': month,
            'year': year,
            'total_income': total_income,
            'total_expense': total_expense,
            'balance': total_income - total_expense,
            'weekly_data': serialized_weeks
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500