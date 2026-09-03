import {
  Users, CreditCard, DollarSign, LifeBuoy, TrendingUp,
  ArrowUpRight, Activity, Globe,
} from "lucide-react";
import { motion } from "motion/react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";

const DEFAULT_STATS = {
  totalUsers: 0,
  activeSubscriptions: 0,
  mrr: 0,
  openTickets: 0,
};

export function OverviewView({
  onViewChange,
  stats,
  users,
  planDistribution,
  growthData,
  activity,
  expiringCount,
  loading,
  onShowExpiringUsers,
}) {
  if (loading) {
    return (
      <div className="space-y-6" style={{ textAlign: "right" }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {[0, 1, 2, 3].map((idx) => (
            <div key={idx} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm animate-pulse">
              <div className="h-10 w-10 rounded-xl bg-gray-100 mb-4" />
              <div className="h-6 w-24 bg-gray-100 rounded mb-2" />
              <div className="h-4 w-32 bg-gray-100 rounded" />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5 animate-pulse">
            <div className="h-4 w-40 bg-gray-100 rounded mb-3" />
            <div className="h-48 bg-gray-100 rounded" />
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 animate-pulse">
            <div className="h-4 w-32 bg-gray-100 rounded mb-3" />
            <div className="h-36 bg-gray-100 rounded" />
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 animate-pulse">
            <div className="h-4 w-32 bg-gray-100 rounded mb-3" />
            <div className="space-y-3">
              {[0, 1, 2].map((idx) => (
                <div key={idx} className="h-6 bg-gray-100 rounded" />
              ))}
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 animate-pulse">
            <div className="h-4 w-32 bg-gray-100 rounded mb-3" />
            <div className="grid grid-cols-2 gap-3">
              {[0, 1, 2, 3].map((idx) => (
                <div key={idx} className="h-16 bg-gray-100 rounded" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const displayStats = stats || DEFAULT_STATS;
  const usersList = users || [];
  const statsCards = [
    {
      label: "Total Users",
      value: displayStats.totalUsers.toLocaleString(),
      delta: "+12%",
      icon: Users,
    },
    {
      label: "Active Subscriptions",
      value: displayStats.activeSubscriptions.toLocaleString(),
      delta: "+5%",
      icon: CreditCard,
    },
    {
      label: "Monthly Revenue",
      value: `${displayStats.mrr.toLocaleString()} ج.م`,
      delta: "+18%",
      icon: DollarSign,
    },
    {
      label: "Open Tickets",
      value: displayStats.openTickets.toString(),
      delta: "-2%",
      icon: LifeBuoy,
    },
  ];

  const derivedPlanDist = [
    { plan: "Free", count: usersList.filter((u) => u.plan === "Free").length, color: "#64748b" },
    { plan: "Pro", count: usersList.filter((u) => u.plan === "Pro").length, color: "#2563eb" },
    { plan: "Enterprise", count: usersList.filter((u) => u.plan === "Enterprise").length, color: "#7c3aed" },
  ];

  const dynamicPlanDist = planDistribution && planDistribution.length > 0 ? planDistribution : derivedPlanDist;
  const totalPossible = displayStats.totalUsers || dynamicPlanDist.reduce((sum, item) => sum + item.count, 0);
  const chartData = growthData && growthData.length > 0 ? growthData : [];
  const activityList = activity || [];

  return (
    <div className="space-y-6" style={{ textAlign: "right" }}>
      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {statsCards.map((s, i) => {
          const Icon = s.icon;
          const isPositive = s.delta.startsWith("+");
          return (
            <div
              key={s.label}
              className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-gray-500 tracking-tight" style={{ fontSize: "0.85rem", fontWeight: 600 }}>{s.label}</span>
                <Icon className="w-4 h-4 text-gray-400" />
              </div>
              <div className="flex items-baseline gap-3">
                <div className="text-gray-900 tracking-tight" style={{ fontWeight: 700, fontSize: "1.75rem", lineHeight: 1 }}>{s.value}</div>
                <span className={`flex items-center gap-1 ${isPositive ? 'text-emerald-600' : 'text-gray-500'}`} style={{ fontSize: "0.75rem", fontWeight: 600 }}>
                  {s.delta}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Area Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="xl:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-gray-900 tracking-tight" style={{ fontWeight: 700, fontSize: "0.95rem" }}>Growth & Revenue</h3>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" /> Users</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-violet-500 inline-block" /> Revenue</span>
            </div>
          </div>
          {chartData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-400" style={{ fontSize: "0.85rem" }}>
              No growth data available yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="userGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 4px 20px rgba(0,0,0,0.08)", fontSize: "0.8rem", textAlign: "right" }}
                />
                <Area type="monotone" dataKey="users" stroke="#2563eb" strokeWidth={2} fill="url(#userGrad)" />
                <Area type="monotone" dataKey="revenue" stroke="#7c3aed" strokeWidth={2} fill="url(#revGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* Plan Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="bg-white rounded-xl border border-gray-200 shadow-sm p-6"
        >
          <div className="mb-6">
            <h3 className="text-gray-900 tracking-tight" style={{ fontWeight: 700, fontSize: "0.95rem" }}>Plan Distribution</h3>
          </div>
          <div className="flex justify-center mb-4">
            <PieChart width={140} height={140}>
              <Pie data={dynamicPlanDist} cx={65} cy={65} innerRadius={45} outerRadius={65} dataKey="count" paddingAngle={3}>
                {dynamicPlanDist.map((entry) => (
                  <Cell key={entry.plan} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </div>
          <div className="space-y-2.5">
            {dynamicPlanDist.map((p) => (
              <div key={p.plan} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ background: p.color }} />
                  <span className="text-gray-600" style={{ fontSize: "0.8rem", fontWeight: 500 }}>{p.plan}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-900" style={{ fontSize: "0.8rem", fontWeight: 700 }}>{p.count.toLocaleString()}</span>
                  <span className="text-gray-400" style={{ fontSize: "0.7rem" }}>
                    ({totalPossible > 0 ? Math.round((p.count / totalPossible) * 100) : 0}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
          className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h3 className="text-gray-900 tracking-tight" style={{ fontWeight: 700, fontSize: "0.95rem" }}>Recent Activity</h3>
            <button className="text-gray-500 hover:text-gray-900 text-xs transition-colors" style={{ fontWeight: 600 }}>
              View log
            </button>
          </div>
          <div className="divide-y divide-gray-100">
            {activityList.length === 0 ? (
              <div className="px-5 py-8 text-center text-gray-400" style={{ fontSize: "0.82rem" }}>
                No activity available.
              </div>
            ) : (
              activityList.map((item) => (
                <div key={item.id} className="flex items-center gap-3 px-6 py-3.5 hover:bg-gray-50 transition-colors group cursor-pointer">
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-gray-300 group-hover:bg-gray-900 transition-colors duration-300" />
                  <div className="flex-1 min-w-0">
                    <span className="text-gray-900" style={{ fontSize: "0.825rem", fontWeight: 600 }}>{item.event}</span>
                    <span className="text-gray-500 mx-2" style={{ fontSize: "0.825rem" }}>{item.user}</span>
                  </div>
                  <span className="text-gray-400 flex-shrink-0" style={{ fontSize: "0.75rem", fontWeight: 500 }}>
                    {item.time ? new Date(item.time).toLocaleDateString() : ""}
                  </span>
                </div>
              ))
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.55 }}
          className="bg-white rounded-xl border border-gray-200 shadow-sm p-6"
        >
          <div className="flex items-center gap-2 mb-6">
            <h3 className="text-gray-900 tracking-tight" style={{ fontWeight: 700, fontSize: "0.95rem" }}>Quick Actions</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Manage Users", icon: Users, view: "users" },
              { label: "Support Tickets", icon: LifeBuoy, view: "tickets" },
              { label: "Subscriptions", icon: CreditCard, view: "plans" },
              { label: "System Settings", icon: Globe, view: "settings" },
            ].map(({ label, icon: Icon, view }) => (
              <button
                key={label}
                onClick={() => onViewChange(view)}
                className="flex flex-col items-center justify-center gap-3 p-5 rounded-xl border border-gray-200 hover:border-gray-900 hover:bg-gray-50 transition-all text-center group"
              >
                <Icon className="w-5 h-5 text-gray-500 group-hover:text-gray-900 transition-colors" />
                <span className="text-gray-700 group-hover:text-gray-900" style={{ fontSize: "0.8rem", fontWeight: 600 }}>{label}</span>
              </button>
            ))}
          </div>

          {typeof expiringCount === "number" && expiringCount > 0 && (
            <motion.div 
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={onShowExpiringUsers}
              className="mt-4 flex items-start gap-3 p-3.5 rounded-xl bg-amber-50 border border-amber-100 hover:bg-amber-100/70 hover:border-amber-200 transition-all cursor-pointer shadow-sm"
            >
              <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 animate-pulse flex-shrink-0" />
              <div>
                <div className="text-amber-800" style={{ fontWeight: 700, fontSize: "0.8rem" }}>
                  {expiringCount} Subscriptions Expiring Soon
                </div>
                <div className="text-amber-600" style={{ fontSize: "0.72rem", marginTop: "2px" }}>
                  Review and reach out to account owners before renewal deadline.
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

