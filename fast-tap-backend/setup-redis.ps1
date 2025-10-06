# Redis Setup Script for Windows
# Run this in PowerShell as Administrator

Write-Host "Setting up Redis for Fast Tap Backend..." -ForegroundColor Green

# Method 1: Using Chocolatey (Recommended)
if (Get-Command choco -ErrorAction SilentlyContinue) {
    Write-Host "Installing Redis using Chocolatey..." -ForegroundColor Yellow
    choco install redis-64 -y
    
    if ($?) {
        Write-Host "Redis installed successfully!" -ForegroundColor Green
        Write-Host "Starting Redis service..." -ForegroundColor Yellow
        redis-server
    } else {
        Write-Host "Chocolatey installation failed. Trying alternative methods..." -ForegroundColor Red
    }
} else {
    Write-Host "Chocolatey not found. Please install Chocolatey first or use Docker." -ForegroundColor Red
    Write-Host "Install Chocolatey: https://chocolatey.org/install" -ForegroundColor Yellow
}

# Method 2: Docker (Alternative)
Write-Host "`nAlternative: Using Docker" -ForegroundColor Cyan
Write-Host "If you have Docker installed, run this command:" -ForegroundColor Yellow
Write-Host "docker run -d -p 6379:6379 --name redis-server redis:alpine" -ForegroundColor White

# Method 3: Manual download
Write-Host "`nManual Installation:" -ForegroundColor Cyan
Write-Host "1. Download Redis from: https://github.com/tporadowski/redis/releases" -ForegroundColor Yellow
Write-Host "2. Install the MSI file" -ForegroundColor Yellow
Write-Host "3. Redis will be available as a Windows service" -ForegroundColor Yellow

Write-Host "`nAfter Redis is installed:" -ForegroundColor Green
Write-Host "1. Update your .env file with Redis connection details" -ForegroundColor Yellow
Write-Host "2. Use 'npm run dev:redis' instead of 'npm run dev'" -ForegroundColor Yellow