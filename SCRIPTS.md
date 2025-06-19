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
# Create distributable packages (unsigned)
npm run make

# Create distributable packages (signed) - requires signed build first
npm run make:signed
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