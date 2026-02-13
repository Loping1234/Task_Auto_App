import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { chatAPI } from '../../api';
import { ensureSocketConnected, socket } from '../../socket';
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
    const [attachments, setAttachments] = useState([]);
    const [typingUsers, setTypingUsers] = useState(new Set());
    const [editingMessageId, setEditingMessageId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const chatBodyRef = useRef(null);
    const fileInputRef = useRef(null);
    const typingTimeoutRef = useRef(null);

    const fetchTeams = useCallback(async () => {
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
    }, [setSearchParams, teamName]);

    const fetchMessages = useCallback(async () => {
        if (!teamName) return;
        try {
            const response = await chatAPI.getTeamMessages(teamName);
            setMessages(response.data.messages || []);
            setTeamMembers(response.data.members || []);
        } catch (err) {
            console.error('Failed to load messages', err);
        }
    }, [teamName]);

    useEffect(() => {
        fetchTeams();
    }, [fetchTeams]);

    useEffect(() => {
        if (!teamName) return;
        fetchMessages();
    }, [fetchMessages, teamName]);

    useEffect(() => {
        if (!teamName) return;

        const s = ensureSocketConnected();
        const room = `team:${teamName}`;

        s.emit('chat:join', { room });

        const onNewMessage = (msg) => {
            if (msg?.teamName !== teamName) return;
            setMessages((prev) => {
                if (msg?._id && prev.some((m) => m?._id === msg._id)) return prev;
                return [...prev, msg];
            });
        };

        const onMessageUpdated = (updatedMsg) => {
            if (updatedMsg?.teamName !== teamName) return;
            setMessages((prev) => prev.map(m => m._id === updatedMsg._id ? updatedMsg : m));
        };

        const onTyping = ({ user, room }) => {
            if (room === `team:${teamName}`) {
                setTypingUsers(prev => {
                    const next = new Set(prev);
                    next.add(user);
                    return next;
                });
            }
        };

        const onStopTyping = ({ user, room }) => {
            if (room === `team:${teamName}`) {
                setTypingUsers(prev => {
                    const next = new Set(prev);
                    next.delete(user);
                    return next;
                });
            }
        };

        s.on('chat:team:new_message', onNewMessage);
        s.on('chat:message_updated', onMessageUpdated);
        s.on('chat:typing', onTyping);
        s.on('chat:stop_typing', onStopTyping);

        return () => {
            s.off('chat:team:new_message', onNewMessage);
            s.off('chat:message_updated', onMessageUpdated);
            s.off('chat:typing', onTyping);
            s.off('chat:stop_typing', onStopTyping);
            s.emit('chat:leave', { room });
        };
    }, [teamName]);

    useEffect(() => {
        // Scroll to bottom when messages change
        if (chatBodyRef.current) {
            chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
        }
    }, [messages]);

    const handleTyping = () => {
        if (!socket.connected) return;
        socket.emit('chat:typing', { room: `team:${teamName}` });

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

        typingTimeoutRef.current = setTimeout(() => {
            socket.emit('chat:stop_typing', { room: `team:${teamName}` });
        }, 2000);
    };

    const handleFileSelect = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            setAttachments(prev => [...prev, ...Array.from(e.target.files)]);
        }
    };

    const removeAttachment = (index) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if ((!newMessage.trim() && attachments.length === 0) || !teamName) return;

        setSending(true);
        try {
            if (editingMessageId) {
                await chatAPI.editMessage(editingMessageId, newMessage);
                setEditingMessageId(null);
            } else {
                let data = { message: newMessage };
                if (attachments.length > 0) {
                    const formData = new FormData();
                    formData.append('message', newMessage);
                    attachments.forEach(file => {
                        formData.append('attachments', file);
                    });
                    data = formData;
                }
                await chatAPI.sendTeamMessage(teamName, data);
            }

            setNewMessage('');
            setAttachments([]);
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            socket.emit('chat:stop_typing', { room: `team:${teamName}` });

            // Socket.IO should deliver the new message; fallback to refresh if disconnected.
            if (!socket.connected) {
                await fetchMessages();
            }
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
                                            {msg.attachments && msg.attachments.length > 0 && (
                                                <div className="message-attachments">
                                                    {msg.attachments.map((att, i) => (
                                                        <div key={i} className="attachment-item">
                                                            {att.type.startsWith('image/') ? (
                                                                <img src={att.url} alt={att.name} className="attachment-preview" onClick={() => window.open(att.url, '_blank')} />
                                                            ) : (
                                                                <a href={att.url} target="_blank" rel="noopener noreferrer" className="attachment-link">
                                                                    <i className="fas fa-file"></i> {att.name}
                                                                </a>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            <div className="message-text">
                                                {msg.message}
                                                {msg.isEdited && <span className="edited-label"> (edited)</span>}
                                            </div>
                                            <div className="message-time">
                                                {formatTime(msg.createdAt)}
                                                {isOutgoing && (
                                                    <i
                                                        className="fas fa-pen edit-icon"
                                                        title="Edit"
                                                        onClick={() => {
                                                            setNewMessage(msg.message);
                                                            setEditingMessageId(msg._id);
                                                            setAttachments([]); // Clear attachments when editing (editing attachments not supported yet)
                                                            if (fileInputRef.current) fileInputRef.current.value = '';
                                                        }}
                                                    ></i>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {typingUsers.size > 0 && (
                        <div className="typing-indicator">
                            {Array.from(typingUsers).join(', ')} {typingUsers.size === 1 ? 'is' : 'are'} typing...
                        </div>
                    )}

                    <form className="chat-footer" onSubmit={handleSendMessage}>
                        {attachments.length > 0 && (
                            <div className="attachments-preview-bar">
                                {attachments.map((file, i) => (
                                    <div key={i} className="attachment-preview-item">
                                        <span>{file.name}</span>
                                        <i className="fas fa-times" onClick={() => removeAttachment(i)}></i>
                                    </div>
                                ))}
                            </div>
                        )}

                        <input
                            type="file"
                            multiple
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                            onChange={handleFileSelect}
                        />
                        <button
                            type="button"
                            className="attach-btn"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={!!editingMessageId} // Disable attachments when editing
                        >
                            <i className="fas fa-paperclip"></i>
                        </button>

                        <textarea
                            value={newMessage}
                            onChange={(e) => {
                                setNewMessage(e.target.value);
                                handleTyping();
                            }}
                            placeholder={editingMessageId ? "Edit your message..." : "Type your message..."}
                            rows={1}
                            required={attachments.length === 0}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendMessage(e);
                                }
                            }}
                        />
                        {editingMessageId && (
                            <button type="button" className="cancel-edit-btn" onClick={() => {
                                setEditingMessageId(null);
                                setNewMessage('');
                            }}>
                                <i className="fas fa-times"></i>
                            </button>
                        )}
                        <button type="submit" className="send-btn" disabled={sending}>
                            <i className={`fas ${editingMessageId ? 'fa-check' : 'fa-paper-plane'}`}></i>
                        </button>
                    </form>
                </div>
            </main>
        </div>
    );
};

export default TeamChat;
