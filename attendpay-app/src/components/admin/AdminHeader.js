import { useState } from "react";
import { Search, Bell, ChevronDown, Settings, LogOut, User, Moon, Sun, X, AlertTriangle, CheckCircle, Info, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "../../context/AuthContext";


const viewTitles = {
  overview: { title: "Dashboard Overview", sub: "Welcome back, Super Admin" },
  users: { title: "User Management", sub: "Manage accounts, plans & access" },
  plans: { title: "Subscription Plans", sub: "Configure pricing & entitlements" },
  tickets: { title: "Support Tickets", sub: "Monitor and resolve customer issues" },
  settings: { title: "System Settings", sub: "Platform configuration & security" },
};

const notifColors = {
  error: "bg-red-500",
  warning: "bg-amber-500",
  success: "bg-emerald-500",
  info: "bg-blue-500",
};

const notifIconStyles = {
  error: "bg-red-50 text-red-600 border border-red-100",
  warning: "bg-amber-50 text-amber-600 border border-amber-100",
  success: "bg-emerald-50 text-emerald-600 border border-emerald-100",
  info: "bg-blue-50 text-blue-600 border border-blue-100",
};

const getNotifIcon = (type) => {
  switch (type) {
    case "success":
      return <CheckCircle className="w-4 h-4" />;
    case "warning":
      return <AlertTriangle className="w-4 h-4" />;
    case "error":
    case "critical":
      return <AlertCircle className="w-4 h-4" />;
    case "info":
    default:
      return <Info className="w-4 h-4" />;
  }
};

export function AdminHeader({ activeView, notifications = [], onMarkAllRead, onDeleteNotification, onNotificationClick, onViewAllNotifications }) {
  const { signOut } = useAuth();
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const [isDark, setIsDark] = useState(false);
  const unreadCount = notifications.filter((n) => n.unread).length;
  const { title, sub } = viewTitles[activeView] || viewTitles.overview;

  return (
    <header
      className="fixed top-0 right-0 bg-white flex items-center gap-4 px-8 h-16 z-30 transition-all"
      style={{ left: "0", borderBottom: "1px solid #f3f4f6", marginRight: "var(--sidebar-width, 256px)" }}
    >
      {/* Page title */}
      <div className="flex-shrink-0 min-w-0" style={{ textAlign: 'right' }}>
        <h1 className="text-gray-900 truncate" style={{ fontWeight: 700, fontSize: "1.05rem", lineHeight: 1.2 }}>
          {title}
        </h1>
        <p className="text-gray-400 truncate" style={{ fontSize: "0.75rem", fontWeight: 400 }}>{sub}</p>
      </div>

      <div className="flex-1" />

      {/* Search */}
      <div className="relative hidden md:block">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Search users, tickets..."
          className="pr-9 pl-4 py-1.5 rounded-lg text-[0.825rem] bg-gray-50 border border-transparent outline-none focus:border-gray-300 focus:bg-white transition-all w-64 placeholder-gray-400 text-gray-900"
          style={{ fontWeight: 500, direction: 'ltr' }}
        />
      </div>

      {/* Dark mode toggle */}
      <button
        onClick={() => setIsDark(!isDark)}
        className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors flex-shrink-0"
      >
        {isDark ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4 h-4" />}
      </button>

      {/* Notifications */}
      <div className="relative flex-shrink-0">
        <button
          onClick={() => { setNotifOpen(!notifOpen); setProfileOpen(false); }}
          className="relative w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <Bell className="w-4.5 h-4.5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center"
              style={{ fontSize: "0.58rem", fontWeight: 800 }}>
              {unreadCount}
            </span>
          )}
        </button>

        <AnimatePresence>
          {notifOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -5 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -5 }}
                transition={{ duration: 0.15 }}
                className="absolute top-12 left-0 w-80 bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden z-50 text-right"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                  <span className="text-gray-900" style={{ fontWeight: 700, fontSize: "0.875rem" }}>Notifications</span>
                  <span onClick={onMarkAllRead} className="text-blue-600 text-xs cursor-pointer hover:underline" style={{ fontWeight: 600 }}>Mark all read</span>
                </div>
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-gray-400 text-sm">
                    No new notifications
                  </div>
                ) : (
                  notifications.slice(0, 5).map((n) => (
                    <div 
                      key={n.id} 
                      onClick={() => { onNotificationClick?.(n); setNotifOpen(false); }}
                      className={`relative flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors cursor-pointer ${n.unread ? "bg-blue-50/30" : ""}`}
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${notifIconStyles[n.type] || notifIconStyles.info}`}>
                          {getNotifIcon(n.type)}
                        </div>
                        <div className="flex-1 min-w-0 text-right">
                          <p className="text-gray-700 leading-5" style={{ fontSize: "0.8rem", fontWeight: n.unread ? 600 : 400 }}>{n.message}</p>
                          <p className="text-gray-400 mt-0.5" style={{ fontSize: "0.7rem" }}>{n.time}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onDeleteNotification?.(n.id); }}
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
                        title="Delete notification"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
                <div className="px-4 py-2.5 bg-gray-50 text-center">
                  <span onClick={() => { onViewAllNotifications?.(); setNotifOpen(false); }} className="text-blue-600 text-xs cursor-pointer hover:underline" style={{ fontWeight: 600 }}>View all notifications</span>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Profile */}
      <div className="relative flex-shrink-0 ml-2">
        <button
          onClick={() => { setProfileOpen(!profileOpen); setNotifOpen(false); }}
          className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-colors"
        >
          <div className="w-7 h-7 rounded-full bg-gray-900 flex items-center justify-center flex-shrink-0 shadow-sm">
            <span className="text-white tracking-tight" style={{ fontWeight: 700, fontSize: "0.65rem" }}>SA</span>
          </div>
          <div className="hidden lg:block text-right">
            <div className="text-gray-900 tracking-tight" style={{ fontWeight: 600, fontSize: "0.75rem", lineHeight: 1.2 }}>Administrator</div>
          </div>
          <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${profileOpen ? "rotate-180" : ""}`} />
        </button>

        <AnimatePresence>
          {profileOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -5 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -5 }}
                transition={{ duration: 0.15 }}
                className="absolute top-12 left-0 w-52 bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden z-50 text-right"
              >
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                  <div className="text-gray-900" style={{ fontWeight: 700, fontSize: "0.85rem" }}>Super Admin</div>
                  <div className="text-gray-400" style={{ fontSize: "0.72rem" }}>admin@kwader.io</div>
                </div>
                {[
                  { icon: User, label: "Profile Settings" },
                  { icon: Settings, label: "Preferences" },
                ].map(({ icon: Icon, label }) => (
                  <button key={label} className="w-full flex items-center gap-3 px-4 py-2.5 text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors text-right">
                    <Icon className="w-4 h-4" />
                    <span style={{ fontSize: "0.825rem", fontWeight: 500 }}>{label}</span>
                  </button>
                ))}
                <div className="border-t border-gray-50">
                  <button 
                    onClick={signOut}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-red-500 hover:bg-red-50 transition-colors text-right"
                  >
                    <LogOut className="w-4 h-4" />
                    <span style={{ fontSize: "0.825rem", fontWeight: 500 }}>Sign Out</span>
                  </button>
                </div>

              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
