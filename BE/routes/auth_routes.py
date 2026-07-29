from flask import Blueprint
from models.models import Category
from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, create_access_token
from werkzeug.security import generate_password_hash, check_password_hash
from models.models import db, User
import re
import random
from datetime import datetime, timedelta
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os

auth_bp = Blueprint('auth', __name__)

def validate_email(email):
    pattern = r'^[\w\.-]+@[\w\.-]+\.\w+$'
    return re.match(pattern, email) is not None

def validate_gmail(email):
    pattern = r'^[\w\.-]+@gmail\.com$'
    return re.match(pattern, email) is not None

def send_otp_email(to_email, otp_code):
    sender_email = os.environ.get("MAIL_USERNAME")
    sender_password = os.environ.get("MAIL_PASSWORD")
    
    if not sender_email or not sender_password:
        print(f"\n[DEVELOPMENT MODE] OTP Code for {to_email}: {otp_code}\n")
        return False

    try:
        message = MIMEMultipart("alternative")
        message["Subject"] = "[Smart Expense] Mã OTP Đặt Lại Mật Khẩu"
        message["From"] = sender_email
        message["To"] = to_email

        text = f"Mã OTP của bạn là: {otp_code}. Mã này có hiệu lực trong 5 phút."
        html = f"""
        <html>
          <body style="font-family: Arial, sans-serif; background-color: #f3f4f6; padding: 20px; color: #1f2937;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
              <h2 style="color: #4ECDC4; text-align: center;">Yêu cầu đặt lại mật khẩu</h2>
              <p>Chào bạn,</p>
              <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản ứng dụng Smart Expense của bạn.</p>
              <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 15px; text-align: center; margin: 20px 0;">
                <span style="font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #2563eb;">{otp_code}</span>
              </div>
              <p>Mã này có hiệu lực trong vòng <b>5 phút</b>. Vui lòng không chia sẻ mã này với người khác.</p>
              <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
              <p style="font-size: 11px; color: #6b7280; text-align: center;">Đây là email tự động, vui lòng không phản hồi.</p>
            </div>
          </body>
        </html>
        """
        message.attach(MIMEText(text, "plain"))
        message.attach(MIMEText(html, "html"))

        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login(sender_email, sender_password)
            server.sendmail(sender_email, to_email, message.as_string())
        return True
    except Exception as e:
        print(f"[Error] Failed to send email via SMTP: {e}")
        print(f"[DEVELOPMENT MODE FALLBACK] OTP Code for {to_email}: {otp_code}")
        return False

@auth_bp.route('/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        
        # Validate input
        if not data.get('name') or not data.get('email') or not data.get('password'):
            return jsonify({'error': 'Missing required fields'}), 400
        
        if not validate_email(data['email']):
            return jsonify({'error': 'Invalid email format'}), 400
        
        if len(data['password']) < 6:
            return jsonify({'error': 'Password must be at least 6 characters'}), 400
        
        # Check if user exists
        if User.query.filter_by(email=data['email']).first():
            return jsonify({'error': 'Email already registered'}), 409
        
        # Create user
        hashed_password = generate_password_hash(data['password'])
        user = User(
            name=data['name'],
            email=data['email'],
            password=hashed_password
        )
        
        db.session.add(user)
        db.session.commit()
        
        # We do not create duplicate custom categories for each user anymore since they inherit Global Categories (user_id = None)
        
        return jsonify({
            'message': 'User created successfully',
            'user': user.to_dict(),
            'token': user.get_token()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        
        if not data.get('email') or not data.get('password'):
            return jsonify({'error': 'Email and password required'}), 400
        
        user = User.query.filter_by(email=data['email']).first()
        
        if not user or not check_password_hash(user.password, data['password']):
            return jsonify({'error': 'Invalid credentials'}), 401
        
        return jsonify({
            'message': 'Login successful',
            'user': user.to_dict(),
            'token': user.get_token()
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/forgot-password', methods=['POST'])
def forgot_password():
    try:
        data = request.get_json()
        email = data.get('email')
        
        if not email:
            return jsonify({'error': 'Vui lòng cung cấp email'}), 400
            
        if not validate_gmail(email):
            return jsonify({'error': 'Email phải có đuôi @gmail.com'}), 400
            
        user = User.query.filter_by(email=email).first()
        if not user:
            return jsonify({'error': 'Email này chưa được đăng ký trong hệ thống'}), 404
            
        otp_code = str(random.randint(100000, 999999))
        user.otp_code = otp_code
        user.otp_expiry = datetime.utcnow() + timedelta(minutes=5)
        db.session.commit()
        
        send_otp_email(email, otp_code)
        
        return jsonify({'message': 'Mã OTP đã được gửi về Gmail của bạn thành công!'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/reset-password-with-otp', methods=['POST'])
def reset_password_with_otp():
    try:
        data = request.get_json()
        email = data.get('email')
        otp = data.get('otp')
        new_password = data.get('new_password')
        
        if not email or not otp or not new_password:
            return jsonify({'error': 'Vui lòng điền đầy đủ Email, OTP và Mật khẩu mới'}), 400
            
        if len(new_password) < 6:
            return jsonify({'error': 'Mật khẩu mới phải từ 6 ký tự trở lên'}), 400
            
        user = User.query.filter_by(email=email).first()
        if not user:
            return jsonify({'error': 'Không tìm thấy người dùng trong hệ thống'}), 404
            
        if not user.otp_code or user.otp_code != otp:
            return jsonify({'error': 'Mã OTP không chính xác'}), 400
            
        if not user.otp_expiry or user.otp_expiry < datetime.utcnow():
            return jsonify({'error': 'Mã OTP đã hết hạn'}), 400
            
        user.password = generate_password_hash(new_password)
        user.otp_code = None
        user.otp_expiry = None
        db.session.commit()
        
        return jsonify({'message': 'Mật khẩu đã được đặt lại thành công!'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/reset-password', methods=['POST'])
def reset_password():
    try:
        data = request.get_json()
        email = data.get('email')
        new_password = data.get('new_password')
        
        if not email or not new_password:
            return jsonify({'error': 'Email and new password required'}), 400
            
        if len(new_password) < 6:
            return jsonify({'error': 'Password must be at least 6 characters'}), 400
            
        user = User.query.filter_by(email=email).first()
        if not user:
            return jsonify({'error': 'Email address not found in system'}), 404
            
        user.password = generate_password_hash(new_password)
        db.session.commit()
        
        return jsonify({'message': 'Password has been reset successfully!'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/profile', methods=['GET'])
@jwt_required()
def get_profile():
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        return jsonify({'user': user.to_dict()}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/users', methods=['GET'])
@jwt_required()
def get_users():
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id)
        
        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Unauthorized. Admin access required.'}), 403
            
        users = User.query.all()
        return jsonify({'users': [u.to_dict() for u in users]}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/change-password', methods=['POST'])
@jwt_required()
def change_password():
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
            
        data = request.get_json()
        old_password = data.get('old_password')
        new_password = data.get('new_password')
        
        if not old_password or not new_password:
            return jsonify({'error': 'Current password and new password are required'}), 400
            
        if len(new_password) < 6:
            return jsonify({'error': 'New password must be at least 6 characters'}), 400
            
        # Xác minh mật khẩu hiện tại
        if not check_password_hash(user.password, old_password):
            return jsonify({'error': 'Current password is incorrect'}), 400
            
        # Lưu mật khẩu mới đã băm
        user.password = generate_password_hash(new_password)
        db.session.commit()
        
        return jsonify({'message': 'Mật khẩu đã được cập nhật thành công!'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

def create_default_categories(user_id):
    default_categories = [
        {'name': 'Food & Dining', 'icon': '🍔', 'color': '#FF6B6B', 'type': 'expense'},
        {'name': 'Transportation', 'icon': '🚗', 'color': '#4ECDC4', 'type': 'expense'},
        {'name': 'Shopping', 'icon': '🛍️', 'color': '#45B7D1', 'type': 'expense'},
        {'name': 'Entertainment', 'icon': '🎬', 'color': '#96CEB4', 'type': 'expense'},
        {'name': 'Bills & Utilities', 'icon': '💡', 'color': '#FFEAA7', 'type': 'expense'},
        {'name': 'Healthcare', 'icon': '🏥', 'color': '#DDA0DD', 'type': 'expense'},
        {'name': 'Education', 'icon': '📚', 'color': '#98D8C8', 'type': 'expense'},
        {'name': 'Salary', 'icon': '💰', 'color': '#B5EAD7', 'type': 'income'},
        {'name': 'Freelance', 'icon': '💻', 'color': '#C7CEEA', 'type': 'income'},
        {'name': 'Investment', 'icon': '📈', 'color': '#E2F0CB', 'type': 'income'}
    ]
    
    for cat in default_categories:
        category = Category(
            name=cat['name'],
            icon=cat['icon'],
            color=cat['color'],
            type=cat['type'],
            user_id=user_id
        )
        db.session.add(category)
    
    db.session.commit()