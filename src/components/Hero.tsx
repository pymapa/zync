import { Link } from 'react-router-dom';

const Hero = () => {
  return (
    <div className="min-h-screen bg-base">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <h1 className="text-xl font-bold text-accent">ZYNC</h1>
        <Link
          to="/login"
          className="bg-accent text-white px-6 py-2.5 rounded-full font-semibold text-sm hover:bg-accent-dim transition-colors"
        >
          Get Started
        </Link>
      </nav>

      {/* Hero */}
      <div className="max-w-6xl mx-auto px-6 pt-16 pb-24 grid lg:grid-cols-2 gap-16 items-center">
        {/* Left — copy */}
        <div className="space-y-6">
          <h2 className="text-5xl lg:text-6xl font-bold text-text-primary leading-tight">
            Your fitness data,<br />
            <span className="text-accent">amplified</span>
          </h2>
          <p className="text-text-secondary text-lg leading-relaxed max-w-md">
            Search, explore, and gain insights across all your Strava activities in one place.
          </p>
          <div className="flex gap-3 pt-2">
            <Link
              to="/login"
              className="bg-accent text-white px-8 py-3.5 rounded-full font-semibold text-sm hover:bg-accent-dim transition-colors"
            >
              Connect Strava
            </Link>
            <button className="border border-border text-text-secondary px-8 py-3.5 rounded-full font-semibold text-sm hover:border-border-strong hover:text-text-primary transition-colors">
              Learn More
            </button>
          </div>
        </div>

        {/* Right — dashboard preview card */}
        <div className="hidden lg:block">
          <div className="bg-card rounded-2xl shadow-lg border border-border p-6 space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-muted uppercase tracking-widest">Dashboard</span>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green" />
                <span className="text-[10px] text-text-muted">Live</span>
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-surface rounded-lg p-3">
                <div className="text-accent text-xl font-bold">3.2h</div>
                <div className="text-text-muted text-xs mt-0.5">Hours</div>
              </div>
              <div className="bg-surface rounded-lg p-3">
                <div className="text-blue text-xl font-bold">24.1km</div>
                <div className="text-text-muted text-xs mt-0.5">Cycling</div>
              </div>
              <div className="bg-surface rounded-lg p-3">
                <div className="text-accent text-xl font-bold">8.7km</div>
                <div className="text-text-muted text-xs mt-0.5">Running</div>
              </div>
            </div>

            {/* Chart */}
            <div className="bg-surface rounded-lg p-4">
              <div className="text-text-muted text-xs font-semibold uppercase tracking-widest mb-3">Weekly Activity</div>
              <div className="flex items-end gap-1.5 h-16">
                {[40, 60, 80, 50, 70, 30, 55].map((height, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-accent rounded-t opacity-70 hover:opacity-100 transition-opacity"
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>
              <div className="flex mt-2.5">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
                  <span key={i} className="flex-1 text-center text-text-muted text-xs">{day}</span>
                ))}
              </div>
            </div>

            {/* Activity list */}
            <div className="space-y-1">
              {[
                { name: 'Morning Run', dist: '5.2 km' },
                { name: 'Lunch Walk', dist: '1.8 km' },
                { name: 'Evening Cycle', dist: '12.4 km' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-surface transition-colors">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-accent" />
                    <span className="text-sm text-text-primary font-medium">{item.name}</span>
                  </div>
                  <span className="text-xs text-text-muted">{item.dist}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Hero;
