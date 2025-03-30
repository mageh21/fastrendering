#!/bin/bash

# Install necessary dependencies for video rendering
echo "Installing required dependencies for video rendering..."

# Install Babel-related packages for path resolution
npm install --save-dev \
  @babel/core@^7.23.7 \
  @babel/preset-env@^7.23.7 \
  @babel/preset-typescript@^7.23.7 \
  @babel/register@^7.23.7 \
  babel-plugin-module-resolver@^5.0.0

# Install FFmpeg-related packages
npm install --save-dev \
  fluent-ffmpeg@^2.1.3 \
  @types/fluent-ffmpeg@^2.1.27

# Install canvas-related packages
npm install --save-dev \
  skia-canvas@^2.0.1

# Install other required packages
npm install --save-dev \
  @types/node@^22.10.2

echo "All dependencies installed successfully."
echo "You may need to install FFmpeg manually on your system."
echo "Download it from: https://ffmpeg.org/download.html"
echo "Then update the path in scripts/render.ts to point to your FFmpeg executable." 