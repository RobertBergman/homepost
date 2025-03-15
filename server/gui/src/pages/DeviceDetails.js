import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Container, Card, ListGroup, Button, Form, 
  InputGroup, Alert, Badge, Modal 
} from 'react-bootstrap';
import { useWebSocket } from '../context/WebSocketContext';

const DeviceDetails = () => {
  const { deviceId } = useParams();
  const navigate = useNavigate();
  const { devices, transcriptions, sendCommand, clearTranscriptions } = useWebSocket();
  
  const [message, setMessage] = useState('');
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configParams, setConfigParams] = useState({
    deviceId: '',
    reconnectInterval: 5000,
    speakerEnabled: true
  });
  
  // Find the device
  const device = devices.find(d => d.id === deviceId);
  const deviceTranscriptions = transcriptions[deviceId] || [];
  
  if (!device) {
    return (
      <Container>
        <Alert variant="warning">
          Device not found. It may have been disconnected.
          <div className="mt-3">
            <Button variant="primary" onClick={() => navigate('/')}>
              Back to Dashboard
            </Button>
          </div>
        </Alert>
      </Container>
    );
  }
  
  // Format the connection time
  const formatTime = (timeString) => {
    const date = new Date(timeString);
    return date.toLocaleString();
  };
  
  // Handle sending a message to the device
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (message.trim() && device.capabilities.speaker) {
      sendCommand(deviceId, 'speak', { text: message });
      setMessage('');
    }
  };
  
  // Handle device restart
  const handleRestartDevice = () => {
    if (window.confirm('Are you sure you want to restart this device?')) {
      sendCommand(deviceId, 'restart');
    }
  };
  
  // Handle configuration updates
  const handleUpdateConfig = () => {
    sendCommand(deviceId, 'update_config', configParams);
    setShowConfigModal(false);
  };
  
  // Show configuration modal
  const showConfig = () => {
    // Pre-fill with current values if available
    setConfigParams({
      deviceId: device.id,
      reconnectInterval: 5000,
      speakerEnabled: device.capabilities.speaker
    });
    setShowConfigModal(true);
  };
  
  return (
    <Container className="device-details-container">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="mb-0">
          <span 
            className={`device-status-indicator ${device.isOnline ? 'status-online' : 'status-offline'}`}
          ></span>
          {deviceId}
          {device.isOnline ? (
            <Badge bg="success" className="ms-2">Online</Badge>
          ) : (
            <Badge bg="secondary" className="ms-2">Offline</Badge>
          )}
        </h1>
        <Button variant="primary" onClick={() => navigate('/')}>
          Back to Dashboard
        </Button>
      </div>
      
      <div className="row mb-4">
        <div className="col-md-6">
          <Card>
            <Card.Header>Device Information</Card.Header>
            <ListGroup variant="flush">
              <ListGroup.Item>
                <strong>Status:</strong> {device.isOnline ? 'Online' : 'Offline'}
              </ListGroup.Item>
              <ListGroup.Item>
                <strong>Connected Since:</strong> {formatTime(device.connectedAt)}
              </ListGroup.Item>
              <ListGroup.Item>
                <strong>Capabilities:</strong>
                <div className="mt-1">
                  {device.capabilities.audio && <Badge bg="info" className="me-1">Audio</Badge>}
                  {device.capabilities.video && <Badge bg="info" className="me-1">Video</Badge>}
                  {device.capabilities.speaker && <Badge bg="info">Speaker</Badge>}
                </div>
              </ListGroup.Item>
            </ListGroup>
          </Card>
        </div>
        
        <div className="col-md-6">
          <Card>
            <Card.Header>Device Controls</Card.Header>
            <Card.Body>
              {device.capabilities.speaker && (
                <Form onSubmit={handleSendMessage} className="mb-3">
                  <Form.Group>
                    <Form.Label>Send Message (Text-to-Speech)</Form.Label>
                    <InputGroup>
                      <Form.Control 
                        type="text" 
                        value={message} 
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Enter message to speak"
                        disabled={!device.isOnline}
                      />
                      <Button 
                        type="submit"
                        disabled={!device.isOnline || !message.trim()}
                      >
                        Speak
                      </Button>
                    </InputGroup>
                  </Form.Group>
                </Form>
              )}
              
              <div className="d-grid gap-2">
                <Button 
                  variant="warning" 
                  onClick={handleRestartDevice}
                  disabled={!device.isOnline}
                >
                  Restart Device
                </Button>
                <Button 
                  variant="info" 
                  onClick={showConfig}
                  disabled={!device.isOnline}
                >
                  Configure Device
                </Button>
                <Button 
                  variant="secondary"
                  onClick={() => clearTranscriptions(deviceId)}
                >
                  Clear Transcription History
                </Button>
              </div>
            </Card.Body>
          </Card>
        </div>
      </div>
      
      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center">
          <h5 className="mb-0">Recent Transcriptions</h5>
          <Badge bg="primary" pill>{deviceTranscriptions.length}</Badge>
        </Card.Header>
        <Card.Body>
          <div className="transcription-list">
            {deviceTranscriptions.length === 0 ? (
              <p className="text-muted">No transcriptions available for this device.</p>
            ) : (
              deviceTranscriptions.map(transcription => (
                <div key={transcription.id} className="transcription-item mb-3">
                  <div className="transcription-bubble">
                    {transcription.text}
                  </div>
                  <div className="timestamp">
                    {new Date(transcription.timestamp).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card.Body>
      </Card>
      
      {/* Configuration Modal */}
      <Modal show={showConfigModal} onHide={() => setShowConfigModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Configure Device</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Device ID</Form.Label>
              <Form.Control 
                type="text" 
                value={configParams.deviceId}
                onChange={(e) => setConfigParams({...configParams, deviceId: e.target.value})}
              />
              <Form.Text className="text-muted">
                Changing the device ID will require a restart.
              </Form.Text>
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Reconnect Interval (ms)</Form.Label>
              <Form.Control 
                type="number" 
                value={configParams.reconnectInterval}
                onChange={(e) => setConfigParams({...configParams, reconnectInterval: parseInt(e.target.value)})}
              />
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Check 
                type="switch"
                id="speaker-switch"
                label="Enable Speaker"
                checked={configParams.speakerEnabled}
                onChange={(e) => setConfigParams({...configParams, speakerEnabled: e.target.checked})}
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowConfigModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleUpdateConfig}>
            Save Changes
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default DeviceDetails;