import pymongo
import random

# 1. Kết nối tới Router (Lưu ý: Cổng 27117)
# Chúng ta KHÔNG kết nối trực tiếp vào Shard lẻ, mà phải qua Router.
# Thêm directConnection=true và đổi localhost thành 127.0.0.1
client = pymongo.MongoClient("mongodb://127.0.0.1:27117/?directConnection=true")

# 2. Chọn Database và Collection
db = client["QuanLyHocLieu"]
collection = db["materials"]

# Xóa dữ liệu cũ (nếu có) để làm sạch
collection.delete_many({})
print("Đã xóa dữ liệu cũ.")

# 3. Tạo dữ liệu giả
data = []
departments = ["CNTT", "KT"] # Chúng ta có 2 khoa tương ứng 2 Shard

print("Đang tạo 1000 bản ghi mẫu...")

for i in range(500):
    dept = random.choice(departments) # Chọn ngẫu nhiên khoa
    doc = {
        "name": f"Tài liệu số {i}",
        "type": random.choice(["Ebook", "Video", "Slide"]),
        "department": dept, # Đây là Shard Key (QUAN TRỌNG)
        "price": random.randint(10000, 500000)
    }
    data.append(doc)

# 4. Ghi dữ liệu vào MongoDB
# Router sẽ tự động đọc field "department" để ném về Shard 1 hay Shard 2
collection.insert_many(data)

print(f"✅ Đã thêm thành công {len(data)} tài liệu vào hệ thống!")
print("Bây giờ bạn hãy vào MongoDB Compass hoặc Terminal để kiểm tra sự phân tán dữ liệu.")