# PowerShell Installation Script for Home Monitoring Client on Windows
# Run as Administrator for best results

# Set error action preference to stop on any error
$ErrorActionPreference = "Stop"

Write-Host "Installing Home Monitoring Client for Windows..." -ForegroundColor Green

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Warning "Script is not running as Administrator. Some operations may fail."
    Write-Host "For best results, restart this script as Administrator." -ForegroundColor Yellow
}

# Check if Node.js is installed
try {
    $nodeVersion = node -v
    Write-Host "Node.js is already installed: $nodeVersion" -ForegroundColor Green
}
catch {
    Write-Host "Node.js is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please download and install Node.js from https://nodejs.org/" -ForegroundColor Yellow
    Write-Host "After installation, restart this script" -ForegroundColor Yellow
    exit 1
}

# Check if npm is installed
try {
    $npmVersion = npm -v
    Write-Host "npm is already installed: $npmVersion" -ForegroundColor Green
}
catch {
    Write-Host "npm is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install npm by installing Node.js from https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# Install Node packages
Write-Host "Installing Node.js packages..." -ForegroundColor Green
npm install

# Apply Windows-specific patches to client.js
Write-Host "Applying Windows-specific patches..." -ForegroundColor Green
node windows-patch.js

# Check for text-to-speech capability
Write-Host "Windows has built-in text-to-speech capabilities, no additional installation required" -ForegroundColor Green

# Make openai-tts.js executable
$ttsScriptPath = Join-Path $PSScriptRoot "openai-tts.js"
if (Test-Path $ttsScriptPath) {
    # Set the executable bit (only meaningful on Unix, but doesn't hurt on Windows)
    $acl = Get-Acl $ttsScriptPath
    $permission = "Everyone", "FullControl", "Allow"
    $accessRule = New-Object System.Security.AccessControl.FileSystemAccessRule $permission
    $acl.SetAccessRule($accessRule)
    Set-Acl $ttsScriptPath $acl
}

# Prompt for OpenAI API key
Write-Host ""
Write-Host "The HomePost client can use OpenAI's Text-to-Speech API for high-quality voice responses." -ForegroundColor Cyan
Write-Host "This requires an OpenAI API key." -ForegroundColor Cyan
Write-Host "  - If you don't have one, you can sign up at https://platform.openai.com/" -ForegroundColor Cyan
Write-Host "  - API key usage will incur charges based on OpenAI's pricing." -ForegroundColor Cyan
Write-Host "  - You can also skip this step and the client will use local text-to-speech." -ForegroundColor Cyan
Write-Host ""
$useOpenAI = Read-Host "Would you like to configure OpenAI TTS? (y/n)"

# Initialize OpenAI config
$openAIConfig = @{
    apiKey = ""
    voice = "alloy"
}

if ($useOpenAI -eq "y" -or $useOpenAI -eq "Y") {
    $openAIApiKey = Read-Host "Enter your OpenAI API key"
    if (-not [string]::IsNullOrWhiteSpace($openAIApiKey)) {
        $openAIConfig.apiKey = $openAIApiKey
        
        # Prompt for voice preference
        Write-Host ""
        Write-Host "Available voices: alloy, echo, fable, onyx, nova, shimmer" -ForegroundColor Cyan
        $voice = Read-Host "Enter preferred voice (default: alloy)"
        if (-not [string]::IsNullOrWhiteSpace($voice)) {
            $openAIConfig.voice = $voice
        }
    }
}

# Create configuration file if it doesn't exist
$configPath = Join-Path $PSScriptRoot "config.json"
if (-not (Test-Path $configPath)) {
    Write-Host "Creating default configuration..." -ForegroundColor Green
    
    $hostname = $env:COMPUTERNAME
    $randomSuffix = Get-Random -Minimum 1000 -Maximum 9999
    $deviceId = "win-$hostname-$randomSuffix"
    
    # Default to localhost as the server URL
    $serverUrl = "ws://localhost:3000"
    
    # Create config using Node.js to ensure proper JSON formatting with OpenAI integration
    $openAIConfigJson = $openAIConfig | ConvertTo-Json -Compress
    
    node -e "
        const fs = require('fs');
        const openAIConfig = JSON.parse('$openAIConfigJson');
        const config = {
            serverUrl: '$serverUrl',
            deviceId: '$deviceId',
            deviceName: '$hostname',
            location: 'Windows PC',
            isWindows: true,
            micConfig: {
                rate: '16000',
                channels: '1',
                device: 'default',
                fileType: 'wav'
            },
            reconnectInterval: 5000,
            speakerEnabled: true,
            openai: openAIConfig
        };
        fs.writeFileSync('config.json', JSON.stringify(config, null, 2));
    "
    Write-Host "Created config.json - Please edit with your server details!" -ForegroundColor Green
}
else {
    Write-Host "Configuration file already exists. Skipping creation." -ForegroundColor Yellow
    
    # If user provided OpenAI API key but config already exists, offer to update it
    if ($useOpenAI -eq "y" -or $useOpenAI -eq "Y") {
        if (-not [string]::IsNullOrWhiteSpace($openAIConfig.apiKey)) {
            $updateConfig = Read-Host "Would you like to update the existing config with OpenAI settings? (y/n)"
            if ($updateConfig -eq "y" -or $updateConfig -eq "Y") {
                # Read existing config
                $existingConfig = Get-Content -Path $configPath -Raw | ConvertFrom-Json
                
                # Create or update openai property
                if (-not (Get-Member -InputObject $existingConfig -Name "openai" -MemberType Properties)) {
                    $existingConfig | Add-Member -NotePropertyName "openai" -NotePropertyValue ([PSCustomObject]$openAIConfig)
                } else {
                    $existingConfig.openai.apiKey = $openAIConfig.apiKey
                    $existingConfig.openai.voice = $openAIConfig.voice
                }
                
                # Write updated config back
                $existingConfig | ConvertTo-Json -Depth 10 | Set-Content -Path $configPath
                Write-Host "Updated config.json with OpenAI settings." -ForegroundColor Green
            }
        }
    }
}

# Create TTS helper script
$ttsScriptPath = Join-Path $PSScriptRoot "speak.ps1"
if (-not (Test-Path $ttsScriptPath)) {
    Write-Host "Creating speech helper script..." -ForegroundColor Green
    @"
# PowerShell Text-to-Speech script
param(
    [Parameter(Mandatory=`$true)]
    [string]`$text
)

Add-Type -AssemblyName System.Speech
`$synthesizer = New-Object System.Speech.Synthesis.SpeechSynthesizer
`$synthesizer.Speak(`$text)
"@ | Out-File -FilePath $ttsScriptPath -Encoding utf8
}

# Create a startup script
$startupScriptPath = Join-Path $PSScriptRoot "start-homepost-client.ps1"
@"
# Start HomePost Client
`$scriptPath = Split-Path -Parent `$MyInvocation.MyCommand.Path
Set-Location `$scriptPath
node client.js
"@ | Out-File -FilePath $startupScriptPath -Encoding utf8

# Create a batch file wrapper for the startup script
$batchPath = Join-Path $PSScriptRoot "start-homepost-client.bat"
@"
@echo off
PowerShell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-homepost-client.ps1"
"@ | Out-File -FilePath $batchPath -Encoding ascii

# Function to create a scheduled task
function CreateScheduledTask {
    try {
        $taskName = "HomePostClient"
        $fullBatchPath = (Get-Item $batchPath).FullName
        
        # Check if task already exists
        $existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
        if ($existingTask) {
            Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
        }
        
        # Create the scheduled task
        $action = New-ScheduledTaskAction -Execute $fullBatchPath
        $trigger = New-ScheduledTaskTrigger -AtLogon
        $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
        
        Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description "HomePost Monitoring Client" -RunLevel Highest
        
        Write-Host "Scheduled task created successfully. The client will start automatically at logon." -ForegroundColor Green
    } catch {
        Write-Host "Failed to create scheduled task: $_" -ForegroundColor Red
        Write-Host "You can start the client manually by running the start-homepost-client.bat file." -ForegroundColor Yellow
    }
}

# Setup Windows service using NSSM if administrator
if ($isAdmin) {
    # Check if NSSM is already available
    $nssmPath = Join-Path $PSScriptRoot "nssm.exe"
    $nssmDownloaded = $false
    
    if (-not (Test-Path $nssmPath)) {
        Write-Host "Downloading NSSM (Non-Sucking Service Manager)..." -ForegroundColor Green
        try {
            $nssmUrl = "https://nssm.cc/release/nssm-2.24.zip"
            $tempFile = [System.IO.Path]::GetTempFileName() + ".zip"
            
            # Use .NET WebClient as it's available in most PowerShell versions
            (New-Object System.Net.WebClient).DownloadFile($nssmUrl, $tempFile)
            
            # Extract nssm.exe from the zip
            Add-Type -AssemblyName System.IO.Compression.FileSystem
            $zip = [System.IO.Compression.ZipFile]::OpenRead($tempFile)
            
            # Find the right executable for the system architecture
            $arch = if ([Environment]::Is64BitOperatingSystem) { "win64" } else { "win32" }
            $nssmEntry = $zip.Entries | Where-Object { $_.FullName -like "*/nssm-2.24/$arch/nssm.exe" }
            
            if ($nssmEntry) {
                [System.IO.Compression.ZipFileExtensions]::ExtractToFile($nssmEntry, $nssmPath, $true)
                $nssmDownloaded = $true
                Write-Host "NSSM downloaded successfully." -ForegroundColor Green
            } else {
                Write-Host "Could not find NSSM executable in the downloaded zip." -ForegroundColor Red
            }
            
            $zip.Dispose()
            Remove-Item $tempFile -Force
        } catch {
            Write-Host "Failed to download NSSM: $_" -ForegroundColor Red
            Write-Host "Please download NSSM manually from https://nssm.cc and place nssm.exe in the client directory" -ForegroundColor Yellow
        }
    } else {
        $nssmDownloaded = $true
    }
    
    # Install as a service if NSSM is available
    if ($nssmDownloaded) {
        Write-Host "Installing Windows service..." -ForegroundColor Green
        
        # Remove existing service if it exists
        & $nssmPath stop HomePostClient 2>$null
        & $nssmPath remove HomePostClient confirm 2>$null
        
        # Full path to Node.js
        $nodePath = (Get-Command node).Source
        $clientPath = Join-Path $PSScriptRoot "client.js"
        
        # Install the service
        & $nssmPath install HomePostClient $nodePath $clientPath
        & $nssmPath set HomePostClient DisplayName "HomePost Monitoring Client"
        & $nssmPath set HomePostClient Description "Client for the HomePost Monitoring System"
        & $nssmPath set HomePostClient AppDirectory $PSScriptRoot
        & $nssmPath set HomePostClient AppStdout (Join-Path $PSScriptRoot "service-output.log")
        & $nssmPath set HomePostClient AppStderr (Join-Path $PSScriptRoot "service-error.log")
        & $nssmPath set HomePostClient Start SERVICE_AUTO_START
        
        # Start the service
        & $nssmPath start HomePostClient
        
        Write-Host "Service installed and started successfully." -ForegroundColor Green
    } else {
        Write-Host "Could not install Windows service. Creating Task Scheduler task instead..." -ForegroundColor Yellow
        CreateScheduledTask
    }
} else {
    Write-Host "Not running as Administrator, creating Task Scheduler task instead..." -ForegroundColor Yellow
    CreateScheduledTask
}


# Display completion message
Write-Host "Installation complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Client Management:" -ForegroundColor Yellow
if ($isAdmin -and $nssmDownloaded) {
    Write-Host "- To check status: nssm status HomePostClient" -ForegroundColor White
    Write-Host "- To start: nssm start HomePostClient" -ForegroundColor White
    Write-Host "- To stop: nssm stop HomePostClient" -ForegroundColor White
    Write-Host "- To restart: nssm restart HomePostClient" -ForegroundColor White
    Write-Host "- Logs are in: service-output.log and service-error.log" -ForegroundColor White
} else {
    Write-Host "- To start manually: run start-homepost-client.bat" -ForegroundColor White
    Write-Host "- To run in background: Right-click start-homepost-client.bat and select 'Run as administrator'" -ForegroundColor White
    Write-Host "- The client will start automatically at logon via Task Scheduler" -ForegroundColor White
}

Write-Host ""
Write-Host "Don't forget to edit config.json to set your server IP and device ID!" -ForegroundColor Cyan
