import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { teamsAPI } from '../../api';
import Navbar from '../../components/Navbar';
import '../styles/Teams.css';

const Teams = () => {
    const { isAdmin, isSubadmin } = useAuth();
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchTeams();
    }, []);

    const fetchTeams = async () => {
        try {
            const response = await teamsAPI.getAll();
            setTeams(response.data.teams || response.data);
        } catch (err) {
            setError('Failed to load teams');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (teamName) => {
        if (!window.confirm(`Are you sure you want to delete team "${teamName}"?`)) return;

        try {
            await teamsAPI.delete(teamName);
            setTeams(teams.filter(t => t.teamName !== teamName));
        } catch (err) {
            console.error('Failed to delete team', err);
        }
    };

    if (!isAdmin && !isSubadmin) {
        return (
            <div className="page-layout">
                <Navbar />
                <main className="page-main">
                    <div className="error-banner">You do not have permission to view teams.</div>
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
                        <p>Loading teams...</p>
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
                        <h1>Teams</h1>
                        <p className="page-subtitle">Manage teams and member assignments</p>
                    </div>
                    {isAdmin && (
                        <Link to="/teams/create" className="btn btn-primary">
                            <i className="fas fa-plus"></i> Create Team
                        </Link>
                    )}
                </div>

                {error && <div className="error-banner">{error}</div>}

                <div className="teams-grid">
                    {teams.length === 0 ? (
                        <div className="empty-state">
                            <i className="fas fa-user-friends"></i>
                            <h3>No teams found</h3>
                            <p>Create a team to get started</p>
                        </div>
                    ) : (
                        teams.map(team => (
                            <div key={team._id || team.teamName} className="team-card">
                                <div className="team-header">
                                    <div className="team-icon">
                                        <i className="fas fa-users"></i>
                                    </div>
                                    <h3>{team.teamName}</h3>
                                </div>

                                <div className="team-details">
                                    <p className="team-subadmin">
                                        <i className="fas fa-user-shield"></i>
                                        {team.subadminEmail}
                                    </p>
                                    <p className="team-member-count">
                                        <i className="fas fa-users"></i>
                                        {team.employees?.length || 0} members
                                    </p>
                                </div>

                                {team.employees && team.employees.length > 0 && (
                                    <div className="team-members">
                                        {team.employees.slice(0, 3).map((email, idx) => (
                                            <span key={idx} className="member-chip">
                                                {email.split('@')[0]}
                                            </span>
                                        ))}
                                        {team.employees.length > 3 && (
                                            <span className="member-more">+{team.employees.length - 3} more</span>
                                        )}
                                    </div>
                                )}

                                {isAdmin && (
                                    <div className="team-actions">
                                        <Link to={`/teams/${encodeURIComponent(team.teamName)}/edit`} className="action-btn edit">
                                            <i className="fas fa-edit"></i> Edit
                                        </Link>
                                        <button
                                            className="action-btn delete"
                                            onClick={() => handleDelete(team.teamName)}
                                        >
                                            <i className="fas fa-trash"></i> Delete
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </main>
        </div>
    );
};

export default Teams;
