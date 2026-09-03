export const initialUsers = [
  {
    id: 1, name: "Sarah Johnson", email: "sarah@technova.io", initials: "SJ",
    avatarColor: "bg-indigo-500", plan: "Pro", registeredAt: "Jan 15, 2024",
    resourceUsage: 78, status: "active", company: "TechNova Inc.", country: "USA", lastActive: "2 min ago",
  },
  {
    id: 2, name: "Michael Chen", email: "m.chen@velocity.io", initials: "MC",
    avatarColor: "bg-violet-500", plan: "Enterprise", registeredAt: "Mar 3, 2024",
    resourceUsage: 94, status: "active", company: "Velocity Ventures", country: "Canada", lastActive: "14 min ago",
  },
  {
    id: 3, name: "Aisha Patel", email: "aisha@launchpad.co", initials: "AP",
    avatarColor: "bg-emerald-500", plan: "Free", registeredAt: "Jun 20, 2024",
    resourceUsage: 23, status: "active", company: "Launchpad Co.", country: "UK", lastActive: "1h ago",
  },
  {
    id: 4, name: "David Martinez", email: "d.martinez@corpsys.com", initials: "DM",
    avatarColor: "bg-blue-500", plan: "Pro", registeredAt: "Feb 8, 2024",
    resourceUsage: 56, status: "active", company: "CorpSys", country: "Spain", lastActive: "3h ago",
  },
  {
    id: 5, name: "Emily Watson", email: "e.watson@brightpath.co", initials: "EW",
    avatarColor: "bg-amber-500", plan: "Enterprise", registeredAt: "Nov 1, 2023",
    resourceUsage: 87, status: "active", company: "BrightPath Solutions", country: "Australia", lastActive: "5h ago",
  },
  {
    id: 6, name: "James O'Brien", email: "j.obrien@parallax.media", initials: "JO",
    avatarColor: "bg-rose-500", plan: "Free", registeredAt: "Jul 14, 2024",
    resourceUsage: 12, status: "suspended", company: "Parallax Media", country: "Ireland", lastActive: "2d ago",
  },
  {
    id: 7, name: "Laura Kim", email: "l.kim@designco.studio", initials: "LK",
    avatarColor: "bg-teal-500", plan: "Pro", registeredAt: "Apr 22, 2024",
    resourceUsage: 65, status: "active", company: "DesignCo Studio", country: "South Korea", lastActive: "1d ago",
  },
  {
    id: 8, name: "Robert Lee", email: "r.lee@finedge.com", initials: "RL",
    avatarColor: "bg-cyan-600", plan: "Enterprise", registeredAt: "Dec 10, 2023",
    resourceUsage: 91, status: "active", company: "FinEdge Corp", country: "USA", lastActive: "30 min ago",
  },
  {
    id: 9, name: "Sofia Garcia", email: "s.garcia@creativelab.io", initials: "SG",
    avatarColor: "bg-orange-500", plan: "Free", registeredAt: "Aug 5, 2024",
    resourceUsage: 8, status: "active", company: "CreativeLab MX", country: "Mexico", lastActive: "4h ago",
  },
  {
    id: 10, name: "Alex Thompson", email: "a.thompson@bigcorp.com", initials: "AT",
    avatarColor: "bg-pink-500", plan: "Pro", registeredAt: "May 17, 2024",
    resourceUsage: 44, status: "active", company: "BigCorp Global", country: "USA", lastActive: "6h ago",
  },
];

export const initialTickets = [
  {
    id: "TK-1048", user: "Sarah Johnson", userInitials: "SJ", userAvatarColor: "bg-indigo-500",
    subject: "Cannot access dashboard after latest update", priority: "High", status: "Open",
    time: "2h ago", assignee: "Unassigned",
  },
  {
    id: "TK-1047", user: "Michael Chen", userInitials: "MC", userAvatarColor: "bg-violet-500",
    subject: "Billing discrepancy on Invoice #4521", priority: "Medium", status: "In Progress",
    time: "5h ago", assignee: "Alex (Support)",
  },
  {
    id: "TK-1046", user: "James O'Brien", userInitials: "JO", userAvatarColor: "bg-rose-500",
    subject: "Feature request: CSV data export", priority: "Low", status: "Open",
    time: "1d ago", assignee: "Unassigned",
  },
  {
    id: "TK-1045", user: "Emily Watson", userInitials: "EW", userAvatarColor: "bg-amber-500",
    subject: "API rate limit exceeded on production env", priority: "Critical", status: "Resolved",
    time: "2d ago", assignee: "Maria (DevOps)",
  },
  {
    id: "TK-1044", user: "Sofia Garcia", userInitials: "SG", userAvatarColor: "bg-orange-500",
    subject: "Account activation link not working", priority: "Medium", status: "Open",
    time: "3d ago", assignee: "Unassigned",
  },
  {
    id: "TK-1043", user: "Robert Lee", userInitials: "RL", userAvatarColor: "bg-cyan-600",
    subject: "Multi-entity payroll sync failure", priority: "High", status: "In Progress",
    time: "4d ago", assignee: "Dev Team",
  },
];

export const systemAlerts = [
  {
    id: 1, type: "error",
    title: "Database Timeout Detected",
    message: "US-East cluster experiencing query timeouts — 7 incidents in the last 2 hours. Engineering team notified.",
    time: "10 min ago",
  },
  {
    id: 2, type: "warning",
    title: "5 Enterprise Subscriptions Expiring Soon",
    message: "Subscriptions for TechNova Inc., FinEdge Corp, and 3 others expire within 7 days. Review and contact accounts.",
    time: "Upcoming",
  },
  {
    id: 3, type: "info",
    title: "Scheduled System Maintenance",
    message: "Routine maintenance window scheduled for Sunday, Apr 6 at 02:00 UTC. Estimated downtime: 30 minutes.",
    time: "In 3 days",
  },
];

export const overviewStats = {
  totalUsers: 3248,
  activeSubscriptions: 1892,
  mrr: 148600,
  openTickets: 24,
  userGrowth: "+12.4%",
  subGrowth: "+8.7%",
  mrrGrowth: "+18.2%",
  ticketDelta: "+3",
};

export const userGrowthData = [
  { month: "Oct", users: 2100, revenue: 98000 },
  { month: "Nov", users: 2340, revenue: 108000 },
  { month: "Dec", users: 2520, revenue: 115000 },
  { month: "Jan", users: 2700, revenue: 122000 },
  { month: "Feb", users: 2910, revenue: 132000 },
  { month: "Mar", users: 3080, revenue: 141000 },
  { month: "Apr", users: 3248, revenue: 148600 },
];

export const planDistribution = [
  { plan: "Free", count: 1423, color: "#64748b" },
  { plan: "Pro", count: 1186, color: "#2563eb" },
  { plan: "Enterprise", count: 639, color: "#7c3aed" },
];
