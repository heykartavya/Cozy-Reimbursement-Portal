import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from "react-router-dom";
import { auth } from "./lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { LogOut, LayoutDashboard, ClipboardList, UserCircle, Menu, X } from "lucide-react";
import ClaimPortal from "./pages/ClaimPortal";
import NeilApprovalDesk from "./pages/NeilApprovalDesk";
import CEODashboard from "./pages/CEODashboard";
import Login from "./pages/Login";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;

  return <>{children}</>;
}

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  useEffect(() => {
    // Check if basic Firebase config is present
    if (!import.meta.env.VITE_FIREBASE_API_KEY) {
      setConfigError("Firebase configuration is missing. Please add your VITE_FIREBASE_* variables to the Secrets panel.");
    }
    return onAuthStateChanged(auth, (user) => setUser(user));
  }, []);

  return (
    <Router>
      <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
        {configError && (
          <div className="bg-amber-50 border-b border-amber-200 p-4 text-center">
            <p className="text-amber-800 text-sm font-medium">
              ⚠️ {configError}
            </p>
          </div>
        )}
        {/* Navigation */}
        <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <Link to="/" className="flex items-center gap-2">
                  <img 
                    src="https://cozyfarms.in/wp-content/uploads/2024/07/logo-cozy-farms.svg" 
                    alt="Cozy Farms Logo" 
                    className="h-10 w-auto"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      // Fallback if logo fails to load
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.parentElement?.querySelector('.logo-fallback')?.classList.remove('hidden');
                    }}
                  />
                  <div className="logo-fallback hidden flex items-center gap-2">
                    <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold text-lg">C</span>
                    </div>
                    <span className="font-bold text-xl tracking-tight">Cozy Farms</span>
                  </div>
                </Link>
              </div>

              {/* Desktop Menu */}
              <div className="hidden md:flex items-center space-x-8">
                <Link to="/" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Submit Claim</Link>
                {user && (
                  <>
                    <Link to="/admin" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Approval Desk</Link>
                    <Link to="/ceo" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">CEO Dashboard</Link>
                    <button 
                      onClick={() => signOut(auth)}
                      className="flex items-center gap-2 text-sm font-medium text-red-600 hover:text-red-700 transition-colors"
                    >
                      <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                  </>
                )}
                {!user && (
                  <Link to="/login" className="flex items-center gap-2 text-sm font-medium text-slate-900 bg-slate-100 px-4 py-2 rounded-lg hover:bg-slate-200 transition-colors">
                    <UserCircle className="w-4 h-4" /> Management Login
                  </Link>
                )}
              </div>

              {/* Mobile Menu Button */}
              <div className="md:hidden flex items-center">
                <button 
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="p-2 text-slate-600"
                >
                  {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>
              </div>
            </div>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden bg-white border-b border-slate-200 px-4 pt-2 pb-6 space-y-4">
              <Link to="/" onClick={() => setMobileMenuOpen(false)} className="block text-base font-medium text-slate-600">Submit Claim</Link>
              {user && (
                <>
                  <Link to="/admin" onClick={() => setMobileMenuOpen(false)} className="block text-base font-medium text-slate-600">Approval Desk</Link>
                  <Link to="/ceo" onClick={() => setMobileMenuOpen(false)} className="block text-base font-medium text-slate-600">CEO Dashboard</Link>
                  <button 
                    onClick={() => { signOut(auth); setMobileMenuOpen(false); }}
                    className="block w-full text-left text-base font-medium text-red-600"
                  >
                    Sign Out
                  </button>
                </>
              )}
              {!user && (
                <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="block text-base font-medium text-slate-900">Management Login</Link>
              )}
            </div>
          )}
        </nav>

        {/* Main Content */}
        <main className="pb-20">
          <Routes>
            <Route path="/" element={<ClaimPortal />} />
            <Route path="/login" element={<Login />} />
            <Route 
              path="/admin" 
              element={
                <ProtectedRoute>
                  <NeilApprovalDesk />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/ceo" 
              element={
                <ProtectedRoute>
                  <CEODashboard />
                </ProtectedRoute>
              } 
            />
          </Routes>
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-slate-200 py-8">
          <div className="max-w-7xl mx-auto px-4 text-center">
            <p className="text-slate-500 text-sm">© 2026 Cozy Farms. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </Router>
  );
}
