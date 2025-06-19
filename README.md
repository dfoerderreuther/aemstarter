# AEM-Starter

![AEM-Starter Application](doc/screenshots/aem-starter-main.png)

AEM-Starter is a comprehensive desktop application designed to streamline the setup and management of local AEM-SDK environments. It provides developers with an intuitive interface to handle all aspects of AEM development workflows.

## Features

- **Setup of local AEM-SDK environments** with Author, Publisher and Dispatcher
- **Automated start, debug and stop** of AEM instances
- **Log tailing** for real-time monitoring and debugging
- **Automated replication setup** between Author, Publisher and Dispatcher
- **Package installation** (WKND, ACS-AEM-Commons, custom packages)
- **Backup and restore** functionality for environment management
- **Connection to AEM development project** for quick access to configurations, code and build tasks

## Requirements

- This app currently only runs on Apple Silicon Macs. Please reach out if you want to help with supporting other environments!
- Access to https://experience.adobe.com and download permission for AEM-SDK 

## Installation

### Prerequisites
- Node.js (version 18 or higher)
- npm or yarn package manager
- Apple Silicon Mac (currently required)

### Quick Build and run
1. **Build local app**
   ```bash
   git clone git@github.com:dfoerderreuther/aemstarter.git
   cd aemstarter
   
   ./build.sh
   ```

2. **Run local app**
   ```bash
   ./run.sh
   ```
   The helper script simply launches the locally-built `.app` bundle.

### Development Setup
For live-reload development you can still run:
```bash
npm run dev
```

### Troubleshooting
macOS may still warn that the application is from an “unidentified developer”.
If that happens:
1. Locate `AEM-Starter.app` inside the `out/…` folder in Finder.
2. Right-click ➜ Open ➜ Open to launch it the first time.

After the first successful launch macOS will remember the choice.

