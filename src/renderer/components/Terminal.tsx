import React, { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

interface TerminalProps {
  onReady?: (terminal: XTerm) => void;
}

export const Terminal: React.FC<TerminalProps> = ({ onReady }) => {
  const terminalRef = useRef<HTMLDivElement>(null);

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

    window.addEventListener('resize', handleResize);

    // Call onReady
    if (onReady) {
      onReady(xterm);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      xterm.dispose();
    };
  }, [onReady]);

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