#!/usr/bin/env node

/**
 * Apply patches to node_modules dependencies
 * This script runs after npm install to fix issues with third-party packages
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Applying patches to node_modules...');

// Paths for node-pty files
const winptyPath = path.join(__dirname, '..', 'node_modules', 'node-pty', 'src', 'win', 'winpty.cc');
const conptyPath = path.join(__dirname, '..', 'node_modules', 'node-pty', 'src', 'win', 'conpty.cc');

// Check if node-pty is installed
if (!fs.existsSync(winptyPath) && !fs.existsSync(conptyPath)) {
  console.log('⚠️  node-pty not found (may not be installed)');
  process.exit(0);
}

// Fix conpty.cc for Node.js 22 compatibility
if (fs.existsSync(conptyPath)) {
  let conptyContent = fs.readFileSync(conptyPath, 'utf8');
  
  // Check if already patched
  if (conptyContent.includes('#ifndef PFNCREATEPSEUDOCONSOLE')) {
    console.log('✅ node-pty conpty.cc patch already applied');
  } else {
    console.log('🔧 Applying node-pty conpty.cc fix for Node.js 22...');
    
    // Fix 1: Update _WIN32_WINNT from 0x600 (Vista) to 0x0A00 (Windows 10) for ConPTY support
    conptyContent = conptyContent.replace(
      /#define _WIN32_WINNT 0x600/,
      '#define _WIN32_WINNT 0x0A00'
    );
    
    // Fix 2: Ensure typedefs are always defined (not just when PROC_THREAD_ATTRIBUTE_PSEUDOCONSOLE is undefined)
    // Replace the #ifndef block with individual checks
    const oldBlock = /\/\/ Taken from the RS5 Windows SDK, but redefined here in case we're targeting <= 17134\n#ifndef PROC_THREAD_ATTRIBUTE_PSEUDOCONSOLE\n#define PROC_THREAD_ATTRIBUTE_PSEUDOCONSOLE \\\n  ProcThreadAttributeValue\(22, FALSE, TRUE, FALSE\)\n\ntypedef VOID\* HPCON;\ntypedef HRESULT \(__stdcall \*PFNCREATEPSEUDOCONSOLE\)\(COORD c, HANDLE hIn, HANDLE hOut, DWORD dwFlags, HPCON\* phpcon\);\ntypedef HRESULT \(__stdcall \*PFNRESIZEPSEUDOCONSOLE\)\(HPCON hpc, COORD newSize\);\ntypedef HRESULT \(__stdcall \*PFNCLEARPSEUDOCONSOLE\)\(HPCON hpc\);\ntypedef void \(__stdcall \*PFNCLOSEPSEUDOCONSOLE\)\(HPCON hpc\);\ntypedef void \(__stdcall \*PFNRELEASEPSEUDOCONSOLE\)\(HPCON hpc\);\n\n#endif/;
    
    const newBlock = `// Taken from the RS5 Windows SDK, but redefined here in case we're targeting <= 17134
#ifndef PROC_THREAD_ATTRIBUTE_PSEUDOCONSOLE
#define PROC_THREAD_ATTRIBUTE_PSEUDOCONSOLE \\
  ProcThreadAttributeValue(22, FALSE, TRUE, FALSE)
#endif

// Always define these types if not already defined by the SDK
#ifndef HPCON
typedef VOID* HPCON;
#endif

#ifndef PFNCREATEPSEUDOCONSOLE
typedef HRESULT (__stdcall *PFNCREATEPSEUDOCONSOLE)(COORD c, HANDLE hIn, HANDLE hOut, DWORD dwFlags, HPCON* phpcon);
#endif

#ifndef PFNRESIZEPSEUDOCONSOLE
typedef HRESULT (__stdcall *PFNRESIZEPSEUDOCONSOLE)(HPCON hpc, COORD newSize);
#endif

#ifndef PFNCLEARPSEUDOCONSOLE
typedef HRESULT (__stdcall *PFNCLEARPSEUDOCONSOLE)(HPCON hpc);
#endif

#ifndef PFNCLOSEPSEUDOCONSOLE
typedef void (__stdcall *PFNCLOSEPSEUDOCONSOLE)(HPCON hpc);
#endif

#ifndef PFNRELEASEPSEUDOCONSOLE
typedef void (__stdcall *PFNRELEASEPSEUDOCONSOLE)(HPCON hpc);
#endif`;
    
    conptyContent = conptyContent.replace(oldBlock, newBlock);
    
    fs.writeFileSync(conptyPath, conptyContent, 'utf8');
    console.log('✅ Successfully applied node-pty conpty.cc fix');
    console.log('📁 Modified:', path.relative(process.cwd(), conptyPath));
  }
}

// Fix winpty.cc for C2362 errors (if it exists - older versions)
if (fs.existsSync(winptyPath)) {
  const originalContent = fs.readFileSync(winptyPath, 'utf8');

  // Check if the patch has already been applied (look for our comment)
  if (originalContent.includes('// Declare all variables at the beginning to avoid C2362 errors with goto cleanup')) {
    console.log('✅ node-pty winpty.cc patch already applied');
  } else {
    console.log('🔧 Applying node-pty winpty.cc C2362 fix...');

    let patchedContent = originalContent;

    // Find the PtyStartProcess function and add variable declarations at the beginning
    const functionStart = 'static NAN_METHOD(PtyStartProcess) {';
    const functionStartIndex = patchedContent.indexOf(functionStart);

    if (functionStartIndex === -1) {
      console.log('⚠️  Could not find PtyStartProcess function in winpty.cc (may be using newer version)');
    } else {
      // Find the parameter validation block end
      const paramCheckEnd = '  }\n\n  std::stringstream why;';
      const paramCheckIndex = patchedContent.indexOf(paramCheckEnd, functionStartIndex);

      if (paramCheckIndex === -1) {
        console.log('⚠️  Could not find parameter validation end in PtyStartProcess');
      } else {
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

        console.log('✅ Successfully applied node-pty winpty.cc C2362 fix');
        console.log('📁 Modified:', path.relative(process.cwd(), winptyPath));
      }
    }
  }
}
