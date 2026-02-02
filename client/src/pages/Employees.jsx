import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { employeesAPI } from '../api';
import Navbar from '../components/Navbar';
import './Employees.css';

const Employees = () => {
    const { isAdmin, isSubadmin } = useAuth();
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchEmployees();
    }, []);

    const fetchEmployees = async () => {
        try {
            const response = await employeesAPI.getAll();
            setEmployees(response.data.employees || response.data);
        } catch (err) {
            setError('Failed to load employees');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const filteredEmployees = employees.filter(emp =>
        emp.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (!isAdmin && !isSubadmin) {
        return (
            <div className="page-layout">
                <Navbar />
                <main className="page-main">
                    <div className="error-banner">You do not have permission to view employees.</div>
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
                        <p>Loading employees...</p>
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
                        <h1>Employees</h1>
                        <p className="page-subtitle">View and manage employee information</p>
                    </div>
                </div>

                <div className="controls-bar">
                    <div className="search-box">
                        <i className="fas fa-search"></i>
                        <input
                            type="text"
                            placeholder="Search employees..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="employee-count">
                        <span>{filteredEmployees.length}</span> employees
                    </div>
                </div>

                {error && <div className="error-banner">{error}</div>}

                <div className="employees-grid">
                    {filteredEmployees.length === 0 ? (
                        <div className="empty-state">
                            <i className="fas fa-users"></i>
                            <h3>No employees found</h3>
                        </div>
                    ) : (
                        filteredEmployees.map(emp => (
                            <div key={emp._id || emp.email} className="employee-card">
                                <div className="employee-avatar">
                                    {(emp.name || emp.email)?.[0]?.toUpperCase() || '?'}
                                </div>
                                <div className="employee-info">
                                    <h3>{emp.name || emp.email?.split('@')[0]}</h3>
                                    <p className="employee-email">{emp.email}</p>
                                    {emp.teams && emp.teams.length > 0 && (
                                        <div className="employee-teams">
                                            {emp.teams.map((team, idx) => (
                                                <span key={idx} className="team-tag">{team}</span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </main>
        </div>
    );
};

export default Employees;
