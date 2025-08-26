#!/bin/bash

# Fusion Music Player - Permission Fix Script
# This script fixes common Docker permission issues

echo "🔧 Fusion Music Player - Permission Fix"
echo "======================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if running as root/sudo
if [[ $EUID -ne 0 ]]; then
    print_error "This script needs to be run with sudo to fix permissions"
    echo "Usage: sudo bash fix-permissions.sh"
    exit 1
fi

# Stop the container if running
echo "1. Stopping container..."
docker-compose down 2>/dev/null || true
print_status "Container stopped"

# Create logs directory if it doesn't exist
echo "2. Creating logs directory..."
mkdir -p logs
print_status "Logs directory created"

# Fix music directory permissions
echo "3. Fixing music directory permissions..."
if [ -d "/opt/docker/public/Music" ]; then
    chown -R 1001:1001 /opt/docker/public/Music/
    chmod -R 755 /opt/docker/public/Music/
    print_status "Music directory permissions fixed"
else
    print_warning "Music directory /opt/docker/public/Music not found"
    print_warning "You may need to adjust the path in docker-compose.yaml"
fi

# Fix logs directory permissions
echo "4. Fixing logs directory permissions..."
chown -R 1001:1001 logs/
chmod -R 755 logs/
print_status "Logs directory permissions fixed"

# Fix uploaded files permissions if they exist
echo "5. Checking uploaded files..."
if [ -d "uploads" ]; then
    chown -R 1001:1001 uploads/
    chmod -R 755 uploads/
    print_status "Uploads directory permissions fixed"
else
    mkdir -p uploads
    chown 1001:1001 uploads/
    chmod 755 uploads/
    print_status "Uploads directory created with correct permissions"
fi

# Check Docker group permissions
echo "6. Checking Docker permissions..."
if groups $SUDO_USER | grep -q docker; then
    print_status "User $SUDO_USER is in docker group"
else
    print_warning "User $SUDO_USER is not in docker group"
    echo "To add user to docker group, run:"
    echo "sudo usermod -aG docker $SUDO_USER"
    echo "Then log out and log back in"
fi

# Restart the container
echo "7. Starting container..."
sudo -u $SUDO_USER docker-compose up -d
print_status "Container started"

# Wait a moment for container to start
sleep 5

# Test the application
echo "8. Testing application..."
if curl -s http://localhost:3043/health > /dev/null; then
    print_status "Application is responding correctly"
    echo ""
    echo "🎉 Permission fix completed successfully!"
    echo "Your Fusion Music Player should now work without permission errors."
    echo ""
    echo "Access your application at: http://localhost:3043"
else
    print_warning "Application might still be starting up"
    echo "Wait a moment and check: http://localhost:3043"
fi

echo ""
echo "📋 Summary of changes:"
echo "  • Fixed music directory permissions (/opt/docker/public/Music/)"
echo "  • Fixed logs directory permissions (./logs/)"
echo "  • Created uploads directory with correct permissions"
echo "  • Restarted Docker container"
echo ""
echo "If you still see permission errors, check the Docker logs:"
echo "  docker-compose logs -f music-player"
