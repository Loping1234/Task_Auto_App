import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext'; // Adjusted import path
import Navbar from '../../components/Navbar';
import axios from 'axios';
import '../styles/Dashboard.css'; // Reuse dashboard styles for layout
import { getImageUrl } from '../../utils/imageUtils';

const Profile = () => {
    const { user, updateUser } = useAuth(); // Destructure updateUser
    const [activeTab, setActiveTab] = useState('profile');
    const [fullName, setFullName] = useState(user?.fullName || user?.name || user?.email?.split('@')[0]);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [previewImage, setPreviewImage] = useState(null);
    const fileInputRef = useRef(null);
    const [twoFactorEnabled, setTwoFactorEnabled] = useState(user?.twoFactorEnabled !== false);

    useEffect(() => {
        setTwoFactorEnabled(user?.twoFactorEnabled !== false);
    }, [user]);

    const handleProfileUpdate = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');
        setError('');
        try {
            const token = localStorage.getItem('token');
            const res = await axios.put('http://localhost:5000/api/users/profile', { fullName }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMessage(res.data.message);
            updateUser(res.data.user); // Update local user context
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update profile');
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            setError("New passwords don't match");
            return;
        }
        setLoading(true);
        setMessage('');
        setError('');
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('http://localhost:5000/api/auth/change-password', {
                currentPassword,
                newPassword
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMessage(res.data.message);
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to change password');
        } finally {
            setLoading(false);
        }
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setPreviewImage(URL.createObjectURL(file));
        }
    };

    const handleImageUpload = async () => {
        if (!fileInputRef.current.files[0]) {
            setError("Please select an image");
            return;
        }
        setLoading(true);
        setMessage('');
        setError('');
        const formData = new FormData();
        formData.append('profilePicture', fileInputRef.current.files[0]);

        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('http://localhost:5000/api/users/profile-picture', formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });
            setMessage(res.data.message);
            updateUser({ profilePicture: res.data.profilePicture }); // Update profile picture in context
            setPreviewImage(null);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to upload image');
        } finally {
            setLoading(false);
        }
    };

    const handleToggle2FA = async (e) => {
        const enabled = e.target.checked;
        setLoading(true);
        setMessage('');
        setError('');
        try {
            const token = localStorage.getItem('token');
            const res = await axios.put('/api/users/toggle2fa', { enabled }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setTwoFactorEnabled(enabled);
            setMessage(res.data.message);
            updateUser({ twoFactorEnabled: enabled });
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update 2FA setting');
            setTwoFactorEnabled(!enabled); // Revert on error
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="dashboard-layout">
            <Navbar />
            <main className="dashboard-main">
                <div className="profile-container" style={{ maxWidth: '800px', margin: '0 auto', background: 'var(--bg-secondary)', padding: '2rem', borderRadius: 'var(--radius-lg)' }}>
                    <h1 style={{ marginBottom: '1.5rem', color: 'var(--text-primary)' }}>My Profile</h1>

                    {/* Tabs */}
                    <div className="profile-tabs" style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '2rem' }}>
                        {['profile', 'picture', 'security', 'password'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                style={{
                                    padding: '1rem 2rem',
                                    background: 'none',
                                    border: 'none',
                                    borderBottom: activeTab === tab ? '2px solid var(--primary)' : '2px solid transparent',
                                    color: activeTab === tab ? 'var(--primary)' : 'var(--text-secondary)',
                                    fontWeight: activeTab === tab ? '600' : '500',
                                    cursor: 'pointer',
                                    textTransform: 'capitalize'
                                }}
                            >
                                {tab === 'password' ? 'Change Password' : tab}
                            </button>
                        ))}
                    </div>

                    {/* Messages */}
                    {message && <div className="success-banner" style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', color: '#059669', borderRadius: '8px', marginBottom: '1rem' }}>{message}</div>}
                    {error && <div className="error-banner" style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', color: '#dc2626', borderRadius: '8px', marginBottom: '1rem' }}>{error}</div>}

                    {/* Content */}
                    <div className="tab-content">
                        {activeTab === 'profile' && (
                            <form onSubmit={handleProfileUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <div className="form-group">
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Email (Read-only)</label>
                                    <input type="text" value={user?.email} disabled style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-muted)' }} />
                                </div>
                                <div className="form-group">
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Role (Read-only)</label>
                                    <input type="text" value={user?.role} disabled style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-muted)', textTransform: 'capitalize' }} />
                                </div>
                                <div className="form-group">
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Full Name</label>
                                    <input
                                        type="text"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                                    />
                                </div>
                                <button type="submit" className="btn btn-primary" disabled={loading} style={{ alignSelf: 'flex-start' }}>
                                    {loading ? 'Saving...' : 'Save Profile'}
                                </button>
                            </form>
                        )}

                        {activeTab === 'picture' && (
                            <div className="picture-upload-section" style={{ textAlign: 'center' }}>
                                <div className="current-picture" style={{ width: '150px', height: '150px', borderRadius: '50%', background: 'var(--bg-primary)', margin: '0 auto 2rem', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '4px solid var(--border-color)' }}>
                                    {previewImage ? (
                                        <img src={previewImage} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : user?.profilePicture ? (
                                        <img src={getImageUrl(user.profilePicture)} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        <span style={{ fontSize: '3rem', color: 'var(--text-muted)' }}>{user?.email?.[0]?.toUpperCase()}</span>
                                    )}
                                </div>

                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleImageChange}
                                    style={{ display: 'none' }}
                                    accept="image/*"
                                />
                                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        onClick={() => fileInputRef.current.click()}
                                    >
                                        Select Image
                                    </button>
                                    {previewImage && (
                                        <button
                                            type="button"
                                            className="btn btn-primary"
                                            onClick={handleImageUpload}
                                            disabled={loading}
                                        >
                                            {loading ? 'Uploading...' : 'Upload New Picture'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'security' && (
                            <div className="security-section" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <div className="form-group" style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'space-between',
                                    padding: '1.5rem',
                                    background: 'var(--bg-primary)',
                                    borderRadius: '12px',
                                    border: '1px solid var(--border-color)'
                                }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-primary)', fontWeight: '600', fontSize: '1.1rem' }}>
                                            Two-Factor Authentication (2FA)
                                        </label>
                                        <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.9rem' }}>
                                            {twoFactorEnabled 
                                                ? 'An OTP will be sent to your email each time you log in.' 
                                                : '2FA is disabled. You will log in directly without OTP verification.'}
                                        </p>
                                    </div>
                                    <label style={{ 
                                        position: 'relative', 
                                        display: 'inline-block', 
                                        width: '60px', 
                                        height: '34px',
                                        flexShrink: 0,
                                        marginLeft: '1rem'
                                    }}>
                                        <input
                                            type="checkbox"
                                            checked={twoFactorEnabled}
                                            onChange={handleToggle2FA}
                                            disabled={loading}
                                            style={{ opacity: 0, width: 0, height: 0 }}
                                        />
                                        <span style={{
                                            position: 'absolute',
                                            cursor: loading ? 'not-allowed' : 'pointer',
                                            top: 0,
                                            left: 0,
                                            right: 0,
                                            bottom: 0,
                                            backgroundColor: twoFactorEnabled ? 'var(--primary)' : '#ccc',
                                            transition: '0.4s',
                                            borderRadius: '34px'
                                        }}>
                                            <span style={{
                                                position: 'absolute',
                                                content: '""',
                                                height: '26px',
                                                width: '26px',
                                                left: twoFactorEnabled ? '30px' : '4px',
                                                bottom: '4px',
                                                backgroundColor: 'white',
                                                transition: '0.4s',
                                                borderRadius: '50%'
                                            }}></span>
                                        </span>
                                    </label>
                                </div>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
                                    <strong>Note:</strong> Changes will take effect from your next login session.
                                </p>
                            </div>
                        )}

                        {activeTab === 'password' && (
                            <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <div className="form-group">
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Current Password</label>
                                    <input
                                        type="password"
                                        value={currentPassword}
                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                        required
                                        style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                                    />
                                </div>
                                <div className="form-group">
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>New Password</label>
                                    <input
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        required
                                        minLength="6"
                                        style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                                    />
                                </div>
                                <div className="form-group">
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Confirm New Password</label>
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                        style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                                    />
                                </div>
                                <button type="submit" className="btn btn-primary" disabled={loading} style={{ alignSelf: 'flex-start' }}>
                                    {loading ? 'Updating...' : 'Update Password'}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Profile;
