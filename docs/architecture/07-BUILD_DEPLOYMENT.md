# Build System & Deployment

**Files**: `esbuild.js`, `package.json`, `.vscodeignore`  
**Type**: Build configuration  
**Output**: `dist/` folder + `gittoys-*.vsix`  

## Build Overview

Extension requires two separate bundles:

1. **Extension Bundle** (`dist/extension.js`)
   - Target: Node.js (VS Code host)
   - Entry: `src/extension.ts`
   - Size: ~19 KB

2. **Webview Bundle** (`dist/webview/bulkCommit.js`)
   - Target: Browser (WebKit)
   - Entry: `webview-ui/bulkCommit.ts`
   - Size: ~14 KB

## esbuild Configuration

**File**: `esbuild.js`

```javascript
const buildOptions = {
  entryPoints: {
    extension: 'src/extension.ts',
    webview: 'webview-ui/bulkCommit.ts'
  },
  bundle: true,           // Inline all imports
  minify: true,           // Remove unused code
  sourcemap: false,       // Production: no maps
  target: 'ES2020',       // Modern JS
  platform: 'node',       // For extension
  platform: 'browser',    // For webview
};
```

### Dual Build Script

```bash
$ npm run build
```

Runs `node esbuild.js --production`:
- Builds both bundles simultaneously
- Minifies code
- Outputs to `dist/` folder
- Shows build summary

### Development vs Production

**Development** (`npm run build`):
- esbuild with watch mode ready
- Source maps included
- No minification

**Production** (`npm run vscode:prepublish`):
- Minified bundles
- No source maps
- Optimized for package size

## Dependency Management

**package.json**:
```json
{
  "dependencies": {},        // ← Empty!
  "devDependencies": {
    "@types/vscode": "^1.85",
    "typescript": "^5.3",
    "esbuild": "^0.19"
  }
}
```

**Zero runtime dependencies**:
- Only VS Code API used (built-in)
- Git operations via VS Code Git extension
- No npm packages bundled

Benefits:
- Minimal download size
- No supply chain vulnerabilities
- Portable (no npm install needed)

## Packaging with vsce

**Command**: `npx vsce package --allow-missing-repository`

**Output**: `gittoys-0.2.0.vsix` (~17 KB)

**VSIX Structure**:
```
gittoys-0.2.0.vsix
├── [Content_Types].xml
├── extension.vsixmanifest
└── extension/
    ├── package.json
    ├── README.md
    ├── LICENSE.txt
    └── dist/
        ├── extension.js
        └── webview/
            ├── bulkCommit.js
            └── bulkCommit.css
```

## .vscodeignore

Excludes files from VSIX package:

```
.git
.github
.vscode
docs
node_modules
src
webview-ui
*.ts
tsconfig.json
esbuild.js
```

Keeps size minimal (~17 KB instead of ~50 MB with node_modules).

## Asset Loading in Extension

Webview panel loads CSS/JS from compiled bundle:

```typescript
const distPath = vscode.Uri.joinPath(
  this.context.extensionUri,
  'dist', 'webview'
);

const jsUri = panel.webview.asWebviewUri(
  vscode.Uri.joinPath(distPath, 'bulkCommit.js')
);

const cssUri = panel.webview.asWebviewUri(
  vscode.Uri.joinPath(distPath, 'bulkCommit.css')
);
```

Paths converted to `vscode-webview:` URIs for security.

## Installation Workflow

### From VSIX File

1. Open VS Code
2. Extensions → Install from VSIX
3. Select `gittoys-0.2.0.vsix`
4. Reload window

### From VS Code Marketplace (Future)

1. Extensions → Search "GitToys"
2. Click Install
3. Auto-downloaded and installed

Current: Local VSIX only.

## Development Workflow

```bash
# Initial setup
npm install

# Build for development
npm run build

# Run in debug mode (F5 in VS Code)
# Opens Extension Development Host

# Build for release
npm run vscode:prepublish

# Package VSIX
npx vsce package --allow-missing-repository
```

## Testing in Extension Dev Host

**Launch Configuration** (`.vscode/launch.json`):
```json
{
  "type": "extensionHost",
  "request": "launch",
  "name": "Extension Dev Host",
  "runtimeExecutable": "${execPath}",
  "args": ["--extensionDevelopmentPath=${workspaceFolder}"],
  "outFiles": ["${workspaceFolder}/dist/**/*.js"]
}
```

Press `F5` to:
1. Start new VS Code instance
2. Load extension from `dist/` (live)
3. Enable debugging

Changes to source require rebuild (`npm run build`).

## Performance Optimization

### Bundle Size

Current:
- Extension: 18.81 KB
- Webview CSS: 13.56 KB
- Webview JS: 14 KB
- Total: ~46 KB uncompressed

Optimization opportunities:
- Remove unused CSS (could save ~2 KB)
- Further minification (already at maximum)
- Tree-shake webview components (architectural change)

### Load Time

- Extension activation: ~50 ms
- Webview initialization: ~100 ms
- First render: ~150 ms

All acceptable. No optimization needed for current scale.

## Multi-Platform Support

esbuild targets:
- **Windows**: Native
- **macOS**: Native
- **Linux**: Native

All platforms get same VSIX. No platform-specific builds needed.

## Continuous Integration

For CI/CD (future):
```bash
npm install
npm run build
npm run lint
npm run test
npx vsce package
# Upload to marketplace
```

Current: Manual build + package.

## Troubleshooting Build Issues

**Issue**: "Cannot find module 'src/...'""
- **Fix**: Run `npm run build` first to compile TS

**Issue**: "esbuild: command not found"
- **Fix**: `npm install` (installs devDependencies)

**Issue**: VSIX missing files
- **Fix**: Check `.vscodeignore` isn't excluding too much

**Issue**: Webview blank/white
- **Fix**: Check asset URIs in console (F12), may be loading from wrong path

## Release Checklist

- [ ] Update version in package.json
- [ ] Update CHANGELOG.md
- [ ] Run `npm run build`
- [ ] Run in Extension Dev Host (F5), test all features
- [ ] Run `npm run vscode:prepublish`
- [ ] Run `npx vsce package --allow-missing-repository`
- [ ] Test .vsix install in clean VS Code instance
- [ ] Commit & tag in git
- [ ] Publish to marketplace (when ready)
