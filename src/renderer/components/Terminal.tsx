import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

interface TerminalProps {
  onReady?: (terminal: XTerm) => void;
  visible?: boolean;
}

export interface TerminalRef {
  resize: () => void;
}

export const Terminal = forwardRef<TerminalRef, TerminalProps>(({ onReady, visible = true }, ref) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const onReadyRef = useRef<((terminal: XTerm) => void) | undefined>(onReady);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  // Expose resize method to parent
  useImperativeHandle(ref, () => ({
    resize: () => {
      if (fitAddonRef.current) {
        try {
          fitAddonRef.current.fit();
        } catch (error) {
          console.warn('Failed to fit terminal:', error);
        }
      }
    }
  }), []);

  useEffect(() => {
    if (!terminalRef.current) return;
    if (!onReadyRef.current) {
      return;
    }


    // Minimal xterm.js configuration
    const xterm = new XTerm({
      convertEol: true,
      fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
      fontSize: 13,
      allowTransparency: true,
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
    if (onReadyRef.current) {
      onReadyRef.current(xterm);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      xterm.dispose();
    };
  }, []);

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
        height: '100%'
      }}
    />
  );
}); 