import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';
import '../styles/Auth.css';

const EnterOTP = () => {
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [darkMode, setDarkMode] = useState(() => {
        return localStorage.getItem('theme') === 'dark';
    });
    const [countdown, setCountdown] = useState(90); // 1.5 minutes
    const [canResend, setCanResend] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const email = location.state?.email || '';

    const toggleDarkMode = () => {
        const newMode = !darkMode;
        setDarkMode(newMode);
        document.documentElement.setAttribute('data-theme', newMode ? 'dark' : 'light');
        localStorage.setItem('theme', newMode ? 'dark' : 'light');
    };

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    }, [darkMode]);

    useEffect(() => {
        let timer;
        if (countdown > 0) {
            timer = setTimeout(() => setCountdown(countdown - 1), 1000);
        } else {
            setCanResend(true);
        }
        return () => clearTimeout(timer);
    }, [countdown]);

    useEffect(() => {
        if (!email) {
            navigate('/signup');
        }
    }, [email, navigate]);

    const handleResend = async () => {
        setLoading(true);
        setMessage('');
        setError('');
        try {
            const res = await axios.post('http://localhost:5000/api/auth/resend-otp', { email });
            setMessage(res.data.message);
            setCountdown(90);
            setCanResend(false);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to resend OTP');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        setLoading(true);
        try {
            const response = await axios.post('http://localhost:5000/api/auth/verify-email', { email, otp });
            setMessage(response.data.message);
            setTimeout(() => navigate('/login'), 2000);
        } catch (err) {
            setError(err.response?.data?.message || 'Verification failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <button onClick={toggleDarkMode} className="theme-toggle-btn-dark" title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
                <i className={darkMode ? 'fas fa-sun' : 'fas fa-moon'}></i>
            </button>
            <div className="auth-background">
                <div className="shape shape-1"></div>
                <div className="shape shape-2"></div>
                <div className="shape shape-3"></div>
            </div>

            <div className="auth-card">
                <div className="auth-header">
                    <span className="auth-logo">✉️</span>
                    <h1>Verify Email</h1>
                    <p>Enter the 6-digit OTP sent to <strong>{email}</strong></p>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                    {error && <div className="error-message">{error}</div>}
                    {message && <div className="success-message" style={{ color: 'green', padding: '10px', background: '#e8f5e9', borderRadius: '5px', marginBottom: '15px' }}>{message}</div>}

                    <div className="form-group">
                        <label htmlFor="otp">Verification Code</label>
                        <div className="input-wrapper">
                            <i className="fas fa-key"></i>
                            <input
                                type="text"
                                id="otp"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                placeholder="Enter 6-digit OTP"
                                maxLength={6}
                                required
                            />
                        </div>
                    </div>
                    <div style={{ marginBottom: '15px' }}>
                        <button 
                            type="button" 
                            className="auth-btn secondary-btn" 
                            onClick={handleResend}
                            disabled={!canResend || loading}
                            style={{ opacity: !canResend ? 0.6 : 1, cursor: !canResend ? 'not-allowed' : 'pointer', background: '#4b5563' }}
                        >
                            {canResend ? 'Resend OTP' : `Resend OTP in ${Math.floor(countdown / 60)}:${(countdown % 60).toString().padStart(2, '0')}`}
                        </button>
                    </div>
                    <button type="submit" className="auth-btn" disabled={loading}>
                        {loading ? (
                            <>
                                <span className="spinner-small"></span>
                                Verifying...
                            </>
                        ) : (
                            'Verify Email'
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default EnterOTP;