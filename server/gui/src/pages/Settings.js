import React, { useState, useEffect } from 'react';
import { Container, Form, Button, Card, Row, Col, Alert } from 'react-bootstrap';

const Settings = () => {
  const [alertPhrases, setAlertPhrases] = useState('help,emergency,fire');
  const [retainHours, setRetainHours] = useState(24);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // Load settings from server on component mount
  useEffect(() => {
    fetchSettings();
  }, []);
  
  // Fetch settings from API
  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      
      // Fetch server settings
      const response = await fetch('/api/settings');
      
      if (response.ok) {
        const settings = await response.json();
        
        // Update state with server settings
        if (settings.alertPhrases) {
          setAlertPhrases(settings.alertPhrases.join(','));
        }
        
        if (settings.retainAudioHours) {
          setRetainHours(settings.retainAudioHours);
        }
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      setMessage({
        type: 'danger',
        text: 'Failed to load settings. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Save settings
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    
    try {
      setIsLoading(true);
      
      // Send updated settings to API
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          alertPhrases: alertPhrases.split(',').map(phrase => phrase.trim()),
          retainAudioHours: parseInt(retainHours, 10)
        })
      });
      
      if (response.ok) {
        setMessage({
          type: 'success',
          text: 'Settings saved successfully!'
        });
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          setMessage({ type: '', text: '' });
        }, 3000);
      } else {
        setMessage({
          type: 'danger',
          text: 'Failed to save settings. Please try again.'
        });
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage({
        type: 'danger',
        text: 'Failed to save settings. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Container className="settings-container">
      <h1 className="page-title">Settings</h1>
      
      {message.text && (
        <Alert variant={message.type}>{message.text}</Alert>
      )}
      
      <Row>
        <Col md={8}>
          <Card className="mb-4">
            <Card.Header>System Settings</Card.Header>
            <Card.Body>
              <Form onSubmit={handleSaveSettings}>
                <Form.Group className="mb-3">
                  <Form.Label>Alert Phrases</Form.Label>
                  <Form.Control
                    type="text"
                    value={alertPhrases}
                    onChange={(e) => setAlertPhrases(e.target.value)}
                    placeholder="Comma-separated list of phrases (e.g., help,emergency,fire)"
                  />
                  <Form.Text className="text-muted">
                    These phrases will trigger alerts when detected in transcriptions.
                  </Form.Text>
                </Form.Group>
                
                <Form.Group className="mb-3">
                  <Form.Label>Retain Audio Data (Hours)</Form.Label>
                  <Form.Control
                    type="number"
                    value={retainHours}
                    onChange={(e) => setRetainHours(e.target.value)}
                    min="1"
                    max="168"
                  />
                  <Form.Text className="text-muted">
                    Automatically delete audio data older than this many hours.
                  </Form.Text>
                </Form.Group>
                
                <Button 
                  type="submit" 
                  variant="primary"
                  disabled={isLoading}
                >
                  {isLoading ? 'Saving...' : 'Save Settings'}
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>
        
        <Col md={4}>
          <Card>
            <Card.Header>System Information</Card.Header>
            <Card.Body>
              <p><strong>Version:</strong> 1.0.0</p>
              <p><strong>Server Status:</strong> <span className="text-success">Online</span></p>
              <p><strong>Database:</strong> SQLite</p>
              
              <hr/>
              
              <h6>About</h6>
              <p className="text-muted small">
                Home Monitoring System uses Raspberry Pi devices with microphones
                to capture audio, process it with OpenAI Realtime API, and provide
                transcriptions and alerts through this web interface.
              </p>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default Settings;