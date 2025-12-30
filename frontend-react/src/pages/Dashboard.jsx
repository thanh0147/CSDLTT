import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export default function Dashboard() {
    const navigate = useNavigate();
    // Lấy token ngay từ đầu để kiểm tra
    const token = localStorage.getItem('token');
    const localUser = localStorage.getItem('user');

    // --- STATE ---
    const [materials, setMaterials] = useState([]);
    const [role, setRole] = useState('hocvien');
    const [user, setUser] = useState('');
    
    // Logo & UI
    const defaultLogo = "hnue.png"; 
    const [logo, setLogo] = useState(defaultLogo);
    const logoInputRef = useRef(null);

    // Modals
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showStatsModal, setShowStatsModal] = useState(false);
    const [loading, setLoading] = useState(false);
    const [chartData, setChartData] = useState({ labels: [], datasets: [] });

    // Forms
    const [addFile, setAddFile] = useState(null);
    const [addForm, setAddForm] = useState({ name: '', course_code: '', department: 'CNTT' });
    const [editId, setEditId] = useState('');
    const [editFile, setEditFile] = useState(null);
    const [editForm, setEditForm] = useState({ name: '', course_code: '', department: 'CNTT' });

    // 1. KIỂM TRA BẢO MẬT KHI VÀO TRANG
    useEffect(() => {
        // Nếu không có token -> Đá về login ngay lập tức
        if(!token) {
            navigate('/login');
        } else {
            setUser(localUser);
            fetchMaterials();
        }
    }, [token, navigate]); // Thêm dependencies để React theo dõi kỹ hơn

    const fetchMaterials = async () => {
        try {
            const res = await axios.get('http://127.0.0.1:8000/materials', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMaterials(res.data.data);
            if (res.data.role) setRole(res.data.role); 
        } catch (err) {
            // Token hết hạn hoặc không hợp lệ -> Đá về login
            if (err.response?.status === 401) {
                localStorage.clear();
                navigate('/login');
            }
        }
    };

    // HÀM ĐĂNG XUẤT
    const handleLogout = () => {
        const confirmLogout = window.confirm("Bạn có chắc chắn muốn đăng xuất?");
        if (confirmLogout) {
            localStorage.clear(); // Xóa sạch token
            navigate('/login');   // Chuyển hướng
        }
    };

    // --- CÁC HÀM XỬ LÝ KHÁC (GIỮ NGUYÊN) ---
    const handleLogoChange = (e) => {
        const file = e.target.files[0];
        if (file) setLogo(URL.createObjectURL(file));
    };

    const fetchStats = async () => {
        setLoading(true);
        try {
            const res = await axios.get('http://127.0.0.1:8000/stats/access-over-time', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setChartData({
                labels: res.data.labels,
                datasets: [{
                    label: 'Truy cập (7 ngày)',
                    data: res.data.values,
                    borderColor: '#0d6efd',
                    backgroundColor: 'rgba(13, 110, 253, 0.2)',
                    tension: 0.4, fill: true
                }],
            });
            setShowStatsModal(true);
        } catch (err) { alert("Lỗi tải thống kê"); } finally { setLoading(false); }
    };

    const handleUpload = async (e) => {
        e.preventDefault(); setLoading(true);
        const data = new FormData();
        data.append('name', addForm.name); data.append('course_code', addForm.course_code);
        data.append('department', addForm.department); data.append('file', addFile);
        try {
            await axios.post('http://127.0.0.1:8000/materials/upload', data, {headers: { Authorization: `Bearer ${token}` }});
            alert('Thêm thành công!'); setShowAddModal(false); fetchMaterials(); 
        } catch (err) { alert('Lỗi upload'); } finally { setLoading(false); }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Xác nhận xóa?")) return;
        try {
            await axios.delete(`http://127.0.0.1:8000/materials/${id}`, {headers: { Authorization: `Bearer ${token}` }});
            setMaterials(materials.filter(item => item._id !== id));
        } catch (err) { alert("Không có quyền xóa."); }
    };

    const handleUpdate = async (e) => {
        e.preventDefault(); setLoading(true);
        const data = new FormData();
        data.append('name', editForm.name); data.append('course_code', editForm.course_code);
        data.append('department', editForm.department);
        if (editFile) data.append('file', editFile);
        try {
            await axios.put(`http://127.0.0.1:8000/materials/${editId}`, data, {headers: { Authorization: `Bearer ${token}` }});
            alert('Cập nhật xong!'); setShowEditModal(false); fetchMaterials();
        } catch (err) { alert('Lỗi cập nhật'); } finally { setLoading(false); }
    };

    const handleDownload = async (fileId, fileName) => {
        try {
            const res = await axios.get(`http://127.0.0.1:8000/materials/download/${fileId}`, {
                headers: { Authorization: `Bearer ${token}` }, responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url; link.setAttribute('download', fileName); document.body.appendChild(link);
            link.click(); link.remove();
        } catch (err) { alert("Lỗi tải file!"); }
    };

    const openEditModal = (item) => {
        setEditId(item._id);
        setEditForm({ name: item.name, course_code: item.course_code, department: item.department });
        setEditFile(null); setShowEditModal(true);
    };

    // --- QUAN TRỌNG: NẾU KHÔNG CÓ TOKEN THÌ KHÔNG RENDER GIAO DIỆN ---
    if (!token) return null; 

    // --- GIAO DIỆN CHÍNH ---
    return (
        <div className="d-flex vh-100 bg-light overflow-hidden">
            
            {/* SIDEBAR TRÁI */}
            <div className="d-flex flex-column flex-shrink-0 p-3 bg-white shadow" style={{width: '280px'}}>
                {/* LOGO */}
                <div className="text-center mb-4">
                    <div 
                        className="rounded-circle overflow-hidden mx-auto border border-3 border-primary shadow-sm"
                        style={{width: '100px', height: '100px', cursor: 'pointer'}}
                        onClick={() => logoInputRef.current.click()}
                    >
                        <img src={logo} alt="Logo" className="w-100 h-100 object-fit-cover" />
                    </div>
                    <input type="file" ref={logoInputRef} className="d-none" accept="image/*" onChange={handleLogoChange}/>
                    <h5 className="mt-3 fw-bold text-primary">Đại Học Demo</h5>
                    <div className="badge bg-warning text-dark mt-1">{role.toUpperCase()}</div>
                </div>

                <hr />

                {/* MENU */}
                <ul className="nav nav-pills flex-column mb-auto">
                    <li className="nav-item mb-2">
                        <a href="#" className="nav-link active fw-bold">
                            <i className="bi bi-grid-fill me-2"></i> Kho Tài Liệu
                        </a>
                    </li>
                    {(role === 'admin' || role === 'giangvien') && (
                        <li className="mb-2">
                            <button onClick={fetchStats} className="nav-link link-dark fw-bold w-100 text-start">
                                <i className="bi bi-bar-chart-fill me-2"></i> Thống Kê
                            </button>
                        </li>
                    )}
                </ul>

                <hr />

                {/* USER INFO & LOGOUT (SỬA LẠI KHÔNG DÙNG DROPDOWN NỮA) */}
                <div>
                    <div className="d-flex align-items-center mb-3 px-2">
                         <div className="rounded-circle bg-secondary text-white d-flex justify-content-center align-items-center me-2 fw-bold" style={{width: 32, height: 32}}>
                            {user ? user.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <strong>{user}</strong>
                    </div>
                    <button onClick={handleLogout} className="btn btn-outline-danger w-100">
                        <i className="bi bi-box-arrow-right me-2"></i> Đăng Xuất
                    </button>
                </div>
            </div>

            {/* MAIN CONTENT (GIỮ NGUYÊN) */}
            <div className="flex-grow-1 overflow-auto p-4">
                <div className="d-flex justify-content-between align-items-center mb-4">
                    <div>
                        <h2 className="fw-bold text-dark mb-0">Tổng Quan</h2>
                        <p className="text-muted">Quản lý tài liệu học tập.</p>
                    </div>
                    {(role !== 'hocvien') && (
                        <button className="btn btn-primary px-4 py-2 shadow-sm rounded-pill" onClick={() => setShowAddModal(true)}>
                            <i className="bi bi-cloud-upload me-2"></i> Thêm Tài Liệu
                        </button>
                    )}
                </div>

                {/* STATS WIDGETS */}
                <div className="row mb-4">
                    <div className="col-md-4">
                        <div className="card border-0 shadow-sm rounded-4 bg-primary text-white h-100">
                            <div className="card-body">
                                <h6 className="card-title text-white-50">Tổng Tài Liệu</h6>
                                <h2 className="fw-bold mb-0">{materials.length}</h2>
                            </div>
                        </div>
                    </div>
                    <div className="col-md-4">
                        <div className="card border-0 shadow-sm rounded-4 bg-white h-100">
                            <div className="card-body">
                                <h6 className="card-title text-muted">Khoa CNTT</h6>
                                <h2 className="fw-bold mb-0 text-info">{materials.filter(m => m.department === 'CNTT').length}</h2>
                            </div>
                        </div>
                    </div>
                    <div className="col-md-4">
                        <div className="card border-0 shadow-sm rounded-4 bg-white h-100">
                            <div className="card-body">
                                <h6 className="card-title text-muted">Môn học khác</h6>
                                <h2 className="fw-bold mb-0 text-success">{materials.filter(m => m.department !== 'CNTT').length}</h2>
                            </div>
                        </div>
                    </div>
                </div>

                {/* TABLE */}
                <div className="card border-0 shadow rounded-4 overflow-hidden">
                    <div className="card-header bg-white py-3 border-0"><h5 className="mb-0 fw-bold">Danh sách tài liệu</h5></div>
                    <div className="table-responsive">
                        <table className="table table-hover align-middle mb-0">
                            <thead className="bg-light text-muted">
                                <tr><th className="ps-4 py-3">Tên Tài Liệu</th><th>Môn / Khoa</th><th>Dung lượng</th><th className="text-end pe-4">Hành động</th></tr>
                            </thead>
                            <tbody>
                                {materials.map(item => (
                                    <tr key={item._id}>
                                        <td className="ps-4">
                                            <div className="d-flex align-items-center">
                                                <div className="bg-light rounded p-2 me-3 text-primary"><i className="bi bi-file-earmark-text fs-5"></i></div>
                                                <div><div className="fw-bold text-dark">{item.name}</div><small className="text-muted">{item.filename}</small></div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className="badge bg-primary bg-opacity-10 text-primary me-1">{item.course_code}</span>
                                            <span className="badge bg-secondary bg-opacity-10 text-secondary">{item.department}</span>
                                        </td>
                                        <td className="text-muted small">{(item.size_kb || 0).toFixed(1)} KB</td>
                                        <td className="text-end pe-4">
                                            <div className="btn-group">
                                                <button className="btn btn-light btn-sm text-primary" onClick={() => navigate(`/view/${item.file_id}`)} title="Xem"><i className="bi bi-eye"></i></button>
                                                <button className="btn btn-light btn-sm text-success" onClick={() => handleDownload(item.file_id, item.filename)} title="Tải"><i className="bi bi-download"></i></button>
                                                {(role === 'admin' || role === 'giangvien') && (
                                                    <>
                                                        <button className="btn btn-light btn-sm text-warning" onClick={() => openEditModal(item)} title="Sửa"><i className="bi bi-pencil"></i></button>
                                                        <button className="btn btn-light btn-sm text-danger" onClick={() => handleDelete(item._id)} title="Xóa"><i className="bi bi-trash"></i></button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {materials.length === 0 && <tr><td colSpan="4" className="text-center py-5 text-muted">Chưa có dữ liệu</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* --- MODALS (GIỮ NGUYÊN CODE CŨ) --- */}
            {/* Modal Stats */}
            {showStatsModal && (
                <div className="modal fade show d-block" style={{background:'rgba(0,0,0,0.5)'}}>
                    <div className="modal-dialog modal-lg modal-dialog-centered">
                        <div className="modal-content border-0 shadow-lg rounded-4">
                            <div className="modal-header"><h5 className="modal-title fw-bold">Thống Kê</h5><button className="btn-close" onClick={() => setShowStatsModal(false)}></button></div>
                            <div className="modal-body p-4" style={{height: '400px'}}><Line options={{ responsive: true, maintainAspectRatio: false }} data={chartData} /></div>
                        </div>
                    </div>
                </div>
            )}
            {/* Modal Add */}
            {showAddModal && (
               <div className="modal fade show d-block" style={{background:'rgba(0,0,0,0.5)'}}>
                   <div className="modal-dialog modal-dialog-centered">
                       <div className="modal-content border-0 shadow-lg rounded-4">
                           <div className="modal-header bg-primary text-white"><h5 className="modal-title">Thêm Tài Liệu</h5><button className="btn-close btn-close-white" onClick={()=>setShowAddModal(false)}></button></div>
                           <div className="modal-body p-4">
                               <form onSubmit={handleUpload}>
                                   <div className="mb-3"><label className="fw-bold small">Tên</label><input className="form-control" value={addForm.name} onChange={e=>setAddForm({...addForm, name: e.target.value})} required/></div>
                                   <div className="row mb-3">
                                       <div className="col"><label className="fw-bold small">Mã HP</label><input className="form-control" value={addForm.course_code} onChange={e=>setAddForm({...addForm, course_code: e.target.value})} required/></div>
                                       <div className="col"><label className="fw-bold small">Khoa</label><select className="form-select" value={addForm.department} onChange={e => setAddForm({...addForm, department: e.target.value})}><option value="CNTT">CNTT</option><option value="KT">Kinh Tế</option><option value="SP">Sư Phạm</option></select></div>
                                   </div>
                                   <div className="mb-4"><label className="fw-bold small">File</label><input type="file" className="form-control" onChange={e=>setAddFile(e.target.files[0])} required/></div>
                                   <button className="btn btn-primary w-100 rounded-pill" type="submit" disabled={loading}>{loading?'Đang tải...':'Lưu'}</button>
                               </form>
                           </div>
                       </div>
                   </div>
               </div>
            )}
             {/* Modal Edit */}
             {showEditModal && (
               <div className="modal fade show d-block" style={{background:'rgba(0,0,0,0.5)'}}>
                   <div className="modal-dialog modal-dialog-centered">
                       <div className="modal-content border-0 shadow-lg rounded-4">
                           <div className="modal-header bg-warning"><h5 className="modal-title">Sửa</h5><button className="btn-close" onClick={()=>setShowEditModal(false)}></button></div>
                           <div className="modal-body p-4">
                               <form onSubmit={handleUpdate}>
                                   <div className="mb-3"><label className="fw-bold small">Tên</label><input className="form-control" value={editForm.name} onChange={e=>setEditForm({...editForm, name: e.target.value})} required/></div>
                                   <div className="row mb-3">
                                       <div className="col"><label className="fw-bold small">Mã HP</label><input className="form-control" value={editForm.course_code} onChange={e=>setEditForm({...editForm, course_code: e.target.value})} required/></div>
                                       <div className="col"><label className="fw-bold small">Khoa</label><select className="form-select" value={editForm.department} onChange={e => setEditForm({...editForm, department: e.target.value})}><option value="CNTT">CNTT</option><option value="KT">Kinh Tế</option><option value="SP">Sư Phạm</option></select></div>
                                   </div>
                                   <div className="mb-4"><label className="fw-bold small text-danger">Đổi file (nếu cần)</label><input type="file" className="form-control" onChange={e=>setEditFile(e.target.files[0])} /></div>
                                   <button className="btn btn-warning w-100 rounded-pill" type="submit" disabled={loading}>{loading?'Đang xử lý...':'Cập Nhật'}</button>
                               </form>
                           </div>
                       </div>
                   </div>
               </div>
            )}
        </div>
    );
}