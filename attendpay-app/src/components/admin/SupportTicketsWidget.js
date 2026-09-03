import { MessageSquare, Clock, ArrowLeft } from "lucide-react";
import { motion } from "motion/react";

const priorityStyle = {
  Low: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  Medium: "bg-amber-50 text-amber-700 border border-amber-200",
  High: "bg-red-50 text-red-700 border border-red-200",
  Critical: "bg-red-100 text-red-800 border border-red-300",
};

const priorityDot = {
  Low: "bg-emerald-500",
  Medium: "bg-amber-500",
  High: "bg-red-500",
  Critical: "bg-red-700",
};

const statusStyle = {
  Open: "bg-blue-50 text-blue-700 border border-blue-200",
  "In Progress": "bg-orange-50 text-orange-700 border border-orange-200",
  Resolved: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  Closed: "bg-gray-100 text-gray-600 border border-gray-200",
};

export function SupportTicketsWidget({ tickets = [], stats, loading = false, onViewAll }) {
  const openCount = stats?.open ?? tickets.filter((t) => t.status === "Open").length;
  const inProgressCount = stats?.inProgress ?? tickets.filter((t) => t.status === "In Progress").length;
  const criticalCount = stats?.critical ?? tickets.filter((t) => t.priority === "Critical").length;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden" style={{ textAlign: "right" }}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
            <MessageSquare className="w-4.5 h-4.5 text-blue-600" />
          </div>
          <div style={{ textAlign: "right" }}>
            <h2 className="text-gray-900" style={{ fontWeight: 700, fontSize: "1rem" }}>Support Tickets Overview</h2>
            <p className="text-gray-400" style={{ fontSize: "0.75rem" }}>Recent activity snapshot</p>
          </div>
        </div>
        <button
          onClick={onViewAll}
          className="flex items-center gap-1 text-blue-600 hover:text-blue-800 transition-colors text-sm"
          style={{ fontWeight: 600 }}
        >
          View All <ArrowLeft className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-px bg-gray-100 border-b border-gray-100">
        {[
          { label: "Open", value: openCount, color: "text-blue-600", bg: "bg-white" },
          { label: "In Progress", value: inProgressCount, color: "text-orange-600", bg: "bg-white" },
          { label: "Critical", value: criticalCount, color: "text-red-600", bg: "bg-white" },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`${bg} px-4 py-3 text-center`}>
            <div className={`${color}`} style={{ fontWeight: 800, fontSize: "1.5rem" }}>{loading ? "—" : value}</div>
            <div className="text-gray-400" style={{ fontSize: "0.72rem", fontWeight: 500 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Tickets list */}
      <div className="divide-y divide-gray-50">
        {loading && (
          <div className="px-6 py-8">
            {[0, 1, 2].map((idx) => (
              <div key={idx} className="h-12 bg-gray-100 rounded-lg mb-3 animate-pulse" />
            ))}
          </div>
        )}

        {!loading && tickets.length === 0 && (
          <div className="px-6 py-12 text-center text-gray-400" style={{ fontSize: "0.85rem" }}>
            No tickets found.
          </div>
        )}

        {!loading && tickets.map((ticket, idx) => {
          const companyName = ticket.companies?.name || "Unknown Company";
          const initials = companyName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
          const timeLabel = ticket.created_at ? new Date(ticket.created_at).toLocaleDateString() : "";

          return (
            <motion.div
              key={ticket.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.06 }}
              onClick={onViewAll}
              className="flex items-center gap-4 px-6 py-4 hover:bg-blue-50/40 hover:pl-8 transition-all cursor-pointer group relative"
            >
              {/* Avatar fallback */}
              <div className="w-9 h-9 rounded-full bg-slate-500 group-hover:bg-blue-600 transition-colors flex items-center justify-center flex-shrink-0 shadow-sm">
                <span className="text-white" style={{ fontWeight: 700, fontSize: "0.65rem" }}>{initials}</span>
              </div>

              {/* Main info */}
              <div className="flex-1 min-w-0" style={{ textAlign: "right" }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-gray-500" style={{ fontSize: "0.7rem", fontWeight: 700 }}>#{ticket.id.toString().slice(0, 8)}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1.5 ${priorityStyle[ticket.priority] || priorityStyle.Medium}`} style={{ fontWeight: 700 }}>
                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${priorityDot[ticket.priority] || priorityDot.Medium} ${ticket.priority === 'Critical' ? 'animate-pulse ring-2 ring-red-400 ring-offset-1' : ''}`} />
                    {ticket.priority}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-900 truncate" style={{ fontWeight: 600, fontSize: "0.85rem" }}>{ticket.subject}</span>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-gray-400" style={{ fontSize: "0.72rem" }}>
                    <span style={{ fontWeight: 600 }}>{companyName}</span>
                  </span>
                  {ticket.assignee && ticket.assignee !== "Unassigned" && (
                    <span className="text-gray-400" style={{ fontSize: "0.7rem" }}>â†گ {ticket.assignee}</span>
                  )}
                </div>
              </div>

              {/* Right side */}
              <div className="flex-shrink-0 text-left">
                <span className={`text-xs px-2.5 py-1 rounded-full ${statusStyle[ticket.status] || statusStyle.Open}`} style={{ fontWeight: 700 }}>
                  {ticket.status}
                </span>
                <div className="flex items-center justify-end gap-1 mt-1.5 text-gray-400">
                  <span style={{ fontSize: "0.68rem" }}>{timeLabel}</span>
                  <Clock className="w-3 h-3" />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

