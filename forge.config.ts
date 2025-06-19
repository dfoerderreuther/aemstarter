import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    // Icon configuration
    icon: './icons/icon', // Path without extension - Electron Forge will choose the right format
    // macOS specific configuration
    // osxSign: {
    //   identity: 'Apple Development: dominik.foerderreuther@gmail.com (3ZHD6SW8R2)',
    //   optionsForFile: () => {
    //     // Return entitlements for the main app
    //     return {
    //       entitlements: 'entitlements.mac.plist',
    //       hardenedRuntime: true,
    //       // timestamp: undefined, // Disable timestamping to avoid network timeouts
    //     };
    //   }
    // },
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
