#!/bin/bash

# Update version script
# This script updates the version.json file with the current package version

# Get version from package.json
VERSION=$(node -p "require('./package.json').version")

# Get current timestamp
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
BUILD_DATE=$(date -u +"%Y-%m-%d")

# Update version.json
cat > public/version.json << EOF
{
  "version": "$VERSION",
  "timestamp": "$TIMESTAMP", 
  "buildDate": "$BUILD_DATE"
}
EOF

echo "Updated version.json with version: $VERSION"
echo "Timestamp: $TIMESTAMP"