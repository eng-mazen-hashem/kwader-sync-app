import { Building2, HardDrive, MessageSquare, LogOut, Activity, ChevronRight } from "lucide-react";
import { motion } from "motion/react";
import { useAuth } from "../../context/AuthContext";

export function ResellerSidebar({ activeTab, onTabChange, stats = {}, resellerData, user, onAccountSettings }) {
  const { signOut } = useAuth();

  const navItems = [
    { id: "clients",     label: "عملائي",         labelEn: "My Clients",        icon: Building2,   badge: null },
    { id: "diagnostics", label: "تشخيص الأجهزة",  labelEn: "Device Diagnostics", icon: HardDrive,   badge: stats.criticalDevices > 0 ? stats.criticalDevices : null, badgeDanger: true },
    { id: "support",     label: "الدعم الفني",    labelEn: "Support Tickets",   icon: MessageSquare, badge: stats.openTickets > 0 ? stats.openTickets : null, badgeDanger: false },
  ];

  const initials = (resellerData?.name || "R").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

  return (
    <aside
      className="fixed right-0 top-0 h-full w-64 flex flex-col z-40 select-none"
      style={{ background: "linear-gradient(180deg, #0d1829 0%, #0f172a 100%)" }}
    >
      {/* Logo / Brand */}
      <div className="flex items-center gap-3 px-5 h-16 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="h-8 flex items-center justify-center">
          <img src="/logo.png" alt="Kwader" className="h-full w-auto object-contain" onError={e => { e.target.style.display='none'; }} />
        </div>
        <div className="flex flex-col" style={{ textAlign: 'right' }}>
          <span className="text-white font-extrabold" style={{ fontSize: "0.95rem", letterSpacing: "0.5px" }}>KWADER</span>
          <span className="text-blue-400" style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.08em" }}>RESELLER PORTAL</span>
        </div>
        <div className="ms-auto">
          <div className="flex items-center gap-1">
            <Activity className="w-3 h-3 text-emerald-400" />
            <span className="text-emerald-400" style={{ fontSize: "0.6rem", fontWeight: 700 }}>LIVE</span>
          </div>
        </div>
      </div>

      {/* Nav section label */}
      <div className="px-5 pt-6 pb-2" style={{ textAlign: 'right' }}>
        <span className="text-slate-500 uppercase tracking-widest" style={{ fontSize: "0.62rem", fontWeight: 700 }}>
          القائمة الرئيسية
        </span>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <motion.button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              whileHover={{ x: -2 }}
              whileTap={{ scale: 0.98 }}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl transition-all duration-200 group relative ${
                isActive
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-900/40"
                  : "text-slate-400 hover:text-slate-100 hover:bg-white/5"
              }`}
              style={{ textAlign: 'right' }}
            >
              {isActive && (
                <motion.div
                  layoutId="resellerActiveNav"
                  className="absolute inset-0 rounded-xl bg-blue-600"
                  style={{ zIndex: -1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                isActive ? "bg-white/20" : "bg-white/5 group-hover:bg-white/10"
              }`}>
                <Icon className="w-4 h-4" />
              </div>
              <span className="flex-1" style={{ fontWeight: isActive ? 600 : 500, fontSize: "0.875rem" }}>
                {item.label}
              </span>
              {item.badge != null && (
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full ${
                    isActive
                      ? "bg-white/20 text-white"
                      : item.badgeDanger
                        ? "bg-red-500/20 text-red-400"
                        : "bg-blue-500/20 text-blue-400"
                  }`}
                  style={{ fontWeight: 700, minWidth: "20px", textAlign: "center" }}
                >
                  {item.badge}
                </span>
              )}
              {isActive && <ChevronRight className="w-3.5 h-3.5 opacity-60 transform rotate-180" />}
            </motion.button>
          );
        })}
      </nav>

      {/* Bottom Section */}
      <div className="p-3 border-t space-y-2" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        {/* Stats summary */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "rgba(16,185,129,0.08)" }}>
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
          <div className="flex-1 text-right">
            <div className="text-emerald-400" style={{ fontSize: "0.7rem", fontWeight: 700 }}>
              {stats.activeClients ?? 0} عميل نشط
            </div>
            <div className="text-slate-500" style={{ fontSize: "0.62rem" }}>
              من أصل {stats.totalClients ?? 0} عميل مسجل
            </div>
          </div>
        </div>

        {/* Reseller profile */}
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors cursor-pointer" onClick={onAccountSettings}>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-violet-500 flex items-center justify-center flex-shrink-0">
            <span className="text-white" style={{ fontWeight: 700, fontSize: "0.7rem" }}>{initials}</span>
          </div>
          <div className="flex-1 min-w-0 text-right">
            <div className="text-slate-200 truncate" style={{ fontWeight: 600, fontSize: "0.8rem" }}>
              {resellerData?.name || "الموزع"}
            </div>
            <div className="text-slate-500 truncate" style={{ fontSize: "0.65rem" }}>
              {user?.email}
            </div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); signOut(); }}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
            title="تسجيل الخروج"
          >
            <LogOut className="w-3.5 h-3.5 transform rotate-180" />
          </button>
        </div>
      </div>
    </aside>
  );
}
