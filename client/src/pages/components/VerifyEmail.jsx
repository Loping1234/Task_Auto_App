import { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { authAPI } from '../../api';
import '../styles/Auth.css';

const VerifyEmail = () => {
    const [status, setStatus] = useState('verifying'); // verifying, success, error
    const [message, setMessage] = useState('Verifying your email...');
    const [resending, setResending] = useState(false);
    const [resendMsg, setResendMsg] = useState('');
    const [cooldown, setCooldown] = useState(0);
    const location = useLocation();
    const navigate = useNavigate();

    const email = new URLSearchParams(location.search).get('email');

    useEffect(() => {
        const verify = async () => {
            const params = new URLSearchParams(location.search);
            const token = params.get('token');
            const emailParam = params.get('email');

            if (!token || !emailParam) {
                setStatus('error');
                setMessage('Invalid verification link.');
                return;
            }

            try {
                const response = await authAPI.verifyEmail(emailParam, token);
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

    // Cooldown timer
    useEffect(() => {
        if (cooldown <= 0) return;
        const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
        return () => clearTimeout(timer);
    }, [cooldown]);

    const handleResend = async () => {
        if (!email || resending || cooldown > 0) return;
        setResending(true);
        setResendMsg('');
        try {
            const res = await authAPI.resendOtp(email);
            setResendMsg(res.data.message || 'Verification link resent! Check your email.');
            setCooldown(60); // 60 second cooldown
        } catch (err) {
            setResendMsg(err.response?.data?.message || 'Failed to resend. Please try again.');
        } finally {
            setResending(false);
        }
    };

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

                    {status === 'error' && email && (
                        <div style={{ marginTop: '15px' }}>
                            <button
                                className="auth-btn"
                                onClick={handleResend}
                                disabled={resending || cooldown > 0}
                                style={{ cursor: resending || cooldown > 0 ? 'not-allowed' : 'pointer', opacity: resending || cooldown > 0 ? 0.7 : 1 }}
                            >
                                {resending ? 'Sending...' : cooldown > 0 ? `Resend in ${cooldown}s` : '🔄 Resend Verification Link'}
                            </button>
                            {resendMsg && <p style={{ marginTop: '10px', color: '#4caf50' }}>{resendMsg}</p>}
                        </div>
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
