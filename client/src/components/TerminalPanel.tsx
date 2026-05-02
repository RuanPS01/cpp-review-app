import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { io, Socket } from 'socket.io-client';
import 'xterm/css/xterm.css';
import { X } from 'lucide-react';

interface TerminalPanelProps {
  isOpen: boolean;
  filePath: string;
  onClose: () => void;
  t: any;
  theme: 'light' | 'dark';
}

const TerminalPanel: React.FC<TerminalPanelProps> = ({ isOpen, filePath, onClose, t, theme }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const [shouldRender, setShouldRender] = useState(isOpen);

  useEffect(() => {
    if (isOpen) setShouldRender(true);
  }, [isOpen]);

  const handleAnimationEnd = () => {
    if (!isOpen) setShouldRender(false);
  };

  useEffect(() => {
    if (!shouldRender || !terminalRef.current) return;

    const isLight = theme === 'light';

    const term = new Terminal({
      cursorBlink: true,
      theme: {
        background: isLight ? '#ffffff' : '#000000',
        foreground: isLight ? '#0891b2' : '#22d3ee',
        cursor: isLight ? '#0891b2' : '#22d3ee',
        selectionBackground: isLight ? 'rgba(8,145,178,0.2)' : 'rgba(34,211,238,0.3)',
      },
      fontSize: 14,
      fontFamily: 'Fira Code, Menlo, Monaco, "Courier New", monospace',
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;

    const socket = io('http://localhost:3001');
    socketRef.current = socket;

    socket.on('connect', () => {
      term.writeln(`\x1b[32m${t.connectedToServer}\x1b[0m`);
      socket.emit('run-code', { filePath });
    });

    socket.on('terminal-data', (data: string) => {
      term.write(data);
    });

    term.onData((data) => {
      socket.emit('terminal-input', data);
    });

    const handleResize = () => {
      fitAddon.fit();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      socket.disconnect();
      term.dispose();
    };
  }, [shouldRender, filePath, t, theme]);

  if (!shouldRender) return null;

  return (
    <div className={`fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md transition-opacity duration-150 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
      <div 
        onAnimationEnd={handleAnimationEnd}
        className={`${isOpen ? 'animate-crt-open' : 'animate-crt-close'} bg-panel w-full max-w-4xl h-[600px] rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-border-main flex flex-col overflow-hidden transition-colors`}
      >
        <div className="bg-header p-4 border-b border-border-main flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-button border border-border-main"></div>
                <div className="w-3 h-3 rounded-full bg-button border border-border-main"></div>
                <div className="w-3 h-3 rounded-full bg-button border border-border-main"></div>
            </div>
            <span className="ml-2 text-xs font-black uppercase tracking-[0.2em] text-accent drop-shadow-[0_0_5px_var(--accent-glow)]">{t.systemTerminal}</span>
          </div>
          <button 
            onClick={onClose}
            className="text-text-dim hover:text-text-bright transition-colors p-1 hover:bg-button rounded-md"
          >
            <X size={20} />
          </button>
        </div>
        <div ref={terminalRef} className={`flex-1 p-4 ${theme === 'light' ? 'bg-white' : 'bg-black'} transition-colors`} />
      </div>
    </div>
  );
};

export default TerminalPanel;
