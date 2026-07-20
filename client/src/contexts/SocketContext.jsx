// src/contexts/SocketContext.jsx
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5001';

export function SocketProvider({ children }) {
    const { isAuthenticated } = useAuth();
    const socketRef = useRef(null);
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        // Only connect if the user is verified and authenticated
        if (!isAuthenticated) {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
                setConnected(false);
            }
            return;
        }

        const token = localStorage.getItem('tf_token');
        if (!token) return;

        // Connect to Socket.IO backend with token payload
        const socket = io(SOCKET_URL, {
            auth: { token },
            autoConnect: true,
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('[Socket]: Connected to server socket ID:', socket.id);
            setConnected(true);
        });

        socket.on('disconnect', (reason) => {
            console.log('[Socket]: Disconnected from server. Reason:', reason);
            setConnected(false);
        });

        socket.on('connect_error', (error) => {
            console.error('[Socket]: Connection error:', error.message);
            setConnected(false);
        });

        return () => {
            if (socket.connected) {
                socket.disconnect();
            }
            socketRef.current = null;
            setConnected(false);
        };
    }, [isAuthenticated]);

    const emit = (event, data) => {
        if (socketRef.current && socketRef.current.connected) {
            socketRef.current.emit(event, data);
        } else {
            console.warn(`[SocketClient] emit("${event}") deferred – socket not connected`);
        }
    };

    const on = (event, handler) => {
        if (socketRef.current) {
            socketRef.current.on(event, handler);
        }
    };

    const off = (event, handler) => {
        if (socketRef.current) {
            socketRef.current.off(event, handler);
        }
    };

    return (
        <SocketContext.Provider value={{ socket: socketRef.current, connected, emit, on, off }}>
            {children}
        </SocketContext.Provider>
    );
}

export const useSocket = () => useContext(SocketContext);
