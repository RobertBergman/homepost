import React from 'react';
import { Navbar, Container, Nav, Badge } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useWebSocket } from '../context/WebSocketContext';

const Header = () => {
  const { alerts } = useWebSocket();
  
  // Count unread high severity alerts
  const highSeverityAlerts = alerts.filter(alert => alert.severity === 'high').length;
  
  return (
    <Navbar bg="dark" variant="dark" expand="lg" fixed="top">
      <Container fluid>
        <Navbar.Brand as={Link} to="/">
          Home Monitoring System
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="ms-auto">
            <Nav.Link as={Link} to="/">Dashboard</Nav.Link>
            <Nav.Link as={Link} to="/alerts" className="position-relative">
              Alerts
              {highSeverityAlerts > 0 && (
                <Badge bg="danger" pill className="position-absolute top-0 start-100 translate-middle">
                  {highSeverityAlerts}
                </Badge>
              )}
            </Nav.Link>
            <Nav.Link as={Link} to="/settings">Settings</Nav.Link>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};

export default Header;