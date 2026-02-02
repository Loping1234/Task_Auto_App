import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { chatAPI, teamsAPI } from '../../api';
import Navbar from '../../components/Navbar';
import '../styles/TeamChat.css';

const TeamChat = () => {
    const { user } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const teamName = searchParams.get('team');

    const [teams, setTeams] = useState([]);
    const [messages, setMessages] = useState([]);
    const [teamMembers, setTeamMembers] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const chatBodyRef = useRef(null);

    useEffect(() => {
        fetchTeams();
    }, []);

    useEffect(() => {
        if (teamName) {
            fetchMessages();
            const interval = setInterval(fetchMessages, 5000); // Auto-refresh every 5s
            return () => clearInterval(interval);
        }
    }, [teamName]);

    useEffect(() => {
        // Scroll to bottom when messages change
        if (chatBodyRef.current) {
            chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
        }
    }, [messages]);

    const fetchTeams = async () => {
        try {
            const response = await chatAPI.getEmployeeTeams();
            setTeams(response.data.teams || []);

            // If only one team, auto-select it
            if (response.data.teams?.length === 1 && !teamName) {
                setSearchParams({ team: response.data.teams[0].teamName });
            }
        } catch (err) {
            console.error('Failed to load teams', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchMessages = async () => {
        if (!teamName) return;
        try {
            const response = await chatAPI.getTeamMessages(teamName);
            setMessages(response.data.messages || []);
            setTeamMembers(response.data.members || []);
        } catch (err) {
            console.error('Failed to load messages', err);
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !teamName) return;

        setSending(true);
        try {
            await chatAPI.sendTeamMessage(teamName, newMessage);
            setNewMessage('');
            await fetchMessages();
        } catch (err) {
            console.error('Failed to send message', err);
        } finally {
            setSending(false);
        }
    };

    const selectTeam = (team) => {
        setSearchParams({ team: team.teamName });
    };

    const formatTime = (dateStr) => {
        return new Date(dateStr).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

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

    // No team selected - show team selection
    if (!teamName) {
        return (
            <div className="page-layout">
                <Navbar />
                <main className="page-main chat-page">
                    <div className="team-selection">
                        <h2>Choose a Team Chat</h2>
                        {teams.length === 0 ? (
                            <div className="no-teams">
                                <i className="fas fa-users-slash"></i>
                                <h3>You are not assigned to any team</h3>
                                <p>Team chat is only available to assigned team members.</p>
                            </div>
                        ) : (
                            <div className="team-grid">
                                {teams.map((team) => (
                                    <div
                                        key={team.teamName}
                                        className="team-card"
                                        onClick={() => selectTeam(team)}
                                    >
                                        <i className="fas fa-users"></i>
                                        <h4>{team.teamName}</h4>
                                        <p>{team.employees?.length || 0} Members</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </main>
            </div>
        );
    }

    // Team selected - show chat
    return (
        <div className="page-layout">
            <Navbar />
            <main className="page-main chat-page">
                <div className="chat-container">
                    <div className="chat-header">
                        <div className="chat-header-info">
                            <i className="fas fa-comments"></i>
                            <div>
                                <h4>Team Chat: {teamName}</h4>
                                <span>{teamMembers.length} members</span>
                            </div>
                        </div>
                        {teams.length > 1 && (
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => setSearchParams({})}
                            >
                                Switch Team
                            </button>
                        )}
                    </div>

                    <div className="member-list">
                        <span className="member-label">Members:</span>
                        <span className="member-badge you">
                            <i className="fas fa-crown"></i> You
                        </span>
                        {teamMembers.filter(m => m.email !== user?.email).map((member, idx) => (
                            <span key={idx} className="member-badge">{member.email}</span>
                        ))}
                    </div>

                    <div className="chat-body" ref={chatBodyRef}>
                        {messages.length === 0 ? (
                            <div className="empty-chat">
                                <i className="fas fa-comments"></i>
                                <p>Start a conversation for team {teamName}!</p>
                            </div>
                        ) : (
                            messages.map((msg, idx) => {
                                const isOutgoing = msg.senderEmail === user?.email;
                                return (
                                    <div key={idx} className={`message-row ${isOutgoing ? 'outgoing' : 'incoming'}`}>
                                        <div className="message-bubble">
                                            {!isOutgoing && (
                                                <div className="message-sender">{msg.senderEmail}</div>
                                            )}
                                            <div className="message-text">{msg.message}</div>
                                            <div className="message-time">{formatTime(msg.createdAt)}</div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    <form className="chat-footer" onSubmit={handleSendMessage}>
                        <textarea
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Type your message..."
                            rows={1}
                            required
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendMessage(e);
                                }
                            }}
                        />
                        <button type="submit" className="send-btn" disabled={sending}>
                            <i className="fas fa-paper-plane"></i>
                        </button>
                    </form>
                </div>
            </main>
        </div>
    );
};

export default TeamChat;
