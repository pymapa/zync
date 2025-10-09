import React from 'react';
import { Link } from 'react-router-dom';

const Hero: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-8">
      <div className="max-w-6xl w-full grid lg:grid-cols-2 gap-12 items-center">
        {/* Content */}
        <div className="space-y-8 flex flex-col">
          <div className="space-y-4">
            <h1 className="text-5xl lg:text-7xl font-bold text-white leading-tight">
              Zync
            </h1>
            <p className="text-xl text-gray-300 leading-relaxed max-w-lg">
              Better search and insights for your personal data
            </p>
          </div>

          {/* Visual Mockup - Shows on mobile before buttons */}
          <div className="flex justify-center lg:hidden order-1">
            <div className="relative">
              {/* Main Dashboard */}
              <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6 w-80 shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex space-x-2">
                    <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                <div className="w-3 h-3 bg-green-400 rounded-full"></div>
              </div>
              <div className="text-white/60 text-sm">Zync</div>
            </div>                {/* Chart */}
                <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl p-4 mb-4 h-32 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-purple-500/10 to-transparent"></div>
                  <div className="relative z-10">
                    <div className="text-white/80 text-sm mb-2">Weekly Activity</div>
                    <div className="flex items-end space-x-1 h-16">
                      <div className="bg-purple-400 w-2 h-8 rounded-t"></div>
                      <div className="bg-purple-400 w-2 h-12 rounded-t"></div>
                      <div className="bg-pink-400 w-2 h-16 rounded-t"></div>
                      <div className="bg-purple-400 w-2 h-10 rounded-t"></div>
                      <div className="bg-pink-400 w-2 h-14 rounded-t"></div>
                      <div className="bg-purple-400 w-2 h-6 rounded-t"></div>
                      <div className="bg-purple-400 w-2 h-11 rounded-t"></div>
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/5 rounded-lg p-3">
                    <div className="text-purple-400 text-2xl font-bold">12.4k</div>
                    <div className="text-white/60 text-xs">Steps Today</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <div className="text-pink-400 text-2xl font-bold">847</div>
                    <div className="text-white/60 text-xs">Calories</div>
                  </div>
                </div>
              </div>

              {/* Floating Elements */}
              <div className="absolute -top-4 -right-4 bg-purple-500 w-8 h-8 rounded-full animate-pulse"></div>
              <div className="absolute -bottom-4 -left-4 bg-pink-500 w-6 h-6 rounded-full animate-pulse delay-1000"></div>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 order-2">
            <Link 
              to="/login"
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-300 hover:scale-105 hover:shadow-2xl text-center"
            >
              Get Started
            </Link>
            <button className="border border-gray-400 text-gray-300 hover:text-white hover:border-white px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-300">
              Learn More
            </button>
          </div>
        </div>

        {/* Visual Mockup - Shows on desktop only */}
        <div className="hidden lg:flex justify-center lg:justify-end">
          <div className="relative">
            {/* Main Dashboard */}
            <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6 w-80 shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex space-x-2">
                  <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                  <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                  <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                </div>
                <div className="text-white/60 text-sm">Zync</div>
              </div>

              {/* Chart */}
              <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl p-4 mb-4 h-32 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-purple-500/10 to-transparent"></div>
                <div className="relative z-10">
                  <div className="text-white/80 text-sm mb-2">Weekly Activity</div>
                  <div className="flex items-end space-x-1 h-16">
                    <div className="bg-purple-400 w-2 h-8 rounded-t"></div>
                    <div className="bg-purple-400 w-2 h-12 rounded-t"></div>
                    <div className="bg-pink-400 w-2 h-16 rounded-t"></div>
                    <div className="bg-purple-400 w-2 h-10 rounded-t"></div>
                    <div className="bg-pink-400 w-2 h-14 rounded-t"></div>
                    <div className="bg-purple-400 w-2 h-6 rounded-t"></div>
                    <div className="bg-purple-400 w-2 h-11 rounded-t"></div>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="text-purple-400 text-2xl font-bold">12.4k</div>
                  <div className="text-white/60 text-xs">Steps Today</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="text-pink-400 text-2xl font-bold">847</div>
                  <div className="text-white/60 text-xs">Calories</div>
                </div>
              </div>
            </div>

            {/* Floating Elements */}
            <div className="absolute -top-4 -right-4 bg-purple-500 w-8 h-8 rounded-full animate-pulse"></div>
            <div className="absolute -bottom-4 -left-4 bg-pink-500 w-6 h-6 rounded-full animate-pulse delay-1000"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Hero;