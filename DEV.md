# Development instructions


## github actions

### release: 

1. Regular commits → Only builds (no release)
2. Create tag (git tag v1.0.5 && git push --tags) → Builds + Creates Release
3. Pull requests → Only builds (no release)



## Build

### Dev:

    npm start

### Lint:

    npm run lint


### Prod:

    npm run clean
    npm run make:verbose

### Make and Publish to GitHub: 

    npm run clean
    npm run publish

Then go to https://github.com/dfoerderreuther/aemstarter/releases and download / test / delete / approve.

### Install: 

    open out/make/AEM-Starter-1.0.0-arm64.dmg

## Uninstall

    rm -rf /Applications/AEM-Starter.app

## Clean local app data to cause a fresh start

    rm -Rf ~/Library/Application\ Support/AEM-Starter/
    rm -Rf ~/Library/Application\ Support/AEM\ Starter/


# Icons

### For macOS (.icns file):
Run this command to create the macOS icon:

    mkdir icon.iconset
    cp icons/icon-1024.png icon.iconset/icon_512x512@2x.png
    cp icons/icon-512.png icon.iconset/icon_512x512.png
    cp icons/icon-512.png icon.iconset/icon_256x256@2x.png
    cp icons/icon-256.png icon.iconset/icon_256x256.png
    cp icons/icon-256.png icon.iconset/icon_128x128@2x.png
    cp icons/icon-256.png icon.iconset/icon_128x128.png
    cp icons/icon-256.png icon.iconset/icon_64x64@2x.png
    cp icons/icon-64.png icon.iconset/icon_64x64.png
    cp icons/icon-64.png icon.iconset/icon_32x32@2x.png
    cp icons/icon-32.png icon.iconset/icon_32x32.png
    cp icons/icon-32.png icon.iconset/icon_16x16@2x.png
    cp icons/icon-16.png icon.iconset/icon_16x16.png
    iconutil -c icns icon.iconset -o icons/icon.icns
    rm -rf icon.iconset

### For Windows (.ico file):
You can use online converters or ImageMagick:

    convert icons/icon-256.png icons/icon-48.png icons/icon-32.png icons/icon-16.png icons/icon.ico

    magick icons/icon-256.png icons/icon.ico

