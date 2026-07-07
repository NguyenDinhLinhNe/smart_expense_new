import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import os
from datetime import datetime, timedelta
from models.models import db, User, Transaction, Category, Budget

SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SENDER_EMAIL = os.getenv("SENDER_EMAIL", SMTP_USER)

def send_financial_report(user_id, is_monthly=False):
    try:
        user = User.query.get(user_id)
        if not user or not user.email:
            return False
            
        today = datetime.now().date()
        if is_monthly:
            start_date = today - timedelta(days=30)
            report_title = f"Báo cáo Tài chính Tháng {today.month}/{today.year}"
        else:
            start_date = today - timedelta(days=7)
            report_title = f"Báo cáo Tài chính Tuần qua ({start_date.strftime('%d/%m')} - {today.strftime('%d/%m')})"
            
        transactions = Transaction.query.filter(
            Transaction.user_id == user_id,
            Transaction.date >= start_date,
            Transaction.date <= today
        ).all()
        
        total_income = sum(float(t.amount) for t in transactions if t.type == 'income')
        total_expense = sum(float(t.amount) for t in transactions if t.type == 'expense')
        
        cat_spent = {}
        for t in transactions:
            if t.type == 'expense':
                cat_name = t.category.name if t.category else "Khác"
                cat_spent[cat_name] = cat_spent.get(cat_name, 0.0) + float(t.amount)
                
        cat_breakdown_html = ""
        for name, amt in sorted(cat_spent.items(), key=lambda x: x[1], reverse=True):
            cat_breakdown_html += f"<tr><td style='padding: 8px; border-bottom: 1px solid #ddd;'>{name}</td><td style='padding: 8px; border-bottom: 1px solid #ddd; text-align: right; font-weight: bold;'>{amt:,.0f} đ</td></tr>"
            
        if not cat_breakdown_html:
            cat_breakdown_html = "<tr><td colspan='2' style='padding: 8px; text-align: center; color: #888;'>Không có chi tiêu nào trong thời gian này.</td></tr>"

        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; background-color: #f4f7f6; padding: 20px; margin: 0;">
            <div style="max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05); background: white;">
                <div style="background: linear-gradient(135deg, #0284c7, #7c3aed); padding: 30px; text-align: center; color: white;">
                    <h2 style="margin: 0; font-size: 24px; font-weight: bold; text-transform: uppercase;">Smart Expense Tracker</h2>
                    <p style="margin: 5px 0 0 0; opacity: 0.8; font-size: 14px;">{report_title}</p>
                </div>
                <div style="padding: 30px;">
                    <p>Chào <strong>{user.name}</strong>,</p>
                    <p>Dưới đây là tóm tắt tình hình tài chính của bạn trong khoảng thời gian vừa qua:</p>
                    
                    <table style="width: 100%; border-collapse: collapse; margin: 25px 0;">
                        <tr>
                            <td style="width: 50%; padding: 15px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; text-align: center;">
                                <span style="font-size: 11px; text-transform: uppercase; color: #166534; font-weight: bold; display: block;">Tổng thu nhập</span>
                                <span style="margin: 5px 0 0 0; color: #15803d; font-size: 18px; font-weight: bold; display: block;">+{total_income:,.0f} đ</span>
                            </td>
                            <td style="width: 5%; font-size: 1px;">&nbsp;</td>
                            <td style="width: 45%; padding: 15px; background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; text-align: center;">
                                <span style="font-size: 11px; text-transform: uppercase; color: #991b1b; font-weight: bold; display: block;">Tổng chi tiêu</span>
                                <span style="margin: 5px 0 0 0; color: #b91c1c; font-size: 18px; font-weight: bold; display: block;">-{total_expense:,.0f} đ</span>
                            </td>
                        </tr>
                    </table>
                    
                    <h4 style="margin: 20px 0 10px 0; border-bottom: 2px solid #0284c7; padding-bottom: 5px; color: #333;">Chi tiết theo danh mục</h4>
                    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                        <thead>
                            <tr style="background-color: #f8fafc; color: #475569; text-align: left;">
                                <th style="padding: 8px; border-bottom: 2px solid #ddd;">Danh mục</th>
                                <th style="padding: 8px; border-bottom: 2px solid #ddd; text-align: right;">Đã chi tiêu</th>
                            </tr>
                        </thead>
                        <tbody>
                            {cat_breakdown_html}
                        </tbody>
                    </table>
                    
                    <div style="margin-top: 30px; padding: 15px; background-color: #f8fafc; border-radius: 8px; font-size: 11px; color: #64748b; line-height: 1.6;">
                        * Đây là báo cáo tự động được gửi từ hệ thống quản lý chi tiêu cá nhân thông minh của bạn. Hãy duy trì thói quen ghi chép tài chính để giữ ví an toàn nhé!
                    </div>
                </div>
                <div style="background-color: #f1f5f9; padding: 20px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
                    © 2026 Smart Expense Tracker AI. Powered by Gemini.
                </div>
            </div>
        </body>
        </html>
        """
        
        msg = MIMEMultipart('alternative')
        msg['Subject'] = report_title
        msg['From'] = SENDER_EMAIL or "noreply@smartexpensetracker.com"
        msg['To'] = user.email
        
        msg.attach(MIMEText(html_content, 'html'))
        
        if not SMTP_USER or not SMTP_PASSWORD:
            print(f"SMTP Credentials not set. Simulating email transmission of: {report_title} to {user.email}")
            return True
            
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SENDER_EMAIL, user.email, msg.as_string())
            
        return True
    except Exception as e:
        print("Error sending report email:", e)
        return False
