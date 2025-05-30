# App Icon Setup Guide

## Export Requirements from Adobe Illustrator

To set up your app icon, you need to export the following formats from Adobe Illustrator:

### 1. Export High-Resolution PNG Files

From Adobe Illustrator, export these PNG files at the specified resolutions:

- **icon-1024.png** (1024x1024) - Master file for macOS
- **icon-512.png** (512x512) - Linux and web
- **icon-256.png** (256x256) - Windows and Linux
- **icon-48.png** (48x48) - Windows small icons
- **icon-32.png** (32x32) - Windows taskbar
- **icon-16.png** (16x16) - Windows system tray

### 2. Adobe Illustrator Export Steps

1. **File → Export → Export As**
2. Choose **PNG** format
3. Set the artboard size to match the required dimensions
4. Use **High** quality settings
5. Ensure **Transparent Background** is enabled
6. Save each size in the `icons/` folder

## 3. Convert to Platform-Specific Formats

### For macOS (.icns file):
Run this command to create the macOS icon:
```bash
# Install iconutil (usually available on macOS by default)
mkdir icon.iconset
cp icons/icon-1024.png icon.iconset/icon_512x512@2x.png
cp icons/icon-512.png icon.iconset/icon_512x512.png
cp icons/icon-512.png icon.iconset/icon_256x256@2x.png
cp icons/icon-256.png icon.iconset/icon_256x256.png
cp icons/icon-256.png icon.iconset/icon_128x128@2x.png
cp icons/icon-256.png icon.iconset/icon_128x128.png
cp icons/icon-64.png icon.iconset/icon_64x64.png
cp icons/icon-32.png icon.iconset/icon_32x32@2x.png
cp icons/icon-32.png icon.iconset/icon_32x32.png
cp icons/icon-16.png icon.iconset/icon_16x16@2x.png
cp icons/icon-16.png icon.iconset/icon_16x16.png
iconutil -c icns icon.iconset -o icons/icon.icns
rm -rf icon.iconset
```

### For Windows (.ico file):
You can use online converters or ImageMagick:
```bash
# If you have ImageMagick installed
convert icons/icon-256.png icons/icon-48.png icons/icon-32.png icons/icon-16.png icons/icon.ico
```

Or use an online converter like:
- https://convertio.co/png-ico/
- https://icoconvert.com/

## 4. File Structure

After completing the exports and conversions, your `icons/` folder should contain:

```
icons/
├── icon.icns          # macOS icon (generated)
├── icon.ico           # Windows icon (generated) 
├── icon.png           # General PNG (copy of icon-512.png)
├── icon-1024.png      # Master resolution
├── icon-512.png       # High resolution
├── icon-256.png       # Medium resolution
├── icon-48.png        # Small resolution
├── icon-32.png        # Taskbar size
└── icon-16.png        # System tray size
```

## 5. Test Your Icons

After setting up the icons:

1. **Development**: `npm run dev` - The icon should appear in the dock/taskbar
2. **Package**: `npm run package` - Test the packaged app
3. **Make**: `npm run make` - Create distributables with proper icons

## 6. Platform-Specific Notes

- **macOS**: The .icns file will be automatically used
- **Windows**: The .ico file is used for the executable and installer
- **Linux**: PNG files are used for various desktop environments

## Current Configuration

The app is configured in `forge.config.ts` to use:
- `./icons/icon` as the base path (Electron Forge auto-detects extensions)
- Platform-specific icon settings for each maker

## Troubleshooting

- Ensure all PNG files have transparent backgrounds
- Check that file permissions allow reading the icon files
- Verify icon dimensions are exactly as specified
- Clear the build cache: `rm -rf .vite out/` if icons don't update 