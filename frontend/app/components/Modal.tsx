import { useEffect, type ReactNode } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'default' | 'lg';
}

const sizeClasses = {
  default: 'max-w-6xl',
  lg: 'max-w-6xl',
} as const;

export function Modal({ isOpen, onClose, title, children, size = 'default' }: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-200 animate-fade-in"
      onClick={onClose}
    >
      <div
        className={`bg-surface rounded-xl p-6 shadow-lg ${sizeClasses[size]} w-[90%] max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button
            className="bg-transparent border-none text-inherit cursor-pointer text-lg leading-none opacity-80 hover:opacity-100 p-0"
            onClick={onClose}
          >
            &times;
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
