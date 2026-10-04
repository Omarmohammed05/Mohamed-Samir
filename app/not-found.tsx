export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>404 - Page Not Found</h1>
          <p style={{ color: '#666' }}>The page you are looking for does not exist.</p>
        </div>
      </body>
    </html>
  );
}
