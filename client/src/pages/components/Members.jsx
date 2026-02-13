import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { employeesAPI, teamsAPI, subadminsAPI } from '../../api';
import Navbar from '../../components/Navbar';
import '../styles/Employees.css';

const Members = () => {
    const { isAdmin, isSubadmin } = useAuth();
    const [activeView, setActiveView] = useState('employees'); // 'employees', 'teams', 'subadmins'
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchData();
    }, [activeView]);

    const fetchData = async () => {
        setLoading(true);
        setError('');
        try {
            let response;
            if (activeView === 'employees') {
                response = await employeesAPI.getAll();
                setData(response.data.employees || response.data);
            } else if (activeView === 'teams') {
                response = await teamsAPI.getAll();
                setData(response.data.teams || response.data);
            } else if (activeView === 'subadmins') {
                response = await subadminsAPI.getAll();
                setData(response.data.subadmins || response.data);
            }
        } catch (err) {
            setError(`Failed to load ${activeView}`);
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const filteredData = data.filter(item => {
        const searchLower = searchTerm.toLowerCase();
        if (activeView === 'teams') {
            return item.teamName?.toLowerCase().includes(searchLower);
        }
        return (
            item.email?.toLowerCase().includes(searchLower) ||
            item.name?.toLowerCase().includes(searchLower)
        );
    });

    if (!isAdmin && !isSubadmin) {
        return (
            <div className="page-layout">
                <Navbar />
                <main className="page-main">
                    <div className="error-banner">You do not have permission to view members.</div>
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
                        <h1>Members & Teams</h1>
                        <p className="page-subtitle">Manage employees, subadmins, and teams</p>
                    </div>
                </div>

                <div className="controls-bar">
                    <div className="filter-tabs" style={{ marginBottom: '1rem' }}>
                        <button
                            className={`filter-tab ${activeView === 'employees' ? 'active' : ''}`}
                            onClick={() => setActiveView('employees')}
                        >
                            Employees
                        </button>
                        <button
                            className={`filter-tab ${activeView === 'teams' ? 'active' : ''}`}
                            onClick={() => setActiveView('teams')}
                        >
                            Teams
                        </button>
                        {isAdmin && (
                            <button
                                className={`filter-tab ${activeView === 'subadmins' ? 'active' : ''}`}
                                onClick={() => setActiveView('subadmins')}
                            >
                                Subadmins
                            </button>
                        )}
                    </div>
                </div>

                {error && <div className="error-banner">{error}</div>}

                {loading ? (
                    <div className="loading-container">
                        <div className="spinner"></div>
                        <p>Loading {activeView}...</p>
                    </div>
                ) : (
                    <div className="members-table-container">
                        {filteredData.length === 0 ? (
                            <div className="empty-state">
                                <i className="fas fa-users"></i>
                                <h3>No {activeView} found</h3>
                            </div>
                        ) : (
                            <table className="members-table">
                                <thead>
                                    <tr>
                                        {(activeView === 'employees' || activeView === 'subadmins') && (
                                            <>
                                                <th>Name</th>
                                                <th>Email</th>
                                                <th>{activeView === 'employees' ? 'Teams' : 'Role'}</th>
                                            </>
                                        )}
                                        {activeView === 'teams' && (
                                            <>
                                                <th>Team Name</th>
                                                <th>Leader</th>
                                                <th>Members</th>
                                            </>
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredData.map((item, idx) => (
                                        <tr key={item._id || idx}>
                                            {/* Name / Team Name Column */}
                                            <td>
                                                <div className="table-avatar-cell">
                                                    <div className="small-avatar">
                                                        {(activeView === 'teams'
                                                            ? item.teamName
                                                            : (item.name || item.email)
                                                        )?.[0]?.toUpperCase() || '?'}
                                                    </div>
                                                    <span style={{ fontWeight: 500 }}>
                                                        {activeView === 'teams'
                                                            ? item.teamName
                                                            : (item.name || item.email?.split('@')[0])
                                                        }
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Middle Column */}
                                            <td>
                                                {activeView === 'teams' ? (
                                                    <span className="employee-email">{item.subadminEmail}</span>
                                                ) : (
                                                    <span className="employee-email">{item.email}</span>
                                                )}
                                            </td>

                                            {/* Third Column */}
                                            <td>
                                                {activeView === 'employees' && (
                                                    item.teams && item.teams.length > 0 ? (
                                                        <div className="employee-teams">
                                                            {item.teams.map((team, tIdx) => (
                                                                <span key={tIdx} className="team-tag">{team}</span>
                                                            ))}
                                                        </div>
                                                    ) : <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>-</span>
                                                )}

                                                {activeView === 'subadmins' && (
                                                    <span className="role-badge">Subadmin</span>
                                                )}

                                                {activeView === 'teams' && (
                                                    <span className="employee-count">
                                                        <span>{item.employees?.length || 0}</span> members
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
};

export default Members;
