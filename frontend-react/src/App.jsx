import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import FileViewer from './pages/FileViewer';

function App() {
  // Hàm kiểm tra xem đã đăng nhập chưa
  const PrivateRoute = ({ children }) => {
    const token = localStorage.getItem('token');
    return token ? children : <Navigate to="/login" />;
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route path="/" element={
          <PrivateRoute><Dashboard /></PrivateRoute>
        } />
        
        {/* Route xem file live */}
        <Route path="/view/:fileId" element={
          <PrivateRoute><FileViewer /></PrivateRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;