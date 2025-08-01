# Enabling Auto-Updates for AEM-Starter

This document outlines the steps required to enable automatic updates for the AEM-Starter Electron application.

## Current State ✅

The application has all the necessary infrastructure in place:

- ✅ `update-electron-app` dependency installed (`^3.1.1`)
- ✅ `electron-log` dependency installed (`^5.4.1`)
- ✅ GitHub publisher configured in `forge.config.ts` with correct repository
- ✅ GitHub Actions workflow for releases (`.github/workflows/build.yml`)
- ✅ TypeScript definitions for `update-electron-app`
- ✅ Latest version: `1.0.18` (in `package.json`)
- ✅ Latest tag: `v1.0.18` (in git)
- ✅ **Auto-update code is enabled in `src/main.ts` (production only)**

## Implementation Status

### What's Ready ✅
1. **Dependencies**: All required packages are installed
2. **Build System**: Electron Forge is configured with GitHub publisher
3. **CI/CD**: GitHub Actions workflow builds and releases on tag pushes
4. **Code Signing**: macOS builds are signed and notarized
5. **Type Definitions**: TypeScript support is ready

### What's Been Completed ✅
1. **Auto-Updates Enabled**: Auto-update code is now active in `src/main.ts` (production only)
2. **Release Created**: Version 1.1.0 has been released with auto-updates
3. **Ready for Testing**: Users can now receive auto-updates

### Optional Enhancements 🔄
1. **Add Update UI**: Add update status to the user interface
2. **Monitor Updates**: Track update success rates and user feedback

## Step 1: Enable Auto-Updates in Main Process

### 1.1 Update Main Process Code

Edit `src/main.ts` and replace the commented auto-update section (lines 50-53) with:

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

### 1.2 Alternative: Always Enable (Simpler)

If you want to enable auto-updates in all environments (including development):

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

## Step 2: Verify GitHub Configuration

### 2.1 Current Configuration ✅

Your `forge.config.ts` already has the correct GitHub publisher configuration:

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

### 2.2 GitHub Actions Workflow ✅

The existing `.github/workflows/build.yml` handles:
- Building for multiple platforms (macOS, Windows, Linux)
- Code signing and notarization for macOS
- Creating GitHub releases when tags are pushed
- Uploading installers to releases

## Step 3: Testing Auto-Updates

### 3.1 Local Testing Process

1. **Enable auto-updates** (Step 1 above)

2. **Build current version**:
   ```bash
   npm run make:mac
   ```

3. **Create a test release**:
   ```bash
   # Update version in package.json
   npm version patch  # This will create v1.0.19
   
   # Push the tag to trigger GitHub Actions
   git push origin v1.0.19
   ```

4. **Test the update**:
   - Run the built app from `out/make/`
   - Check if it detects the new version
   - Verify the update process works

### 3.2 Expected Behavior

- **Update Check**: App checks GitHub releases every hour
- **Version Detection**: Compares current version (`1.0.18`) with latest release (`1.0.19`)
- **Download**: Downloads appropriate installer for user's platform
- **Install**: Automatically installs update and restarts app
- **Notifications**: System notifications for update events

## Step 4: Release Process

### 4.1 Standard Release Workflow

1. **Update version**:
   ```bash
   npm version patch  # or minor/major
   ```

2. **Push tag to trigger release**:
   ```bash
   git push origin v1.0.19
   ```

3. **GitHub Actions will automatically**:
   - Build for all platforms (macOS, Windows, Linux)
   - Create a GitHub release
   - Upload installers to the release
   - Users will receive auto-updates

### 4.2 Version Management

- **Current version**: `1.1.0` (in `package.json`)
- **Latest tag**: `v1.1.0`
- **Next version**: `1.1.1` (after `npm version patch`)
- **Version format**: Semantic versioning (`major.minor.patch`)

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

## Next Steps

### Immediate Actions Required:

1. **Enable Auto-Updates** (5 minutes):
   - Uncomment and configure the auto-update code in `src/main.ts`
   - Choose between production-only or always-enabled approach

2. **Test Implementation** (15 minutes):
   - Build current version: `npm run make:mac`
   - Create test release: `npm version patch && git push origin v1.0.19`
   - Test update process with built app

3. **Optional: Add Update UI** (30 minutes):
   - Add IPC handlers for update status
   - Create UI components to show update status
   - Add manual update check button

### Timeline:

- **Day 1**: Enable auto-updates and test with a patch release
- **Day 2**: Monitor first auto-updates and gather feedback
- **Week 1**: Add optional UI improvements based on user feedback

## Summary

After completing these steps:

1. ✅ Auto-updates will be enabled for all users
2. ✅ Updates will be delivered automatically via GitHub releases
3. ✅ Users will be notified of available updates
4. ✅ Updates will install seamlessly across all platforms
5. ✅ The release process is fully automated via GitHub Actions

The auto-update system integrates seamlessly with your existing build and release infrastructure, providing a smooth update experience for all users.

**Current Status**: ✅ Auto-updates are now active! Version 1.1.0 has been released and users will receive automatic updates. 