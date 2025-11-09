#!/usr/bin/env node

/**
 * Apply patches to node_modules dependencies
 * This script runs after npm install to fix issues with third-party packages
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Applying patches to node_modules...');

// Check if patch file exists
const patchPath = path.join(__dirname, '..', 'patches', 'node-pty+1.0.0.patch');
const winptyPath = path.join(__dirname, '..', 'node_modules', 'node-pty', 'src', 'win', 'winpty.cc');

if (!fs.existsSync(patchPath)) {
  console.log('⚠️  Patch file not found:', patchPath);
  process.exit(0);
}

if (!fs.existsSync(winptyPath)) {
  console.log('⚠️  winpty.cc not found (node-pty may not be installed):', winptyPath);
  process.exit(0);
}

// Read the current winpty.cc content
const originalContent = fs.readFileSync(winptyPath, 'utf8');

// Check if the patch has already been applied (look for our comment)
if (originalContent.includes('// Declare all variables at the beginning to avoid C2362 errors with goto cleanup')) {
  console.log('✅ node-pty patch already applied');
  process.exit(0);
}

// Apply the patch manually by replacing the content
// This is a simplified patch application - in production you'd use a proper patch tool

console.log('🔧 Applying node-pty C2362 fix...');

let patchedContent = originalContent;

// Find the PtyStartProcess function and add variable declarations at the beginning
const functionStart = 'static NAN_METHOD(PtyStartProcess) {';
const functionStartIndex = patchedContent.indexOf(functionStart);

if (functionStartIndex === -1) {
  console.error('❌ Could not find PtyStartProcess function in winpty.cc');
  process.exit(1);
}

// Find the parameter validation block end
const paramCheckEnd = '  }\n\n  std::stringstream why;';
const paramCheckIndex = patchedContent.indexOf(paramCheckEnd, functionStartIndex);

if (paramCheckIndex === -1) {
  console.error('❌ Could not find parameter validation end in PtyStartProcess');
  process.exit(1);
}

// Insert variable declarations after parameter validation
const insertPoint = paramCheckIndex + paramCheckEnd.length;
const variableDeclarations = `  // Declare all variables at the beginning to avoid C2362 errors with goto cleanup
  int cols = 0;
  int rows = 0;
  bool debug = false;
  winpty_error_ptr_t error_ptr = nullptr;
  winpty_config_t* winpty_config = nullptr;
  winpty_t* pc = nullptr;
  winpty_spawn_config_t* config = nullptr;
  HANDLE handle = nullptr;
  BOOL spawnSuccess = FALSE;
  v8::Local<v8::Object> marshal;

`;

patchedContent = patchedContent.slice(0, insertPoint) + variableDeclarations + patchedContent.slice(insertPoint);

// Remove the duplicate variable declarations
patchedContent = patchedContent.replace(
  /  int cols = info\[4\]->Int32Value\(Nan::GetCurrentContext\(\)\)\.FromJust\(\);\s*int rows = info\[5\]->Int32Value\(Nan::GetCurrentContext\(\)\)\.FromJust\(\);\s*bool debug = Nan::To<bool>\(info\[6\]\)\.FromJust\(\);/,
  '  cols = info[4]->Int32Value(Nan::GetCurrentContext()).FromJust();\n  rows = info[5]->Int32Value(Nan::GetCurrentContext()).FromJust();\n  debug = Nan::To<bool>(info[6]).FromJust();'
);

patchedContent = patchedContent.replace(
  /  winpty_error_ptr_t error_ptr = nullptr;\s*winpty_config_t\* winpty_config = winpty_config_new\(0, &error_ptr\);/,
  '  winpty_config = winpty_config_new(0, &error_ptr);'
);

patchedContent = patchedContent.replace(
  /  winpty_t \*pc = winpty_open\(winpty_config, &error_ptr\);/,
  '  pc = winpty_open(winpty_config, &error_ptr);'
);

patchedContent = patchedContent.replace(
  /  winpty_spawn_config_t\* config = winpty_spawn_config_new\(WINPTY_SPAWN_FLAG_AUTO_SHUTDOWN, shellpath\.c_str\(\), cmdline, cwd, env\.c_str\(\), &error_ptr\);/,
  '  config = winpty_spawn_config_new(WINPTY_SPAWN_FLAG_AUTO_SHUTDOWN, shellpath.c_str(), cmdline, cwd, env.c_str(), &error_ptr);'
);

patchedContent = patchedContent.replace(
  /  HANDLE handle = nullptr;\s*BOOL spawnSuccess = winpty_spawn\(pc, config, &handle, nullptr, nullptr, &error_ptr\);/,
  '  spawnSuccess = winpty_spawn(pc, config, &handle, nullptr, nullptr, &error_ptr);'
);

patchedContent = patchedContent.replace(
  /  v8::Local<v8::Object> marshal = Nan::New<v8::Object>\(\);/,
  '  marshal = Nan::New<v8::Object>();'
);

// Write the patched content back
fs.writeFileSync(winptyPath, patchedContent, 'utf8');

console.log('✅ Successfully applied node-pty C2362 fix');
console.log('📁 Modified:', path.relative(process.cwd(), winptyPath));
