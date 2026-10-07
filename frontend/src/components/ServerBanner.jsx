function ServerBanner({ onRetry, retrying }) {
  return (
    <div className="server-banner" role="alert">
      <p>Can't reach the server. Check that the backend is running, then try again.</p>
      <button type="button" onClick={onRetry} disabled={retrying}>
        {retrying ? 'Trying...' : 'Try again'}
      </button>
    </div>
  )
}

export default ServerBanner
