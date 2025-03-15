import React from 'react';
import { Alert } from 'react-bootstrap';
import { useWebSocket } from '../context/WebSocketContext';

const ConnectionStatus = () => {
  const { connected } = useWebSocket();
  
  if (connected) {
    return (
      <Alert variant="success" className="connection-status">
        Server Connected
      </Alert>
    );
  }
  
  return (
    <Alert variant="danger" className="connection-status">
      Server Disconnected - Reconnecting...
    </Alert>
  );
};

export default ConnectionStatus;