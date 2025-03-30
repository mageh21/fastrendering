// This file helps with path alias resolution for the render script
require('@babel/register')({
  presets: [
    '@babel/preset-env',
    '@babel/preset-typescript',
    '@babel/preset-react'
  ],
  plugins: [
    ['module-resolver', {
      root: ['.'],
      alias: {
        '@': './src'
      }
    }]
  ],
  extensions: ['.js', '.ts', '.tsx']
});

// Now run the actual render script
require('./render.ts'); 