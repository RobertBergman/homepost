import React from 'react';
import { Container, Card, Button, Alert, Badge } from 'react-bootstrap';
import { useWebSocket } from '../context/WebSocketContext';
import { Link } from 'react-router-dom';

const Alerts = () => {
  const { alerts, clearAlerts } = useWebSocket();
  
  // Get alerts grouped by severity
  const highAlerts = alerts.filter(alert => alert.severity === 'high');
  const mediumAlerts = alerts.filter(alert => alert.severity === 'medium');
  const lowAlerts = alerts.filter(alert => alert.severity === 'low' || !alert.severity);
  
  // Format timestamp
  const formatTime = (timeString) => {
    const date = new Date(timeString);
    return date.toLocaleString();
  };
  
  // Get alert variant based on severity
  const getAlertVariant = (severity) => {
    switch (severity) {
      case 'high':
        return 'danger';
      case 'medium':
        return 'warning';
      case 'low':
        return 'info';
      default:
        return 'secondary';
    }
  };
  
  return (
    <Container>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="mb-0">Alerts</h1>
        <Button 
          variant="secondary"
          onClick={clearAlerts}
          disabled={alerts.length === 0}
        >
          Clear All Alerts
        </Button>
      </div>
      
      {alerts.length === 0 ? (
        <Alert variant="info">
          No alerts available. Alerts will appear here when triggered by your Raspberry Pi devices.
        </Alert>
      ) : (
        <>
          {highAlerts.length > 0 && (
            <Card className="mb-4">
              <Card.Header className="bg-danger text-white d-flex justify-content-between">
                <span>High Priority Alerts</span>
                <Badge bg="light" text="danger">{highAlerts.length}</Badge>
              </Card.Header>
              <Card.Body>
                {highAlerts.map(alert => (
                  <Alert 
                    key={alert.id}
                    variant={getAlertVariant(alert.severity)}
                    className="alert-high"
                  >
                    <div className="d-flex justify-content-between">
                      <strong>{alert.deviceId}</strong>
                      <Link to={`/device/${alert.deviceId}`} className="btn btn-sm btn-outline-primary">
                        View Device
                      </Link>
                    </div>
                    <p>{alert.message}</p>
                    <small>{formatTime(alert.timestamp)}</small>
                  </Alert>
                ))}
              </Card.Body>
            </Card>
          )}
          
          {mediumAlerts.length > 0 && (
            <Card className="mb-4">
              <Card.Header className="bg-warning text-dark d-flex justify-content-between">
                <span>Medium Priority Alerts</span>
                <Badge bg="light" text="warning">{mediumAlerts.length}</Badge>
              </Card.Header>
              <Card.Body>
                {mediumAlerts.map(alert => (
                  <Alert 
                    key={alert.id}
                    variant={getAlertVariant(alert.severity)}
                    className="alert-medium"
                  >
                    <div className="d-flex justify-content-between">
                      <strong>{alert.deviceId}</strong>
                      <Link to={`/device/${alert.deviceId}`} className="btn btn-sm btn-outline-primary">
                        View Device
                      </Link>
                    </div>
                    <p>{alert.message}</p>
                    <small>{formatTime(alert.timestamp)}</small>
                  </Alert>
                ))}
              </Card.Body>
            </Card>
          )}
          
          {lowAlerts.length > 0 && (
            <Card>
              <Card.Header className="bg-info text-white d-flex justify-content-between">
                <span>Low Priority Alerts</span>
                <Badge bg="light" text="info">{lowAlerts.length}</Badge>
              </Card.Header>
              <Card.Body>
                {lowAlerts.map(alert => (
                  <Alert 
                    key={alert.id}
                    variant={getAlertVariant(alert.severity)}
                    className="alert-low"
                  >
                    <div className="d-flex justify-content-between">
                      <strong>{alert.deviceId}</strong>
                      <Link to={`/device/${alert.deviceId}`} className="btn btn-sm btn-outline-primary">
                        View Device
                      </Link>
                    </div>
                    <p>{alert.message}</p>
                    <small>{formatTime(alert.timestamp)}</small>
                  </Alert>
                ))}
              </Card.Body>
            </Card>
          )}
        </>
      )}
    </Container>
  );
};

export default Alerts;