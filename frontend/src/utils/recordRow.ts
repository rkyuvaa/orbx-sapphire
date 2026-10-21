import React from 'react';

function isNestedControl(target: EventTarget | null, currentTarget: HTMLElement): boolean {
  return target instanceof Element
    && target !== currentTarget
    && Boolean(target.closest('button, a, input, select, textarea, [role="button"]'));
}

export function handleRecordRowClick(
  event: React.MouseEvent<HTMLElement>,
  openRecord: () => void,
): void {
  if (!isNestedControl(event.target, event.currentTarget)) openRecord();
}

export function handleRecordRowKeyDown(
  event: React.KeyboardEvent<HTMLElement>,
  openRecord: () => void,
): void {
  if (isNestedControl(event.target, event.currentTarget)) return;
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    openRecord();
  }
}
