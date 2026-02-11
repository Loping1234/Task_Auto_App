import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { authAPI } from '../../api';
import '../styles/Auth.css';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [otp, setOtp] = useState('');
    const [require2FA, setRequire2FA] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [loading, setLoading] = useState(false);

    const { login, verify2FA } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const from = location.state?.from?.pathname || '/dashboard';

    // Theme toggle logic...
    const [darkMode, setDarkMode] = useState(() => {
        return localStorage.getItem('theme') === 'dark';
    });

    const toggleDarkMode = () => {
        const newMode = !darkMode;
        setDarkMode(newMode);
        if (newMode) {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
            localStorage.setItem('theme', 'light');
        }
    };

    // Apply theme on mount
    useEffect(() => {
        if (darkMode) {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
        }
    }, [darkMode]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');
        setLoading(true);

        try {
            if (require2FA) {
                await verify2FA(email, otp);
                navigate(from, { replace: true });
            } else {
                const res = await login(email, password);
                if (res.require2FA) {
                    setRequire2FA(true);
                    setSuccessMessage('OTP sent to your email. Please verify to continue.');
                } else {
                    navigate(from, { replace: true });
                }
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Action failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleResendOtp = async () => {
        try {
            await authAPI.resendOtp(email);
            setSuccessMessage('A new code has been sent to your email.');
            setError('');
        } catch (err) {
            setError('Failed to resend code. Please try again later.');
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
                    <span className="auth-logo">📋</span>
                    <h1>{require2FA ? 'Two-Factor Authentication' : 'Welcome Back'}</h1>
                    <p>{require2FA ? 'Enter the code sent to your email' : 'Sign in to continue to TaskFlow'}</p>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                    {error && <div className="error-message">{error}</div>}
                    {successMessage && <div className="success-message" style={{ color: '#007bff', backgroundColor: 'rgba(0,123,255,0.1)', padding: '10px', borderRadius: '5px', marginBottom: '15px', fontSize: '0.9rem' }}>{successMessage}</div>}

                    {!require2FA ? (
                        <>
                            <div className="form-group">
                                <label htmlFor="email">Email Address</label>
                                <div className="input-wrapper">
                                    <i className="fas fa-envelope"></i>
                                    <input
                                        type="email"
                                        id="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="you@example.com"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label htmlFor="password">Password</label>
                                <div className="input-wrapper">
                                    <i className="fas fa-lock"></i>
                                    <input
                                        type="password"
                                        id="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter your password"
                                        required
                                    />
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="form-group">
                            <label htmlFor="otp">OTP Code</label>
                            <div className="input-wrapper">
                                <i className="fas fa-shield-alt"></i>
                                <input
                                    type="text"
                                    id="otp"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value)}
                                    placeholder="6-digit code"
                                    required
                                    autoFocus
                                />
                            </div>
                            <button
                                type="button"
                                className="resend-link"
                                style={{ background: 'none', border: 'none', color: '#007bff', cursor: 'pointer', fontSize: '0.85rem', marginTop: '10px', textAlign: 'left', padding: 0 }}
                                onClick={handleResendOtp}
                            >
                                Didn't get a code? Resend
                            </button>
                        </div>
                    )}

                    <button type="submit" className="auth-btn" disabled={loading} style={{ marginTop: '20px' }}>
                        {loading ? (
                            <>
                                <span className="spinner-small"></span>
                                {require2FA ? 'Verifying...' : 'Signing in...'}
                            </>
                        ) : (
                            <>
                                <i className={require2FA ? 'fas fa-check-circle' : 'fas fa-sign-in-alt'}></i>
                                {require2FA ? 'Verify Code' : 'Sign In'}
                            </>
                        )
                        }
                    </button>

                    {require2FA && (
                        <button
                            type="button"
                            className="back-to-login"
                            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.9rem', marginTop: '15px', width: '100%', textAlign: 'center' }}
                            onClick={() => {
                                setRequire2FA(false);
                                setOtp('');
                                setSuccessMessage('');
                                setError('');
                            }}
                        >
                            <i className="fas fa-arrow-left" style={{ marginRight: '8px' }}></i>
                            Back to Sign In
                        </button>
                    )}
                </form>

                <div className="auth-footer">
                    <p>Don't have an account? <Link to="/signup">Sign up</Link></p>
                    <p>Forgot your password? <Link to="/forget-password">Reset Password</Link></p>
                </div>
            </div>
        </div>
    );
};

export default Login;