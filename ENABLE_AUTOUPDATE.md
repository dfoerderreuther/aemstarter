# Enabling Auto-Updates for AEM-Starter

This document outlines the steps required to enable automatic updates for the AEM-Starter Electron application.

## Current State

The application already has most of the infrastructure in place:

- ✅ `update-electron-app` dependency installed (`^3.1.1`)
- ✅ GitHub publisher configured in `forge.config.ts`
- ✅ GitHub Actions workflow for releases
- ✅ TypeScript definitions for `update-electron-app`
- ❌ Auto-update code is commented out in `src/main.ts`

## Step 1: Enable Auto-Updates in Main Process

### 1.1 Install Electron Log (Optional but Recommended)

```bash
npm install electron-log
```

### 1.2 Update Main Process Code

Edit `src/main.ts` and replace the commented auto-update section (around lines 75-79) with:

```typescript:src/main.ts
// ... existing imports ...
import log from 'electron-log';

// ... existing code ...

// Initialize auto-updates
const { updateElectronApp } = require('update-electron-app');
updateElectronApp({
  repo: 'dfoerderreuther/aemstarter',
  updateInterval: '1 hour',
  logger: log,
  notifyUser: true
});

// ... rest of existing code ...
```

### 1.3 Environment-Specific Configuration (Recommended)

For better development experience, only enable auto-updates in production:

```typescript:src/main.ts
// ... existing imports ...
import log from 'electron-log';

// ... existing code ...

// Initialize auto-updates (only in production)
if (process.env.NODE_ENV === 'production') {
  const { updateElectronApp } = require('update-electron-app');
  updateElectronApp({
    repo: 'dfoerderreuther/aemstarter',
    updateInterval: '1 hour',
    logger: log,
    notifyUser: true
  });
}

// ... rest of existing code ...
```

## Step 2: Verify GitHub Configuration

### 2.1 Check Forge Config

Ensure your `forge.config.ts` has the correct GitHub publisher configuration:

```typescript:forge.config.ts
publishers: [
  {
    name: '@electron-forge/publisher-github',
    config: {
      repository: {
        owner: 'dfoerderreuther',
        name: 'aemstarter'
      },
      prerelease: false
    }
  }
]
```

### 2.2 Verify GitHub Actions Workflow

The existing `.github/workflows/build.yml` should already handle:
- Building for multiple platforms (macOS, Windows, Linux)
- Code signing and notarization for macOS
- Creating GitHub releases when tags are pushed

## Step 3: Testing Auto-Updates

### 3.1 Local Testing

1. **Build current version**:
   ```bash
   npm run make:mac
   ```

2. **Create a test release**:
   ```bash
   # Update version in package.json
   npm version patch
   
   # Create and push tag
   git tag v1.0.19
   git push origin v1.0.19
   ```

3. **Test the update**:
   - Run the built app
   - Check if it detects the new version
   - Verify the update process works

### 3.2 Staging Environment (Optional)

For safer testing, create a separate repository:

1. **Fork the repository** for testing
2. **Update the repo name** in the auto-update configuration
3. **Test releases** in the staging environment first

## Step 4: Release Process

### 4.1 Standard Release Workflow

1. **Update version**:
   ```bash
   npm version patch  # or minor/major
   ```

2. **Create and push tag**:
   ```bash
   git tag v1.0.19
   git push origin v1.0.19
   ```

3. **GitHub Actions will automatically**:
   - Build for all platforms
   - Create a GitHub release
   - Upload installers to the release

### 4.2 Version Management

- **Current version**: `1.0.18` (in `package.json`)
- **Version format**: Semantic versioning (`major.minor.patch`)
- **Tag format**: `v1.0.19`, `v1.1.0`, `v2.0.0`

## How Auto-Updates Work

### 5.1 Update Flow

1. **Check for updates**: App checks GitHub releases every hour
2. **Version comparison**: Compares current version with latest release
3. **Download**: Downloads appropriate installer for user's platform
4. **Install**: Automatically installs update and restarts app

### 5.2 Platform-Specific Behavior

**macOS**:
- ✅ Code signed and notarized builds
- ✅ Seamless auto-updates with proper permissions
- ✅ DMG and PKG installers supported

**Windows**:
- ✅ Squirrel installer (`.exe`) supports auto-updates
- ✅ Updates downloaded and installed automatically

**Linux**:
- ✅ `.deb` and `.rpm` packages support auto-updates
- ✅ Package manager integration possible

### 5.3 Update Intervals

- **Default**: Check every hour
- **Configurable**: Can be changed in the `updateInterval` setting
- **Options**: `'1 hour'`, `'2 hours'`, `'1 day'`, etc.

## Advanced Configuration

### 6.1 Custom Update Logic

For more control, you can implement custom update handling:

```typescript:src/main.ts
const { updateElectronApp } = require('update-electron-app');

updateElectronApp({
  repo: 'dfoerderreuther/aemstarter',
  updateInterval: '1 hour',
  logger: log,
  notifyUser: true,
  // Custom update handling
  onUpdateAvailable: (info) => {
    console.log('Update available:', info);
  },
  onUpdateDownloaded: (info) => {
    console.log('Update downloaded:', info);
  }
});
```

### 6.2 Update Status in UI

Add IPC handlers to expose update status to the renderer:

```typescript:src/main.ts
// Add to your existing IPC handlers
ipcMain.handle('check-for-updates', async () => {
  // Implementation to check update status
  return { hasUpdate: false, version: '1.0.18' };
});

ipcMain.handle('install-update', async () => {
  // Implementation to install update
  return { success: true };
});
```

### 6.3 Update Notifications

The `notifyUser: true` option will show system notifications when:
- An update is available
- An update is downloaded
- An update is being installed

## Troubleshooting

### 7.1 Common Issues

**Updates not detected**:
- Check GitHub repository name in configuration
- Verify releases are public (not draft)
- Ensure version numbers follow semantic versioning

**Update fails to install**:
- Check file permissions on macOS
- Verify code signing is working
- Check network connectivity

**Development vs Production**:
- Auto-updates only work with production builds
- Development builds should not check for updates

### 7.2 Debugging

Enable detailed logging:

```typescript:src/main.ts
const { updateElectronApp } = require('update-electron-app');
updateElectronApp({
  repo: 'dfoerderreuther/aemstarter',
  updateInterval: '1 hour',
  logger: log,
  notifyUser: true,
  // Enable debug logging
  debug: process.env.NODE_ENV === 'development'
});
```

### 7.3 Log Files

Check log files for update-related messages:
- **macOS**: `~/Library/Logs/AEM-Starter/main.log`
- **Windows**: `%APPDATA%\AEM-Starter\logs\main.log`
- **Linux**: `~/.config/AEM-Starter/logs/main.log`

## Security Considerations

### 8.1 Code Signing

- ✅ macOS builds are code signed and notarized
- ✅ Windows builds should be code signed for production
- ✅ Linux builds can be GPG signed

### 8.2 Update Verification

- `update-electron-app` verifies GitHub release authenticity
- Downloads are verified against GitHub's checksums
- No additional verification needed for GitHub releases

## Monitoring and Analytics

### 9.1 Update Metrics

Track update success rates by monitoring:
- GitHub release download counts
- App crash reports after updates
- User feedback on update process

### 9.2 Rollback Strategy

For critical issues:
1. **Immediate**: Create a hotfix release
2. **Communication**: Notify users about the issue
3. **Investigation**: Analyze what went wrong
4. **Prevention**: Update release process to prevent recurrence

## Summary

After completing these steps:

1. ✅ Auto-updates will be enabled for all users
2. ✅ Updates will be delivered automatically via GitHub releases
3. ✅ Users will be notified of available updates
4. ✅ Updates will install seamlessly across all platforms
5. ✅ The release process is fully automated via GitHub Actions

The auto-update system integrates seamlessly with your existing build and release infrastructure, providing a smooth update experience for all users. 