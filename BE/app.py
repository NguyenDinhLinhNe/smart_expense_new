import os
from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from config import Config
from models.models import db

base_dir = os.path.abspath(os.path.dirname(__file__))
react_build_dir = os.path.abspath(os.path.join(base_dir, '..', 'FE', 'build'))
app = Flask(__name__, static_folder=react_build_dir, static_url_path='/static-assets')
app.config.from_object(Config)

# Initialize extensions
CORS(app, origins=Config.CORS_ORIGINS)
jwt = JWTManager(app)
db.init_app(app)

# Import routes
from routes.auth_routes import auth_bp
from routes.transaction_routes import transaction_bp
from routes.category_routes import category_bp
from routes.budget_routes import budget_bp
from routes.report_routes import report_bp
from routes.ai_routes import ai_bp
from routes.recurring_routes import recurring_bp, check_and_execute_recurrings
from services.report_scheduler import check_and_send_reports
from services.gmail_sync import sync_gmail_transactions
import time

# Register blueprints
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(transaction_bp, url_prefix='/api/transactions')
app.register_blueprint(category_bp, url_prefix='/api/categories')
app.register_blueprint(budget_bp, url_prefix='/api/budgets')
app.register_blueprint(report_bp, url_prefix='/api/reports')
app.register_blueprint(ai_bp, url_prefix='/api/ai')
app.register_blueprint(recurring_bp, url_prefix='/api/recurring')

last_checked_time = 0

@app.before_request
def before_request_func():
    global last_checked_time
    current_time = time.time()
    # Check once every hour (3600 seconds)
    if current_time - last_checked_time > 3600:
        check_and_execute_recurrings()
        check_and_send_reports()
        sync_gmail_transactions()
        last_checked_time = current_time

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'message': 'Smart Expense Tracker API'})

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    file_path = os.path.join(app.static_folder, path)
    if path != "" and os.path.exists(file_path):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, 'index.html')

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        print("[OK] Database tables created!")
    
    app.run(debug=True, use_reloader=False, port=5000)