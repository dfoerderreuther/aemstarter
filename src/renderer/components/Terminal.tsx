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
  const fitAddonRef = useRef<FitAddon | null>(null);

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
    });

    // Initialize fit addon
    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    fitAddonRef.current = fitAddon;

    // Store ref
    xtermRef.current = xterm;

    // Open terminal
    xterm.open(terminalRef.current);

    // Initial fit
    try {
      fitAddon.fit();
    } catch (error) {
      console.warn('Failed to fit terminal:', error);
    }

    // Call onReady callback if provided
    if (onReady) {
      onReady(xterm);
    }

    // Handle window resize
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
    // Also handle parent container resize
    const resizeObserver = new ResizeObserver(handleResize);
    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      xterm.dispose();
    };
  }, [onReady]);

  return (
    <div 
      ref={terminalRef} 
      style={{ 
        width: '100%', 
        height: '100%',
        backgroundColor: '#1a1b1e',
        padding: '8px',
        display: 'flex',
        overflow: 'hidden',
      }} 
    />
  );
}; 