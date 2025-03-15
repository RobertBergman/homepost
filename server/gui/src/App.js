import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

// Pages
import Dashboard from './pages/Dashboard';
import DeviceDetails from './pages/DeviceDetails';
import Settings from './pages/Settings';
import Alerts from './pages/Alerts';

// Components
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import { Container, Row, Col } from 'react-bootstrap';
import ConnectionStatus from './components/ConnectionStatus';

function App() {
  return (
    <Router>
      <div className="App">
        <Header />
        <Container fluid>
          <Row>
            <Col md={3} lg={2} className="d-none d-md-block bg-light sidebar">
              <Sidebar />
            </Col>
            <Col md={9} ms={{ span: 10, offset: 1 }} lg={{ span: 10, offset: 2 }} className="main-content">
              <ConnectionStatus />
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/device/:deviceId" element={<DeviceDetails />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/alerts" element={<Alerts />} />
              </Routes>
            </Col>
          </Row>
        </Container>
      </div>
    </Router>
  );
}

export default App;