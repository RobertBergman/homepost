#!/bin/bash

# Installation script for Home Monitoring Server
echo "Installing Home Monitoring Server..."

# Update system
echo "Updating system packages..."
sudo apt update
sudo apt upgrade -y

# Install required dependencies
echo "Installing required dependencies..."
sudo apt install -y nodejs npm

# Install node packages
echo "Installing Node.js packages..."
npm install

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "Creating .env file from example..."
    cp .env.example .env
    echo "Please edit .env file with your API keys and configuration settings!"
else
    echo "Configuration file .env already exists. Skipping creation."
fi

# Build the React GUI
echo "Building the React UI..."
if [ -d "gui" ]; then
    npm run build-ui
else
    echo "Error: gui directory doesn't exist. Skipping UI build."
    echo "Please make sure to set up the React UI in the 'gui' directory."
fi

# Create data directories
echo "Creating data directories..."
mkdir -p data/audio

# Create a systemd service file
echo "Creating systemd service..."
cat > homepost-server.service << EOL
[Unit]
Description=Home Monitoring Server
After=network.target

[Service]
Type=simple
User=${USER}
WorkingDirectory=$(pwd)
ExecStart=$(which node) server.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=homepost-server
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOL

# Install the service
echo "Installing systemd service..."
sudo cp homepost-server.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable homepost-server.service

echo "Installation complete!"
echo ""
echo "Next steps:"
echo "1. Edit the .env file with your OpenAI API key"
echo "2. Build the React UI with: npm run build-ui"
echo "3. Start the server with: sudo systemctl start homepost-server"
echo "4. To check status: sudo systemctl status homepost-server"
echo "5. To view logs: sudo journalctl -u homepost-server"
echo ""
echo "Access the web interface at: http://$(hostname -I | awk '{print $1}'):3000 (or configured port)"