import { io } from 'socket.io-client';

// Single socket instance for the whole frontend.
// We keep autoConnect=false so pages can decide when to connect.
export const socket = io('http://localhost:5000', {
    autoConnect: false,
    transports: ['websocket'],
    auth: {
        token: localStorage.getItem('token')
    }
});

export const ensureSocketConnected = () => {
    // Keep token fresh in case it changed after login.
    socket.auth = { token: localStorage.getItem('token') };

    if (!socket.connected) {
        socket.connect();
    }

    return socket;
};
