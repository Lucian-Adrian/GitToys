# GitToys 🔧

**PowerToys-style modular Git utilities for VS Code**

GitToys brings powerful Git utilities directly into VS Code with a clean, intuitive interface. Inspired by Microsoft PowerToys, each feature is a self-contained "toy" that enhances your Git workflow.

## ✨ Features

### 🎯 Bulk Commit (Primary Feature)

Commit files **one by one** with individual commit messages - perfect for:
- Splitting large changes into atomic commits
- Creating meaningful commit history
- Preparing clean PRs with logical commits

![Bulk Commit Demo](resources/demo.gif)

**How to use:**
1. Open the Command Palette (`Ctrl+Shift+P`)
2. Run "GitToys: Open Bulk Commit"
3. Select files you want to commit
4. Enter a commit message for each file
5. Click "Commit" - each file gets its own commit!

### 🔮 Coming Soon

- **Stash Manager** - Enhanced stash management with search and descriptions
- **Branch Visualizer** - Visual branch tree with quick actions
- **Commit Templates** - Reusable commit message templates

## 📦 Installation

### From VS Code Marketplace
1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X`)
3. Search for "GitToys"
4. Click Install

### From VSIX (Portable)
1. Download the `.vsix` file
2. In VS Code, go to Extensions
3. Click `...` → "Install from VSIX..."
4. Select the downloaded file

## 🚀 Quick Start

1. Open a folder with a Git repository
2. Click the **GitToys** icon in the Activity Bar (sidebar)
3. Click **Bulk Commit** to open the panel
4. Select files, write messages, commit!

## ⌨️ Commands

| Command | Description |
|---------|-------------|
| `GitToys: Open Bulk Commit` | Open the Bulk Commit panel |
| `GitToys: Refresh Changed Files` | Refresh the file list |

## ⚙️ Settings

| Setting | Description | Default |
|---------|-------------|---------|
| `gittoys.bulkCommit.autoStage` | Auto-stage files before committing | `true` |
| `gittoys.bulkCommit.showDiffOnSelect` | Show diff when clicking a file | `true` |

## 🛠️ Development

```bash
# Clone the repo
git clone https://github.com/gittoys/gittoys.git
cd gittoys

# Install dependencies
npm install

# Start watching for changes
npm run watch

# Press F5 in VS Code to launch Extension Development Host
```

### Building

```bash
# Build for production
npm run build

# Package as .vsix
npm run package
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT

---

**Made with ❤️ for developers who care about clean Git history**
