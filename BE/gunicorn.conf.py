import os
import multiprocessing

# Lắng nghe cổng PORT do máy chủ Render tự động cấp phát, mặc định là 5000
bind = "0.0.0.0:" + os.environ.get("PORT", "5000")

# Số lượng tiến trình xử lý song song
workers = multiprocessing.cpu_count() * 2 + 1

# Thời gian chờ phản hồi tối đa của request (giúp RAG AI xử lý không bị timeout)
timeout = 120

# Ghi nhận log
accesslog = "-"
errorlog = "-"
loglevel = "info"
