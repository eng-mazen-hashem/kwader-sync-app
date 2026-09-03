import { useState } from "react";
import { AlertTriangle, AlertCircle, Info, X, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const alertConfig = {
  error: {
    icon: AlertCircle,
    containerClass: "bg-red-50 border-red-200",
    iconClass: "text-red-500",
    titleClass: "text-red-800",
    msgClass: "text-red-600",
    timeClass: "text-red-400 bg-red-100",
    dotClass: "bg-red-500",
    label: "ERROR",
    labelClass: "bg-red-100 text-red-700",
  },
  warning: {
    icon: AlertTriangle,
    containerClass: "bg-amber-50 border-amber-200",
    iconClass: "text-amber-500",
    titleClass: "text-amber-800",
    msgClass: "text-amber-700",
    timeClass: "text-amber-500 bg-amber-100",
    dotClass: "bg-amber-500",
    label: "WARNING",
    labelClass: "bg-amber-100 text-amber-700",
  },
  info: {
    icon: Info,
    containerClass: "bg-blue-50 border-blue-200",
    iconClass: "text-blue-500",
    titleClass: "text-blue-800",
    msgClass: "text-blue-700",
    timeClass: "text-blue-500 bg-blue-100",
    dotClass: "bg-blue-400",
    label: "INFO",
    labelClass: "bg-blue-100 text-blue-700",
  },
};

export function AlertBanner({ alerts = [], loading = false }) {
  const [dismissed, setDismissed] = useState([]);
  const [collapsed, setCollapsed] = useState(false);

  if (loading) {
    return (
      <div className="mb-6" style={{ textAlign: "right" }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-slate-300" />
            <span className="text-gray-400" style={{ fontWeight: 700, fontSize: "0.8rem" }}>
              System Alerts
            </span>
          </div>
        </div>
        <div className="space-y-2">
          {[0, 1].map((idx) => (
            <div key={idx} className="h-16 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const visible = (alerts || []).filter((a) => !dismissed.includes(a.id));

  if (visible.length === 0) return null;

  return (
    <div className="mb-6" style={{ textAlign: "right" }}>
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-slate-400" />
          <span className="text-gray-600" style={{ fontWeight: 700, fontSize: "0.8rem" }}>
            System Alerts
          </span>
          <span
            className="w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center"
            style={{ fontSize: "0.62rem", fontWeight: 800 }}
          >
            {visible.length}
          </span>
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-1 text-gray-400 hover:text-gray-600 transition-colors"
          style={{ fontSize: "0.75rem", fontWeight: 500 }}
        >
          {collapsed ? "Show" : "Hide"} alerts
          {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </button>
      </div>

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-2 overflow-hidden"
          >
            {visible.map((alert) => {
              const cfg = alertConfig[alert.type] || alertConfig.info;
              const Icon = cfg.icon;
              const timeLabel = alert.time || (alert.created_at ? new Date(alert.created_at).toLocaleDateString() : "");

              return (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10, height: 0 }}
                  className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${cfg.containerClass}`}
                >
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 animate-pulse ${cfg.dotClass}`} />
                  <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${cfg.iconClass}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-md ${cfg.labelClass}`} style={{ fontWeight: 700 }}>
                        {cfg.label}
                      </span>
                      <span className={`${cfg.titleClass}`} style={{ fontWeight: 700, fontSize: "0.825rem" }}>
                        {alert.title}
                      </span>
                    </div>
                    <p className={`mt-0.5 ${cfg.msgClass}`} style={{ fontSize: "0.78rem", lineHeight: 1.5 }}>
                      {alert.message}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-md flex-shrink-0 ${cfg.timeClass}`} style={{ fontWeight: 500 }}>
                    {timeLabel}
                  </span>
                  <button
                    onClick={() => setDismissed([...dismissed, alert.id])}
                    className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center opacity-50 hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

