# Development instructions

## Build

Dev:

    npm start

Lint:

    npm run lint


Prod:

    npm run clean
    npm run make:verbose

Make and Publish to GitHub: 

    npm run publish

Install: 

    open out/make/AEM-Starter-1.0.0-arm64.dmg


## Uninstall

    sudo rm -rf /Applications/AEM-Starter.app


## Clean local app data to cause a fresh start

    rm -Rf ~/Library/Application\ Support/AEM-Starter/