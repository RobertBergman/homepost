import React from 'react';
import { Nav } from 'react-bootstrap';
import { Link, useLocation } from 'react-router-dom';
import { useWebSocket } from '../context/WebSocketContext';

const Sidebar = () => {
  const location = useLocation();
  const { devices } = useWebSocket();
  
  return (
    <div className="pt-3">
      <h5 className="text-center mb-4">Devices</h5>
      <Nav className="flex-column">
        {devices.map(device => (
          <Nav.Link
            as={Link}
            to={`/device/${device.id}`}
            key={device.id}
            active={location.pathname === `/device/${device.id}`}
            className="d-flex align-items-center"
          >
            <span 
              className={`device-status-indicator ${device.isOnline ? 'status-online' : 'status-offline'}`}
            ></span>
            {device.id}
          </Nav.Link>
        ))}
        
        {devices.length === 0 && (
          <p className="text-muted text-center small">No devices connected</p>
        )}
      </Nav>
      
      <hr className="my-4" />
      
      <Nav className="flex-column">
        <Nav.Link as={Link} to="/" active={location.pathname === '/'}>
          Dashboard
        </Nav.Link>
        <Nav.Link as={Link} to="/alerts" active={location.pathname === '/alerts'}>
          Alerts
        </Nav.Link>
        <Nav.Link as={Link} to="/settings" active={location.pathname === '/settings'}>
          Settings
        </Nav.Link>
      </Nav>
    </div>
  );
};

export default Sidebar;