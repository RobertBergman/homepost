#!/bin/bash

# Installation script for Home Monitoring Client on Raspberry Pi
echo "Installing Home Monitoring Client..."

# Check if running in WSL
IS_WSL=false
if grep -qi microsoft /proc/version 2>/dev/null; then
  IS_WSL=true
  echo "WSL environment detected"
fi

# Update system
echo "Updating system packages..."
sudo apt update
sudo apt upgrade -y

# Install required dependencies
echo "Installing required dependencies..."

# Check if nodejs is already installed
if command -v node &> /dev/null; then
  echo "Node.js is already installed: $(node -v)"
else
  sudo apt install -y nodejs
fi

# Check if npm is already installed
if command -v npm &> /dev/null; then
  echo "npm is already installed: $(npm -v)"
else
  # If npm is not available but nodejs is from nodesource, we need a different approach
  if apt-cache policy nodejs | grep -q "nodesource"; then
    echo "Node.js is installed from NodeSource, installing npm via Node.js..."
    # NodeSource nodejs typically includes npm or has it available through corepack
    if command -v corepack &> /dev/null; then
      sudo corepack enable npm
    else
      echo "Warning: Unable to install npm automatically with this Node.js installation."
      echo "Please install npm manually or use a different Node.js distribution."
    fi
  else
    # Try standard install
    sudo apt install -y npm
  fi
fi

# Install espeak for text-to-speech
if ! command -v espeak &> /dev/null; then
  sudo apt install -y espeak
else
  echo "espeak is already installed"
fi

# Install sox for audio capture
if ! command -v sox &> /dev/null; then
  sudo apt install -y sox
else
  echo "sox is already installed"
fi

# Install node packages
echo "Installing Node.js packages..."
npm install

# Create configuration file if it doesn't exist
if [ ! -f "config.json" ]; then
    echo "Creating default configuration..."

    # Get host info for better default config
    HOSTNAME=$(hostname)
    IS_WSL_CONFIG="false"
    DEVICE_PREFIX="device"
    
    if [ "$IS_WSL" = true ]; then
        IS_WSL_CONFIG="true"
        DEVICE_PREFIX="wsl"
        # For WSL, we'll use localhost as default server since it might be running on the same machine
        SERVER_URL="ws://localhost:3000"
    else
        SERVER_URL="ws://192.168.1.100:3000"
    fi
    
    RANDOM_ID="${DEVICE_PREFIX}-${HOSTNAME}-$(date +%s | tail -c 6)"
    
    node -e "
        const fs = require('fs');
        const config = {
            serverUrl: '${SERVER_URL}',
            deviceId: '${RANDOM_ID}',
            deviceName: '${HOSTNAME}',
            isWSL: ${IS_WSL_CONFIG},
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
echo "Setting up service for auto-start..."

# Update service file with current user and directory
CURRENT_USER=$(whoami)
INSTALL_DIR=$(pwd)
echo "Configuring service to run as user: $CURRENT_USER"
echo "Installation directory: $INSTALL_DIR"

if [ "$IS_WSL" = true ]; then
  echo "WSL detected: systemd may not work properly in this environment"
  echo "Creating startup script instead of systemd service"
  
  # Create a startup script
  cat > start-homepost-client.sh << EOF
#!/bin/bash
cd "$INSTALL_DIR"
node client.js
EOF
  
  chmod +x start-homepost-client.sh
  
  echo "To start the client manually: ./start-homepost-client.sh"
  echo "You can add this to your .bashrc or use Task Scheduler on Windows to run it at startup"
else
  # Create a temporary service file with proper values
  sed "s|%USER%|$CURRENT_USER|g; s|%INSTALL_DIR%|$INSTALL_DIR|g" homepost-client.service > homepost-client.service.tmp
  sudo cp homepost-client.service.tmp /etc/systemd/system/homepost-client.service
  rm homepost-client.service.tmp
  sudo systemctl daemon-reload
  sudo systemctl enable homepost-client.service
  sudo systemctl start homepost-client.service
  
  echo "Systemd service installed and started"
fi

echo "Installation complete!"
echo ""

if [ "$IS_WSL" = true ]; then
  echo "In WSL environment:"
  echo "- To start the client: ./start-homepost-client.sh"
  echo "- To run in background: nohup ./start-homepost-client.sh > homepost.log 2>&1 &"
  echo "- To view logs: cat homepost.log"
  echo ""
  echo "WARNING: Audio capture may not work properly in WSL."
  echo "WSL has limited audio device support. You may need to configure"
  echo "audio redirection from Windows or use a native Linux installation"
  echo "for full functionality."
else
  echo "On standard Linux:"
  echo "- To check status: sudo systemctl status homepost-client"
  echo "- To view logs: sudo journalctl -u homepost-client"
  echo "- To restart: sudo systemctl restart homepost-client"
fi

echo ""
echo "Don't forget to edit config.json to set your server IP and device ID!"
