#!/usr/bin/env node

/**
 * Windows Compatibility Test Script
 * 
 * This script tests the Windows compatibility features of the AEM-Starter application.
 * Run this script on a Windows machine to verify the implementation works correctly.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('=== AEM-Starter Windows Compatibility Test ===\n');

// Test 1: Shell Detection
console.log('1. Testing Shell Detection...');
const shells = [
  process.env.COMSPEC, // cmd.exe
  'powershell.exe',
  'pwsh.exe', // PowerShell Core
  'C:\\Windows\\System32\\cmd.exe',
  'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
  'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
].filter(Boolean);

console.log('Available shells:');
shells.forEach(shell => {
  const exists = fs.existsSync(shell);
  console.log(`  ${shell}: ${exists ? '✅ Found' : '❌ Not found'}`);
});

// Test 2: Environment Variables
console.log('\n2. Testing Environment Variables...');
const envVars = {
  'TERM': 'xterm-256color',
  'COLORTERM': 'truecolor',
  'CONEMUANSI': 'ON',
  'PATH': process.env.PATH,
  'USERPROFILE': process.env.USERPROFILE,
  'SystemRoot': process.env.SystemRoot,
};

console.log('Environment variables:');
Object.entries(envVars).forEach(([key, value]) => {
  console.log(`  ${key}: ${value ? '✅ Set' : '❌ Not set'}`);
});

// Test 3: PowerShell Execution
console.log('\n3. Testing PowerShell Execution...');
try {
  const psProcess = spawn('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    'Write-Host "PowerShell test successful"'
  ], {
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let output = '';
  psProcess.stdout.on('data', (data) => {
    output += data.toString();
  });

  psProcess.on('close', (code) => {
    if (code === 0) {
      console.log('  ✅ PowerShell execution successful');
      console.log(`  Output: ${output.trim()}`);
    } else {
      console.log('  ❌ PowerShell execution failed');
    }
  });
} catch (error) {
  console.log('  ❌ PowerShell execution error:', error.message);
}

// Test 4: File Tailing Simulation
console.log('\n4. Testing File Tailing Simulation...');
const testLogPath = path.join(os.tmpdir(), 'test-log.txt');

// Create a test log file
fs.writeFileSync(testLogPath, 'Test log entry 1\nTest log entry 2\n');

try {
  const tailCommand = `Get-Content -Path "${testLogPath}" -Wait -Tail 100 -ErrorAction SilentlyContinue`;
  const tailProcess = spawn('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    tailCommand
  ], {
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let tailOutput = '';
  tailProcess.stdout.on('data', (data) => {
    tailOutput += data.toString();
  });

  // Add a new line to the log file
  setTimeout(() => {
    fs.appendFileSync(testLogPath, 'Test log entry 3\n');
  }, 1000);

  // Stop the tail process after 2 seconds
  setTimeout(() => {
    tailProcess.kill();
    console.log('  ✅ File tailing simulation completed');
    console.log(`  Output: ${tailOutput.trim()}`);
    
    // Clean up test file
    try {
      fs.unlinkSync(testLogPath);
    } catch (error) {
      // Ignore cleanup errors
    }
  }, 2000);

} catch (error) {
  console.log('  ❌ File tailing simulation error:', error.message);
}

// Test 5: Java Environment
console.log('\n5. Testing Java Environment...');
const javaPaths = [
  'C:\\Program Files\\Java\\jdk-17\\bin\\java.exe',
  'C:\\Program Files\\Java\\jdk-11\\bin\\java.exe',
  'C:\\Program Files\\Java\\jdk-8\\bin\\java.exe',
  'C:\\Program Files\\Java\\jre1.8.0_291\\bin\\java.exe',
];

console.log('Java installations:');
javaPaths.forEach(javaPath => {
  const exists = fs.existsSync(javaPath);
  console.log(`  ${javaPath}: ${exists ? '✅ Found' : '❌ Not found'}`);
});

// Test 6: Git Environment
console.log('\n6. Testing Git Environment...');
const gitPaths = [
  'C:\\Program Files\\Git\\bin\\git.exe',
  'C:\\Program Files\\Git\\cmd\\git.exe',
];

console.log('Git installations:');
gitPaths.forEach(gitPath => {
  const exists = fs.existsSync(gitPath);
  console.log(`  ${gitPath}: ${exists ? '✅ Found' : '❌ Not found'}`);
});

// Test 7: Node.js Environment
console.log('\n7. Testing Node.js Environment...');
try {
  const nodeVersion = process.version;
  console.log(`  ✅ Node.js version: ${nodeVersion}`);
  
  // Test if node-pty is available
  try {
    require('node-pty');
    console.log('  ✅ node-pty module available');
  } catch (error) {
    console.log('  ❌ node-pty module not available:', error.message);
  }
} catch (error) {
  console.log('  ❌ Node.js environment error:', error.message);
}

console.log('\n=== Test Summary ===');
console.log('All tests completed. Check the output above for any issues.');
console.log('\nIf you see any ❌ marks, those features may need attention.');
console.log('If you see mostly ✅ marks, the Windows compatibility is working well.');

// Wait a bit for async operations to complete
setTimeout(() => {
  console.log('\nTest script finished.');
  process.exit(0);
}, 3000); 