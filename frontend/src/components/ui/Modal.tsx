import React from 'react';
import { IconClose } from './Icons';

interface ModalProps {
  title: React.ReactNode;
  headerContent?: React.ReactNode;
  headerClassName?: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}

export function Modal({ title, headerContent, headerClassName, onClose, children, wide = false }: ModalProps) {
  return (
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="app-modal-backdrop"
    >
      <section role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} className={`card app-modal-panel${wide ? ' app-modal-panel-wide' : ''} anim-rise`}>
        <div className={`app-modal-header${headerClassName ? ` ${headerClassName}` : ''}`}>
          {headerContent ?? <h2>{title}</h2>}
          <button type="button" className="btn sm" aria-label="Close dialog" onClick={onClose}>
            <IconClose size={16} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
