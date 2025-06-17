import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

interface TerminalProps {
  onReady?: (terminal: XTerm) => void;
  visible?: boolean;
  fontSize?: number;
  cwd?: string;
}

export interface TerminalRef {
  resize: () => void;
  clear: () => void;
  focus: () => void;
  getTerminalId: () => string | null;
  writeToShell: (data: string) => void;
}

export const Terminal = forwardRef<TerminalRef, TerminalProps>(({ onReady, visible = true, fontSize = 13, cwd }, ref) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const [terminalId, setTerminalId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const cleanupFuncsRef = useRef<(() => void)[]>([]);

  // Expose methods to parent
  useImperativeHandle(ref, () => ({
    resize: () => {
      if (fitAddonRef.current && xtermRef.current) {
        try {
          fitAddonRef.current.fit();
        } catch (error) {
          console.warn('Failed to fit terminal:', error);
        }
      }
    },
    clear: () => {
      if (xtermRef.current) {
        xtermRef.current.clear();
      }
    },
    focus: () => {
      if (xtermRef.current) {
        xtermRef.current.focus();
      }
    },
    getTerminalId: () => terminalId,
    writeToShell: (data: string) => {
      if (terminalId) {
        window.electronAPI.writeTerminal(terminalId, data);
      }
    }
  }), [terminalId]);

  // Handle font size changes
  useEffect(() => {
    if (xtermRef.current && fontSize) {
      xtermRef.current.options.fontSize = fontSize;
      try {
        if (fitAddonRef.current) {
          fitAddonRef.current.fit();
        }
      } catch (error) {
        console.warn('Failed to fit terminal:', error);
      }
    }
  }, [fontSize]);

  // Create terminal and connect to backend
  useEffect(() => {
    if (!terminalRef.current) return;

    // Only create terminal if it doesn't exist
    if (xtermRef.current) {
      return;
    }

    // Create xterm.js instance
    const xterm = new XTerm({
      convertEol: true,
      fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
      fontSize: fontSize,
      allowTransparency: true,
      cursorBlink: true,
      theme: {
        background: '#1a1a1a',
        foreground: '#ffffff',
        cursor: '#ffffff',
        selectionBackground: 'rgba(255, 255, 255, 0.3)'
      }
    });

    xtermRef.current = xterm;

    // Initialize fit addon
    const fitAddon = new FitAddon();
    fitAddonRef.current = fitAddon;
    xterm.loadAddon(fitAddon);

    // Open terminal
    xterm.open(terminalRef.current);
    
    // Add padding to terminal screen
    const xtermScreen = terminalRef.current.querySelector('.xterm-screen');
    if (xtermScreen) {
      (xtermScreen as HTMLElement).style.padding = '8px';
    }
    
    // Fit terminal to container
    try {
      fitAddon.fit();
    } catch (error) {
      console.warn('Failed to fit terminal on initialization:', error);
    }

    // Create backend terminal session
    const initializeTerminal = async () => {
      try {
        console.log('Initializing terminal with cwd:', cwd);
        const result = await window.electronAPI.createTerminal({ cwd });

        
        if (result.success) {
          setTerminalId(result.terminalId);
          setIsConnected(true);
          
          // Set up data handler
          const cleanupData = window.electronAPI.onTerminalData((id, data) => {
            if (id === result.terminalId && xtermRef.current) {
              xtermRef.current.write(data);
            }
          });
          
          // Set up exit handler
          const cleanupExit = window.electronAPI.onTerminalExit((id, code, signal) => {
            if (id === result.terminalId && xtermRef.current) {
              console.log(`Terminal ${id} exited with code ${code}, signal ${signal}`);
              xtermRef.current.writeln(`\r\n\x1b[31mProcess exited with code ${code}\x1b[0m`);
              setIsConnected(false);
            }
          });
          
          // Set up error handler
          const cleanupError = window.electronAPI.onTerminalError((id, error) => {
            if (id === result.terminalId && xtermRef.current) {
              console.log(`Terminal ${id} error:`, error);
              xtermRef.current.writeln(`\r\n\x1b[31mTerminal error: ${error}\x1b[0m`);
            }
          });
          
          cleanupFuncsRef.current = [cleanupData, cleanupExit, cleanupError];
          
          // Handle user input
          xterm.onData((data) => {
            if (result.terminalId) {
              window.electronAPI.writeTerminal(result.terminalId, data);
            }
          });
          
          // Handle terminal resize
          xterm.onResize(({ cols, rows }) => {
            if (result.terminalId) {
              window.electronAPI.resizeTerminal(result.terminalId, cols, rows);
            }
          });
          
          // Call onReady callback
          if (onReady) {
            onReady(xterm);
          }
        } else {
          console.error('Failed to create terminal session');
        }
      } catch (error) {
        console.error('Failed to initialize terminal:', error);
        if (xtermRef.current) {
          xtermRef.current.writeln('\x1b[31mFailed to connect to terminal backend\x1b[0m');
        }
      }
    };

    initializeTerminal();

    // Resize handler
    const handleResize = () => {
      try {
        if (fitAddonRef.current) {
          fitAddonRef.current.fit();
        }
      } catch (error) {
        console.warn('Failed to fit terminal:', error);
      }
    };

    window.addEventListener('resize', handleResize);
    document.addEventListener('visibilitychange', handleResize);

    // Cleanup function
    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleResize);
      
      // Clean up event listeners
      cleanupFuncsRef.current.forEach(cleanup => cleanup());
      cleanupFuncsRef.current = [];
      
      // Kill terminal session
      if (terminalId) {
        window.electronAPI.killTerminal(terminalId);
      }
      
      // Dispose xterm
      if (xtermRef.current) {
        xtermRef.current.dispose();
        xtermRef.current = null;
      }
      
      setTerminalId(null);
      setIsConnected(false);
    };
  }, [cwd]); // Re-create when cwd changes

  // Handle tab visibility changes
  useEffect(() => {
    if (visible && fitAddonRef.current) {
      try {
        fitAddonRef.current.fit();
      } catch (error) {
        console.warn('Failed to fit terminal on tab visibility change:', error);
      }
    }
  }, [visible]);

  return (
    <div 
      ref={terminalRef} 
      style={{ 
        width: '100%', 
        height: '100%',
        position: 'relative'
      }}
    >
      {!isConnected && terminalId && (
        <div style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          background: 'rgba(255, 0, 0, 0.1)',
          color: '#ff6b6b',
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '11px',
          zIndex: 1000
        }}>
          Disconnected
        </div>
      )}
    </div>
  );
}); 