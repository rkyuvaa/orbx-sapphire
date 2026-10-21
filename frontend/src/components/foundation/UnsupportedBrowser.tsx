interface UnsupportedBrowserProps {
  missingFeatures: string[];
}

export function UnsupportedBrowser({ missingFeatures }: UnsupportedBrowserProps) {
  return (
    <main className="browser-notice" role="alert">
      <section>
        <h1>Update your browser to use OrbX</h1>
        <p>OrbX requires a modern browser to keep your workspace reliable and secure.</p>
        <p>Please update to the latest Chrome, Edge, Firefox, or Safari, then reload this page.</p>
        {missingFeatures.length > 0 && <p className="browser-notice__detail">Missing: {missingFeatures.join(', ')}</p>}
      </section>
    </main>
  );
}
