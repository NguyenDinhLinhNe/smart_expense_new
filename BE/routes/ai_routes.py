import os
import re
from flask import request, jsonify, Blueprint
from flask_jwt_extended import jwt_required, get_jwt_identity
from ml.ai_service import AIService
from datetime import datetime, timedelta
from models.models import db

ai_bp = Blueprint('ai', __name__)
ai_service = AIService()

def format_vnd_py(val):
    try:
        return f"{int(float(val)):,} đ"
    except Exception:
        return f"{val} đ"

@ai_bp.route('/predict', methods=['GET'])
@jwt_required()
def get_predictions():
    try:
        user_id = get_jwt_identity()
        
        prediction = ai_service.predict_next_month_expense(user_id)
        
        if not prediction:
            return jsonify({
                'predicted_expense': 0.0,
                'change_percentage': 0.0,
                'top_category': 'None',
                'top_category_amount': 0.0,
                'category_comparison': [],
                'anomalies': [],
                'alerts': ["Welcome! Please start logging your transactions to unlock AI-powered expense forecasting, anomaly detection, and smart budget advice from your financial assistant."]
            }), 200
        
        trends = ai_service.get_category_trends(user_id)
        
        anomalies = ai_service.detect_anomalies(user_id)
        
        df = ai_service.get_user_transactions_data(user_id)
        expense_df = df[df['type'] == 'expense']
        
        current_month = datetime.now().month
        current_year = datetime.now().year
        
        current_expense = expense_df[
            (expense_df['month'] == current_month) & 
            (expense_df['year'] == current_year)
            ]['amount'].sum()
        
        change_percentage = float(((prediction['predicted_expense'] - current_expense) / current_expense * 100)) if current_expense > 0 else 0.0

        alerts = []
        
        income_df = df[df['type'] == 'income']
        current_income = float(income_df[
            (income_df['month'] == current_month) & 
            (income_df['year'] == current_year)
        ]['amount'].sum())
        
        if anomalies:
            high_anomalies = [a for a in anomalies if a['is_high']]
            if high_anomalies:
                alerts.append(f"Found {len(high_anomalies)} unusually high transactions. Audit your transaction logs to spot discrepancies.")
        
        if prediction['predicted_expense'] > current_expense * 1.2:
            alerts.append(f"Next month's predicted expense is {abs(change_percentage):.0f}% higher than this month. Plan a tighter savings budget.")
            
        if current_income > 0 and current_expense > current_income:
            deficit = current_expense - current_income
            alerts.append(f"CRITICAL: Monthly expenses exceed income (Deficit of -${deficit:.2f}). Tighten your belt immediately!")
            
        elif current_income > 0 and (current_income - current_expense) < (current_income * 0.1):
            balance = current_income - current_expense
            alerts.append(f"WARNING: Remaining balance is very low (only ${balance:.2f}, under 10% of total income). Postpone discretionary purchases.")
            
        from models.models import Budget, Category
        budgets = Budget.query.filter_by(user_id=user_id, month=current_month, year=current_year).all()
        for budget in budgets:
            cat_id = budget.category_id
            cat_budget_amount = float(budget.amount)
            
            cat_expense_amount = float(expense_df[
                (expense_df['month'] == current_month) & 
                (expense_df['year'] == current_year) & 
                (expense_df['category_id'] == cat_id)
            ]['amount'].sum())
            
            if cat_budget_amount > 0 and cat_expense_amount > cat_budget_amount:
                category = Category.query.get(int(cat_id))
                category_name = category.name if category else f"Category #{cat_id}"
                overrun = cat_expense_amount - cat_budget_amount
                alerts.append(f"BUDGET BREACHED: Category '{category_name}' has exceeded its budget by ${overrun:.2f} (Spent ${cat_expense_amount:.2f} / Limit ${cat_budget_amount:.2f}).")
        
        return jsonify({
            'predicted_expense': prediction['predicted_expense'],
            'change_percentage': change_percentage,
            'top_category': prediction.get('top_category'),
            'top_category_amount': prediction.get('top_category_amount', 0),
            'category_comparison': trends,
            'anomalies': anomalies[:5],
            'alerts': alerts
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@ai_bp.route('/recommendations', methods=['GET'])
@jwt_required()
def get_recommendations():
    try:
        user_id = get_jwt_identity()
        
        recommendations = ai_service.analyze_spending_patterns(user_id)
        
        return jsonify({
            'recommendations': recommendations
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@ai_bp.route('/insights', methods=['GET'])
@jwt_required()
def get_insights():
    try:
        user_id = get_jwt_identity()
        
        trends = ai_service.get_category_trends(user_id)
        anomalies = ai_service.detect_anomalies(user_id)
        
        insights = {
            'total_categories': len(trends),
            'fastest_growing': max(trends, key=lambda x: x['change']) if trends else None,
            'fastest_declining': min(trends, key=lambda x: x['change']) if trends else None,
            'anomaly_count': len(anomalies),
            'top_spending_category': max(trends, key=lambda x: x['current']) if trends else None
        }
        
        return jsonify(insights), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def detect_is_vietnamese(message):
    message_lower = message.lower()
    
    accented_chars = ['á', 'à', 'ả', 'ã', 'ạ', 'é', 'è', 'ẻ', 'ẽ', 'ẹ', 'í', 'ì', 'ỉ', 'ĩ', 'ị', 
                      'ó', 'ò', 'ỏ', 'õ', 'ọ', 'ú', 'ù', 'ủ', 'ũ', 'ụ', 'đ', 'ý', 'ỳ', 'ỷ', 'ỹ', 'ỵ',
                      'â', 'ă', 'ê', 'ô', 'ơ', 'ư']
    if any(c in message_lower for c in accented_chars):
        return True
    words = re.findall(r'\b\w+\b', message_lower)
    
    vietnamese_unaccented_words = {
        'chao', 'tieu', 'tien', 'nhap', 'luong', 'tiet', 'kiem', 'ngan', 'sach', 
        'khuyen', 'thuong', 'nhat', 'giup', 'phan', 'tich', 'tai', 'chinh', 'danh', 
        'muc', 'toi', 'muon', 'khoe', 'khong', 'noi', 'tieng', 'viet'
    }
    
    if any(w in vietnamese_unaccented_words for w in words):
        return True
        
    vietnamese_phrases = [
        'chi tieu', 'tieu dung', 'tieu hao', 'tiet kiem', 'ngan sach', 'han muc', 
        'tieu bao nhieu', 'lam sao', 'toi muon', 'cho toi', 'tinh hinh', 'tuyet voi'
    ]
    if any(phrase in message_lower for phrase in vietnamese_phrases):
        return True
        
    return False

@ai_bp.route('/chat', methods=['POST'])
@jwt_required()
def ai_chat():
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data or not data.get('message'):
            return jsonify({'error': 'Message is required'}), 400
            
        message = data.get('message').strip()
        message_lower = message.lower()
        
        is_vietnamese = detect_is_vietnamese(message)
            
        from models.models import User, Category, Transaction, Budget
        user = User.query.get(user_id)
        user_name = user.name if user else "User"
        
        current_month = datetime.now().month
        current_year = datetime.now().year
        
        transactions = Transaction.query.filter_by(user_id=user_id).all()
        
        curr_trans = [t for t in transactions if t.date.month == current_month and t.date.year == current_year]
        
        spent = sum(float(t.amount) for t in curr_trans if t.type == 'expense')
        income = sum(float(t.amount) for t in curr_trans if t.type == 'income')
        
        cat_spent = {}
        for t in curr_trans:
            if t.type == 'expense':
                cat_spent[t.category_id] = cat_spent.get(t.category_id, 0.0) + float(t.amount)
                
        top_cat_name = "None"
        top_cat_spent = 0.0
        if cat_spent:
            top_cat_id = max(cat_spent, key=cat_spent.get)
            top_cat_spent = cat_spent[top_cat_id]
            category = Category.query.get(top_cat_id)
            if category:
                top_cat_name = category.name
                
        budgets = Budget.query.filter_by(user_id=user_id, month=current_month, year=current_year).all()
        total_budget = sum(float(b.amount) for b in budgets)

        api_key = os.getenv("GEMINI_API_KEY")
        if api_key:
            try:
                import google.generativeai as genai
                genai.configure(api_key=api_key)

                if is_vietnamese:

                    budget_details = []
                    overrun_count = 0
                    for b in budgets:
                        cat = Category.query.get(b.category_id)
                        cat_name = cat.name if cat else "Khác"
                        cat_spent_val = sum(float(t.amount) for t in curr_trans if t.type == 'expense' and t.category_id == b.category_id)
                        pct = (cat_spent_val / float(b.amount) * 100) if float(b.amount) > 0 else 0
                        status = "🟢 OK"
                        if pct >= 100:
                            status = "🔴 Vượt hạn mức (Breached)"
                            overrun_count += 1
                        elif pct >= 80:
                                 budget_details.append(f"- {cat_name}: Hạn mức: {format_vnd_py(b.amount)}, Đã tiêu: {format_vnd_py(cat_spent_val)} ({pct:.1f}%) -> Trạng thái: {status}")
                    budget_details_str = "\n".join(budget_details) if budget_details else "Chưa thiết lập ngân sách danh mục nào."

                    anomalies = ai_service.detect_anomalies(user_id)
                    anomalies_list = []
                    for a in anomalies[:5]:
                        anomalies_list.append(f"- Ngày: {a['date'][:10]} | Danh mục: {a['category']} | Số tiền: {format_vnd_py(a['amount'])} (Bất thường: {'Tăng vọt 📈' if a['is_high'] else 'Nhỏ lẻ'})")
                    anomalies_str = "\n".join(anomalies_list) if anomalies_list else "Không phát hiện giao dịch bất thường nào."

                    recs = ai_service.analyze_spending_patterns(user_id)
                    recs_list = []
                    for r in recs:
                        msg = r['message']
                        if "Welcome! Start logging" in msg:
                            msg = "Chào mừng bạn thân yêu! Hãy bắt đầu ghi chép chi tiêu và đặt hạn mức ngân sách để giữ ví an toàn nhé."
                        elif "BUDGET OVERRUN" in msg:
                            cat_match = re.search(r"for '([^']+)'", msg)
                            cat_name = cat_match.group(1) if cat_match else "danh mục"
                            msg = f"Vượt hạn mức chi tiêu cho danh mục '{cat_name}'"
                        elif "BUDGET WARNING" in msg:
                            cat_match = re.search(r"for '([^']+)'", msg)
                            cat_name = cat_match.group(1) if cat_match else "danh mục"
                            msg = f"Cảnh báo hạn mức cho danh mục '{cat_name}'"
                        elif "No active budgets found" in msg:
                            msg = "Không tìm thấy hạn mức ngân sách hoạt động nào."
                        elif "Needs allocation is high" in msg:
                            msg = "Chi tiêu cho nhu cầu thiết yếu đang hơi cao so với thu nhập."
                        elif "Spending is healthy" in msg:
                            msg = "Cơ cấu chi tiêu đang vô cùng lành mạnh và cân đối."
                        recs_list.append(f"- {msg} (Tiết kiệm tiềm năng: {format_vnd_py(r['potential_savings'])}/tháng)")
                    recs_str = "\n".join(recs_list) if recs_list else "Không có gợi ý tiết kiệm cụ thể nào tại thời điểm này."

                    recent_txs = sorted(curr_trans, key=lambda t: t.date, reverse=True)[:10]
                    recent_tx_lines = []
                    for t in recent_txs:
                        cat = Category.query.get(t.category_id)
                        cname = cat.name if cat else "Khác"
                        recent_tx_lines.append(f"- {t.date} | {cname} | {format_vnd_py(t.amount)} | {'Chi tiêu' if t.type == 'expense' else 'Thu nhập'} | {t.note or ''}")
                    recent_tx_str = "\n".join(recent_tx_lines) if recent_tx_lines else "Chưa có giao dịch nào tháng này."

                    cat_breakdown = []
                    for cid, cval in sorted(cat_spent.items(), key=lambda x: x[1], reverse=True):
                        cat = Category.query.get(cid)
                        cname = cat.name if cat else "Khác"
                        pct = (cval / spent * 100) if spent > 0 else 0
                        cat_breakdown.append(f"- {cname}: {format_vnd_py(cval)} ({pct:.1f}% tổng chi)")
                    cat_breakdown_str = "\n".join(cat_breakdown) if cat_breakdown else "Chưa có dữ liệu danh mục."
                    recs_str = "\n".join(recs_list) if recs_list else "Không có gợi ý tiết kiệm cụ thể nào tại thời điểm này."

                    system_instruction = f"""Bạn là **Tri kỷ Tài chính AI** — cố vấn tài chính cá nhân và người bạn đồng hành tin cậy của {user_name} trong ứng dụng Smart Expense Tracker.

QUAN TRỌNG NHẤT:
- Trả lời hoàn toàn bằng TIẾNG VIỆT, không dùng từ tiếng Anh.
- Luôn tham chiếu số liệu THỰC TẾ từ database dưới đây khi trả lời. Không bao giờ bịa số.
- Câu trả lời phải CHÍNH XÁC, CỤ THỂ, có số liệu thực bằng VNĐ.

HÀNH ĐỘNG TỰ ĐỘNG:
1. Ghi chép giao dịch ("ăn trưa 50k", "chi 200k đổ xăng", "nhận lương 15tr"):
[TRANSACTION_ACTION]
{{{{"amount": 50000, "type": "expense", "category_name": "Food", "note": "Ăn trưa"}}}}
[/TRANSACTION_ACTION]
2. Thiết lập ngân sách ("đặt ngân sách ăn uống 2 triệu", "hạn mức shopping 500k"):
[BUDGET_ACTION]
{{{{"category_name": "Food", "amount": 2000000}}}}
[/BUDGET_ACTION]
Danh mục có sẵn: {', '.join([c.name for c in Category.query.all()])}

--- DỮ LIỆU TÀI CHÍNH THỰC TẾ CỦA {user_name} ({current_month}/{current_year}) ---
Tổng chi tiêu: {format_vnd_py(spent)}
Tổng thu nhập: {format_vnd_py(income)}
Dòng tiền: {'+' if income - spent >= 0 else ''}{format_vnd_py(abs(income - spent))} ({'Thặng dư ✅' if income - spent >= 0 else 'Thâm hụt ⚠️'})
Danh mục chi nhiều nhất: {top_cat_name} — {format_vnd_py(top_cat_spent)}

Phân tích chi tiêu theo danh mục:
{cat_breakdown_str}

Ngân sách tháng này:
{budget_details_str}
Số danh mục vượt hạn mức: {overrun_count}

10 giao dịch gần nhất:
{recent_tx_str}

Giao dịch bất thường:
{anomalies_str}

Gợi ý tiết kiệm:
{recs_str}
--- KẾT THÚC DỮ LIỆU ---

NGUYÊN TẮC TRẢ LỜI:
1. Bạn bè, ấm áp, đồng cảm — không phán xét, không cằn nhằn.
2. Phân tích dữ liệu thực, đề xuất kế hoạch cụ thể kèm số liệu VNĐ.
3. Khi người dùng tiêu lố: an ủi ngay ("Bình thường thôi bạn ơi, tụi mình cùng điều chỉnh lại nha! 🤗").
4. Khi đạt mốc tốt: ăn mừng nhiệt tình ("Wow, bạn đang làm rất tốt! 🎉").
5. Dùng Markdown đẹp, emoji ấm áp, cấu trúc rõ ràng.
"""
                else:

                    budget_details = []
                    overrun_count = 0
                    for b in budgets:
                        cat = Category.query.get(b.category_id)
                        cat_name = cat.name if cat else "Other"
                        cat_spent_val = sum(float(t.amount) for t in curr_trans if t.type == 'expense' and t.category_id == b.category_id)
                        pct = (cat_spent_val / float(b.amount) * 100) if float(b.amount) > 0 else 0
                        status = "🟢 OK"
                        if pct >= 100:
                            status = "🔴 Breached"
                            overrun_count += 1
                        elif pct >= 80:
                            status = "🟡 Warning"
                        budget_details.append(f"- {cat_name}: Limit: ${float(b.amount):.2f}, Spent: ${cat_spent_val:.2f} ({pct:.1f}%) -> Status: {status}")
                    budget_details_str = "\n".join(budget_details) if budget_details else "No active category budgets configured."

                    anomalies = ai_service.detect_anomalies(user_id)
                    anomalies_list = []
                    for a in anomalies[:5]:
                        anomalies_list.append(f"- Date: {a['date'][:10]} | Category: {a['category']} | Amount: ${a['amount']:.2f} (Anomaly: {'Spike 📈' if a['is_high'] else 'Minor'})")
                    anomalies_str = "\n".join(anomalies_list) if anomalies_list else "No anomalous transactions detected."

                    recs = ai_service.analyze_spending_patterns(user_id)
                    recs_list = []
                    for r in recs:
                        recs_list.append(f"- {r['message']} (Potential savings: ${r['potential_savings']:.2f}/month)")
                    recs_str = "\n".join(recs_list) if recs_list else "No smart savings recommendations at this time."

                    system_instruction = f"""You are the personal AI Financial Companion and close friend to {user_name}, integrated into the Smart Expense Tracker app.
Your mission is to provide the absolute best, most gentle, and highly personalized financial solutions, spending plans, and budgeting blueprints, while conversing with {user_name} as a warm, comforting, and empathetic friend to ensure they feel incredibly comfortable, relaxed, heard, and supported.

IMPORTANT: The user {user_name} is currently speaking in ENGLISH. You MUST reply 100% in ENGLISH. Under no circumstances should you use any Vietnamese words, characters, or phrases (like "Tri kỷ Tài chính"). Keep your response purely in beautiful, warm English.

You have direct access to {user_name}'s real-time financial stats in our SQLite database:
- User Name: {user_name}
- Current Month/Year: {current_month}/{current_year}
- Total Spent This Month: ${spent:.2f}
- Total Income This Month: ${income:.2f}
- Net Cash Flow (Income - Spent): ${income - spent:.2f}
- Top Spending Category: {top_cat_name} (${top_cat_spent:.2f} spent)
- Active Budgets:
{budget_details_str}
- Number of Over-budget categories: {overrun_count}
- Recent Anomalous Transactions:
{anomalies_str}
- Smart Savings Recommendations:
{recs_str}

Guidelines to deliver maximum comfort and elite companion experience:
1. Persona: Speak as a highly empathetic, warm, caring close friend. You are active-listening, supportive, encouraging, and emotionally intelligent. You never judge, lecture, or scold the user.
2. Solving spending plans: If the user wants a spending plan, budget strategy, or savings advice, you MUST analyze their real-time cashflow, active budgets, anomalies, and top spending category in detail. Then, draft a highly concrete, step-by-step personalized spending and saving blueprint using their real data. Ensure any spending plan request is fully addressed and processed.
3. Milestones & Failures: Celebrate their savings milestones with excitement ("So proud of you! 🎉"). If they overspent or are stressed, comfort them immediately with deep kindness ("Hey, take a deep breath. It happens to the best of us! I've got your back! 🤗").
4. Formatting: Use beautiful Markdown formatting with plenty of spaces, comforting emojis (e.g. 🤗, ✨, ☕, 🌸, 🟢, 💪, 🎉), and clear structure so it feels like a cozy premium reading experience.
"""
                model = genai.GenerativeModel(
                    model_name="gemini-1.5-flash",
                    system_instruction=system_instruction
                )
                
                response_obj = model.generate_content(message)
                reply = response_obj.text
                return jsonify({'response': reply}), 200
                
            except Exception as e:
                import logging
                logging.error(f"Gemini API Error: {str(e)}")

        # ---- Offline rule-based parser ----
        def parse_amount_vn(text):
            """Parse Vietnamese number words and abbreviations into float"""
            t = text.lower().strip()
            patterns = [
                (r'(\d+(?:[\.,]\d+)?)\s*tỷ', 1_000_000_000),
                (r'(\d+(?:[\.,]\d+)?)\s*triệu', 1_000_000),
                (r'(\d+(?:[\.,]\d+)?)\s*tr\b', 1_000_000),
                (r'(\d+(?:[\.,]\d+)?)\s*nghìn', 1_000),
                (r'(\d+(?:[\.,]\d+)?)\s*ngàn', 1_000),
                (r'(\d+(?:[\.,]\d+)?)\s*k\b', 1_000),
                (r'(\d+(?:[\.,]\d+)?)\s*(?:đ|₫|vnd)\b', 1),
                (r'(\d{4,})', 1),
            ]
            for pattern, multiplier in patterns:
                m = re.search(pattern, t)
                if m:
                    try:
                        return float(m.group(1).replace(',', '').replace('.', '')) * multiplier
                    except Exception:
                        pass
            return 0.0

        def detect_category(text, categories):
            """Smart category detection from Vietnamese chat text"""
            tl = text.lower()
            keywords = {
                'food': ['ăn', 'uống', 'cafe', 'cà phê', 'cơm', 'phở', 'bún', 'bánh', 'trà sữa', 'trưa', 'tối', 'sáng', 'bữa', 'nhậu', 'bia', 'đồ ăn', 'nước', 'order'],
                'shopping': ['mua sắm', 'shopping', 'quần áo', 'giày', 'túi', 'thời trang', 'shopee', 'lazada', 'tiki'],
                'transport': ['xăng', 'grab', 'taxi', 'uber', 'đi lại', 'vé', 'bus', 'metro', 'xe'],
                'entertainment': ['giải trí', 'xem phim', 'game', 'netflix', 'spotify', 'du lịch', 'đi chơi', 'karaoke'],
                'health': ['thuốc', 'bệnh viện', 'khám', 'y tế', 'sức khỏe', 'gym', 'spa', 'bác sĩ'],
                'utilities': ['điện', 'nước', 'internet', 'hóa đơn', 'thuê nhà', 'wifi'],
                'education': ['học phí', 'sách', 'khóa học', 'giáo dục', 'học'],
            }
            for cat in categories:
                cname_lower = cat.name.lower()
                if cname_lower in tl:
                    return cat
                for key, kw_list in keywords.items():
                    if key in cname_lower and any(kw in tl for kw in kw_list):
                        return cat
            return None

        is_handled_offline = False
        offline_response = ""

        from models.models import Transaction, Budget, Category

        # 1. DELETE
        if any(kw in message_lower for kw in ['xóa', 'hủy', 'bỏ', 'delete', 'remove']):
            if any(kw in message_lower for kw in ['ngân sách', 'hạn mức', 'budget']):
                cats = Category.query.all()
                found_cat = detect_category(message_lower, cats)
                today = datetime.now()
                if found_cat:
                    Budget.query.filter_by(user_id=user_id, category_id=found_cat.id, month=today.month, year=today.year).delete()
                    db.session.commit()
                    is_handled_offline = True
                    offline_response = f"### 🛡️ Đã Xóa Ngân Sách!\n\nMinh đã xóa ngân sách danh mục `{found_cat.name}` tháng {today.month}/{today.year}. ❌"
                else:
                    last_b = Budget.query.filter_by(user_id=user_id, month=today.month, year=today.year).order_by(Budget.id.desc()).first()
                    if last_b:
                        cat = Category.query.get(last_b.category_id)
                        cname = cat.name if cat else "Khác"
                        Budget.query.filter_by(user_id=user_id, category_id=last_b.category_id, month=today.month, year=today.year).delete()
                        db.session.commit()
                        is_handled_offline = True
                        offline_response = f"### 🛡️ Đã Xóa Ngân Sách!\n\nMinh đã xóa ngân sách mới nhất: danh mục `{cname}`. ❌"
            else:
                val = parse_amount_vn(message_lower)
                tx = (Transaction.query.filter_by(user_id=user_id, amount=val).order_by(Transaction.id.desc()).first()
                      if val > 0 else
                      Transaction.query.filter_by(user_id=user_id).order_by(Transaction.id.desc()).first())
                if tx:
                    cat = Category.query.get(tx.category_id)
                    cname = cat.name if cat else "Khác"
                    old_amt = tx.amount
                    db.session.delete(tx)
                    db.session.commit()
                    is_handled_offline = True
                    offline_response = (
                        f"### 📊 Đã Xóa Giao Dịch!\n\n"
                        f"*   **Số tiền:** `{format_vnd_py(old_amt)}`\n"
                        f"*   **Danh mục:** `{cname}`\n\n"
                        f"✓ Đã xóa thành công! ❌"
                    )
                else:
                    is_handled_offline = True
                    offline_response = "Không tìm thấy giao dịch nào phù hợp! 🤔"

        # 2. UPDATE
        elif any(kw in message_lower for kw in ['sửa', 'cập nhật', 'update', 'edit', 'thay đổi']):
            val = parse_amount_vn(message_lower)
            if val > 0:
                if any(kw in message_lower for kw in ['ngân sách', 'hạn mức', 'budget']):
                    cats = Category.query.all()
                    found_cat = detect_category(message_lower, cats)
                    if found_cat:
                        today = datetime.now()
                        first_day = datetime(today.year, today.month, 1)
                        last_day = (first_day + timedelta(days=32)).replace(day=1) - timedelta(days=1)
                        start_monday = first_day - timedelta(days=first_day.isoweekday() - 1)
                        end_sunday = last_day + timedelta(days=7 - last_day.isoweekday())
                        num_weeks = int((end_sunday - start_monday).days / 7)
                        for w in range(1, num_weeks + 1):
                            existing = Budget.query.filter_by(user_id=user_id, category_id=found_cat.id, month=today.month, year=today.year, week=w).first()
                            if existing:
                                existing.amount = val
                            else:
                                db.session.add(Budget(user_id=user_id, category_id=found_cat.id, amount=val, month=today.month, year=today.year, week=w))
                        db.session.commit()
                        is_handled_offline = True
                        offline_response = (
                            f"### 🛡️ Cập Nhật Ngân Sách Thành Công!\n\n"
                            f"*   **Danh mục:** `{found_cat.name}`\n"
                            f"*   **Hạn mức mới:** `{format_vnd_py(val)}`\n\n"
                            f"✓ Cập nhật thành công! 📝"
                        )
                else:
                    tx = Transaction.query.filter_by(user_id=user_id).order_by(Transaction.id.desc()).first()
                    if tx:
                        old_val = tx.amount
                        tx.amount = val
                        db.session.commit()
                        cat = Category.query.get(tx.category_id)
                        cname = cat.name if cat else "Khác"
                        is_handled_offline = True
                        offline_response = (
                            f"### 📊 Cập Nhật Chi Tiêu Thành Công!\n\n"
                            f"*   **Danh mục:** `{cname}`\n"
                            f"*   **Số tiền cũ:** `{format_vnd_py(old_val)}`\n"
                            f"*   **Số tiền mới:** `{format_vnd_py(val)}`\n\n"
                            f"✓ Cập nhật thành công! 📝"
                        )

        # 3. ADD BUDGET
        elif any(kw in message_lower for kw in ['ngân sách', 'hạn mức', 'budget']):
            val = parse_amount_vn(message_lower)
            if val > 0:
                cats = Category.query.all()
                found_cat = detect_category(message_lower, cats)
                cat_id = found_cat.id if found_cat else (cats[0].id if cats else 1)
                cat_name = found_cat.name if found_cat else "Khác"
                today = datetime.now()
                first_day = datetime(today.year, today.month, 1)
                last_day = (first_day + timedelta(days=32)).replace(day=1) - timedelta(days=1)
                start_monday = first_day - timedelta(days=first_day.isoweekday() - 1)
                end_sunday = last_day + timedelta(days=7 - last_day.isoweekday())
                num_weeks = int((end_sunday - start_monday).days / 7)
                for w in range(1, num_weeks + 1):
                    existing = Budget.query.filter_by(user_id=user_id, category_id=cat_id, month=today.month, year=today.year, week=w).first()
                    if existing:
                        existing.amount = val
                    else:
                        db.session.add(Budget(user_id=user_id, category_id=cat_id, amount=val, month=today.month, year=today.year, week=w))
                db.session.commit()
                # budget summary
                all_budgets = Budget.query.filter_by(user_id=user_id, month=today.month, year=today.year).all()
                total_b = sum(float(b.amount) for b in all_budgets)
                unique_cats = {b.category_id for b in all_budgets}
                is_handled_offline = True
                offline_response = (
                    f"### 🛡️ Thiết Lập Ngân Sách Thành Công!\n\n"
                    f"*   **Danh mục:** `{cat_name}`\n"
                    f"*   **Hạn mức:** `{format_vnd_py(val)}`\n"
                    f"*   **Tháng:** {today.month}/{today.year}\n\n"
                    f"**📊 Tổng ngân sách tháng này (tất cả danh mục): `{format_vnd_py(total_b)}`** (từ {len(unique_cats)} danh mục)\n\n"
                    f"✓ Đã lưu ngân sách vào hệ thống! 🎉"
                )

        # 4. ADD TRANSACTION
        else:
            val = parse_amount_vn(message_lower)
            if val > 0:
                cats = Category.query.all()
                found_cat = detect_category(message_lower, cats)
                cat_id = found_cat.id if found_cat else (cats[0].id if cats else 1)
                cat_name = found_cat.name if found_cat else "Food"
                tx_type = 'income' if any(x in message_lower for x in ['thu nhập', 'lương', 'salary', 'received', 'nhận tiền', 'nạp tiền']) else 'expense'
                new_tx = Transaction(
                    user_id=user_id, category_id=cat_id, amount=val,
                    type=tx_type, note=message[:100], date=datetime.now().date()
                )
                db.session.add(new_tx)
                db.session.commit()
                # build budget summary
                today = datetime.now()
                all_budgets = Budget.query.filter_by(user_id=user_id, month=today.month, year=today.year).all()
                total_b = sum(float(b.amount) for b in all_budgets)
                is_handled_offline = True
                offline_response = (
                    f"### 📊 Ghi Nhận Thành Công!\n\n"
                    f"*   **Số tiền:** `{format_vnd_py(val)}`\n"
                    f"*   **Danh mục:** `{cat_name}`\n"
                    f"*   **Loại:** `{'Thu nhập 🟢' if tx_type == 'income' else 'Chi tiêu 🔴'}`\n"
                    f"*   **Ghi chú:** *\"{message}\"*\n\n"
                    f"**📊 Tổng ngân sách tháng này: `{format_vnd_py(total_b)}`**\n\n"
                    f"✓ Giao dịch đã lưu vào hệ thống thành công! 🎉"
                )

        if is_handled_offline:
            return jsonify({'response': offline_response}), 200
        
        if any(kw in message_lower for kw in ['hi', 'hello', 'chào', 'xin chào', 'greetings', 'bạn là ai', 'who are you', 'help', 'giúp']):

            if is_vietnamese:
                response = f"Chào bạn thân mến **{user_name}**! 🤗 Tôi là **Cố vấn & Tri kỷ Tài chính AI** của bạn đây. Hôm nay của bạn thế nào? \n\nTôi ở đây không chỉ để cùng bạn tối ưu hóa hầu bao mà còn muốn lắng nghe, chia sẻ và đem lại cho bạn cảm giác thoải mái nhất trong cuộc sống! Hãy kể cho tôi nghe mọi điều nhé. ☕✨\n\nBạn có thể hỏi tôi bất cứ điều gì hoặc dùng nhanh các lệnh ấm áp này:\n*   **Xem chi tiêu tháng này:** Gõ *'chi tiêu'* hoặc *'mình tiêu bao nhiêu rồi'* 📊\n*   **Kiểm tra thu nhập:** Gõ *'thu nhập'* 💰\n*   **Nghe lời khuyên tiết kiệm:** Gõ *'tiết kiệm'* hoặc *'tư vấn'* 💡\n*   **Xem hạn mức ngân sách:** Gõ *'ngân sách'* 🛡️"
            else:
                response = f"Hello my dear friend **{user_name}**! 🤗 I am your **AI Financial Companion & Soulmate**. How are you feeling today?\n\nI am here not just to crunch numbers, but to listen, chat, and make you feel completely comfortable and supported. Tell me anything! ☕✨\n\nYou can talk about anything or ask me to check on your figures:\n*   **Analyze monthly spending:** Type *'spent'* or *'expenses'* 📊\n*   **Check income:** Type *'income'* or *'salary'* 💰\n*   **Get cozy savings advice:** Type *'save'* or *'saving advice'* 💡\n*   **Verify budgets:** Type *'budget'* or *'limit'* 🛡️"

        elif any(kw in message_lower for kw in ['tiết kiệm', 'khuyên', 'tư vấn', 'lời khuyên', 'save', 'saving', 'advice', 'kế hoạch', 'plan', 'tiêu dùng', 'phân bổ']):

            recs = ai_service.analyze_spending_patterns(user_id)
            recs_text = ""
            for r in recs:
                msg = r['message']
                if is_vietnamese:

                    if "Welcome! Start logging" in msg:
                        msg = "Chào mừng bạn thân yêu! Hãy bắt đầu ghi chép chi tiêu và đặt hạn mức ngân sách để mình giúp bạn tối ưu tiết kiệm tới 15% thu nhập nha."
                    elif "BUDGET OVERRUN" in msg:
                        cat_match = re.search(r"for '([^']+)'", msg)
                        cat_name = cat_match.group(1) if cat_match else "danh mục"
                        msg = f"🚨 VƯỢT HẠN MỨC: Hạng mục **'{cat_name}'** đã chi tiêu lố ngân sách. Tụi mình cùng tạm hoãn mua sắm cho mục này nha."
                    elif "BUDGET WARNING" in msg:
                        cat_match = re.search(r"for '([^']+)'", msg)
                        cat_name = cat_match.group(1) if cat_match else "danh mục"
                        msg = f"⚠️ CẢNH BÁO HẠN MỨC: Chi tiêu cho **'{cat_name}'** đã sắp chạm trần ngân sách rồi nè."
                    elif "No active budgets found" in msg:
                        msg = "Tháng này tụi mình chưa lập hạn mức chi tiêu nào nè. Thiết lập ngay để giữ ví chắc chắn hơn nha!"
                    elif "Needs allocation is high" in msg:
                        msg = "Chi phí thiết yếu đang hơi cao so với thu nhập, tụi mình cùng cân nhắc tối ưu lại nha."
                    elif "Spending is healthy" in msg:
                        msg = "Tuyệt vời ông mặt trời! Cơ cấu chi tiêu của bạn đang vô cùng cân đối và lành mạnh."
                
                recs_text += f"*   {msg} *(Tiết kiệm tiềm năng: {format_vnd_py(r['potential_savings'])}/tháng)*\n"
            
            if is_vietnamese:
                if income > 0:
                    plan_text = f"☘️ **Kế hoạch phân bổ Tiêu dùng & Tiết kiệm của riêng bạn dựa trên thu nhập ({format_vnd_py(income)}):**\n" \
                                f"*   **50% Thiết yếu (tối đa {format_vnd_py(income * 0.5)}):** Chi phí sống bắt buộc (Hóa đơn cố định, ăn uống cơ bản, đi lại). *(Đã dùng: {format_vnd_py(spent)})*\n" \
                                f"*   **30% Sở thích cá nhân (tối đa {format_vnd_py(income * 0.3)}):** Chiêu đãi bản thân, mua sắm giải trí, cà phê thư giãn sau giờ làm.\n" \
                                f"*   **20% Tích lũy (tối thiểu {format_vnd_py(income * 0.2)}):** Bỏ túi tiết kiệm dài hạn hoặc Quỹ bình yên phòng thân.\n\n"
                else:
                    plan_text = f"☘️ **Quy tắc phân bổ 50/30/20 thảnh thơi:**\n" \
                                f"*   **50% Thiết yếu:** Chi phí sống thiết thực (nhà cửa ấm cúng, ăn uống đủ chất).\n" \
                                f"*   **30% Sở thích cá nhân:** Chiêu đãi bản thân, giải tỏa căng thẳng (cafe, xem phim).\n" \
                                f"*   **20% Tích lũy:** Cho tương lai thảnh thơi và quỹ bình yên an tâm.\n\n"

                response = f"### 💡 Lời Khuyên & Kế Hoạch Tài Chính Từ Bạn Thân AI\n\n" \
                           f"Dựa trên thói quen của bạn, mình đã thiết lập một lộ trình tiêu dùng thảnh thơi nhất nè:\n\n" \
                           f"{recs_text}\n" \
                           f"{plan_text}" \
                           f"👉 *Mẹo nhỏ:* Hãy thử gõ **'ngân sách'** để mình rà soát xem các danh mục chi tiêu của bạn có đang nằm trong giới hạn an toàn không nhé! 🤗"
            else:
                if income > 0:
                    plan_text = f"☘️ **Your Custom 50/30/20 Spending & Savings Plan based on your income (${income:.2f}):**\n" \
                                f"*   **50% Essential Needs (max ${income * 0.5:.2f}):** Fixed bills, essential groceries, transport. *(Currently spent: ${spent:.2f})*\n" \
                                f"*   **30% Personal Wants (max ${income * 0.3:.2f}):** Coffee, movies, treating yourself kindly after work.\n" \
                                f"*   **20% Savings Goals (min ${income * 0.2:.2f}):** Building your cozy Peace Fund or long-term investments.\n\n"
                else:
                    plan_text = f"☘️ **Cozy 50/30/20 Allocation Rule:**\n" \
                                f"*   **50% Needs:** Essential living. Make sure you are eating well and keeping a warm, safe home.\n" \
                                f"*   **30% Wants:** Self-care! Enjoy movies, coffee with friends, and small gifts to reward yourself.\n" \
                                f"*   **20% Savings:** For your peace of mind and secure future dreams.\n\n"

                response = f"### 💡 Friendly AI Savings & Lifestyle Advice\n\n" \
                           f"Based on your patterns, here are a few gentle suggestions to make your life happier and stress-free:\n\n" \
                           f"{recs_text}\n" \
                           f"{plan_text}" \
                           f"👉 *Note:* You can type **'budget'** to check if your category allocations are healthy and safe! 🤗"

        elif any(kw in message_lower for kw in ['chi tiêu', 'đã tiêu', 'tiêu hao', 'tiêu bao nhiêu', 'spent', 'spending', 'expense']):

            cash_flow = income - spent
            if is_vietnamese:
                cash_flow_status = f"Dòng tiền thặng dư **+{format_vnd_py(cash_flow)}** (Tuyệt vời quá bạn ơi! Bạn đang làm rất tốt! 🎉)" if cash_flow >= 0 else f"Dòng tiền đang tạm thời thâm hụt nhẹ **-{format_vnd_py(abs(cash_flow))}** (Đừng lo lắng nhé bạn thân mến, tụi mình sẽ cùng tìm cách cân bằng lại mà! 🤗)"
                response = f"### 📊 Báo Cáo Chi Tiêu Của Bạn Thân Yêu ({current_month}/{current_year})\n\n" \
                           f"Tụi mình cùng nhìn lại một chút số liệu tháng này nha:\n\n" \
                           f"*   **Tổng đã chi tiêu:** `{format_vnd_py(spent)}`\n" \
                           f"*   **Tổng thu nhập đã nhận:** `{format_vnd_py(income)}`\n" \
                           f"*   **Dòng tiền hiện tại:** {cash_flow_status}\n" \
                           f"*   **Danh mục tiêu hao lớn nhất:** *{top_cat_name}* (`{format_vnd_py(top_cat_spent)}`)\n\n" \
                           f"💡 *Gợi ý nhỏ:* Đừng quá khắt khe với bản thân nha. Bạn có thể gõ *'tiết kiệm'* để cùng mình lên một kế hoạch phân bổ nhẹ nhàng chuẩn 50/30/20 nhé! ✨"
            else:
                cash_flow_status = f"Surplus of **+${cash_flow:.2f}** (So proud of you! Keep it up! 🎉)" if cash_flow >= 0 else f"Deficit of **-${abs(cash_flow):.2f}** (Hey, don't worry! We will adjust things gently together! 🤗)"
                response = f"### 📊 Monthly Spending Breakdown for {datetime.now().strftime('%B %Y')}\n\n" \
                           f"Let's review how we are doing this month, my friend:\n\n" \
                           f"*   **Total Spent:** `${spent:.2f}`\n" \
                           f"*   **Total Income:** `${income:.2f}`\n" \
                           f"*   **Net Cash Flow:** {cash_flow_status}\n" \
                           f"*   **Top Spending Category:** *{top_cat_name}* (`${top_cat_spent:.2f}`)\n\n" \
                           f"💡 *Cozy Note:* Be kind to yourself! Ask me for *'savings advice'* to see how we can smoothly balance things out! ✨"
 
        elif any(kw in message_lower for kw in ['ngân sách', 'hạn mức', 'budget', 'limit', 'limits']):

            budget_details = ""
            overrun_count = 0
            
            for b in budgets:
                cat = Category.query.get(b.category_id)
                cat_name = cat.name if cat else "Other"
                
                cat_spent_val = sum(float(t.amount) for t in curr_trans if t.type == 'expense' and t.category_id == b.category_id)
                pct = (cat_spent_val / float(b.amount) * 100) if float(b.amount) > 0 else 0
                
                status_emoji = "🟢 Đang kiểm soát tốt"
                if pct >= 100:
                    status_emoji = "🔴 Vượt hạn mức chút xíu (Đừng buồn nhé, tụi mình điều chỉnh sau nha! 🤗)"
                    overrun_count += 1
                elif pct >= 80:
                    status_emoji = "🟡 Sắp chạm trần rồi nè"
                
                budget_details += f"*   **{cat_name}:** Chi `{format_vnd_py(cat_spent_val)}` / Hạn mức `{format_vnd_py(float(b.amount))}` ({pct:.1f}%) -> {status_emoji}\n"
                
            if not budgets:
                budget_details = "*Bạn chưa thiết lập hạn mức nào cho tháng này. Muốn mình gợi ý lập ngân sách cho dễ quản lý không?*" if is_vietnamese else "*No limits configured for this month. Want me to help you set up budget goals?*"
                
            if is_vietnamese:
                alert_text = f"🚨 Cảnh báo: Tụi mình có **{overrun_count} danh mục** tiêu lố ngân sách một tí." if overrun_count > 0 else "✅ Tuyệt vời ông mặt trời! Bạn đang giữ ví rất chắc luôn."
                response = f"### 🛡️ Nhật Ký Ngân Sách Tháng {current_month}/{current_year}\n\n" \
                           f"*   **Tổng ngân sách bảo vệ:** `{format_vnd_py(total_budget)}`\n" \
                           f"*   **Trạng thái:** {alert_text}\n\n" \
                           f"**Chi tiết ngân sách từng hạng mục:**\n{budget_details}"
            else:
                alert_text = f"🚨 Note: We have **{overrun_count} category/categories** slightly over budget." if overrun_count > 0 else "✅ Brilliant! Everything is perfectly within limits."
                response = f"### 🛡️ Your Budget Shield Status ({datetime.now().strftime('%B %Y')})\n\n" \
                           f"*   **Total Protected Budget:** `${total_budget:.2f}`\n" \
                           f"*   **Status:** {alert_text}\n\n" \
                           f"**Budget Details:**\n{budget_details}"
 
        elif any(kw in message_lower for kw in ['danh mục cao nhất', 'chi nhiều nhất', 'top category', 'highest', 'cao nhất']):

            if top_cat_spent > 0:
                if is_vietnamese:
                    response = f"### 🏆 Hạng Mục Bạn Chi Tiêu Nhiều Nhất\n\n" \
                               f"Tháng này, bạn đã dành nhiều tình yêu thương tài chính nhất cho danh mục **{top_cat_name}** với tổng số tiền là **{format_vnd_py(top_cat_spent)}**.\n\n" \
                               f"💡 *Tâm sự nhỏ:* Nếu hạng mục này đem lại niềm vui to lớn và giá trị đích thực cho bạn thì hoàn toàn xứng đáng nhé! Nhưng nếu muốn tích lũy thêm, tụi mình có thể đặt hạn mức nhỏ hơn một chút cho **{top_cat_name}** trong tháng sau nè! ✨"
                else:
                    response = f"### 🏆 Top Spending Category\n\n" \
                               f"This month, your heart and wallet went most towards **{top_cat_name}** with a total of **${top_cat_spent:.2f}**.\n\n" \
                               f"💡 *Friendly Tip:* If this category brought you genuine joy and comfort, it's absolutely worth it! But if you're looking to save a bit more next month, we can gently set a tiny budget cap for **{top_cat_name}** together! ✨"
 
        elif any(kw in message_lower for kw in ['bất thường', 'anomaly', 'anomalies', 'unusual', 'spikes']):

            anomalies = ai_service.detect_anomalies(user_id)
            anom_text = ""
            for a in anomalies[:5]:
                anom_text += f"*   Ngày `{a['date'][:10]}`: Chi **{format_vnd_py(a['amount'])}** ở danh mục *{a['category']}* (Bất thường: {'Tăng vọt 📈' if a['is_high'] else 'Nhỏ lẻ'})\n"
                
            if not anomalies:
                anom_text = "*Tuyệt vời quá! Mình không phát hiện giao dịch bất thường nào luôn. Chi tiêu của bạn vô cùng ngăn nắp và ổn định!*" if is_vietnamese else "*Superb! No unusual spikes detected. Your transactions are beautifully organized!*"
                
            if is_vietnamese:
                response = f"### 🚨 Rà Soát Chi Tiêu Bất Thường Cùng AI\n\n" \
                           f"Mình đã rà soát lại nhật ký để giúp bạn an tâm tuyệt đối nè:\n\n" \
                           f"{anom_text}"
            else:
                response = f"### 🚨 AI Spending Anomaly Check\n\n" \
                           f"I ran a quick check across your logs to ensure everything is perfectly safe and sound:\n\n" \
                           f"{anom_text}"
 
        else:

            if is_vietnamese:
                response = f"### 🧠 Tâm Sự Tài Chính Cùng Người Bạn AI\n\n" \
                           f"Với tư cách là một người bạn tri kỷ luôn đồng hành bên bạn, đây là các nguyên tắc cốt lõi giúp bạn thảnh thơi tài chính nhất nè:\n\n" \
                           f"1. **Bình yên tâm hồn trước hết:** Luôn giữ một khoản tích lũy nhỏ (Quỹ bình yên/Quỹ khẩn cấp) tương đương 3 tháng sinh hoạt phí. Có nó, bạn sẽ luôn thấy an tâm và tự tin trong mọi hoàn cảnh.\n" \
                           f"2. **Giải phóng những gánh lo:** Ưu tiên dọn sạch các khoản nợ lãi cao để đầu óc thảnh thơi sáng tạo bạn nhé.\n" \
                           f"3. **Tích lũy tự động nhẹ nhàng:** Trích ra một phần nhỏ thu nhập mỗi tháng (ví dụ 10%) cất đi ngay khi nhận lương. Xem như trả công cho bản thân tương lai!\n" \
                           f"4. **Hãy yêu thương và nuông chiều bản thân:** Luôn dành ra một phần ngân sách nhỏ để làm những việc mình thích. Cuộc sống cần có niềm vui và sự thoải mái mới trọn vẹn chứ, đúng không nào! 🤗\n\n" \
                           f"👉 *Mẹo nhỏ:* Hãy gõ **'chi tiêu'**, **'ngân sách'** hoặc **'tiết kiệm'** bất cứ lúc nào để xem phân tích tài chính cá nhân của riêng bạn nhé!"
            else:
                response = f"### 🧠 Financial Heart-to-Heart with AI Companion\n\n" \
                           f"As your supportive friend and wealth companion, here are a few gentle pillars for your peace of mind:\n\n" \
                           f"1. **Peace of Mind First:** Always keep a tiny savings pocket (your Peace Fund) of about 3 months of expenses. Knowing it's there gives you incredible security and comfort.\n" \
                           f"2. **Clear the Heavy Baggage:** Prioritize paying down high-interest debts to set your mind free.\n" \
                           f"3. **Automate Cozy Savings:** Pay yourself first by setting aside a small percentage (e.g. 10%) right away. Your future self will thank you!\n" \
                           f"4. **Treat Yourself Kindly:** Never forget to budget a little for things that make you happy. You deserve joy and a comfortable journey! 🤗\n\n" \
                           f"👉 *Note:* You can type **'spent'**, **'budget'**, or **'save'** at any time to inspect your custom statistics!"

        return jsonify({'response': response}), 200
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500