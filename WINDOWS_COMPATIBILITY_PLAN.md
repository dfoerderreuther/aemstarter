# Windows Terminal Compatibility Plan

## Overview

This document outlines the implementation plan to make the AEM-Starter application fully Windows-compliant while maintaining Mac compatibility. The focus is on ensuring that terminal operations work seamlessly on both platforms.

## Key Requirements

1. **AEM Process Spawning**: AEM processes must not start as separate GUI windows on Windows
2. **Terminal Environment**: Proper terminal environment for both interactive and log output terminals
3. **Cross-Platform Compatibility**: Maintain existing Mac functionality while adding Windows support
4. **Performance**: Optimized log tailing and process management

## Implementation Summary

### Phase 1: Enhanced TerminalService ✅

**File**: `src/main/services/TerminalService.ts`

**Improvements**:
- Enhanced shell detection for Windows (PowerShell, PowerShell Core, cmd.exe)
- Platform-specific environment setup with proper PATH configuration
- Windows-specific PTY options (flow control, console environment)
- Better error handling and fallback mechanisms

**Key Features**:
- Automatic detection of available shells on Windows
- Enhanced PATH configuration for Windows development tools
- Proper terminal emulation settings for Windows console
- Flow control support for better performance

### Phase 2: New AemProcessManager ✅

**File**: `src/main/services/AemProcessManager.ts`

**Purpose**: Dedicated service for managing AEM processes with proper terminal environment

**Key Features**:
- **Windows**: Uses `node-pty` to spawn AEM processes in proper terminal environment
- **Unix/Mac**: Uses traditional `child_process.spawn` (maintains existing behavior)
- Platform-specific environment configuration
- Proper process lifecycle management
- Integrated logging and status updates

**Benefits**:
- Prevents AEM processes from starting as GUI windows on Windows
- Maintains existing Mac functionality
- Better process isolation and management
- Integrated with existing IPC system

### Phase 3: Enhanced Log Tailing ✅

**File**: `src/main/services/AemInstanceManager.ts`

**Improvements**:
- Enhanced PowerShell tailing for Windows with better error handling
- Hidden PowerShell windows (`windowsHide: true`)
- Non-interactive PowerShell execution
- Better performance and reliability

**Key Features**:
- Silent PowerShell execution (no visible windows)
- Error handling with `-ErrorAction SilentlyContinue`
- Non-interactive mode for better performance
- Maintains existing Unix tailing functionality

### Phase 4: Integration and IPC ✅

**Files**: `src/main.ts`, `src/preload.ts`

**Improvements**:
- Added AemProcessManager to main process
- New IPC handlers for AEM process management
- Exposed new functions to renderer process
- Proper initialization and cleanup

## Technical Details

### Windows Terminal Environment

The application now properly configures the Windows terminal environment:

```typescript
// Windows-specific environment setup
{
  TERM: 'xterm-256color',
  COLORTERM: 'truecolor',
  CONEMUANSI: 'ON',
  PATH: enhancedWindowsPath,
  JAVA_OPTS: jvmOpts
}
```

### Shell Detection

Enhanced shell detection for Windows:

1. `process.env.COMSPEC` (cmd.exe)
2. `powershell.exe` (PowerShell)
3. `pwsh.exe` (PowerShell Core)
4. Fallback to `cmd.exe`

### AEM Process Spawning

**Windows**: Uses `node-pty.spawn()` with proper terminal configuration
**Unix/Mac**: Uses `child_process.spawn()` (existing behavior)

### Log Tailing

**Windows**: PowerShell with `Get-Content -Wait -Tail 100`
**Unix/Mac**: Traditional `tail -f -n 100`

## Benefits

### For Windows Users
- AEM processes run in proper terminal environment
- No separate GUI windows for AEM processes
- Better integration with Windows console
- Improved performance for log tailing
- Proper shell detection and fallbacks

### For Mac Users
- All existing functionality preserved
- No breaking changes
- Maintained performance and reliability
- Enhanced error handling

### Cross-Platform
- Consistent API across platforms
- Unified process management
- Better error handling and recovery
- Improved debugging capabilities

## Testing Strategy

### Windows Testing
1. **Shell Detection**: Verify all shell types are detected correctly
2. **AEM Process Spawning**: Ensure no GUI windows appear
3. **Log Tailing**: Verify PowerShell tailing works correctly
4. **Environment**: Check PATH and environment variables
5. **Performance**: Test with large log files

### Mac Testing
1. **Regression Testing**: Ensure no functionality is broken
2. **Performance**: Verify performance is maintained
3. **Shell Detection**: Test shell detection still works
4. **AEM Processes**: Verify existing behavior is preserved

### Cross-Platform Testing
1. **API Consistency**: Verify APIs work the same on both platforms
2. **Error Handling**: Test error scenarios on both platforms
3. **Process Management**: Verify process lifecycle management
4. **Logging**: Test log output consistency

## Future Enhancements

### Potential Improvements
1. **WSL Integration**: Better Windows Subsystem for Linux support
2. **ConPTY Optimization**: Further Windows console optimizations
3. **Process Monitoring**: Enhanced process health monitoring
4. **Performance Tuning**: Platform-specific performance optimizations

### Monitoring and Metrics
1. **Process Startup Time**: Measure and optimize startup times
2. **Memory Usage**: Monitor memory usage across platforms
3. **Error Rates**: Track and reduce error rates
4. **User Experience**: Gather feedback on terminal experience

## Conclusion

The Windows compatibility implementation provides:

1. **Seamless Windows Experience**: AEM processes run properly in terminal environment
2. **Mac Compatibility**: All existing functionality preserved
3. **Performance**: Optimized for both platforms
4. **Reliability**: Better error handling and recovery
5. **Maintainability**: Clean, modular code structure

The implementation follows best practices for cross-platform Electron development and leverages the power of `node-pty` for Windows while maintaining the proven approach for Unix-like systems.

## References

- [node-pty Documentation](https://github.com/microsoft/node-pty)
- [Windows ConPTY Documentation](https://devblogs.microsoft.com/commandline/windows-command-line-introducing-the-windows-pseudo-console-conpty/)
- [Electron Cross-Platform Development](https://www.electronjs.org/docs/latest/tutorial/process-model) 