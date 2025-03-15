import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const WebSocketContext = createContext(null);

export const useWebSocket = () => useContext(WebSocketContext);

export const WebSocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [devices, setDevices] = useState([]);
  const [transcriptions, setTranscriptions] = useState({});
  const [alerts, setAlerts] = useState([]);
  
  // Initialize WebSocket connection
  useEffect(() => {
    // Determine WebSocket URL based on current location
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}`;
    
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('WebSocket connected');
      setConnected(true);
      
      // Register as a web client
      ws.send(JSON.stringify({
        type: 'web_client'
      }));
    };
    
    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setConnected(false);
      
      // Attempt to reconnect after a delay
      setTimeout(() => {
        window.location.reload();
      }, 5000);
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'device_list':
          setDevices(data.devices);
          break;
          
        case 'device_connected':
          setDevices(prevDevices => {
            // Check if device already exists
            const deviceExists = prevDevices.some(device => device.id === data.deviceId);
            
            if (deviceExists) {
              // Update existing device
              return prevDevices.map(device => 
                device.id === data.deviceId
                  ? { ...device, capabilities: data.capabilities, isOnline: true }
                  : device
              );
            } else {
              // Add new device
              return [...prevDevices, {
                id: data.deviceId,
                capabilities: data.capabilities,
                isOnline: true,
                connectedAt: new Date().toISOString()
              }];
            }
          });
          break;
          
        case 'device_disconnected':
          setDevices(prevDevices => 
            prevDevices.map(device => 
              device.id === data.deviceId
                ? { ...device, isOnline: false }
                : device
            )
          );
          break;
          
        case 'transcription':
          setTranscriptions(prev => {
            // Create device bucket if it doesn't exist
            const deviceTranscriptions = prev[data.deviceId] || [];
            
            // Add new transcription to device bucket
            return {
              ...prev,
              [data.deviceId]: [
                { 
                  id: Date.now(), // Use timestamp as unique ID
                  text: data.text,
                  timestamp: data.timestamp
                },
                ...deviceTranscriptions
              ].slice(0, 100) // Keep last 100 transcriptions
            };
          });
          break;
          
        case 'alert':
          setAlerts(prev => [
            {
              id: Date.now(),
              deviceId: data.deviceId,
              message: data.message,
              timestamp: data.timestamp,
              severity: data.severity
            },
            ...prev
          ].slice(0, 100)); // Keep last 100 alerts
          break;
          
        default:
          console.log('Unknown message type:', data.type);
      }
    };
    
    setSocket(ws);
    
    // Cleanup function
    return () => {
      ws.close();
    };
  }, []);
  
  // Function to send commands to devices
  const sendCommand = useCallback((deviceId, command, params = {}) => {
    if (socket && connected) {
      socket.send(JSON.stringify({
        type: 'command',
        deviceId,
        command,
        params
      }));
    }
  }, [socket, connected]);
  
  // Clear transcriptions for a specific device
  const clearTranscriptions = useCallback((deviceId) => {
    setTranscriptions(prev => ({
      ...prev,
      [deviceId]: []
    }));
  }, []);
  
  // Clear all alerts
  const clearAlerts = useCallback(() => {
    setAlerts([]);
  }, []);
  
  const contextValue = {
    connected,
    devices,
    transcriptions,
    alerts,
    sendCommand,
    clearTranscriptions,
    clearAlerts
  };
  
  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};