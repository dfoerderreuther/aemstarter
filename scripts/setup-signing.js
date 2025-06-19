const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function setupSigning() {
  console.log('🔐 AEM-Starter Code Signing & Notarization Setup\n');

  // Check if .env exists
  const envPath = path.join(process.cwd(), '.env');
  const envExists = fs.existsSync(envPath);

  console.log('📋 STEP 1: Certificate Setup');
  console.log('══════════════════════════════════════════════════════════════════════════════');
  
  // Check current certificates
  try {
    const identities = execSync('security find-identity -v -p codesigning', { encoding: 'utf8' });
    console.log('✅ Current code signing certificates:');
    console.log(identities);
    
    const hasDevId = identities.includes('Developer ID Application');
    const hasAppleDev = identities.includes('Apple Development');
    
    if (!hasDevId) {
      console.log('\n⚠️  You need a "Developer ID Application" certificate for distribution and notarization.');
      console.log('   Your current "Apple Development" certificates are only for testing.\n');
      
      console.log('🔧 To get a Developer ID Application certificate:');
      console.log('   1. Create a Certificate Signing Request (CSR)');
      console.log('   2. Download the certificate from Apple Developer Portal');
      console.log('   3. Install it in your Keychain\n');
      
      createCSRGuide();
    } else {
      console.log('✅ You have a Developer ID Application certificate - ready for distribution!');
    }
  } catch (error) {
    console.log('❌ Error checking certificates:', error.message);
  }

  console.log('\n📋 STEP 2: Apple Developer Account Setup');
  console.log('══════════════════════════════════════════════════════════════════════════════');
  
  if (!envExists) {
    console.log('⚠️  No .env file found. Creating template...\n');
    createEnvTemplate();
  } else {
    console.log('✅ .env file exists. Checking configuration...\n');
    checkEnvConfiguration();
  }

  console.log('\n📋 STEP 3: App-Specific Password Setup');
  console.log('══════════════════════════════════════════════════════════════════════════════');
  console.log('For notarization, you need an app-specific password:');
  console.log('1. Go to https://appleid.apple.com/account/manage');
  console.log('2. Sign in with your Apple ID');
  console.log('3. Go to "App-Specific Passwords" section');
  console.log('4. Click "Generate Password"');
  console.log('5. Enter a label like "AEM-Starter-Notarization"');
  console.log('6. Copy the generated password to your .env file\n');

  console.log('📋 STEP 4: Team ID Setup');
  console.log('══════════════════════════════════════════════════════════════════════════════');
  console.log('Find your Team ID:');
  console.log('1. Go to https://developer.apple.com/account/');
  console.log('2. Sign in to your Apple Developer account');
  console.log('3. Your Team ID is shown in the top right corner');
  console.log('4. Add it to your .env file\n');

  console.log('📋 STEP 5: Testing & Distribution');
  console.log('══════════════════════════════════════════════════════════════════════════════');
  console.log('Once everything is set up:');
  console.log('• npm run build         - Build unsigned app (for development)');
  console.log('• npm run build:signed  - Build signed app (requires certificates)');
  console.log('• npm run distribute    - Full pipeline: build, sign, notarize, package');
  console.log('• npm run release       - Same as distribute (alias)\n');

  console.log('🎯 Next Steps:');
  try {
    const identities = execSync('security find-identity -v -p codesigning', { encoding: 'utf8' });
    const hasDevId = identities.includes('Developer ID Application');
    
    if (!hasDevId) {
      console.log('1. ⚠️  Create CSR and get Developer ID Application certificate (see guide above)');
    } else {
      console.log('1. ✅ Developer ID certificate ready');
    }
  } catch (error) {
    console.log('1. ⚠️  Create CSR and get Developer ID Application certificate (see guide above)');
  }
  console.log('2. 📝 Complete .env file with Apple ID credentials');
  console.log('3. 🔑 Generate app-specific password');
  console.log('4. 🆔 Add your Team ID');
  console.log('5. 🚀 Run npm run distribute to test the full pipeline\n');
}

function createCSRGuide() {
  console.log('🔧 CREATING CERTIFICATE SIGNING REQUEST (CSR)');
  console.log('══════════════════════════════════════════════════════════════════════════════');
  
  console.log('Option 1: Using Keychain Access (GUI)');
  console.log('─────────────────────────────────────────');
  console.log('1. Open "Keychain Access" application');
  console.log('2. Go to: Keychain Access → Certificate Assistant → Request a Certificate from a Certificate Authority');
  console.log('3. Fill in:');
  console.log('   • User Email Address: dominik.foerderreuther@gmail.com');
  console.log('   • Common Name: Dominik Förderreuther');
  console.log('   • CA Email Address: (leave empty)');
  console.log('   • Request is: "Saved to disk"');
  console.log('   • Let me specify key pair information: (checked)');
  console.log('4. Click Continue');
  console.log('5. Choose:');
  console.log('   • Key Size: 2048 bits');
  console.log('   • Algorithm: RSA');
  console.log('6. Save as: DeveloperID_CSR.certSigningRequest');
  console.log('7. Click Continue\n');

  console.log('Option 2: Using Command Line');
  console.log('─────────────────────────────────────');
  console.log('Run this command to generate CSR:');
  console.log('');
  console.log('openssl req -new -newkey rsa:2048 -nodes -keyout DeveloperID.key -out DeveloperID_CSR.certSigningRequest -subj "/emailAddress=dominik.foerderreuther@gmail.com/CN=Dominik Förderreuther/C=DE"');
  console.log('');

  console.log('📤 SUBMITTING CSR TO APPLE');
  console.log('══════════════════════════════════════════════════════════════════════════════');
  console.log('1. Go to https://developer.apple.com/account/resources/certificates/list');
  console.log('2. Click the "+" button to create a new certificate');
  console.log('3. Select "Developer ID Application" (under "Production")');
  console.log('4. Click "Continue"');
  console.log('5. Upload your CSR file (DeveloperID_CSR.certSigningRequest)');
  console.log('6. Click "Continue"');
  console.log('7. Download the certificate (.cer file)');
  console.log('8. Double-click the .cer file to install it in Keychain Access\n');

  console.log('✅ After installation, run this script again to verify the certificate is installed.');
}

function createEnvTemplate() {
  const template = `# Apple Developer Account Configuration for Code Signing & Notarization
# Required for npm run distribute and npm run release

# Your Apple ID (used for notarization)
APPLE_ID=dominik.foerderreuther@gmail.com

# App-specific password (generate at https://appleid.apple.com/account/manage)
# DO NOT use your regular Apple ID password!
APPLE_ID_PASSWORD=your-app-specific-password-here

# Your Apple Developer Team ID (find at https://developer.apple.com/account/)
APPLE_TEAM_ID=your-team-id-here

# Optional: Specific signing identity (auto-detected if not specified)
# SIGNING_IDENTITY=Developer ID Application: Your Name (TEAM_ID)

# Optional: GitHub token for automatic releases (generate at https://github.com/settings/tokens)
# GITHUB_TOKEN=your-github-token-here
`;

  fs.writeFileSync('.env', template);
  console.log('✅ Created .env template file');
  console.log('📝 Please edit .env and fill in your credentials\n');
}

function checkEnvConfiguration() {
  try {
    const envContent = fs.readFileSync('.env', 'utf8');
    const config = {};
    
    envContent.split('\n').forEach(line => {
      const [key, value] = line.split('=');
      if (key && value && !key.startsWith('#')) {
        config[key.trim()] = value.trim();
      }
    });

    const required = ['APPLE_ID', 'APPLE_ID_PASSWORD', 'APPLE_TEAM_ID'];
    const missing = required.filter(key => !config[key] || config[key].includes('your-') || config[key].includes('here'));

    if (missing.length === 0) {
      console.log('✅ All required environment variables are configured');
      
      // Validate Apple ID format
      if (!config.APPLE_ID.includes('@')) {
        console.log('⚠️  APPLE_ID should be an email address');
      }
      
      // Check Team ID format (should be 10 characters)
      if (config.APPLE_TEAM_ID.length !== 10) {
        console.log('⚠️  APPLE_TEAM_ID should be exactly 10 characters');
      }
      
    } else {
      console.log('⚠️  Missing or incomplete configuration:');
      missing.forEach(key => {
        console.log(`   • ${key}: ${config[key] || 'not set'}`);
      });
      console.log('\n📝 Please complete your .env file configuration');
    }

    // Check optional settings
    if (config.GITHUB_TOKEN && !config.GITHUB_TOKEN.includes('your-')) {
      console.log('✅ GitHub token configured for automatic releases');
    } else {
      console.log('ℹ️  GitHub token not configured (releases will be manual)');
    }

  } catch (error) {
    console.log('❌ Error reading .env file:', error.message);
  }
}

// Run if called directly
if (require.main === module) {
  setupSigning();
}

module.exports = setupSigning; 