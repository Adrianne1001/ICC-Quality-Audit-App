import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, User, LogOut, CheckCircle, SlidersHorizontal, BarChart3, Bot } from 'lucide-react';

interface NavbarProps {
  currentTab: 'hub' | 'admin';
  onSelectTab: (tab: 'hub' | 'admin') => void;
  onOpenProfile: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, onSelectTab, onOpenProfile }) => {
  const { user, profile, isAdmin, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-700 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-indigo-200">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 tracking-tight text-base sm:text-lg">
                  Infosoft
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                  TQM Audit
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                Process Audit & Quality Management Agent
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => onSelectTab('hub')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                currentTab === 'hub'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Bot className="w-4 h-4" />
              <span>Audit Hub</span>
            </button>

            {isAdmin && (
              <button
                onClick={() => onSelectTab('admin')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                  currentTab === 'admin'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Shield className="w-4 h-4 text-amber-500" />
                <span>Super Admin</span>
              </button>
            )}
          </div>

          {/* User Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {profile && (
              <button
                onClick={onOpenProfile}
                className="hidden md:flex flex-col text-right hover:opacity-80 transition-opacity"
                title="Edit profile"
              >
                <span className="text-xs font-semibold text-slate-800">
                  {profile.displayName || user?.displayName}
                </span>
                <span className="text-[10px] text-indigo-600 font-medium">
                  {profile.department} &bull; {profile.role}
                </span>
              </button>
            )}

            <button
              onClick={onOpenProfile}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              title="Edit Profile"
              aria-label="Profile Settings"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>

            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || 'User'}
                className="w-8 h-8 rounded-full border border-slate-200"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                {user?.displayName ? user.displayName[0].toUpperCase() : 'U'}
              </div>
            )}

            <button
              onClick={signOut}
              className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Sign Out"
              aria-label="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
