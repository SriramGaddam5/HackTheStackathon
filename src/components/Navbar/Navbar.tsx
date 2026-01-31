
const Navbar = () => {
  return (
    <nav className="navbar">
      <div className="navbar-content">
        {/* Existing navbar content */}
        <div className="navbar-actions">
          <Button onClick={handleRunAnalysis}>Run Analysis</Button>
          <ThemeToggle className="theme-toggle" /> {/* Move toggle here */}
        </div>
      </div>
    </nav>
  );
}