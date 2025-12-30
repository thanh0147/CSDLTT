import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function FileViewer() {
    const { fileId } = useParams();
    const navigate = useNavigate();
    const [fileType, setFileType] = useState('');
    
    // URL trực tiếp từ Backend (Vì ở Bước 2 ta đã mở public nên không cần Token nữa)
    const fileUrl = `http://127.0.0.1:8000/materials/view/${fileId}`;

    return (
        <div className="vh-100 d-flex flex-column bg-dark">
            {/* Header */}
            <div className="bg-secondary text-white p-2 d-flex justify-content-between align-items-center">
                <h6 className="m-0 ms-3">🔍 Xem Tài Liệu</h6>
                <div>
                    <a href={`http://127.0.0.1:8000/materials/download/${fileId}`} className="btn btn-primary btn-sm me-2">
                        ⬇ Tải Về
                    </a>
                    <button className="btn btn-danger btn-sm me-3" onClick={() => navigate('/')}>
                        Đóng
                    </button>
                </div>
            </div>

            {/* Vùng hiển thị nội dung */}
            <div className="flex-grow-1 bg-light d-flex justify-content-center align-items-center position-relative">
                
                {/* Cách hiển thị chuẩn nhất cho PDF, Ảnh, Video */}
                <iframe 
                    src={fileUrl}
                    className="w-100 h-100 border-0"
                    title="Document Viewer"
                    onError={() => alert("Không thể tải file này!")}
                />

                {/* Lớp phủ hướng dẫn nếu là file không xem được */}
                <div className="position-absolute bottom-0 start-0 w-100 text-center p-2 bg-warning bg-opacity-75" style={{pointerEvents: 'none'}}>
                   <small>Nếu màn hình trắng hoặc lỗi: Đây có thể là file Word/Excel. Vui lòng bấm nút <b>Tải Về</b> ở góc trên.</small>
                </div>
            </div>
        </div>
    );
}