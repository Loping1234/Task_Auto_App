import { io } from 'socket.io-client';

export const socket = io('http://localhost:5000', {
    autoConnect: false,
    transports: ['websocket'],
    auth: {
        token: localStorage.getItem('token')
    }
});

export const ensureSocketConnected = () => {
    socket.auth = { token: localStorage.getItem('token') };

    if (!socket.connected) {
        socket.connect();
    }

    return socket;
};
