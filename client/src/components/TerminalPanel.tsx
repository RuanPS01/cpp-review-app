import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { io, Socket } from 'socket.io-client';
import 'xterm/css/xterm.css';
import { X, Maximize2, Minimize2, Move } from 'lucide-react';

interface TerminalPanelProps {
  isOpen: boolean;
  filePath: string;
  codeOverride?: string;
  onClose: () => void;
  t: Record<string, string>;
  theme: 'light' | 'dark';
}

const TerminalPanel: React.FC<TerminalPanelProps> = ({ isOpen, filePath, codeOverride, onClose, t, theme }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const [shouldRender, setShouldRender] = useState(isOpen);
  
  const [isFocused, setIsFocused] = useState(() => {
    const saved = localStorage.getItem('terminalMode');
    return saved === 'focused';
  });

  const [pos, setPos] = useState({ x: 100, y: 100 });
  const [size, setSize] = useState({ width: 800, height: 500 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const sizeStart = useRef({ width: 0, height: 0 });

  useEffect(() => {
    if (isOpen && !shouldRender) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShouldRender(true);
      // Center on open if in free mode
      if (!isFocused) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPos({
          x: (window.innerWidth - size.width) / 2,
          y: (window.innerHeight - size.height) / 2
        });
      }
    }
  }, [isOpen, shouldRender, isFocused, size.width, size.height]);

  const handleAnimationEnd = () => {
    if (!isOpen) setShouldRender(false);
  };

  const toggleMode = () => {
    const newMode = !isFocused;
    setIsFocused(newMode);
    localStorage.setItem('terminalMode', newMode ? 'focused' : 'free');
    
    if (!newMode) {
      // If switching to free mode, center it
      setPos({
        x: (window.innerWidth - size.width) / 2,
        y: (window.innerHeight - size.height) / 2
      });
    }
  };

  const onDragStart = (e: React.MouseEvent) => {
    if (isFocused) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
  };

  const onResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    sizeStart.current = { width: size.width, height: size.height };
  };

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      setPos({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y
      });
    } else if (isResizing) {
      const deltaX = e.clientX - dragStart.current.x;
      const deltaY = e.clientY - dragStart.current.y;
      setSize({
        width: Math.max(400, sizeStart.current.width + deltaX),
        height: Math.max(300, sizeStart.current.height + deltaY)
      });
    }
  }, [isDragging, isResizing]);

  const onMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isDragging || isResizing) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    } else {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging, isResizing, onMouseMove, onMouseUp]);

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
      socket.emit('run-code', { filePath, codeOverride });
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
  }, [shouldRender, filePath, codeOverride, t, theme]);

  // Re-fit when size changes
  useEffect(() => {
    if (xtermRef.current) {
      const fitAddon = new FitAddon();
      xtermRef.current.loadAddon(fitAddon);
      setTimeout(() => fitAddon.fit(), 10);
    }
  }, [size, isFocused]);

  if (!shouldRender) return null;

  const containerStyle: React.CSSProperties = isFocused ? {
    width: '100%',
    maxWidth: '56rem', // max-w-4xl
    height: '600px',
  } : {
    position: 'fixed',
    left: pos.x,
    top: pos.y,
    width: size.width,
    height: size.height,
    zIndex: 1000,
  };

  return (
    <div className={`${isFocused ? 'fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md' : ''} transition-opacity duration-150 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
      <div 
        onAnimationEnd={handleAnimationEnd}
        style={containerStyle}
        className={`${isOpen ? 'animate-crt-open' : 'animate-crt-close'} bg-panel rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-border-main flex flex-col overflow-hidden transition-colors`}
      >
        <div 
          onMouseDown={onDragStart}
          className={`bg-header p-4 border-b border-border-main flex justify-between items-center ${isFocused ? '' : 'cursor-move select-none'}`}
        >
          <div className="flex items-center gap-3">
            {!isFocused && <Move size={14} className="text-text-dim" />}
            <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-button border border-border-main"></div>
                <div className="w-3 h-3 rounded-full bg-button border border-border-main"></div>
                <div className="w-3 h-3 rounded-full bg-button border border-border-main"></div>
            </div>
            <span className="ml-2 text-xs font-black uppercase tracking-[0.2em] text-accent drop-shadow-[0_0_5px_var(--accent-glow)]">{t.systemTerminal}</span>
          </div>
          <div className="flex items-center gap-2">
            <button 
                onClick={toggleMode}
                className="text-text-dim hover:text-accent transition-colors p-1 hover:bg-button rounded-md"
                title={isFocused ? "Modo Livre" : "Modo Focado"}
            >
                {isFocused ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            <button 
                onClick={onClose}
                className="text-text-dim hover:text-red-500 transition-colors p-1 hover:bg-button rounded-md"
            >
                <X size={20} />
            </button>
          </div>
        </div>
        <div ref={terminalRef} className={`flex-1 p-4 ${theme === 'light' ? 'bg-white' : 'bg-black'} transition-colors`} />
        {!isFocused && (
            <div 
                onMouseDown={onResizeStart}
                className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize flex items-center justify-center"
            >
                <div className="w-1.5 h-1.5 bg-accent/30 rounded-full"></div>
            </div>
        )}
      </div>
    </div>
  );
};

export default TerminalPanel;
