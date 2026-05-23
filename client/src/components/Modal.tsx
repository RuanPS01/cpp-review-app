import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  maxWidth?: string;
  maxHeight?: string;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, icon: Icon, children, maxWidth = "max-w-2xl", maxHeight = "" }) => {
  const [shouldRender, setShouldRender] = useState(isOpen);

  useEffect(() => {
    if (isOpen && !shouldRender) {
      setShouldRender(true);
    }
  }, [isOpen, shouldRender]);

  const handleAnimationEnd = () => {
    if (!isOpen) setShouldRender(false);
  };

  if (!shouldRender) return null;

  return (
    <div className={`fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md transition-opacity duration-150 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
      <div 
        onAnimationEnd={handleAnimationEnd}
        className={`${isOpen ? 'animate-crt-open' : 'animate-crt-close'} bg-panel w-full ${maxWidth} ${maxHeight} rounded-xl border border-border-main shadow-2xl flex flex-col overflow-hidden transition-colors`}
      >
        <div className="p-4 border-b border-border-main flex justify-between items-center bg-header">
          <h3 className="text-sm font-black uppercase tracking-widest text-text-bright flex items-center gap-2">
              <Icon size={16} className="text-accent" /> {title}
          </h3>
          <button onClick={onClose} className="text-text-dim hover:text-text-bright transition-colors"><X size={20} /></button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
