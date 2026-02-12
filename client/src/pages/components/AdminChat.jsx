import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { chatAPI } from '../../api';
import { ensureSocketConnected, socket } from '../../socket';
import Navbar from '../../components/Navbar';
import '../styles/TeamChat.css';

const AdminChat = () => {
    const { user, isAdmin } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const channel = searchParams.get('channel') || 'general';

    const [subadmins, setSubadmins] = useState([]);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const chatBodyRef = useRef(null);

    const fetchSubadmins = useCallback(async () => {
        try {
            const response = await chatAPI.getSubadmins();
            setSubadmins(response.data.subadmins || []);
        } catch (err) {
            console.error('Failed to load subadmins', err);
        }
    }, []);

    const fetchMessages = useCallback(async () => {
        try {
            const response = await chatAPI.getAdminSubadminMessages(channel);
            setMessages(response.data.messages || []);
        } catch (err) {
            console.error('Failed to load messages', err);
        } finally {
            setLoading(false);
        }
    }, [channel]);

    useEffect(() => {
        if (isAdmin) {
            fetchSubadmins();
        }
    }, [fetchSubadmins, isAdmin]);

    useEffect(() => {
        fetchMessages();
    }, [fetchMessages]);

    useEffect(() => {
        const s = ensureSocketConnected();

        const userEmail = user?.email;
        if (!userEmail) return;

        const room = channel === 'general'
            ? 'admin:general'
            : isAdmin
                ? `admin:dm:${channel}`
                : `admin:dm:${userEmail}`;

        s.emit('chat:join', { room });

        const onNewMessage = (msg) => {
            // Avoid duplicates
            setMessages((prev) => {
                if (msg?._id && prev.some((m) => m?._id === msg._id)) return prev;

                // Filter to match current view
                const isBroadcast = msg?.receiverEmail === 'all@subadmin.com';

                if (channel === 'general') {
                    return isBroadcast ? [...prev, msg] : prev;
                }

                if (isAdmin) {
                    const isDmBetween =
                        (msg?.senderEmail === userEmail && msg?.receiverEmail === channel) ||
                        (msg?.senderEmail === channel && msg?.receiverEmail === userEmail);
                    return (isBroadcast || isDmBetween) ? [...prev, msg] : prev;
                }

                const involvesMe = msg?.senderEmail === userEmail || msg?.receiverEmail === userEmail;
                return (isBroadcast || involvesMe) ? [...prev, msg] : prev;
            });
        };

        s.on('chat:admin:new_message', onNewMessage);

        return () => {
            s.off('chat:admin:new_message', onNewMessage);
            s.emit('chat:leave', { room });
        };
    }, [channel, isAdmin, user?.email]);

    useEffect(() => {
        if (chatBodyRef.current) {
            chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
        }
    }, [messages]);

    useEffect(() => {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
        }
    }, []);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        setSending(true);
        try {
            let receiverEmail;
            if (channel === 'general') {
                receiverEmail = 'all@subadmin.com';
            } else if (isAdmin) {
                receiverEmail = channel;
            } else {
                receiverEmail = 'admin@admin.com'; // Subadmin sending to admin
            }

            await chatAPI.sendAdminSubadminMessage(receiverEmail, newMessage, channel);
            setNewMessage('');
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

    const switchChannel = (newChannel) => {
        setSearchParams({ channel: newChannel });
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

    return (
        <div className="page-layout">
            <Navbar />
            <main className="page-main chat-page">
                <div className="chat-container admin-chat">
                    <div className="chat-header">
                        <div className="chat-header-info">
                            <i className="fas fa-comments"></i>
                            <div>
                                <h4>{isAdmin ? 'Admin Chat' : 'Chat with Admin'}</h4>
                                <span>
                                    {channel === 'general' ? (
                                        <><i className="fas fa-globe"></i> General Broadcast</>
                                    ) : isAdmin ? (
                                        <><i className="fas fa-user"></i> Private: {channel}</>
                                    ) : (
                                        <><i className="fas fa-user-shield"></i> Direct to Admin</>
                                    )}
                                </span>
                            </div>
                        </div>
                        <select
                            className="channel-select"
                            value={channel}
                            onChange={(e) => switchChannel(e.target.value)}
                        >
                            <option value="general">General (All)</option>
                            {isAdmin ? (
                                subadmins.map((s) => (
                                    <option key={s._id || s.email} value={s.email}>{s.email}</option>
                                ))
                            ) : (
                                <option value="direct">Direct to Admin</option>
                            )}
                        </select>
                    </div>
                    
                    <div className="chat-body" ref={chatBodyRef}>
                        {messages.length === 0 ? (
                            <div className="empty-chat">
                                <i className="fas fa-comments"></i>
                                <h5>No messages yet</h5>
                                <p>Start the conversation by sending a message below.</p>
                                
                            </div>
                        ) : (
                            messages.map((msg, idx) => {
                                const isOutgoing = msg.senderEmail === user?.email;
                                return (
                                    <div key={idx} className={`message-row ${isOutgoing ? 'outgoing' : 'incoming'}`}>
                                        <div className="message-bubble">
                                            <div className="message-sender">
                                                {isOutgoing ? (
                                                    <>
                                                        You
                                                        {isAdmin && msg.receiverEmail !== 'all@subadmin.com' && (
                                                            <> → {msg.receiverEmail}</>
                                                        )}
                                                        {msg.receiverEmail === 'all@subadmin.com' && <> → All</>}
                                                    </>
                                                ) : (
                                                    msg.senderEmail
                                                )}
                                            </div>
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

export default AdminChat;
