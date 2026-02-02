import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

const Signup = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    const { signup } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setLoading(true);

        try {
            await signup(email, password);
            setSuccess('Account created successfully! Redirecting to login...');
            setTimeout(() => navigate('/login'), 2000);
        } catch (err) {
            setError(err.response?.data?.message || 'Signup failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const getRoleHint = () => {
        if (email.includes('@admin.com')) return { role: 'Admin', color: '#ef4444' };
        if (email.includes('@subadmin.com')) return { role: 'Sub-Admin', color: '#f59e0b' };
        if (email.includes('@emp.com')) return { role: 'Employee', color: '#10b981' };
        return null;
    };

    const roleHint = getRoleHint();

    return (
        <div className="auth-container">
            <div className="auth-background">
                <div className="shape shape-1"></div>
                <div className="shape shape-2"></div>
                <div className="shape shape-3"></div>
            </div>

            <div className="auth-card">
                <div className="auth-header">
                    <span className="auth-logo">📋</span>
                    <h1>Create Account</h1>
                    <p>Join TaskFlow to manage your tasks</p>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                    {error && <div className="error-message">{error}</div>}
                    {success && <div className="success-message">{success}</div>}

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
                        {roleHint && (
                            <span className="role-hint" style={{ color: roleHint.color }}>
                                Will be registered as: {roleHint.role}
                            </span>
                        )}
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
                                placeholder="Create a password"
                                required
                                minLength={6}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="confirmPassword">Confirm Password</label>
                        <div className="input-wrapper">
                            <i className="fas fa-lock"></i>
                            <input
                                type="password"
                                id="confirmPassword"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Confirm your password"
                                required
                            />
                        </div>
                    </div>

                    <button type="submit" className="auth-btn" disabled={loading}>
                        {loading ? (
                            <>
                                <span className="spinner-small"></span>
                                Creating account...
                            </>
                        ) : (
                            <>
                                <i className="fas fa-user-plus"></i>
                                Create Account
                            </>
                        )}
                    </button>
                </form>

                <div className="auth-footer">
                    <p>Already have an account? <Link to="/login">Sign in</Link></p>
                </div>

                <div className="auth-roles-info">
                    <p><strong>Role assignment by email domain:</strong></p>
                    <ul>
                        <li><code>@admin.com</code> → Admin</li>
                        <li><code>@subadmin.com</code> → Sub-Admin</li>
                        <li><code>@emp.com</code> → Employee</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default Signup;
