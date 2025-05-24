import React, { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

interface TerminalProps {
  onReady?: (terminal: XTerm) => void;
  visible?: boolean;
}

export const Terminal: React.FC<TerminalProps> = ({ onReady, visible = true }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Minimal xterm.js configuration
    const xterm = new XTerm({
      convertEol: true,
      fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
      fontSize: 13,
      theme: {
        background: '#1a1a1a',
        foreground: '#ffffff',
      }
    });

    // Initialize fit addon
    const fitAddon = new FitAddon();
    fitAddonRef.current = fitAddon;
    xterm.loadAddon(fitAddon);

    // Open terminal
    xterm.open(terminalRef.current);
    
    // Fit terminal to container
    fitAddon.fit();

    // Simple resize handler
    const handleResize = () => {
      try {
        fitAddon.fit();
      } catch (error) {
        console.warn('Failed to fit terminal:', error);
      }
    };

    // Handle visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleResize();
      }
    };

    window.addEventListener('resize', handleResize);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Call onReady
    if (onReady) {
      onReady(xterm);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      xterm.dispose();
    };
  }, [onReady]);

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
      }}
    />
  );
}; 