# Development instructions

## Build

Dev:

    npm start

Lint:

    npm run lint



Prod:

    npm run clean
    npm run make:verbose

Insall: 

    open out/make/AEM-Starter-1.0.0-arm64.pkg 


## Uninstall

    sudo rm -rf /Applications/AEM-Starter.app
    sudo rm -f /usr/local/bin/aem-starter

## Clean local app data to cause a fresh start

    rm -Rf ~/Library/Application\ Support/AEM-Starter/