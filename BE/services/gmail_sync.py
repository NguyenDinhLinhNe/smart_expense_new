import imaplib
import email
from email.header import decode_header
import os
import re
import html
from datetime import datetime
from models.models import db, User, Transaction, Category, SentReport

GMAIL_USER = os.getenv("GMAIL_USER", "")
GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD", "")

def clean_html(html_content):
    """Strip tags, decode HTML entities and normalize whitespace"""
    text = re.sub(r'<[^>]+>', ' ', html_content)
    text = html.unescape(text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def parse_vietcombank_receipt(html_body):
    """Extract fields from Vietcombank Payment Receipt email body"""
    text = clean_html(html_body)
    
    # 1. Parse Amount
    amount = 0.0
    # Match pattern: "Số tiền Amount 2,600,000 VND"
    amt_match = re.search(r'(?:Số\s*tiền|Amount)\s*([\d\.,]+)\s*VND', text, re.IGNORECASE)
    if amt_match:
        num_str = amt_match.group(1).replace(',', '').replace('.', '')
        try:
            amount = float(num_str)
        except ValueError:
            pass
            
    # 2. Parse Date
    date_parsed = datetime.now().date()
    # Match pattern: "Ngày, giờ giao dịch Trans. Date, Time 07:38 Thứ Hai 06/07/2026"
    date_match = re.search(r'(?:Ngày,\s*giờ\s*giao\s*dịch|Trans\.\s*Date,\s*Time)\s*(\d{2}:\d{2})\s*.*?\s*(\d{2}/\d{2}/\d{4})', text, re.IGNORECASE)
    if date_match:
        date_str = date_match.group(2)
        try:
            date_parsed = datetime.strptime(date_str, '%m/%d/%Y').date()
        except ValueError:
            pass

    # 3. Parse Note / Details of Payment
    note = "Chuyển tiền ngân hàng"
    # Match pattern: "Nội dung chuyển tiền Details of Payment NGUYEN DINH LINH chuyen tien"
    note_match = re.search(r'(?:Nội\s*dung\s*chuyển\s*tiền|Details\s*of\s*Payment)\s*(?:Details\s*of\s*Payment)?\s*(.*?)(?:\s*(?:Cám\s*ơn|Thank\s*you|Lưu\s*ý|Biên\s*lai)|$)', text, re.IGNORECASE)
    if note_match:
        note_text = note_match.group(1).strip()
        note = re.sub(r'\s+', ' ', note_text)
        
    return amount, date_parsed, note

def get_category_for_transaction(note_text):
    """Suggest category or default to 'Bills' (Hóa đơn) if unclear"""
    note_lower = note_text.lower()
    
    food_kws = ['an uong', 'food', 'restaurant', 'coffee', 'cafe', 'tea', 'kem', 'sieu thi', 'winmart', 'coop', 'market', 'cho', 'nha hang', 'bakery', 'starbucks', 'highlands', 'phuc long']
    trans_kws = ['grab', 'be', 'gojek', 'taxi', 'xang', 'gas', 'bus', 'tau', 've xe', 'xe may', 'o to', 'gui xe', 'vé máy bay', 'flight']
    shop_kws = ['shopee', 'lazada', 'tiki', 'shopping', 'quan ao', 'clothes', 'giay', 'shoes', 'online', 'mua sam', 'dien thoai', 'laptop', 'phu kien']
    ent_kws = ['cinema', 'rap chieu phim', 'phim', 'game', 'netflix', 'spotify', 'bar', 'pub', 'party', 'du lich', 'travel', 'hotel', 'resort', 'kyoto']
    
    cat_map = {
        'Food': food_kws,
        'Transport': trans_kws,
        'Shopping': shop_kws,
        'Entertainment': ent_kws
    }
    
    categories = Category.query.all()
    suggested_id = None
    
    # 1. Match specific category rules
    for cat_name, kws in cat_map.items():
        for kw in kws:
            if kw in note_lower:
                # Find database category ID
                db_cat = Category.query.filter(Category.name.ilike(f"%{cat_name}%")).first()
                if db_cat:
                    suggested_id = db_cat.id
                    break
        if suggested_id:
            break
            
    # 2. Fallback to Bills / Hóa đơn if no category matched
    if not suggested_id:
        bills_cat = Category.query.filter(
            (Category.name.ilike('%bill%')) | (Category.name.ilike('%hóa đơn%')) | (Category.name.ilike('%hoa don%'))
        ).first()
        if bills_cat:
            suggested_id = bills_cat.id
        elif categories:
            suggested_id = categories[0].id
            
    return suggested_id

def sync_gmail_transactions():
    """Sync unseen VCBDigibank receipts from linked Gmail account"""
    if not GMAIL_USER or not GMAIL_APP_PASSWORD:
        return
        
    try:
        # Connect to Gmail
        mail = imaplib.IMAP4_SSL("imap.gmail.com")
        mail.login(GMAIL_USER, GMAIL_APP_PASSWORD)
        mail.select("inbox")
        
        # Search for unseen emails from VCBDigibank
        status, messages = mail.search(None, '(UNSEEN FROM "VCBDigibank")')
        if status != "OK" or not messages[0]:
            mail.logout()
            return
            
        email_ids = messages[0].split()
        users = User.query.all()
        # For simplicity, if we map the Gmail user directly or sync for the first user:
        if not users:
            mail.logout()
            return
            
        target_user = users[0]  # Sync to the main user
        
        for e_id in email_ids:
            res, msg_data = mail.fetch(e_id, "(RFC822)")
            if res != "OK":
                continue
                
            raw_email = msg_data[0][1]
            msg = email.message_from_bytes(raw_email)
            
            # Extract HTML body
            html_body = ""
            if msg.is_multipart():
                for part in msg.walk():
                    content_type = part.get_content_type()
                    if content_type == "text/html":
                        html_body = part.get_payload(decode=True).decode('utf-8', errors='ignore')
                        break
            else:
                if msg.get_content_type() == "text/html":
                    html_body = msg.get_payload(decode=True).decode('utf-8', errors='ignore')
                    
            if not html_body:
                continue
                
            # Parse Vietcombank payment details
            amount, tx_date, note = parse_vietcombank_receipt(html_body)
            if amount <= 0:
                continue
                
            # Avoid logging duplicates (check if identical transaction exists within the day)
            duplicate = Transaction.query.filter_by(
                user_id=target_user.id,
                amount=amount,
                date=tx_date,
                note=note[:100]
            ).first()
            
            if not duplicate:
                category_id = get_category_for_transaction(note)
                
                new_tx = Transaction(
                    user_id=target_user.id,
                    category_id=category_id,
                    amount=amount,
                    type='expense',
                    note=note[:100],
                    date=tx_date
                )
                db.session.add(new_tx)
                
            # Mark email as read/seen so we don't process it again
            mail.store(e_id, "+FLAGS", "\\Seen")
            
        db.session.commit()
        mail.logout()
    except Exception as e:
        print("Error syncing Gmail transactions:", e)
