#!/bin/bash

# Installation script for Home Monitoring Client on Raspberry Pi
echo "Installing Home Monitoring Client..."

# Update system
echo "Updating system packages..."
sudo apt update
sudo apt upgrade -y

# Install required dependencies
echo "Installing required dependencies..."
sudo apt install -y nodejs npm espeak

# Install node packages
echo "Installing Node.js packages..."
npm install

# Create configuration file if it doesn't exist
if [ ! -f "config.json" ]; then
    echo "Creating default configuration..."
    node -e "
        const fs = require('fs');
        const config = {
            serverUrl: 'ws://192.168.1.100:3000',
            deviceId: 'raspberry-pi-' + Math.floor(Math.random() * 10000),
            micConfig: {
                rate: '16000',
                channels: '1',
                device: 'default',
                fileType: 'wav'
            },
            reconnectInterval: 5000,
            speakerEnabled: true
        };
        fs.writeFileSync('config.json', JSON.stringify(config, null, 2));
    "
    echo "Created config.json - Please edit with your server details!"
else
    echo "Configuration file already exists. Skipping creation."
fi

# Install systemd service for autostart
echo "Setting up systemd service for auto-start..."
sudo cp homepost-client.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable homepost-client.service
sudo systemctl start homepost-client.service

echo "Installation complete!"
echo ""
echo "To check status: sudo systemctl status homepost-client"
echo "To view logs: sudo journalctl -u homepost-client"
echo ""
echo "Don't forget to edit config.json to set your server IP and device ID!"