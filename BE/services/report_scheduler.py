from datetime import date, timedelta
from models.models import db, User, SentReport
from services.email_service import send_financial_report

def check_and_send_reports():
    """Triggered daily to check if weekly/monthly reports should be generated and emailed"""
    try:
        today = date.today()
        
        users = User.query.all()
        for user in users:
            # 1. Weekly report check
            # Send on Sunday (6) or Monday (0)
            if today.weekday() in [0, 6]:
                start_of_week = today - timedelta(days=today.weekday())
                already_sent = SentReport.query.filter_by(
                    user_id=user.id,
                    report_type='weekly',
                    sent_date=start_of_week
                ).first()
                
                if not already_sent:
                    success = send_financial_report(user.id, is_monthly=False)
                    if success:
                        new_log = SentReport(
                            user_id=user.id,
                            report_type='weekly',
                            sent_date=start_of_week
                        )
                        db.session.add(new_log)
                        
            # 2. Monthly report check
            # Send on the first day of the month
            if today.day == 1:
                already_sent = SentReport.query.filter_by(
                    user_id=user.id,
                    report_type='monthly',
                    sent_date=today
                ).first()
                
                if not already_sent:
                    success = send_financial_report(user.id, is_monthly=True)
                    if success:
                        new_log = SentReport(
                            user_id=user.id,
                            report_type='monthly',
                            sent_date=today
                        )
                        db.session.add(new_log)
                        
        db.session.commit()
    except Exception as e:
        print("Error checking reports schedule:", e)
        db.session.rollback()
