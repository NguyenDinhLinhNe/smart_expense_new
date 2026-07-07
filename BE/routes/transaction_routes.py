from flask import Blueprint
from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models.models import db, Transaction, Category
from datetime import datetime, timedelta
from models.models import User

transaction_bp = Blueprint('transactions', __name__)

@transaction_bp.route('', methods=['GET'])
@jwt_required()
def get_transactions():
    try:
        user_id = get_jwt_identity()

        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 401
        
        # Get query parameters
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        category_id = request.args.get('category_id')
        type_filter = request.args.get('type')
        
        query = Transaction.query.filter_by(user_id=user_id)
        
        if start_date:
            query = query.filter(Transaction.date >= start_date)
        if end_date:
            query = query.filter(Transaction.date <= end_date)
        if category_id:
            query = query.filter_by(category_id=category_id)
        if type_filter:
            query = query.filter_by(type=type_filter)
        
        transactions = query.order_by(Transaction.date.desc()).all()
        
        return jsonify({
            'transactions': [t.to_dict() for t in transactions],
            'total': len(transactions)
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@transaction_bp.route('', methods=['POST'])
@jwt_required()
def create_transaction():
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        # Validate
        required = ['amount', 'type', 'category_id', 'date']
        for field in required:
            if field not in data:
                return jsonify({'error': f'Missing {field}'}), 400
        
        # Check category belongs to user
        category = Category.query.filter(
                (Category.id == data['category_id']) &
                ((Category.user_id == user_id) | (Category.user_id.is_(None)))
            ).first()
        
        if not category:
            return jsonify({'error': 'Invalid category'}), 400
        
        transaction = Transaction(
            user_id=user_id,
            category_id=data['category_id'],
            amount=data['amount'],
            type=data['type'],
            note=data.get('note', ''),
            date=datetime.strptime(data['date'], '%Y-%m-%d')
        )
        
        db.session.add(transaction)
        db.session.commit()
        
        return jsonify({
            'message': 'Transaction created',
            'transaction': transaction.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@transaction_bp.route('/<int:transaction_id>', methods=['PUT'])
@jwt_required()
def update_transaction(transaction_id):
    try:
        user_id = get_jwt_identity()
        transaction = Transaction.query.filter_by(
            id=transaction_id,
            user_id=user_id
        ).first()
        
        if not transaction:
            return jsonify({'error': 'Transaction not found'}), 404
        
        data = request.get_json()
        
        if 'amount' in data:
            transaction.amount = data['amount']
        if 'type' in data:
            transaction.type = data['type']
        if 'category_id' in data:
            transaction.category_id = data['category_id']
        if 'note' in data:
            transaction.note = data['note']
        if 'date' in data:
            transaction.date = datetime.strptime(data['date'], '%Y-%m-%d')
        
        db.session.commit()
        
        return jsonify({
            'message': 'Transaction updated',
            'transaction': transaction.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@transaction_bp.route('/<int:transaction_id>', methods=['DELETE'])
@jwt_required()
def delete_transaction(transaction_id):
    try:
        user_id = get_jwt_identity()
        transaction = Transaction.query.filter_by(
            id=transaction_id,
            user_id=user_id
        ).first()
        
        if not transaction:
            return jsonify({'error': 'Transaction not found'}), 404
        
        db.session.delete(transaction)
        db.session.commit()
        
        return jsonify({'message': 'Transaction deleted'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

import re

@transaction_bp.route('/parse-sms', methods=['POST'])
@jwt_required()
def parse_sms():
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        if not data or 'text' not in data:
            return jsonify({'error': 'Missing text field'}), 400
            
        text = data['text']
        
        amount = 0.0
        tx_type = 'expense'
        
        amount_match = re.search(r'([\+\-])\s*([\d\.,]+)\s*(VND|VND|đ|đ|₫|₫|USD)?', text, re.IGNORECASE)
        if amount_match:
            sign = amount_match.group(1)
            num_str = amount_match.group(2).replace(',', '').replace('.', '')
            try:
                amount = float(num_str)
                if sign == '+':
                    tx_type = 'income'
            except ValueError:
                pass
        else:
            num_match = re.search(r'([\d\.,]+)\s*(VND|đ|₫|đ|₫)', text, re.IGNORECASE)
            if num_match:
                num_str = num_match.group(1).replace(',', '').replace('.', '')
                try:
                    amount = float(num_str)
                except ValueError:
                    pass
            
            income_keywords = ['nhan tien', 'chuyen vao', 'nạp tiền', 'cộng tiền', 'thu nhap', 'luong', 'salary', 'received', 'deposit']
            for kw in income_keywords:
                if kw in text.lower():
                    tx_type = 'income'
                    break
        
        today = datetime.now()
        date_parsed = today.strftime('%Y-%m-%d')
        date_match = re.search(r'(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?', text)
        if date_match:
            dd = int(date_match.group(1))
            mm = int(date_match.group(2))
            yy = date_match.group(3)
            year = int(yy) if yy else today.year
            if yy and len(yy) == 2:
                year += 2000
            try:
                parsed_dt = datetime(year, mm, dd)
                date_parsed = parsed_dt.strftime('%Y-%m-%d')
            except ValueError:
                pass
                
        note = text
        nd_match = re.search(r'ND:\s*(.*?)(?:\.|$)', text, re.IGNORECASE)
        if nd_match:
            note = nd_match.group(1).strip()
        else:
            momo_match = re.search(r'cho\s+([^,\.\d]+)', text, re.IGNORECASE)
            if momo_match:
                note = "Pay " + momo_match.group(1).strip()
                
        categories = Category.query.all()
        suggested_category_id = None
        note_lower = note.lower()
        
        food_kws = ['an uong', 'food', 'restaurant', 'coffee', 'cafe', 'tea', 'kem', 'sieu thi', 'winmart', 'coop', 'market', 'cho', 'nha hang', 'bakery', 'starbucks', 'highlands', 'phuc long']
        trans_kws = ['grab', 'be', 'gojek', 'taxi', 'xang', 'gas', 'bus', 'tau', 've xe', 'xe may', 'o to', 'gui xe', 'vé máy bay', 'flight']
        shop_kws = ['shopee', 'lazada', 'tiki', 'shopping', 'quan ao', 'clothes', 'giay', 'shoes', 'online', 'mua sam', 'dien thoai', 'laptop', 'phu kien']
        ent_kws = ['cinema', 'rap chieu phim', 'phim', 'game', 'netflix', 'spotify', 'bar', 'pub', 'party', 'du lich', 'travel', 'hotel', 'resort', 'kyoto']
        bill_kws = ['dien', 'nuoc', 'internet', 'wifi', 'cuoc', 'bill', 'dien thoai', 'phone', 'thue', 'rent', 'hoc phi', 'tuition', 'insurance', 'bao hiem']
        
        cat_map = {
            'Food': food_kws,
            'Transport': trans_kws,
            'Shopping': shop_kws,
            'Entertainment': ent_kws,
            'Bills': bill_kws
        }
        
        for cat in categories:
            if cat.name.lower() in note_lower:
                suggested_category_id = cat.id
                break
            
            kws = cat_map.get(cat.name)
            if kws:
                for kw in kws:
                    if kw in note_lower:
                        suggested_category_id = cat.id
                        break
                if suggested_category_id:
                    break
                    
        if not suggested_category_id and categories:
            suggested_category_id = categories[0].id
            
        return jsonify({
            'amount': amount,
            'type': tx_type,
            'date': date_parsed,
            'note': note[:100],
            'category_id': suggested_category_id
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500