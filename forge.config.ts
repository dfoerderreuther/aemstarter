import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import dotenv from 'dotenv';
dotenv.config();

const config: ForgeConfig = {
  packagerConfig: {
    asar: {
      unpack: "**/{node_modules/node-pty,node_modules/@serialport,node_modules/bindings}/**" // Unpack native modules from ASAR
    },
    // Icon configuration
    icon: './icons/icon', // Path without extension - Electron Forge will choose the right format
    // macOS specific configuration
    osxSign: {
      identity: 'Developer ID Application: eleon GmbH (3U35D35E29)',
      optionsForFile: () => {
        // Return entitlements for the main app
        return {
          entitlements: 'entitlements.mac.plist',
          hardenedRuntime: true,
        };
      }
    },
    // macOS notarization
    osxNotarize: {
      appleId: process.env.APPLE_ID || '',
      appleIdPassword: process.env.APPLE_ID_PASSWORD || '',
      teamId: process.env.APPLE_TEAM_ID || '',
    },
    // Increase memory limit for the app
    executableName: 'AEM-Starter',
    // Add extra resources if needed
    extraResource: [],
    // Ensure native modules are properly handled
    ignore: [
      /^\/\.vscode\//,
      /^\/\.git\//,
      /^\/node_modules\/.*\/test\//,
      /^\/node_modules\/.*\/tests\//,
    ],
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({
      // Windows-specific icon
      setupIcon: './icons/icon.ico',
      // loadingGif: './icons/icon.gif', // Optional: custom loading animation
    }),
    // DMG is the standard macOS distribution format - provides drag & drop to Applications
    new MakerDMG({
      //background: './icons/icon.png',
      icon: './icons/icon.icns'
    }, ['darwin']),
    new MakerZIP({}, ['darwin']),
    new MakerRpm({
      options: {
        icon: './icons/icon.png'
      }
    }),
    new MakerDeb({
      options: {
        icon: './icons/icon.png'
      }
    })
  ],
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
  ],
  plugins: [
    // Add AutoUnpackNativesPlugin to handle native modules like node-pty
    new AutoUnpackNativesPlugin({}),
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: 'src/main.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: true,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: false,
      [FuseV1Options.OnlyLoadAppFromAsar]: false,
    }),
  ],
};

export default config;
