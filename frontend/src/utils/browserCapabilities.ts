export interface BrowserCapabilities {
  isSupported: boolean;
  missingFeatures: string[];
}

export function getBrowserCapabilities(): BrowserCapabilities {
  const requiredFeatures: Array<[string, boolean]> = [
    ['ES modules', 'noModule' in HTMLScriptElement.prototype],
    ['Fetch API', typeof window.fetch === 'function'],
    ['Promises', typeof window.Promise === 'function'],
    ['URL API', typeof window.URL === 'function'],
    ['CSS custom properties', typeof window.CSS?.supports === 'function' && window.CSS.supports('color', 'var(--orbx-check)')],
  ];
  const missingFeatures = requiredFeatures.filter(([, supported]) => !supported).map(([name]) => name);
  return { isSupported: missingFeatures.length === 0, missingFeatures };
}
