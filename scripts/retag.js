#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Read package.json to get current version
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
const version = packageJson.version;

console.log('🔄 Re-tagging version:', version);
console.log('');

try {
  // Step 1: Delete local tag (ignore errors if it doesn't exist)
  console.log('1️⃣ Deleting local tag...');
  try {
    execSync(`git tag -d ${version}`, { stdio: 'inherit' });
    console.log('   ✅ Local tag deleted');
  } catch (error) {
    console.log('   ℹ️  Local tag not found (this is OK)');
  }

  // Step 2: Delete remote tag (ignore errors if it doesn't exist)
  console.log('2️⃣ Deleting remote tag...');
  try {
    execSync(`git push origin :refs/tags/${version}`, { stdio: 'inherit' });
    console.log('   ✅ Remote tag deleted');
  } catch (error) {
    console.log('   ℹ️  Remote tag not found (this is OK)');
  }

  // Step 3: Create new local tag
  console.log('3️⃣ Creating new local tag...');
  execSync(`git tag ${version}`, { stdio: 'inherit' });
  console.log('   ✅ New local tag created');

  // Step 4: Push new remote tag
  console.log('4️⃣ Pushing new remote tag...');
  execSync(`git push origin ${version}`, { stdio: 'inherit' });
  console.log('   ✅ New remote tag pushed');

  console.log('');
  console.log('✅ Successfully re-tagged version', version);
  console.log('');
  console.log('📝 Next steps:');
  console.log('   1. Go to GitHub releases page');
  console.log('   2. Delete the existing release draft for version', version);
  console.log('   3. Create a new release draft with the same tag');
  console.log('   4. Publish the release when ready');
  console.log('');
  console.log('🔗 GitHub releases: https://github.com/dfoerderreuther/aemstarter/releases');

} catch (error) {
  console.error('❌ Error during re-tagging:', error.message);
  process.exit(1);
} 