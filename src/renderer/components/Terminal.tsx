import React, { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

interface TerminalProps {
  onReady?: (terminal: XTerm) => void;
}

export const Terminal: React.FC<TerminalProps> = ({ onReady }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Initialize xterm.js
    const xterm = new XTerm({
      theme: {
        background: '#1a1b1e',
        foreground: '#ffffff',
      },
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      cursorBlink: true,
      rows: 24,
      cols: 80,
    });

    // Initialize fit addon
    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);

    // Store ref
    xtermRef.current = xterm;

    // Delay opening to ensure container is ready
    requestAnimationFrame(() => {
      if (!terminalRef.current) return;
      
      // Open terminal
      xterm.open(terminalRef.current);

      // Delay fit to ensure dimensions are calculated
      setTimeout(() => {
        try {
          fitAddon.fit();
          
          // Call onReady callback if provided
          if (onReady) {
            onReady(xterm);
          }

          // Handle window resize
          const handleResize = () => {
            try {
              fitAddon.fit();
            } catch (error) {
              console.warn('Failed to fit terminal:', error);
            }
          };
          window.addEventListener('resize', handleResize);

          // Store cleanup function
          return () => {
            window.removeEventListener('resize', handleResize);
            xterm.dispose();
          };
        } catch (error) {
          console.warn('Failed to initialize terminal:', error);
        }
      }, 50);
    });
  }, [onReady]);

  return (
    <div 
      ref={terminalRef} 
      style={{ 
        width: '100%', 
        height: '100%',
        backgroundColor: '#1a1b1e',
        padding: '8px',
        borderRadius: '4px',
        position: 'relative',
      }} 
    />
  );
}; 