# AEM-Starter Build Scripts

All build and development tasks are now handled through npm scripts. No more shell scripts! 🎉

## Development

```bash
# Start development server
npm run dev

# Start Electron in development mode
npm start
```

## Building

```bash
# Clean build directory
npm run clean

# Build app (unsigned)
npm run build

# Build app with code signing (requires .env setup)
npm run build:signed

# Build app with full signing & notarization debug output
npm run build:verbose

# Test the built app
npm run test:app

# Test the signed app
npm run test:signed
```

## Distribution Pipeline

```bash
# Full distribution pipeline: build → sign → notarize → package → upload
npm run distribute

# Alias for distribute
npm run release
```

The distribution pipeline performs these steps:
1. **Build** unsigned app
2. **Sign** app with entitlements and hardened runtime
3. **Notarize** with Apple (can take 5-15 minutes)
4. **Package** into distributable ZIP
5. **Upload** to GitHub releases (if GITHUB_TOKEN is set)

## Manual Distribution Steps

```bash
# Create PKG installer (the solution for Terminal & Editor issues)
npm run make

# Create PKG installer with full debug output
npm run make:verbose

# Test PKG installer creation
npm run test:pkg
```

## Code Signing Setup

```bash
# Set up code signing environment
npm run setup:signing
```

This will:
1. Create a `.env` file with placeholders
2. Show you the steps to get your Apple ID credentials
3. List your current code signing certificates
4. Explain the full distribution pipeline

## Running the Built App

```bash
# Launch the built app
npm run run:app
```

## Quick Workflows

```bash
# Build and test unsigned app
npm run test:app

# Build and test signed app (requires .env setup)
npm run test:signed

# Full production release
npm run release
```

## Environment Variables

Create a `.env` file with:

```env
# Required for signing and notarization
APPLE_ID=your-apple-id@example.com
APPLE_ID_PASSWORD=your-app-specific-password
APPLE_TEAM_ID=your-team-id

# Optional: Custom signing identity (defaults to Apple Development cert)
SIGNING_IDENTITY=Developer ID Application: Your Name (TEAM_ID)

# Optional: GitHub releases
GITHUB_TOKEN=ghp_your_github_personal_access_token
```

## Prerequisites for Distribution

1. **Apple Developer Account** with valid certificates
2. **App-Specific Password** for notarization
3. **Developer ID Application Certificate** (for production)
4. **GitHub CLI** installed and authenticated (for releases)
   ```bash
   brew install gh
   gh auth login
   ```

## Distribution Pipeline Details

### 1. Code Signing
- Uses entitlements from `entitlements.mac.plist`
- Applies hardened runtime
- Timestamps the signature
- Verifies signature integrity

### 2. Notarization
- Uploads to Apple's notarization service
- Typically takes 5-15 minutes
- Required for distribution outside App Store

### 3. Packaging
- Creates ZIP file for distribution
- Maintains code signature and notarization

### 4. GitHub Release
- Creates release with version from `package.json`
- Uploads signed and notarized ZIP
- Generates release notes

## Notes

- All builds target `arm64` (Apple Silicon) only
- The `prebuild` hooks automatically clean the `out/` directory
- Code signing requires proper Apple Developer credentials
- Notarization can take several minutes - be patient!
- GitHub releases require the `gh` CLI tool

## 🏗️ **Build Scripts**

### **Development Builds**
- `npm run build` - Build unsigned app (fast, for testing)
- `npm run build:signed` - Build signed app (with debug output)
- `npm run build:verbose` - Build with full signing & notarization debug output

### **Production Builds**  
- `npm run make` - Create signed, notarized PKG installer
- `npm run make:verbose` - Create PKG installer with full debug output

### **Debug Output Explained**
- `build:signed` - Shows Electron Forge progress
- `build:verbose` - Shows detailed signing and notarization progress including:
  - Upload progress to Apple's servers
  - Notarization status updates
  - Detailed error messages if issues occur

**Note**: Notarization uploads your entire app (~355MB) to Apple's servers, which can take 5-15 minutes depending on your internet connection.

## 📦 **PKG Installers - The Solution for Terminal & File Access**

### **Why PKG Installers?**

The Terminal component and Monaco Editor file operations require special permissions that can only be granted through proper macOS installation:

- **Terminal Component** (`node-pty`) needs permission to spawn shell processes
- **File Editor** needs advanced file system access beyond basic read/write
- **PKG installers** request these permissions during installation
- **Proper installation to `/Applications`** resolves security restrictions

### **Why PKG is Now the Default**

| Format | Installation | Permissions | Terminal/Editor |
|--------|-------------|-------------|-----------------|
| **PKG** | Guided installer | ✅ Full system integration | ✅ **Works perfectly** |
| **ZIP** | Manual extraction | ❌ No permissions | ❌ Terminal/Editor blocked |

**PKG is now the default `make` target** because it's the only format that solves the Terminal and Editor permission issues.

### **PKG Installer Features**

```bash
# Create PKG installer (now the default!)
npm run make
```

The PKG installer:
1. **Installs to `/Applications`** (proper system location)
2. **Requests permissions** during installation
3. **Runs post-install script** to set proper file permissions
4. **Creates CLI symlink** at `/usr/local/bin/aem-starter`
5. **Integrates with macOS** (Spotlight, Launchpad, etc.)

### **Post-Install Script**

The PKG installer includes a post-install script (`scripts/pkg-scripts/postinstall`) that:
- Sets executable permissions for the app
- Configures native module permissions (node-pty)
- Creates optional CLI symlink
- Ensures proper file system access

### **Installation Instructions for Users**

1. **Download** the `.pkg` file from releases
2. **Double-click** to start installer
3. **Follow** the guided installation
4. **Grant permissions** when prompted
5. **Launch** from Applications or run `aem-starter` in terminal

### **Expected Permission Prompts**

During first launch after PKG installation, macOS may ask for:
- ✅ **Terminal access** (for interactive shells)
- ✅ **File system access** (for project files)
- ✅ **Network access** (for AEM connections)

**These prompts are normal and required for full functionality!** 