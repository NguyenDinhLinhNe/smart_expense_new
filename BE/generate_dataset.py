import json
import random

# Danh mục chi tiêu & thu nhập
categories = ["Ăn uống", "Di chuyển", "Mua sắm", "Giải trí", "Hóa đơn", "Sức khỏe", "Giáo dục", "Lương", "Làm thêm", "Đầu tư"]
notes = {
    "Ăn uống": ["Ăn trưa văn phòng", "Cà phê Starbucks", "Ăn tối cùng gia đình", "Mua trà sữa", "Bánh mì ăn sáng"],
    "Di chuyển": ["Đổ xăng xe máy", "Đi GrabCar", "Thanh toán vé xe buýt", "Bảo dưỡng xe máy", "Tiền gửi xe"],
    "Mua sắm": ["Mua quần áo mới", "Sắm đồ dùng gia đình", "Mua điện thoại mới", "Đi siêu thị BigC"],
    "Giải trí": ["Xem phim rạp CGV", "Đăng ký Netflix", "Đi hát Karaoke", "Mua game Steam"],
    "Hóa đơn": ["Đóng tiền điện", "Tiền nước tháng này", "Cước Internet", "Tiền thuê nhà"],
    "Lương": ["Nhận lương tháng", "Tiền thưởng dự án", "Lương cứng"],
    "Làm thêm": ["Thu nhập từ viết lách", "Dạy kèm tiếng Anh", "Thiết kế logo freelancer"]
}

# 1. Các mẫu hội thoại Text-to-Action (Ghi chép giao dịch & Ngân sách tự động)
action_templates = [
    # Thêm chi tiêu
    {
        "user": [
            "Hôm nay mình tiêu {amount}đ cho {note}",
            "Ghi lại chi tiêu {note} hết {amount} đồng",
            "Mới thanh toán {amount} cho {note}",
            "Vừa tiêu {amount} vnd làm {note}",
            "Ăn uống {note} hết {amount}k"
        ],
        "category_map": {
            "Ăn uống": "Eating", "Di chuyển": "Transport", "Mua sắm": "Shopping", 
            "Giải trí": "Entertainment", "Hóa đơn": "Bills", "Sức khỏe": "Healthcare"
        },
        "type": "expense"
    },
    # Thêm thu nhập
    {
        "user": [
            "Lương tháng này về {amount}đ",
            "Vừa nhận được {amount} tiền {note}",
            "Thu nhập từ {note} được {amount} đồng",
            "Mới có {amount} từ {note}",
            "Nhận {amount}k tiền {note}"
        ],
        "category_map": {
            "Lương": "Salary", "Làm thêm": "Freelance", "Đầu tư": "Investment"
        },
        "type": "income"
    }
]

# 2. Các câu hỏi tư vấn tài chính chung (như ChatGPT / Claude)
general_advices = [
    {
        "q": "Làm thế nào để quản lý tài chính cá nhân tốt hơn?",
        "a": "Để quản lý tài chính cá nhân hiệu quả, bạn nên áp dụng quy tắc 50/30/20:\n- **50% cho nhu cầu thiết yếu** (Tiền nhà, ăn uống, hóa đơn).\n- **30% cho sở thích cá nhân** (Giải trí, mua sắm, du lịch).\n- **20% cho tích lũy** (Tiết kiệm, quỹ khẩn cấp, đầu tư).\nHãy tập thói quen ghi chép mọi giao dịch hàng ngày trong ứng dụng Smart Expense để theo dõi dòng tiền dễ dàng nhất."
    },
    {
        "q": "Tại sao tôi luôn hết tiền trước cuối tháng?",
        "a": "Tình trạng này xảy ra do bạn gặp phải hiện tượng 'lạm phát lối sống' hoặc chưa thiết lập ngân sách rõ ràng. Để khắc phục:\n1. **Đặt hạn mức chi tiêu** cho từng danh mục ở tab 'Ngân sách'.\n2. **Phân biệt Nhu cầu và Mong muốn** trước khi thanh toán.\n3. **Tự động tiết kiệm** ngay khi nhận lương trước khi chi tiêu."
    },
    {
        "q": "Quỹ khẩn cấp là gì và nên tích lũy bao nhiêu?",
        "a": "Quỹ khẩn cấp là khoản tiền dự phòng dành riêng cho các sự kiện bất ngờ (thất nghiệp, ốm đau, sửa xe). Bạn nên tích lũy khoản tiền tương đương từ **3 đến 6 tháng chi phí sinh hoạt thiết yếu** của mình để đảm bảo an toàn tài chính."
    },
    {
        "q": "Làm sao để tiết kiệm tiền khi thu nhập thấp?",
        "a": "Với thu nhập thấp, bạn vẫn có thể tiết kiệm bằng các bước:\n- **Tiết kiệm trước, chi tiêu sau:** Trích ra 5-10% thu nhập ngay khi nhận.\n- **Cắt giảm chi phí ẩn:** Hủy các gói đăng ký không dùng, tự nấu ăn ở nhà.\n- **Sử dụng ứng dụng ghi chép:** Theo dõi từng khoản chi nhỏ nhất để biết tiền trôi đi đâu."
    },
    {
        "q": "Có nên đầu tư khi chưa có nhiều tiền tiết kiệm?",
        "a": "Trước khi đầu tư, bạn cần ưu tiên xây dựng **Quỹ khẩn cấp** và **Thanh toán các khoản nợ có lãi suất cao**. Khi đã có quỹ phòng vệ cơ bản, bạn có thể bắt đầu đầu tư với số tiền nhỏ (như quỹ mở, chứng chỉ quỹ) để tận dụng lãi kép."
    }
]

dataset = []

# Sinh dữ liệu tự động
# 1. Sinh các mẫu hành động (Text-to-Action)
for i in range(300):
    template = random.choice(action_templates)
    cat = random.choice(list(template["category_map"].keys()))
    amount_raw = random.choice([20000, 50000, 150000, 350000, 1200000, 5000000])
    
    note = random.choice(notes.get(cat, ["chi tiêu"]))
    user_phrase = random.choice(template["user"])
    
    amount_str = f"{amount_raw:,}" if "đ" in user_phrase else str(amount_raw // 1000) if "k" in user_phrase else str(amount_raw)
    instruction = user_phrase.format(amount=amount_str, note=note)
    
    action_type = template["type"]
    category_db_name = template["category_map"][cat]
    
    action_json = {
        "amount": amount_raw,
        "type": action_type,
        "category_name": category_db_name,
        "note": note
    }
    
    action_block = f"[TRANSACTION_ACTION]\n{json.dumps(action_json, ensure_ascii=False)}\n[/TRANSACTION_ACTION]"
    
    if action_type == "expense":
        output = f"Đã hiểu! Tôi đã tự động ghi nhận khoản chi tiêu cho **{cat}** ({note}) với số tiền **{amount_raw:,}đ** vào sổ ghi chép của bạn.\n\n{action_block}"
    else:
        output = f"Tuyệt vời! Tôi đã ghi nhận khoản thu nhập mới từ **{cat}** ({note}) trị giá **{amount_raw:,}đ** vào tài khoản của bạn.\n\n{action_block}"
        
    dataset.append({
        "instruction": instruction,
        "input": "",
        "output": output
    })

# 2. Sinh các mẫu câu hỏi tư vấn chung
for i in range(150):
    advice = random.choice(general_advices)
    # Thêm biến thể cho câu hỏi phong phú
    prefix = random.choice(["", "Trợ lý ơi, ", "Làm sao để ", "Cho mình hỏi: "])
    q = prefix + advice["q"].replace("Làm thế nào để ", "").replace("Làm sao để ", "")
    
    dataset.append({
        "instruction": q,
        "input": "",
        "output": advice["a"]
    })

# 3. Xuất ra file dataset.json
output_file = "dataset.json"
with open(output_file, "w", encoding="utf-8") as f:
    json.dump(dataset, f, ensure_ascii=False, indent=2)

print(f"[OK] Đã sinh thành công {len(dataset)} mẫu dữ liệu huấn luyện tại: {output_file}")
