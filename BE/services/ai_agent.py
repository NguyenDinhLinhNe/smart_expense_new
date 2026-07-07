import os
import re
import json
from datetime import datetime, timedelta
import numpy as np
import google.generativeai as genai
from models.models import db, User, Transaction, Category, Budget
from langgraph.graph import StateGraph, END

# Define local RAG Knowledge Base - Vietnamese Personal Finance Guidelines
RAG_DOCUMENTS = [
    "Kế hoạch 50/30/20: Phân bổ 50% thu nhập cho nhu cầu thiết yếu (nhà cửa, ăn uống, di chuyển, hóa đơn điện nước internet), 30% cho sở thích cá nhân (mua sắm, giải trí, cafe, du lịch), và 20% cho tiết kiệm hoặc trả nợ. Đây là quy tắc ngân sách phổ biến nhất thế giới.",
    "Tiết kiệm tối ưu: Duy trì một quỹ khẩn cấp tương đương 3-6 tháng chi phí sinh hoạt thiết yếu để phòng ngừa rủi ro như mất việc, ốm đau, tai nạn. Không nên đụng vào quỹ này trừ tình huống thực sự khẩn cấp.",
    "Chi tiêu thông minh: Áp dụng quy tắc 24 giờ - trước khi mua bất kỳ thứ gì không thiết yếu trên 500.000đ, hãy chờ 24 giờ để tránh mua sắm bốc đồng. Thống kê cho thấy 68% người mua sắm từ bỏ ý định sau 24 giờ.",
    "Đầu tư cơ bản tại Việt Nam: Phân bổ tiền nhàn rỗi theo thứ tự ưu tiên: (1) Gửi tiết kiệm ngân hàng lãi suất cao, (2) Mua vàng SJC tích lũy dài hạn, (3) Đầu tư chứng khoán (VN-Index) nếu am hiểu thị trường, (4) Bất động sản khi có đủ vốn. Không bao giờ đầu tư tiền vay.",
    "Quản lý hóa đơn: Thanh toán tất cả hóa đơn cố định (điện, nước, internet, điện thoại, tiền nhà) vào ngày 1-5 hàng tháng để tránh quên và phát sinh phí phạt. Thiết lập thanh toán tự động qua ngân hàng nếu có thể.",
    "Giảm chi phí ăn uống: Lên kế hoạch bữa ăn hàng tuần, mua sắm tại chợ truyền thống hoặc siêu thị thay vì tiện lợi, hạn chế order đồ ăn online vì phí giao hàng và giá cao hơn 20-40%. Nấu ăn tại nhà giúp tiết kiệm 40-60% chi phí ăn uống.",
    "Xử lý nợ thông minh: Ưu tiên trả nợ lãi suất cao nhất trước (thẻ tín dụng thường 20-30%/năm, vay tiêu dùng 15-25%/năm). Không vay nặng lãi. Không vay tiền để đầu tư hoặc mua hàng xa xỉ.",
    "Tăng thu nhập bổ sung: Khai thác kỹ năng cá nhân để có nguồn thu nhập thêm: dạy kèm, freelance, bán hàng online, cho thuê tài sản. Thu nhập thêm 2-5 triệu/tháng có thể tăng tốc tiết kiệm đáng kể.",
    "Bảo hiểm cần thiết: Mua bảo hiểm nhân thọ và bảo hiểm sức khỏe nếu chưa có. Chi phí bảo hiểm không nên vượt quá 10% thu nhập. Bảo hiểm y tế bắt buộc tại Việt Nam đã bao phủ 80% chi phí điều trị cơ bản.",
    "Tâm lý tài chính: Tránh so sánh chi tiêu với người khác. Xác định rõ mục tiêu tài chính cá nhân (mua nhà, nghỉ hưu sớm, du lịch) và lập timeline cụ thể. Ghi chép chi tiêu hàng ngày giúp tăng ý thức và giảm chi tiêu lãng phí 15-20%.",
    "Mua sắm thông minh: Tận dụng các đợt sale lớn (11.11, 12.12, Tết) để mua hàng thiết yếu với giá tốt. So sánh giá trên nhiều nền tảng (Shopee, Lazada, Tiki) trước khi mua. Dùng mã giảm giá và cashback từ các ví điện tử (MoMo, ZaloPay, VNPay).",
    "Lương tháng 13 và thưởng: Sử dụng lương tháng 13 và các khoản thưởng để tăng tốc thanh toán nợ, bổ sung quỹ khẩn cấp hoặc đầu tư dài hạn, thay vì tiêu hết vào mua sắm và giải trí.",
    "Phân tích chi tiêu bất thường: Nếu chi tiêu tháng này tăng đột biến so với trung bình 3 tháng trước, hãy rà soát lại từng khoản. Thường do tiệc tùng, sửa chữa đột xuất hoặc mua sắm bốc đồng. Xác định nguyên nhân để tránh lặp lại.",
    "Tiết kiệm tự động: Thiết lập chuyển khoản tự động vào tài khoản tiết kiệm riêng ngay khi nhận lương (trước khi tiêu). Nguyên tắc: Tiết kiệm TRƯỚC, tiêu SAU với số tiền còn lại. Mục tiêu tối thiểu 10% thu nhập mỗi tháng.",
    "Tài chính cặp đôi và gia đình: Thảo luận mở về tiền bạc với người thân. Lập ngân sách gia đình chung, xác định ai quản lý khoản nào. Duy trì tài khoản cá nhân riêng để có sự tự chủ tài chính nhất định.",
]

def get_embedding(text, api_key):
    try:
        if api_key:
            os.environ["GOOGLE_API_KEY"] = api_key
        genai.configure(api_key=api_key)
        res = genai.embed_content(
            model="models/embedding-001",
            content=text,
            task_type="retrieval_document"
        )
        return res['embedding']
    except Exception as e:
        print("Embedding error:", e)
        return None

def retrieve_rag_context(query, api_key):
    """Retrieve the most relevant financial advice document from local vector space using RAG"""
    query_emb = get_embedding(query, api_key)
    if not query_emb:
        return ""
        
    best_doc = ""
    best_sim = -1.0
    
    for doc in RAG_DOCUMENTS:
        doc_emb = get_embedding(doc, api_key)
        if not doc_emb:
            continue
        # Cosine similarity
        sim = np.dot(query_emb, doc_emb) / (np.linalg.norm(query_emb) * np.linalg.norm(doc_emb))
        if sim > best_sim:
            best_sim = sim
            best_doc = doc
            
    if best_sim > 0.6:  # Similarity threshold
        return f"\n[RAG Knowledge retrieved]: {best_doc}\n"
    return ""

def call_model_node(state):
    """LangGraph node: calls the LLM with database context & RAG documents"""
    messages = state['messages']
    user_id = state['user_id']
    api_key = state['api_key']
    categories_str = state['categories_str']
    context_data = state['context_data']
    
    last_user_message = messages[-1]['content']
    
    # 1. Retrieve RAG context if query requests advice
    rag_context = ""
    if any(kw in last_user_message.lower() for kw in ['khuyên', 'tư vấn', 'kế hoạch', 'tiết kiệm', 'advice', 'plan', 'save']):
        rag_context = retrieve_rag_context(last_user_message, api_key)
        
    # 2. Build full prompt
    system_instruction = f"""Bạn là một Cố vấn kiêm Tri kỷ Tài chính AI cá nhân.
Bạn hỗ trợ quản lý chi tiêu và thiết lập ngân sách dựa trên số liệu thực tế của cơ sở dữ liệu SQLite dưới đây:
{context_data}
{rag_context}

HÀNH ĐỘNG GHI CHÉP GIAO DỊCH VÀ THIẾT LẬP NGÂN SÁCH TỰ ĐỘNG:
1. Nếu người dùng muốn ghi chép giao dịch (ví dụ: "ăn trưa 50k", "tiêu 100k mua sắm"), bạn PHẢI đính kèm khối:
[TRANSACTION_ACTION]
{{
  "amount": 50000,
  "type": "expense",
  "category_name": "Food",
  "note": "Ăn trưa"
}}
[/TRANSACTION_ACTION]
2. Nếu người dùng muốn đặt ngân sách (ví dụ: "cài ngân sách ăn uống 2 triệu"), bạn PHẢI đính kèm khối:
[BUDGET_ACTION]
{{
  "category_name": "Food",
  "amount": 2000000
}}
[/BUDGET_ACTION]
Hãy chọn category_name phù hợp nhất từ danh sách: {categories_str}.
"""
    
    if api_key:
        os.environ["GOOGLE_API_KEY"] = api_key
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(
        model_name="gemini-1.5-flash",
        system_instruction=system_instruction
    )
    
    response = model.generate_content(last_user_message)
    reply_text = response.text
    
    state['response'] = reply_text
    
    # Detect action blocks
    tx_match = re.search(r'\[TRANSACTION_ACTION\]([\s\S]*?)\[\/TRANSACTION_ACTION\]', reply_text)
    bg_match = re.search(r'\[BUDGET_ACTION\]([\s\S]*?)\[\/BUDGET_ACTION\]', reply_text)
    
    if tx_match:
        state['action_detected'] = ('transaction', tx_match.group(1).strip())
    elif bg_match:
        state['action_detected'] = ('budget', bg_match.group(1).strip())
        
    return state

def execute_tools_node(state):
    """LangGraph node: executes database operations automatically"""
    action = state.get('action_detected')
    user_id = state['user_id']
    
    if not action:
        return state
        
    action_type, json_str = action
    try:
        data = json.loads(json_str)
        categories = Category.query.all()
        found_cat = next((c for c in categories if c.name.lower() in data['category_name'].lower()), None)
        cat_id = found_cat.id if found_cat else (categories[0].id if categories else 1)
        
        if action_type == 'transaction':
            new_tx = Transaction(
                user_id=user_id,
                category_id=cat_id,
                amount=float(data['amount']),
                type=data.get('type', 'expense'),
                note=data.get('note', '')[:100],
                date=datetime.now().date()
            )
            db.session.add(new_tx)
            db.session.commit()
            state['action_executed'] = True
            
            # Format clean success message to prepend to response
            success_msg = f"\n\n[TRANSACTION_ACTION]\n{json_str}\n[/TRANSACTION_ACTION]"
            state['response'] += success_msg
            
        elif action_type == 'budget':
            today = datetime.now()
            first_day = datetime(today.year, today.month, 1)
            last_day = (first_day + timedelta(days=32)).replace(day=1) - timedelta(days=1)
            start_monday = first_day - timedelta(days=first_day.isoweekday() - 1)
            end_sunday = last_day + timedelta(days=7 - last_day.isoweekday())
            num_weeks = int((end_sunday - start_monday).days / 7)
            for w in range(1, num_weeks + 1):
                existing = Budget.query.filter_by(
                    user_id=user_id,
                    category_id=cat_id,
                    month=today.month,
                    year=today.year,
                    week=w
                ).first()
                if existing:
                    existing.amount = float(data['amount'])
                else:
                    new_b = Budget(
                        user_id=user_id,
                        category_id=cat_id,
                        amount=float(data['amount']),
                        month=today.month,
                        year=today.year,
                        week=w
                    )
                    db.session.add(new_b)
            db.session.commit()
            state['action_executed'] = True
            
            success_msg = f"\n\n[BUDGET_ACTION]\n{json_str}\n[/BUDGET_ACTION]"
            state['response'] += success_msg
            
    except Exception as e:
        print("Failed to auto-execute action in tools node:", e)
        db.session.rollback()
        
    return state

def should_continue(state):
    if state.get('action_detected'):
        return "execute_tools"
    return END

# Build the Graph
workflow = StateGraph(dict)

workflow.add_node("call_model", call_model_node)
workflow.add_node("execute_tools", execute_tools_node)

workflow.set_entry_point("call_model")
workflow.add_conditional_edges(
    "call_model",
    should_continue,
    {
        "execute_tools": "execute_tools",
        END: END
    }
)
workflow.add_edge("execute_tools", END)

agent_graph = workflow.compile()

def run_ai_agent(user_message, user_id, api_key, categories_str, context_data):
    """Helper method to run the LangGraph workflow"""
    initial_state = {
        'messages': [{'role': 'user', 'content': user_message}],
        'user_id': user_id,
        'api_key': api_key,
        'categories_str': categories_str,
        'context_data': context_data,
        'response': "",
        'action_detected': None,
        'action_executed': False
    }
    
    final_state = agent_graph.invoke(initial_state)
    return final_state['response']
