const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

// Ensure dist directory exists
if (!fs.existsSync('./dist')) {
  fs.mkdirSync('./dist', { recursive: true });
}
if (!fs.existsSync('./dist/webview')) {
  fs.mkdirSync('./dist/webview', { recursive: true });
}

// Copy webview HTML files
function copyWebviewAssets() {
  const webviewSrc = './webview-ui';
  const webviewDest = './dist/webview';
  
  if (fs.existsSync(webviewSrc)) {
    const files = fs.readdirSync(webviewSrc);
    files.forEach(file => {
      if (file.endsWith('.html') || file.endsWith('.css')) {
        fs.copyFileSync(
          path.join(webviewSrc, file),
          path.join(webviewDest, file)
        );
      }
    });
  }
}

// Extension bundle (Node.js)
const extensionConfig = {
  entryPoints: ['./src/extension.ts'],
  bundle: true,
  outfile: './dist/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  sourcemap: !production,
  minify: production,
  treeShaking: true,
  plugins: [
    {
      name: 'copy-assets',
      setup(build) {
        build.onEnd(() => {
          copyWebviewAssets();
          console.log('[extension] Build complete');
        });
      }
    }
  ]
};

// Webview bundle (Browser)
const webviewConfig = {
  entryPoints: ['./webview-ui/bulkCommit.ts'],
  bundle: true,
  outfile: './dist/webview/bulkCommit.js',
  format: 'iife',
  platform: 'browser',
  sourcemap: !production,
  minify: production,
  treeShaking: true,
  plugins: [
    {
      name: 'webview-log',
      setup(build) {
        build.onEnd(() => {
          console.log('[webview] Build complete');
        });
      }
    }
  ]
};

async function build() {
  try {
    if (watch) {
      // Watch mode
      const extCtx = await esbuild.context(extensionConfig);
      const webCtx = await esbuild.context(webviewConfig);
      
      await Promise.all([
        extCtx.watch(),
        webCtx.watch()
      ]);
      
      console.log('👀 Watching for changes...');
    } else {
      // Production build
      await Promise.all([
        esbuild.build(extensionConfig),
        esbuild.build(webviewConfig)
      ]);
      
      console.log('✅ Build complete!');
    }
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();
