import React from 'react';
import { Card, Badge } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useWebSocket } from '../context/WebSocketContext';

const DeviceCard = ({ device }) => {
  const { transcriptions } = useWebSocket();
  const deviceTranscriptions = transcriptions[device.id] || [];
  const latestTranscription = deviceTranscriptions[0]?.text || 'No recent transcriptions';
  
  // Format the connection time
  const formatTime = (timeString) => {
    const date = new Date(timeString);
    return date.toLocaleString();
  };
  
  return (
    <Card 
      className={`h-100 device-card ${!device.isOnline ? 'device-offline' : ''}`}
      border={device.isOnline ? 'success' : 'secondary'}
    >
      <Card.Header className="d-flex justify-content-between align-items-center">
        <div>
          <span 
            className={`device-status-indicator ${device.isOnline ? 'status-online' : 'status-offline'}`}
          ></span>
          {device.id}
        </div>
        {device.isOnline ? (
          <Badge bg="success">Online</Badge>
        ) : (
          <Badge bg="secondary">Offline</Badge>
        )}
      </Card.Header>
      <Card.Body>
        <Card.Text className="text-truncate">
          <strong>Latest:</strong> {latestTranscription}
        </Card.Text>
        <Card.Text className="mb-2">
          <small className="text-muted">
            Connected: {formatTime(device.connectedAt)}
          </small>
        </Card.Text>
        <Card.Text>
          <strong>Capabilities:</strong>
          <br />
          {device.capabilities.audio && <Badge bg="info" className="me-1">Audio</Badge>}
          {device.capabilities.video && <Badge bg="info" className="me-1">Video</Badge>}
          {device.capabilities.speaker && <Badge bg="info">Speaker</Badge>}
        </Card.Text>
      </Card.Body>
      <Card.Footer>
        <Link to={`/device/${device.id}`} className="btn btn-sm btn-primary">
          View Details
        </Link>
      </Card.Footer>
    </Card>
  );
};

export default DeviceCard;