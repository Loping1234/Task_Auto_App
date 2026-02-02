import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { teamsAPI, employeesAPI, subadminsAPI } from '../api';
import Navbar from '../components/Navbar';
import './TeamManagement.css';

const TeamManagement = () => {
    const { isAdmin } = useAuth();
    const [teams, setTeams] = useState([]);
    const [subadmins, setSubadmins] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        teamName: '',
        subadminEmail: '',
        employees: []
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [teamsRes, subadminsRes, employeesRes] = await Promise.all([
                teamsAPI.getAll(),
                subadminsAPI.getAll(),
                employeesAPI.getAll()
            ]);
            setTeams(teamsRes.data.teams || []);
            setSubadmins(subadminsRes.data.subadmins || []);
            setEmployees(employeesRes.data.employees || []);
        } catch (err) {
            setError('Failed to load data');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateTeam = async (e) => {
        e.preventDefault();
        try {
            await teamsAPI.create(formData);
            setFormData({ teamName: '', subadminEmail: '', employees: [] });
            await fetchData();
        } catch (err) {
            console.error('Failed to create team', err);
            alert(err.response?.data?.message || 'Failed to create team');
        }
    };

    const handleDeleteTeam = async (teamName) => {
        if (!window.confirm(`Delete team "${teamName}"?`)) return;
        try {
            await teamsAPI.delete(teamName);
            await fetchData();
        } catch (err) {
            console.error('Failed to delete team', err);
        }
    };

    const handleEmployeeSelect = (e) => {
        const selected = Array.from(e.target.selectedOptions, opt => opt.value);
        setFormData({ ...formData, employees: selected });
    };

    const totalMembers = teams.reduce((acc, t) => acc + (t.employees?.length || 0), 0);

    if (!isAdmin) {
        return (
            <div className="page-layout">
                <Navbar />
                <main className="page-main">
                    <div className="error-banner">Only admins can access Team Management.</div>
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
                        <p>Loading...</p>
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
                        <h1>Team Management</h1>
                        <p className="page-subtitle">Organize employees into teams and assign sub-admin coordinators</p>
                    </div>
                </div>

                {error && <div className="error-banner">{error}</div>}

                {/* Stats Row */}
                <div className="stats-row">
                    <div className="stat-card primary">
                        <div className="stat-content">
                            <h6>Total Teams</h6>
                            <h2>{teams.length}</h2>
                        </div>
                        <div className="stat-icon">
                            <i className="fas fa-users"></i>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-content">
                            <h6>Total Members Assigned</h6>
                            <h2>{totalMembers}</h2>
                        </div>
                        <div className="stat-icon">
                            <i className="fas fa-user-check"></i>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-content">
                            <h6>Active Sub-admins</h6>
                            <h2>{subadmins.length}</h2>
                        </div>
                        <div className="stat-icon success">
                            <i className="fas fa-user-shield"></i>
                        </div>
                    </div>
                </div>

                <div className="team-mgmt-grid">
                    {/* Create Team Form */}
                    <div className="form-card">
                        <div className="form-card-header">
                            <div className="form-icon">
                                <i className="fas fa-plus"></i>
                            </div>
                            <h3>Create New Team</h3>
                        </div>

                        <form onSubmit={handleCreateTeam}>
                            <div className="form-group">
                                <label>Team Name</label>
                                <input
                                    type="text"
                                    value={formData.teamName}
                                    onChange={(e) => setFormData({ ...formData, teamName: e.target.value })}
                                    placeholder="e.g. Development Squad"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Assign Sub-Admin</label>
                                <select
                                    value={formData.subadminEmail}
                                    onChange={(e) => setFormData({ ...formData, subadminEmail: e.target.value })}
                                    required
                                >
                                    <option value="">Select Coordinator...</option>
                                    {subadmins.map((s) => (
                                        <option key={s._id || s.email} value={s.email}>{s.email}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Select Members</label>
                                <div className="multi-select-wrapper">
                                    <select
                                        multiple
                                        size={8}
                                        value={formData.employees}
                                        onChange={handleEmployeeSelect}
                                    >
                                        {employees.map((emp) => (
                                            <option key={emp._id || emp.email} value={emp.email}>
                                                {emp.email} {emp.teams?.length > 0 ? `(In: ${emp.teams.join(', ')})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <small><i className="fas fa-info-circle"></i> Hold Ctrl/Cmd to select multiple</small>
                            </div>

                            <button type="submit" className="btn btn-primary btn-block">
                                Create Team
                            </button>
                        </form>
                    </div>

                    {/* Existing Teams Table */}
                    <div className="teams-table-card">
                        <div className="teams-table-header">
                            <div className="form-card-header">
                                <div className="form-icon success">
                                    <i className="fas fa-layer-group"></i>
                                </div>
                                <h3>Existing Teams</h3>
                            </div>
                            <span className="team-count">{teams.length} Active</span>
                        </div>

                        <div className="teams-table-wrapper">
                            <table className="teams-table">
                                <thead>
                                    <tr>
                                        <th>Team Name</th>
                                        <th>Coordinator</th>
                                        <th>Members</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {teams.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="empty-row">
                                                <i className="fas fa-users-slash"></i>
                                                No teams created yet.
                                            </td>
                                        </tr>
                                    ) : (
                                        teams.map((team) => (
                                            <tr key={team._id || team.teamName}>
                                                <td className="team-name-cell">
                                                    <strong>{team.teamName}</strong>
                                                </td>
                                                <td>
                                                    <div className="coordinator-cell">
                                                        <span className="coordinator-avatar">
                                                            {team.subadminEmail?.[0]?.toUpperCase()}
                                                        </span>
                                                        <span>{team.subadminEmail}</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className="member-count-badge">
                                                        {team.employees?.length || 0} Members
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="action-btns">
                                                        <Link
                                                            to={`/teams/${encodeURIComponent(team.teamName)}/edit`}
                                                            className="action-btn edit"
                                                        >
                                                            <i className="fas fa-edit"></i>
                                                        </Link>
                                                        <button
                                                            className="action-btn delete"
                                                            onClick={() => handleDeleteTeam(team.teamName)}
                                                        >
                                                            <i className="fas fa-trash"></i>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default TeamManagement;
