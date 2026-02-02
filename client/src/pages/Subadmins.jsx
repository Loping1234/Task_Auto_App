import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { subadminsAPI } from '../api';
import Navbar from '../components/Navbar';
import './Subadmins.css';

const Subadmins = () => {
    const { isAdmin } = useAuth();
    const [subadmins, setSubadmins] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchSubadmins();
    }, []);

    const fetchSubadmins = async () => {
        try {
            const response = await subadminsAPI.getAll();
            setSubadmins(response.data.subadmins || []);
        } catch (err) {
            setError('Failed to load subadmins');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (!isAdmin) {
        return (
            <div className="page-layout">
                <Navbar />
                <main className="page-main">
                    <div className="error-banner">Only admins can view subadmins.</div>
                </main>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="page-layout">
                <Navbar />
                <main className="page-main">
                    <div className="loading-container">
                        <div className="spinner"></div>
                        <p>Loading subadmins...</p>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="page-layout">
            <Navbar />
            <main className="page-main">
                <div className="page-header">
                    <div>
                        <h1>Subadmin Directory</h1>
                        <p className="page-subtitle">Manage and view all registered subadmins</p>
                    </div>
                </div>

                {error && <div className="error-banner">{error}</div>}

                <div className="subadmins-card">
                    <table className="subadmins-table">
                        <thead>
                            <tr>
                                <th style={{ width: '80px' }}>Sr. No.</th>
                                <th>Subadmin Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            {subadmins.length === 0 ? (
                                <tr>
                                    <td colSpan={2} className="empty-row">
                                        <i className="fas fa-user-slash"></i>
                                        No subadmins found
                                    </td>
                                </tr>
                            ) : (
                                subadmins.map((subadmin, index) => (
                                    <tr key={subadmin._id || subadmin.email}>
                                        <td className="serial-cell">{index + 1}</td>
                                        <td>
                                            <div className="subadmin-info">
                                                <div className="subadmin-avatar">
                                                    {subadmin.email?.[0]?.toUpperCase() || '?'}
                                                </div>
                                                <div>
                                                    <div className="subadmin-email">{subadmin.email}</div>
                                                    <div className="subadmin-role">Sub-admin</div>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </main>
        </div>
    );
};

export default Subadmins;
