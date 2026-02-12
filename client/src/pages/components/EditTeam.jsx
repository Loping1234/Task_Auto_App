import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { teamsAPI, employeesAPI, subadminsAPI } from '../../api';
import Navbar from '../../components/Navbar';
import '../styles/TeamManagement.css';

const EditTeam = () => {
    const { teamName } = useParams();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [subadmins, setSubadmins] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [originalTeam, setOriginalTeam] = useState(null);

    const [formData, setFormData] = useState({
        newTeamName: '',
        subadminEmail: '',
        employees: []
    });

    const fetchData = useCallback(async () => {
        try {
            const decodedName = decodeURIComponent(teamName);

            const [teamsRes, subadminsRes, employeesRes] = await Promise.all([
                teamsAPI.getAll(),
                subadminsAPI.getAll(),
                employeesAPI.getAll()
            ]);

            const allTeams = teamsRes.data.teams || [];
            const team = allTeams.find(t => t.teamName === decodedName);

            setSubadmins(subadminsRes.data.subadmins || []);
            setEmployees(employeesRes.data.employees || []);

            if (team) {
                setOriginalTeam(team);
                setFormData({
                    newTeamName: team.teamName,
                    subadminEmail: team.subadminEmail,
                    employees: team.employees || []
                });
            } else {
                alert('Team not found');
                navigate('/team-management');
            }
        } catch (err) {
            console.error('Failed to load data', err);
        } finally {
            setLoading(false);
        }
    }, [navigate, teamName]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await teamsAPI.update(teamName, formData);
            navigate('/team-management');
        } catch (err) {
            console.error('Failed to update team', err);
            alert('Failed to update team');
        }
    };

    const handleEmployeeSelect = (e) => {
        const selected = Array.from(e.target.selectedOptions, opt => opt.value);
        setFormData({ ...formData, employees: selected });
    };

    if (loading) {
        return (
            <div className="page-layout">
                <Navbar />
                <main className="page-main">
                    <div className="loading-container">
                        <div className="spinner"></div>
                        <p>Loading team details...</p>
                    </div>
                </main>
            </div>
        );
    }

    if (!originalTeam) return null;

    return (
        <div className="page-layout">
            <Navbar />
            <main className="page-main">
                <div className="page-header">
                    <div>
                        <Link to="/team-management" className="text-muted small text-decoration-none">
                            <i className="fas fa-arrow-left"></i> Back to Team Management
                        </Link>
                        <h1 className="mt-2">Edit Team: {originalTeam.teamName}</h1>
                        <p className="page-subtitle">Update team details and coordinate members</p>
                    </div>
                </div>

                <div className="team-mgmt-grid">
                    <div className="form-card" style={{ gridColumn: 'span 2' }}>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label>Team Name</label>
                                <input
                                    type="text"
                                    value={formData.newTeamName}
                                    onChange={(e) => setFormData({ ...formData, newTeamName: e.target.value })}
                                    required
                                />
                                <small>Changing name will update all associated tasks.</small>
                            </div>

                            <div className="form-group">
                                <label>Sub-Admin Coordinator</label>
                                <select
                                    value={formData.subadminEmail}
                                    onChange={(e) => setFormData({ ...formData, subadminEmail: e.target.value })}
                                    required
                                >
                                    {subadmins.map((s) => (
                                        <option key={s._id || s.email} value={s.email}>{s.email}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Team Members</label>
                                <div className="multi-select-wrapper" style={{ height: '300px' }}>
                                    <select
                                        multiple
                                        size={15}
                                        value={formData.employees}
                                        onChange={handleEmployeeSelect}
                                        style={{ height: '100%' }}
                                    >
                                        {employees.map((emp) => {
                                            const inCurrentTeam = originalTeam.employees.includes(emp.email);
                                            return (
                                                <option key={emp._id || emp.email} value={emp.email}>
                                                    {emp.email} {(!inCurrentTeam && emp.teams?.length > 0) ? `(In: ${emp.teams.join(', ')})` : ''}
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>
                                <small>Hold Ctrl/Cmd to select multiple members.</small>
                            </div>

                            <div className="d-flex gap-3">
                                <button type="submit" className="btn btn-primary">Save Changes</button>
                                <Link to="/team-management" className="btn btn-secondary">Cancel</Link>
                            </div>
                        </form>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default EditTeam;
