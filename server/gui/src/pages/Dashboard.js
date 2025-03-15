import React from 'react';
import { Container, Row, Col, Alert } from 'react-bootstrap';
import DeviceCard from '../components/DeviceCard';
import { useWebSocket } from '../context/WebSocketContext';

const Dashboard = () => {
  const { devices, alerts } = useWebSocket();
  
  // Get high priority alerts
  const highPriorityAlerts = alerts.filter(alert => alert.severity === 'high').slice(0, 3);
  
  return (
    <Container>
      <h1 className="page-title">Dashboard</h1>
      
      {highPriorityAlerts.length > 0 && (
        <div className="mb-4">
          <h4>High Priority Alerts</h4>
          {highPriorityAlerts.map(alert => (
            <Alert key={alert.id} variant="danger">
              <strong>{alert.deviceId}:</strong> {alert.message}
              <div><small>{new Date(alert.timestamp).toLocaleString()}</small></div>
            </Alert>
          ))}
        </div>
      )}
      
      <h4>Connected Devices ({devices.length})</h4>
      <Row>
        {devices.length === 0 ? (
          <Col>
            <Alert variant="info">
              No devices connected. Please set up and connect your Raspberry Pi clients.
            </Alert>
          </Col>
        ) : (
          <div className="device-grid">
            {devices.map(device => (
              <DeviceCard key={device.id} device={device} />
            ))}
          </div>
        )}
      </Row>
    </Container>
  );
};

export default Dashboard;