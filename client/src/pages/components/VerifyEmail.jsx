import { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { authAPI } from '../../api';
import '../styles/Auth.css';

const VerifyEmail = () => {
    const [status, setStatus] = useState('verifying'); // verifying, success, error
    const [message, setMessage] = useState('Verifying your email...');
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        const verify = async () => {
            const params = new URLSearchParams(location.search);
            const token = params.get('token');
            const email = params.get('email');

            if (!token || !email) {
                setStatus('error');
                setMessage('Invalid verification link.');
                return;
            }

            try {
                const response = await authAPI.verifyEmail(email, token);
                setStatus('success');
                setMessage(response.data.message || 'Email verified successfully!');

                // Auto redirect to login after 3 seconds
                setTimeout(() => {
                    navigate('/login');
                }, 3000);
            } catch (err) {
                setStatus('error');
                setMessage(err.response?.data?.message || 'Verification failed. The link may be expired.');
            }
        };

        verify();
    }, [location, navigate]);

    return (
        <div className="auth-container">
            <div className="auth-background">
                <div className="shape shape-1"></div>
                <div className="shape shape-2"></div>
                <div className="shape shape-3"></div>
            </div>

            <div className="auth-card">
                <div className="auth-header">
                    <span className="auth-logo">
                        {status === 'verifying' && '⏳'}
                        {status === 'success' && '✅'}
                        {status === 'error' && '❌'}
                    </span>
                    <h1>Email Verification</h1>
                </div>

                <div className="auth-body" style={{ textAlign: 'center', padding: '20px 0' }}>
                    <p style={{ fontSize: '1.1rem', marginBottom: '20px' }}>{message}</p>

                    {status === 'verifying' && <div className="spinner" style={{ margin: '0 auto' }}></div>}

                    {status === 'success' && (
                        <p className="redirect-text">Redirecting to login page in 3 seconds...</p>
                    )}
                </div>

                <div className="auth-footer">
                    <Link to="/login" className="auth-btn" style={{ textDecoration: 'none', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        Back to Login
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default VerifyEmail;
