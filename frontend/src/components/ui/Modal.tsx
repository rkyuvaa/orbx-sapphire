import React, { useState } from 'react';
import { IconClose } from './Icons';
import { Maximize2, Minimize2 } from 'lucide-react';

interface ModalProps {
  title: React.ReactNode;
  headerContent?: React.ReactNode;
  headerClassName?: string;
  panelClassName?: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
  allowFullScreen?: boolean;
  defaultFullScreen?: boolean;
}

export function Modal({
  title,
  headerContent,
  headerClassName,
  panelClassName,
  onClose,
  children,
  wide = false,
  allowFullScreen = wide,
  defaultFullScreen = false,
}: ModalProps) {
  const [isFullScreen, setIsFullScreen] = useState(defaultFullScreen);

  return (
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="app-modal-backdrop"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className={`card app-modal-panel${wide ? ' app-modal-panel-wide' : ''}${isFullScreen ? ' app-modal-panel-fullscreen' : ''}${panelClassName ? ` ${panelClassName}` : ''} anim-rise`}
      >
        <div className={`app-modal-header${headerClassName ? ` ${headerClassName}` : ''}`}>
          {headerContent ?? <h2>{title}</h2>}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            {allowFullScreen && (
              <button
                type="button"
                className="btn sm"
                aria-label={isFullScreen ? 'Exit full screen' : 'Expand full screen'}
                title={isFullScreen ? 'Exit full screen' : 'Expand full screen'}
                onClick={() => setIsFullScreen((prev) => !prev)}
                style={{ padding: '0 8px', height: '32px' }}
              >
                {isFullScreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              </button>
            )}
            <button
              type="button"
              className="btn sm"
              aria-label="Close dialog"
              onClick={onClose}
              style={{ padding: '0 8px', height: '32px' }}
            >
              <IconClose size={16} />
            </button>
          </div>
        </div>
        {children}
      </section>
    </div>
  );
}
