from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form, Response
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pymongo import MongoClient
from pydantic import BaseModel
from bson import ObjectId
from datetime import datetime, timedelta
import gridfs
import hashlib
import sys
import os
app = FastAPI()

# --- CẤU HÌNH CORS (BẮT BUỘC ĐỂ KHẮC PHỤC LỖI) ---
origins = [
    "*", # Cho phép tất cả các nguồn truy cập (Dễ nhất cho đồ án)
    "https://csdltt-txt.onrender.com", # Hoặc bạn có thể ghi cụ thể link frontend của bạn vào đây
    "http://localhost:5173", # Cho phép cả localhost khi chạy máy nhà
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins, # Sử dụng danh sách origins ở trên
    allow_credentials=True,
    allow_methods=["*"], # Cho phép tất cả các method (GET, POST, PUT, DELETE...)
    allow_headers=["*"], # Cho phép tất cả các headers
)

# --- KẾT NỐI DB ---
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
try:
    client = MongoClient(MONGO_URI)
    db = client["QuanLyHocLieu"]
    col_materials = db["materials"]
    col_users = db["users"]
    col_activities = db["activities"]
    col_logs = db["logs"] # Collection lưu lịch sử truy cập
    # Kích hoạt GridFS để lưu file
    fs = gridfs.GridFS(db)
    
    print("✅ DB & GridFS Connected!")
except Exception as e:
    print(f"❌ Error: {e}")
    sys.exit(1)

# --- MODELS & AUTH ---
class User(BaseModel):
    username: str
    password: str
    role: str 

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")
# Hàm phụ trợ để ghi log nhanh gọn
def log_activity(action: str, file_id: str):
    col_logs.insert_one({
        "action": action, # 'view' hoặc 'download'
        "file_id": file_id,
        "timestamp": datetime.now() # Cần import datetime
    })
    
def get_current_user(token: str = Depends(oauth2_scheme)):
    user = col_users.find_one({"username": token})
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return user

@app.post("/token")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = col_users.find_one({"username": form_data.username})
    if not user or user["password"] != form_data.password:
        raise HTTPException(status_code=400, detail="Sai thông tin")
    return {"access_token": user["username"], "token_type": "bearer"}

# Helper ghi log
def log_action(username: str, action: str, target: str):
    col_activities.insert_one({
        "user": username, "action": action, 
        "target": target, "timestamp": datetime.now()
    })

def fix_id(doc):
    doc["_id"] = str(doc["_id"])
    return doc

# --- API XỬ LÝ FILE & HỌC LIỆU ---

@app.post("/materials/upload")
async def upload_material(
    name: str = Form(...),
    department: str = Form(...), # Shard Key
    course_code: str = Form(...),
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] == "hocvien":
        raise HTTPException(status_code=403, detail="Học viên không được upload")

    # 1. Đọc file và Tính Hash (SHA-256) để chống trùng
    content = await file.read()
    file_hash = hashlib.sha256(content).hexdigest()

    # 2. Kiểm tra trùng lặp
    if col_materials.find_one({"file_hash": file_hash}):
        raise HTTPException(status_code=400, detail="❌ File này đã tồn tại trong hệ thống!")

    # 3. Lưu file vào GridFS
    # GridFS sẽ tự cắt file thành các chunk nhỏ và lưu vào fs.chunks
    file_id = fs.put(content, filename=file.filename, content_type=file.content_type)

    # 4. Lưu Metadata vào Collection materials
    metadata = {
        "name": name,
        "department": department,
        "course_code": course_code,
        "file_id": str(file_id), # Link sang GridFS
        "file_hash": file_hash,  # Dùng để check trùng sau này
        "filename": file.filename,
        "content_type": file.content_type,
        "size_kb": len(content) / 1024,
        "uploader": current_user["username"],
        "created_at": datetime.now()
    }
    col_materials.insert_one(metadata)

    log_action(current_user["username"], "UPLOAD", file.filename)
    return {"msg": "Upload thành công", "hash": file_hash}

@app.get("/materials")
async def get_materials(current_user: dict = Depends(get_current_user)):
    try:
        materials = []
        # Lấy tất cả tài liệu, sắp xếp mới nhất lên đầu (-1)
        cursor = col_materials.find().sort("_id", -1)
        
        for doc in cursor:
            # Chuyển đổi ObjectId thành string để không bị lỗi JSON
            doc["_id"] = str(doc["_id"])
            if "file_id" in doc:
                doc["file_id"] = str(doc["file_id"])
            materials.append(doc)
            
        return {
            "data": materials,
            "role": current_user["role"]  # <--- Quan trọng: Trả về role (admin/giangvien/hocvien)
        }
    except Exception as e:
        print(f"Lỗi lấy danh sách: {e}")
        raise HTTPException(status_code=500, detail="Lỗi Server")
# --- 1. API DOWNLOAD (Dùng để tải file về máy) ---
@app.get("/materials/download/{file_id}")
async def download_file(file_id: str): # Bỏ require login ở đây nếu muốn test nhanh, hoặc dùng cách Axios bên dưới
    try:
        grid_out = fs.get(ObjectId(file_id))
        log_activity("download", file_id)
        return StreamingResponse(
            grid_out, 
            media_type="application/octet-stream", # Ép buộc tải xuống
            headers={"Content-Disposition": f"attachment; filename={grid_out.filename}"}
        )
    except:
        raise HTTPException(status_code=404, detail="File không tìm thấy")

# --- 2. API VIEW (Dùng để xem trực tiếp - chỉ work tốt với PDF/Ảnh/Video) ---
@app.get("/materials/view/{file_id}")
async def view_file(file_id: str):
    try:
        grid_out = fs.get(ObjectId(file_id))
        
        # Xử lý vấn đề tên file tiếng Việt khi hiển thị header
        from urllib.parse import quote
        filename_encoded = quote(grid_out.filename)
        log_activity("view", file_id)
        return StreamingResponse(
            grid_out, 
            media_type=grid_out.content_type,
            headers={
                "Content-Disposition": f"inline; filename*=utf-8''{filename_encoded}"
            }
        )
    except:
        raise HTTPException(status_code=404, detail="File không tìm thấy")
    
@app.delete("/materials/{id}")
async def delete_material(id: str, current_user: dict = Depends(get_current_user)):
    # 1. Kiểm tra quyền
    if current_user["role"] == "hocvien":
        raise HTTPException(status_code=403, detail="Bạn không có quyền xóa")
        
    # 2. Tìm tài liệu trong DB
    material = col_materials.find_one({"_id": ObjectId(id)})
    if not material:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu")

    try:
        # 3. Xóa file vật lý trong GridFS (nếu có file_id)
        if "file_id" in material:
            fs.delete(ObjectId(material["file_id"]))
            
        # 4. Xóa thông tin trong Collection (MongoDB)
        col_materials.delete_one({"_id": ObjectId(id)})
        
        return {"message": "Đã xóa thành công"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi xóa: {str(e)}")

# --- THỐNG KÊ REAL-TIME (Theo giờ) ---
@app.get("/stats/realtime")
def realtime_stats():
    # Thống kê lượt upload/tương tác trong 24h qua, gom nhóm theo giờ
    one_day_ago = datetime.now() - timedelta(days=1)
    pipeline = [
        {"$match": {"timestamp": {"$gte": one_day_ago}}},
        {
            "$group": {
                "_id": {
                    "hour": {"$hour": "$timestamp"},
                    "day": {"$dayOfMonth": "$timestamp"}
                },
                "count": {"$sum": 1},
                "actions": {"$push": "$action"}
            }
        },
        {"$sort": {"_id.day": 1, "_id.hour": 1}}
    ]
    stats = list(col_activities.aggregate(pipeline))
    return stats

@app.put("/materials/{id}")
async def update_material(
    id: str,
    name: str = Form(...),
    course_code: str = Form(...),
    department: str = Form(...),
    file: UploadFile = File(None), # File là tùy chọn (None)
    current_user: dict = Depends(get_current_user)
):
    # 1. Kiểm tra quyền
    if current_user["role"] == "hocvien":
        raise HTTPException(status_code=403, detail="Bạn không có quyền sửa")

    # 2. Tìm tài liệu cũ
    old_material = col_materials.find_one({"_id": ObjectId(id)})
    if not old_material:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu")

    update_data = {
        "name": name,
        "course_code": course_code,
        "department": department
    }

    try:
        # 3. Nếu người dùng có chọn file mới -> Xóa file cũ, lưu file mới
        if file:
            # Xóa file cũ trong GridFS
            if "file_id" in old_material:
                fs.delete(ObjectId(old_material["file_id"]))
            
            # Lưu file mới
            file_id = fs.put(file.file, filename=file.filename, content_type=file.content_type)
            
            # Cập nhật thông tin file mới
            update_data["file_id"] = file_id
            update_data["filename"] = file.filename
            # Tính dung lượng (KB) - Di chuyển con trỏ về cuối file để lấy size
            file.file.seek(0, 2)
            size_kb = file.file.tell() / 1024
            update_data["size_kb"] = size_kb

        # 4. Cập nhật vào MongoDB
        col_materials.update_one({"_id": ObjectId(id)}, {"$set": update_data})
        
        return {"message": "Cập nhật thành công"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi cập nhật: {str(e)}")
# --- TRONG FILE main.py ---

@app.post("/seed-users")
def seed_users():
    users = [
        {"username": "admin", "password": "123", "role": "admin"},
        {"username": "gv01", "password": "123", "role": "giangvien"},
        {"username": "hv01", "password": "123", "role": "hocvien"},
    ]
    col_users.delete_many({})
    col_users.insert_many(users)
    return {"msg": "Đã tạo user mẫu"}

@app.get("/stats/access-over-time")
async def get_access_stats(current_user: dict = Depends(get_current_user)):
    # Chỉ Admin hoặc Giảng viên mới được xem
    if current_user["role"] == "hocvien":
        raise HTTPException(status_code=403, detail="Không có quyền xem thống kê")

    # Tạo danh sách 7 ngày gần nhất
    stats = {}
    today = datetime.now()
    for i in range(6, -1, -1):
        date_str = (today - timedelta(days=i)).strftime("%Y-%m-%d")
        stats[date_str] = 0

    # Lấy dữ liệu từ MongoDB trong khoảng 7 ngày qua
    seven_days_ago = today - timedelta(days=7)
    logs = col_logs.find({"timestamp": {"$gte": seven_days_ago}})

    for log in logs:
        date_key = log["timestamp"].strftime("%Y-%m-%d")
        if date_key in stats:
            stats[date_key] += 1

    return {
        "labels": list(stats.keys()), # Danh sách ngày
        "values": list(stats.values()) # Số lượt truy cập tương ứng
    }