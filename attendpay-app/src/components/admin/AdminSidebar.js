import {
  LayoutDashboard, Users, CreditCard, LifeBuoy, Settings,
  LogOut, ChevronRight, Activity, Building2, RefreshCw, Bell, Megaphone
} from "lucide-react";
import { motion } from "motion/react";
import { useAuth } from "../../context/AuthContext";


export function AdminSidebar({ activeView, onViewChange, openTicketsCount = 0, pendingRenewalsCount = 0, unreadNotificationsCount = 0, pendingPaymentsCount = 0 }) {
  const { signOut } = useAuth();

  const navItems = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "resellers", label: "Resellers", icon: Building2 },
    { id: "users", label: "User Management", icon: Users },
    { id: "plans", label: "Subscription Plans", icon: CreditCard },
    { id: "renewals", label: "Renewal Requests", icon: RefreshCw, badge: pendingRenewalsCount },
    { id: "payments", label: "طلبات الدفع 💳", icon: CreditCard, badge: pendingPaymentsCount },
    { id: "tickets", label: "Support Tickets", icon: LifeBuoy, badge: openTicketsCount },
    { id: "diagnostics", label: "Devices & Diagnostics", icon: Activity },
    { id: "notifications", label: "Notifications", icon: Bell, badge: unreadNotificationsCount },
    { id: "broadcast", label: "Broadcast Alerts", icon: Megaphone },
    { id: "settings", label: "System Settings", icon: Settings },
  ];

  return (
    <aside className="fixed right-0 top-0 h-full w-64 flex flex-col z-40 select-none bg-white border-l border-gray-200">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 h-16 border-b border-gray-100">
        <div className="h-7 flex items-center justify-center">
          <img src="/logo.png" alt="Kwader" className="h-full w-auto object-contain grayscale opacity-80" />
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="text-gray-900 tracking-tight" style={{ fontSize: "0.75rem", fontWeight: 700 }}>KWADER</div>
          <div className="text-gray-400 tracking-widest uppercase" style={{ fontSize: "0.55rem", fontWeight: 600 }}>Super Admin</div>
        </div>
        <div className="ms-auto">
          <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 rounded-full border border-emerald-100">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-emerald-700" style={{ fontSize: "0.55rem", fontWeight: 700, letterSpacing: "0.05em" }}>LIVE</span>
          </div>
        </div>
      </div>

      {/* Nav section label */}
      <div className="px-6 pt-8 pb-3" style={{ textAlign: 'right' }}>
        <span className="text-gray-400 uppercase tracking-[0.15em]" style={{ fontSize: "0.6rem", fontWeight: 700 }}>
          Overview
        </span>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <motion.button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              whileHover={{ x: -2 }}
              whileTap={{ scale: 0.98 }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 group relative ${
                isActive
                  ? "bg-gray-100 text-gray-900"
                  : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
              }`}
              style={{ textAlign: 'right' }}
            >
              <div className="flex-shrink-0 flex items-center justify-center">
                <Icon className={`w-4 h-4 transition-colors ${isActive ? "text-gray-900" : "text-gray-400 group-hover:text-gray-600"}`} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className="flex-1 tracking-tight" style={{ fontWeight: isActive ? 600 : 500, fontSize: "0.875rem" }}>
                {item.label}
              </span>
              {item.badge && (
                <span className={`text-[0.65rem] px-2 py-0.5 rounded-full ${
                  isActive ? "bg-white text-gray-900 border border-gray-200 shadow-sm" : "bg-red-50 border border-red-100 text-red-600"
                }`} style={{ fontWeight: 700, minWidth: "20px", textAlign: "center" }}>
                  {item.badge}
                </span>
              )}
            </motion.button>
          );
        })}
      </nav>

      {/* Bottom Section */}
      <div className="p-4 border-t border-gray-100 space-y-3 bg-gray-50/50">
        {/* System status */}
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white border border-gray-200 shadow-sm">
          <div className="flex-1 text-right">
            <div className="text-gray-900 tracking-tight" style={{ fontSize: "0.75rem", fontWeight: 700 }}>System Status</div>
            <div className="text-emerald-600" style={{ fontSize: "0.65rem", fontWeight: 600 }}>100% Operational</div>
          </div>
          <Activity className="w-4 h-4 text-emerald-500 flex-shrink-0" />
        </div>

        {/* Admin profile */}
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer group border border-transparent hover:border-gray-200">
          <div className="flex-1 min-w-0 text-right">
            <div className="text-gray-900 truncate tracking-tight" style={{ fontWeight: 600, fontSize: "0.8rem" }}>Administrator</div>
            <div className="text-gray-500 truncate" style={{ fontSize: "0.65rem" }}>admin@kwader.io</div>
          </div>
          <div className="w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center flex-shrink-0 shadow-sm">
            <span className="text-white" style={{ fontWeight: 700, fontSize: "0.7rem" }}>SA</span>
          </div>
          <button
            onClick={signOut}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors flex-shrink-0"
            title="Logout"
          >
            <LogOut className="w-4 h-4 transform rotate-180" />
          </button>
        </div>
      </div>
    </aside>
  );
}
