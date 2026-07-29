import json
import random
import time

def run_demo():
    output_lines = []
    output_lines.append("=" * 60)
    output_lines.append("DEMO TRUY XUẤT BỘ DỮ LIỆU HUẤN LUYỆN AI ADVISOR")
    output_lines.append("=" * 60)
    
    try:
        # Đọc dữ liệu từ dataset.json
        with open("dataset.json", "r", encoding="utf-8") as f:
            dataset = json.load(f)
            
        total_samples = len(dataset)
        output_lines.append(f"[*] Tìm thấy {total_samples} mẫu dữ liệu huấn luyện.")
        output_lines.append("[*] Đang tiến hành mô phỏng hội thoại...")
        output_lines.append("-" * 60)
        
        # Chọn ngẫu nhiên 3 mẫu dữ liệu đại diện cho 2 nhóm: Action và Tư vấn
        action_samples = [s for s in dataset if "[TRANSACTION_ACTION]" in s["output"]]
        advice_samples = [s for s in dataset if "[TRANSACTION_ACTION]" not in s["output"]]
        
        selected_samples = []
        if len(action_samples) >= 2:
            selected_samples.extend(random.sample(action_samples, 2))
        if len(advice_samples) >= 1:
            selected_samples.extend(random.sample(advice_samples, 1))
            
        random.shuffle(selected_samples)
        
        for idx, sample in enumerate(selected_samples, 1):
            output_lines.append(f"\n[Câu hỏi của bạn #{idx}]:")
            output_lines.append(f" => \"{sample['instruction']}\"")
            output_lines.append("..." * 10)
            
            output_lines.append(f"[AI Advisor Phản hồi]:")
            output_lines.append(sample['output'])
            output_lines.append("-" * 60)
            
        # Ghi toàn bộ kết quả ra file demo_output.txt với mã hóa utf-8
        with open("demo_output.txt", "w", encoding="utf-8") as out_f:
            out_f.write("\n".join(output_lines))
            
        print("[OK] Demo successfully written to demo_output.txt!")
            
    except FileNotFoundError:
        print("[Lỗi] Không tìm thấy file dataset.json.")
    except Exception as e:
        print(f"[Lỗi] Gặp sự cố: {str(e)}")

if __name__ == "__main__":
    run_demo()
