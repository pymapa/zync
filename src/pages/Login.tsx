import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const Login: React.FC = () => {
  const [isSignup, setIsSignup] = useState(false);

  const handleOAuthLogin = (provider: string) => {
    // Will implement OAuth flow when backend is ready
    console.log(`OAuth login with ${provider}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-8">
      <div className="max-w-md w-full">
        {/* Back to Home Link */}
        <Link 
          to="/" 
          className="inline-flex items-center text-gray-300 hover:text-white mb-8 transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Home
        </Link>

        {/* Login/Signup Card */}
        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-8 shadow-2xl">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">
              {isSignup ? 'Create Account' : 'Welcome Back'}
            </h1>
            <p className="text-gray-300">
              {isSignup 
                ? 'Sign up to start tracking your fitness data' 
                : 'Sign in to access your dashboard'}
            </p>
          </div>

          {/* OAuth Button */}
          <div>
            {/* Strava */}
            <button
              onClick={() => handleOAuthLogin('strava')}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-3"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
              </svg>
              Continue with Strava
            </button>
          </div>

          {/* Divider */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-600"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-transparent text-gray-400">
                {isSignup ? 'Already have an account?' : "Don't have an account?"}
              </span>
            </div>
          </div>

          {/* Toggle Login/Signup */}
          <button
            onClick={() => setIsSignup(!isSignup)}
            className="w-full text-purple-400 hover:text-purple-300 font-medium transition-colors"
          >
            {isSignup ? 'Sign in instead' : 'Create an account'}
          </button>
        </div>

        {/* Footer Text */}
        <p className="text-center text-gray-400 text-sm mt-8">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
};

export default Login;