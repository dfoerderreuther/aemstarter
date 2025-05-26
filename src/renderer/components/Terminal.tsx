import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

interface TerminalProps {
  onReady?: (terminal: XTerm) => void;
  visible?: boolean;
  fontSize?: number;
}

export interface TerminalRef {
  resize: () => void;
}

export const Terminal = forwardRef<TerminalRef, TerminalProps>(({ onReady, visible = true, fontSize = 13 }, ref) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const xtermRef = useRef<XTerm | null>(null);
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

  // Handle font size changes without recreating terminal
  useEffect(() => {
    if (xtermRef.current && fontSize) {
      xtermRef.current.options.fontSize = fontSize;
      // Trigger a resize to apply the new font size
      if (fitAddonRef.current) {
        try {
          fitAddonRef.current.fit();
        } catch (error) {
          console.warn('Failed to fit terminal after font size change:', error);
        }
      }
    }
  }, [fontSize]);

  useEffect(() => {
    if (!terminalRef.current) return;
    if (!onReadyRef.current) {
      return;
    }

    // Only create terminal if it doesn't exist
    if (xtermRef.current) {
      return;
    }

    // Minimal xterm.js configuration
    const xterm = new XTerm({
      convertEol: true,
      fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
      fontSize: fontSize,
      allowTransparency: true,
      theme: {
        background: '#1a1a1a',
        foreground: '#ffffff',
      }
    });

    xtermRef.current = xterm;

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
      if (xtermRef.current) {
        xtermRef.current.dispose();
        xtermRef.current = null;
      }
    };
  }, []); // Remove fontSize dependency since we handle it separately

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