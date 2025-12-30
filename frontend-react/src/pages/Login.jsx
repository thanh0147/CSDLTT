import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const formData = new URLSearchParams();
            formData.append('username', username);
            formData.append('password', password);

            const res = await axios.post('http://127.0.0.1:8000/token', formData);
            
            // Lưu token vào localStorage
            localStorage.setItem('token', res.data.access_token);
            localStorage.setItem('user', username);
            
            navigate('/'); // Chuyển về trang chủ
        } catch (error) {
            alert('Đăng nhập thất bại!');
        }
    };

    return (
        <div className="d-flex justify-content-center align-items-center vh-100 bg-light">
            <div className="card p-4 shadow" style={{ width: '350px' }}>
                <h3 className="text-center">Đăng Nhập</h3>
                <form onSubmit={handleLogin}>
                    <div className="mb-3">
                        <label>Tài khoản</label>
                        <input className="form-control" onChange={e => setUsername(e.target.value)} />
                    </div>
                    <div className="mb-3">
                        <label>Mật khẩu</label>
                        <input type="password" className="form-control" onChange={e => setPassword(e.target.value)} />
                    </div>
                    <button className="btn btn-primary w-100">Vào Hệ Thống</button>
                </form>
            </div>
        </div>
    );
}