import { useState, useEffect, useCallback, useRef } from "react";
import { Toaster, toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { AdminSidebar } from "../components/admin/AdminSidebar";
import { AdminHeader } from "../components/admin/AdminHeader";
import { AlertBanner } from "../components/admin/AlertBanner";
import { UserManagementTable } from "../components/admin/UserManagementTable";
import { SupportTicketsWidget } from "../components/admin/SupportTicketsWidget";
import { OverviewView } from "../components/admin/OverviewView";
import {
  SubscriptionPlansView,
  SupportTicketsView,
  SystemSettingsView,
  DevicesDiagnosticsView,
  RenewalRequestsView,
  BroadcastAlertsView,
} from "../components/admin/OtherViews";
import { ResellersView } from "../components/admin/ResellersView";
import { NotificationsCenterView } from "../components/admin/NotificationsCenterView";
import { PaymentRequestsView } from "../components/admin/PaymentRequestsView";
import { supabase } from "../supabaseClient";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "../context/AuthContext";
import { useLocale } from "../context/LocaleContext";

const PLAN_PRICING = {
  Free: 0,
  Pro: 79,
  Enterprise: 199,
};

const PLAN_COLORS = {
  Free: "var(--obs-on-surface-variant)",
  Pro: "var(--obs-primary)",
  Enterprise: "var(--obs-secondary)",
};

const DEFAULT_STATS = {
  totalUsers: 0,
  activeSubscriptions: 0,
  mrr: 0,
  openTickets: 0,
};

const DEFAULT_PLAN_STATS = {
  Free: { users: 0, revenue: 0 },
  Pro: { users: 0, revenue: 0 },
  Enterprise: { users: 0, revenue: 0 },
};

const DEFAULT_TICKET_STATS = {
  total: 0,
  open: 0,
  inProgress: 0,
  critical: 0,
};

const DEFAULT_USER_QUERY = {
  page: 1,
  pageSize: 7,
  search: "",
  plan: "All",
  status: "all",
  sortField: "name",
  sortDir: "asc",
};

const DEFAULT_TICKET_QUERY = {
  page: 1,
  pageSize: 7,
  search: "",
  status: "All",
  priority: "All",
  sortField: "created_at",
  sortDir: "desc",
};

export default function SuperAdminDashboard() {
  const { user, isSuperAdmin, loading: authLoading, impersonateCompany } = useAuth();
  const { t } = useLocale();
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState("overview");

  const [initialLoading, setInitialLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(true);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [alertsLoading, setAlertsLoading] = useState(true);

  const [error, setError] = useState(null);

  const [userQuery, setUserQuery] = useState(DEFAULT_USER_QUERY);
  const [ticketQuery, setTicketQuery] = useState(DEFAULT_TICKET_QUERY);
  const [renewalsLoading, setRenewalsLoading] = useState(true);
  const [renewalQuery, setRenewalQuery] = useState({ page: 1, pageSize: 7, status: "All" });
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [payments, setPayments] = useState([]);
  const [paymentsTotal, setPaymentsTotal] = useState(0);
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('pending');
  const [paymentConfig, setPaymentConfig] = useState({});
  const [savingConfig, setSavingConfig] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [readNotifIds, setReadNotifIds] = useState([]);
  const [deletedNotifIds, setDeletedNotifIds] = useState([]);
  const initialSyncRef = useRef(false);

  // Sync initial notification states from DB user metadata and local storage
  useEffect(() => {
    if (user && !initialSyncRef.current) {
      const metaRead = user.user_metadata?.sa_read_notifications || [];
      const metaDeleted = user.user_metadata?.sa_deleted_notifications || [];
      
      let localRead = [];
      let localDel = [];
      try {
        localRead = JSON.parse(localStorage.getItem("sa_read_notifications") || "[]");
        localDel = JSON.parse(localStorage.getItem("sa_deleted_notifications") || "[]");
      } catch {}

      const mergedRead = Array.from(new Set([...metaRead, ...localRead]));
      const mergedDel = Array.from(new Set([...metaDeleted, ...localDel]));

      setReadNotifIds(mergedRead);
      setDeletedNotifIds(mergedDel);
      initialSyncRef.current = true;
    }
  }, [user]);

  // Persist states to local storage and DB metadata on updates
  useEffect(() => {
    if (!initialSyncRef.current) return;
    localStorage.setItem("sa_read_notifications", JSON.stringify(readNotifIds));
    localStorage.setItem("sa_deleted_notifications", JSON.stringify(deletedNotifIds));
    
    const saveToDb = async () => {
      try {
        await supabase.auth.updateUser({
          data: {
            sa_read_notifications: readNotifIds,
            sa_deleted_notifications: deletedNotifIds
          }
        });
      } catch (err) {
        console.error("Error saving notifications state to user metadata:", err);
      }
    };
    saveToDb();
  }, [readNotifIds, deletedNotifIds]);

  const [dashboardData, setDashboardData] = useState({
    users: [],
    usersTotal: 0,
    tickets: [],
    ticketsTotal: 0,
    renewals: [],
    renewalsTotal: 0,
    stats: DEFAULT_STATS,
    planStats: DEFAULT_PLAN_STATS,
    planDistribution: [],
    growthData: [],
    alerts: [],
    activity: [],
    ticketStats: DEFAULT_TICKET_STATS,
    expiringCount: null,
    pendingRenewalsCount: 0,
    pendingPaymentsCount: 0,
  });

  const isMounted = useRef(true);
  const initialLoadRef = useRef(true);
  const refreshTimers = useRef({});

  useEffect(() => {
    return () => {
      isMounted.current = false;
      // eslint-disable-next-line react-hooks/exhaustive-deps
      Object.values(refreshTimers.current).forEach((timer) => clearTimeout(timer));
    };
  }, []);

  const isMissingTableError = (err) => {
    if (!err) return false;
    const message = (err.message || "").toLowerCase();
    return err.code === "42P01"
      || message.includes("relation")
      || message.includes("does not exist")
      || message.includes("schema cache")
      || message.includes("could not find the table");
  };

  const formatDate = (value) => {
    if (!value) return "—";
    try {
      return new Date(value).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "—";
    }
  };

  const formatDateTime = useCallback((value) => {
    if (!value) return t.saNeverLogin;
    try {
      const d = new Date(value);
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) + 
             " " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return t.saNeverLogin;
    }
  }, [t]);

  const makeInitials = (name) => {
    if (!name) return "??";
    return name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  const getValidatedSession = useCallback(async () => {
    if (!user || !isSuperAdmin) {
      throw new Error("Unauthorized");
    }
    const { data, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!data?.session?.access_token) {
      throw new Error("Authentication required");
    }
    return data.session;
  }, [user, isSuperAdmin]);

  const handleError = useCallback((title, err) => {
    console.error(title, err);
    if (!isMounted.current) return;
    setError({
      title,
      message: err?.message || "Unexpected error while loading data.",
    });
  }, []);

  const fetchUsersPage = useCallback(async (options = { silent: false }) => {
    if (!user || !isSuperAdmin || authLoading) return;

    if (!options.silent) setUsersLoading(true);

    try {
      await getValidatedSession();

      const { page, pageSize, search, plan, status, sortField, sortDir } = userQuery;
      const sortMap = {
        name: "name",
        plan: "plan",
        registeredAt: "created_at",
        status: "status",
      };
      const orderField = sortMap[sortField] || "created_at";

      let query = supabase
        .from("companies")
        .select("id, name, plan, status, created_at, settings, owner_id", { count: "exact" });

      if (search) query = query.ilike("name", `%${search}%`);
      if (plan && plan !== "All") query = query.eq("plan", plan);
      if (status && status !== "all") {
        if (status === "expiring") {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() + 7);
          query = query.lte("subscription_expires_at", cutoff.toISOString());
        } else {
          query = query.eq("status", status);
        }
      }

      query = query.order(orderField, { ascending: sortDir === "asc" });

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error: queryError, count } = await query.range(from, to);
      if (queryError) throw queryError;

      const companyIds = (data || []).map(c => c.id);

      // Fetch sub-users / company_users for these companies
      let companyUsersMap = {};
      let teamUserIds = [];
      if (companyIds.length > 0) {
        const { data: cuData } = await supabase
          .from('company_users')
          .select('id, company_id, user_id, role, permissions')
          .in('company_id', companyIds);
        
        if (cuData) {
          cuData.forEach(cu => {
            if (!companyUsersMap[cu.company_id]) {
              companyUsersMap[cu.company_id] = [];
            }
            companyUsersMap[cu.company_id].push(cu);
            teamUserIds.push(cu.user_id);
          });
        }
      }

      const ownerIds = (data || []).map(c => c.owner_id).filter(Boolean);
      const allUserIds = Array.from(new Set([...ownerIds, ...teamUserIds]));

      let authMap = {};
      if (allUserIds.length > 0) {
        const { data: authData } = await supabase.rpc('get_auth_users_info', { user_ids: allUserIds });
        if (authData) {
          authData.forEach(ad => { authMap[ad.id] = ad; });
        }
      }

      const formattedUsers = (data || []).map((company) => {
        const authUser = authMap[company.owner_id] || {};
        
        // Map the sub-users for this company
        const rawSubUsers = companyUsersMap[company.id] || [];
        const teamMembers = rawSubUsers.map(su => {
          const authSu = authMap[su.user_id] || {};
          return {
            id: su.id,
            userId: su.user_id,
            role: su.role,
            permissions: su.permissions,
            email: authSu.email || "—",
            name: authSu.raw_user_meta_data?.full_name || authSu.raw_user_meta_data?.name || "—",
            lastActive: authSu.last_sign_in_at ? formatDateTime(authSu.last_sign_in_at) : t.saNeverLogin
          };
        });

        return {
          id: company.id,
          name: company.name || "Unnamed",
          email: authUser.email ||
            company.settings?.email ||
            company.settings?.owner_email ||
            company.email ||
            company.owner_email ||
            "—",
          initials: makeInitials(company.name),
          avatarColor: "var(--obs-primary)",
          plan: company.plan || "Free",
          registeredAt: formatDate(company.created_at),
          resourceUsage: 0,
          status: (company.status || "active").toString().trim().toLowerCase(),
          company: company.name || "—",
          country: company.settings?.country || "—",
          lastActive: authUser.last_sign_in_at ? formatDateTime(authUser.last_sign_in_at) : t.saNeverLogin,
          subscription_amount: company.subscription_amount || 0,
          subscription_expires_at: company.subscription_expires_at || company.settings?.trial_end_date || null,
          teamMembers: teamMembers,
        };
      });

      if (!isMounted.current) return;
      setDashboardData((prev) => ({
        ...prev,
        users: formattedUsers,
        usersTotal: count ?? formattedUsers.length,
      }));
    } catch (err) {
      handleError("Failed to load users", err);
    } finally {
      if (isMounted.current && !options.silent) setUsersLoading(false);
    }
  }, [authLoading, formatDateTime, getValidatedSession, handleError, isSuperAdmin, t, user, userQuery]);

  const fetchTicketsPage = useCallback(async (options = { silent: false }) => {
    if (!user || !isSuperAdmin || authLoading) return;

    if (!options.silent) setTicketsLoading(true);

    try {
      await getValidatedSession();

      const { page, pageSize, search, status, priority } = ticketQuery;

      let query = supabase
        .from("support_tickets")
        .select("id, subject, priority, status, created_at, assignee, companies(name)", { count: "exact" });

      if (search) query = query.ilike("subject", `%${search}%`);
      if (status && status !== "All") query = query.eq("status", status);
      if (priority && priority !== "All") query = query.eq("priority", priority);

      query = query.order("created_at", { ascending: false });

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error: queryError, count } = await query.range(from, to);
      if (queryError) {
        if (isMissingTableError(queryError)) {
          if (!isMounted.current) return;
          setDashboardData((prev) => ({
            ...prev,
            tickets: [],
            ticketsTotal: 0,
          }));
          return;
        }
        throw queryError;
      }

      if (!isMounted.current) return;
      setDashboardData((prev) => ({
        ...prev,
        tickets: data || [],
        ticketsTotal: count ?? (data || []).length,
      }));
    } catch (err) {
      handleError("Failed to load tickets", err);
    } finally {
      if (isMounted.current && !options.silent) setTicketsLoading(false);
    }
  }, [authLoading, getValidatedSession, handleError, isSuperAdmin, ticketQuery, user]);

  const fetchGrowthData = useCallback(async () => {
    const endDate = new Date();
    const startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 6, 1);

    const { data, error: queryError } = await supabase
      .from("companies")
      .select("created_at, plan")
      .gte("created_at", startDate.toISOString());

    if (queryError) throw queryError;

    const monthlyBuckets = {};
    const monthLabels = [];

    for (let i = 6; i >= 0; i -= 1) {
      const date = new Date(endDate.getFullYear(), endDate.getMonth() - i, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      monthlyBuckets[key] = [];
      monthLabels.push({
        key,
        label: date.toLocaleDateString("en-US", { month: "short" }),
      });
    }

    (data || []).forEach((row) => {
      if (!row.created_at) return;
      const date = new Date(row.created_at);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (!monthlyBuckets[key]) return;
      monthlyBuckets[key].push(row.plan || "Free");
    });

    const cumulative = { Free: 0, Pro: 0, Enterprise: 0 };
    const results = [];

    monthLabels.forEach(({ key, label }) => {
      const plans = monthlyBuckets[key] || [];
      plans.forEach((plan) => {
        if (cumulative[plan] !== undefined) cumulative[plan] += 1;
        else cumulative.Free += 1;
      });

      const totalUsers = cumulative.Free + cumulative.Pro + cumulative.Enterprise;
      const revenue = cumulative.Pro * PLAN_PRICING.Pro + cumulative.Enterprise * PLAN_PRICING.Enterprise;

      results.push({
        month: label,
        users: totalUsers,
        revenue,
      });
    });

    return results;
  }, []);

  const fetchTicketStats = useCallback(async () => {
    try {
      const [totalRes, openRes, inProgressRes, criticalRes] = await Promise.all([
        supabase.from("support_tickets").select("id", { count: "exact", head: true }),
        supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "Open"),
        supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "In Progress"),
        supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("priority", "Critical"),
      ]);

      if (totalRes.error || openRes.error || inProgressRes.error || criticalRes.error) {
        const err = totalRes.error || openRes.error || inProgressRes.error || criticalRes.error;
        if (isMissingTableError(err)) {
          return DEFAULT_TICKET_STATS;
        }
        throw err;
      }

      return {
        total: totalRes.count ?? 0,
        open: openRes.count ?? 0,
        inProgress: inProgressRes.count ?? 0,
        critical: criticalRes.count ?? 0,
      };
    } catch (err) {
      if (isMissingTableError(err)) return DEFAULT_TICKET_STATS;
      throw err;
    }
  }, []);

  const fetchExpiringCount = useCallback(async () => {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() + 7);

      const { count, error: queryError } = await supabase
        .from("companies")
        .select("id", { count: "exact", head: true })
        .lte("subscription_expires_at", cutoff.toISOString());

      if (queryError) {
        if (isMissingTableError(queryError)) return null;
        return null;
      }

      return count ?? 0;
    } catch {
      return null;
    }
  }, []);

  const fetchOverviewData = useCallback(async (options = { silent: false }) => {
    if (!user || !isSuperAdmin || authLoading) return;

    if (!options.silent) setOverviewLoading(true);

    try {
      await getValidatedSession();

      const [
        totalUsersRes,
        freeRes,
        proRes,
        enterpriseRes,
        openTicketsRes,
        growthData,
        ticketStats,
        expiringCount,
        pendingRenewalsRes,
      ] = await Promise.all([
        supabase.from("companies").select("id", { count: "exact", head: true }),
        supabase.from("companies").select("id", { count: "exact", head: true }).eq("plan", "Free"),
        supabase.from("companies").select("id", { count: "exact", head: true }).eq("plan", "Pro"),
        supabase.from("companies").select("id", { count: "exact", head: true }).eq("plan", "Enterprise"),
        supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "Open"),
        fetchGrowthData(),
        fetchTicketStats(),
        fetchExpiringCount(),
        supabase.from("renewal_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
      ]);

      const companyError = totalUsersRes.error || freeRes.error || proRes.error || enterpriseRes.error;
      if (companyError) throw companyError;

      if (openTicketsRes.error && !isMissingTableError(openTicketsRes.error)) {
        throw openTicketsRes.error;
      }

      const totalUsers = totalUsersRes.count ?? 0;
      const freeCount = freeRes.count ?? 0;
      const proCount = proRes.count ?? 0;
      const enterpriseCount = enterpriseRes.count ?? 0;
      const activeSubscriptions = proCount + enterpriseCount;
      const mrr = proCount * PLAN_PRICING.Pro + enterpriseCount * PLAN_PRICING.Enterprise;
      const openTickets = isMissingTableError(openTicketsRes.error) ? 0 : openTicketsRes.count ?? 0;
      const pendingRenewalsCount = pendingRenewalsRes.error ? 0 : pendingRenewalsRes.count ?? 0;

      const planStats = {
        Free: { users: freeCount, revenue: 0 },
        Pro: { users: proCount, revenue: proCount * PLAN_PRICING.Pro },
        Enterprise: { users: enterpriseCount, revenue: enterpriseCount * PLAN_PRICING.Enterprise },
      };

      const planDistribution = [
        { plan: "Free", count: freeCount, color: PLAN_COLORS.Free },
        { plan: "Pro", count: proCount, color: PLAN_COLORS.Pro },
        { plan: "Enterprise", count: enterpriseCount, color: PLAN_COLORS.Enterprise },
      ];

      if (!isMounted.current) return;

      setDashboardData((prev) => ({
        ...prev,
        stats: {
          totalUsers,
          activeSubscriptions,
          mrr,
          openTickets,
        },
        planStats,
        planDistribution,
        growthData,
        ticketStats: ticketStats || DEFAULT_TICKET_STATS,
        expiringCount,
        pendingRenewalsCount,
      }));
    } catch (err) {
      handleError("Failed to load overview stats", err);
    } finally {
      if (isMounted.current && !options.silent) setOverviewLoading(false);
    }
  }, [authLoading, fetchExpiringCount, fetchGrowthData, fetchTicketStats, getValidatedSession, handleError, isSuperAdmin, user]);

  const fetchAlerts = useCallback(async (options = { silent: false }) => {
    if (!user || !isSuperAdmin || authLoading) return;

    if (!options.silent) setAlertsLoading(true);

    try {
      await getValidatedSession();

      const { data, error: queryError } = await supabase
        .from("system_alerts")
        .select("id, type, title, message, created_at")
        .order("created_at", { ascending: false })
        .limit(5);

      if (queryError) {
        if (isMissingTableError(queryError)) {
          if (!isMounted.current) return;
          setDashboardData((prev) => ({ ...prev, alerts: [] }));
          return;
        }
        throw queryError;
      }

      if (!isMounted.current) return;
      setDashboardData((prev) => ({
        ...prev,
        alerts: data || [],
      }));
    } catch (err) {
      handleError("Failed to load alerts", err);
    } finally {
      if (isMounted.current && !options.silent) setAlertsLoading(false);
    }
  }, [authLoading, getValidatedSession, handleError, isSuperAdmin, user]);

  const fetchActivity = useCallback(async (options = { silent: false }) => {
    if (!user || !isSuperAdmin || authLoading) return;

    try {
      await getValidatedSession();

      const { data, error: queryError } = await supabase
        .from("admin_activity")
        .select("id, event, action, description, actor, created_at")
        .order("created_at", { ascending: false })
        .limit(5);

      if (queryError) {
        if (isMissingTableError(queryError)) {
          if (!isMounted.current) return;
          setDashboardData((prev) => ({ ...prev, activity: [] }));
          return;
        }
        throw queryError;
      }

      const normalized = (data || []).map((item) => ({
        id: item.id,
        event: item.event || item.action || item.description || "Activity",
        user: item.actor || "System",
        time: item.created_at,
      }));

      if (!isMounted.current) return;
      setDashboardData((prev) => ({
        ...prev,
        activity: normalized,
      }));
    } catch (err) {
      handleError("Failed to load activity", err);
    }
  }, [authLoading, getValidatedSession, handleError, isSuperAdmin, user]);

  const fetchNotifications = useCallback(async () => {
    if (!user || !isSuperAdmin || authLoading) return;

    try {
      await getValidatedSession();

      const formatRelativeTime = (dateStr) => {
        if (!dateStr) return "";
        try {
          const now = new Date();
          const date = new Date(dateStr);
          const diffMs = now - date;
          const diffMins = Math.floor(diffMs / 60000);
          const diffHours = Math.floor(diffMins / 60);
          const diffDays = Math.floor(diffHours / 24);

          if (diffMins < 1) return t.saJustNow || "Just now";
          if (diffMins < 60) return `${diffMins}m ago`;
          if (diffHours < 24) return `${diffHours}h ago`;
          return `${diffDays}d ago`;
        } catch {
          return "";
        }
      };

      // 1. Fetch recent support tickets
      const { data: ticketNotifs, error: ticketErr } = await supabase
        .from("support_tickets")
        .select("id, subject, priority, created_at, status")
        .order("created_at", { ascending: false })
        .limit(20);

      // 2. Fetch recent registered companies
      const { data: companyNotifs, error: companyErr } = await supabase
        .from("companies")
        .select("id, name, created_at")
        .order("created_at", { ascending: false })
        .limit(20);

      // 3. Fetch expiring subscriptions soon (within 7 days)
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() + 7);
      const { data: expiringNotifs, error: expiringErr } = await supabase
        .from("companies")
        .select("id, name, subscription_expires_at")
        .lte("subscription_expires_at", cutoff.toISOString())
        .gte("subscription_expires_at", new Date().toISOString())
        .limit(10);

      const items = [];

      if (!ticketErr && ticketNotifs) {
        ticketNotifs.forEach((t) => {
          const id = `ticket-${t.id}`;
          if (deletedNotifIds.includes(id)) return;
          items.push({
            id,
            type: t.priority === "Critical" || t.priority === "High" ? "error" : "info",
            message: `New support ticket: "${t.subject}"`,
            time: formatRelativeTime(t.created_at),
            unread: t.status === "Open" && !readNotifIds.includes(id),
            rawTime: t.created_at,
          });
        });
      }

      if (!companyErr && companyNotifs) {
        companyNotifs.forEach((c) => {
          const id = `company-${c.id}`;
          if (deletedNotifIds.includes(id)) return;
          items.push({
            id,
            type: "success",
            message: `New company registered: "${c.name}"`,
            time: formatRelativeTime(c.created_at),
            unread: !readNotifIds.includes(id),
            rawTime: c.created_at,
          });
        });
      }

      if (!expiringErr && expiringNotifs) {
        expiringNotifs.forEach((ec) => {
          const id = `expiring-${ec.id}`;
          if (deletedNotifIds.includes(id)) return;
          items.push({
            id,
            type: "warning",
            message: `Subscription expiring soon: "${ec.name}"`,
            time: formatRelativeTime(ec.subscription_expires_at),
            unread: !readNotifIds.includes(id),
            rawTime: ec.subscription_expires_at,
          });
        });
      }

      // Sort all items by rawTime descending
      items.sort((a, b) => new Date(b.rawTime) - new Date(a.rawTime));

      if (!isMounted.current) return;
      setNotifications(items);
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    }
  }, [authLoading, getValidatedSession, isSuperAdmin, user, readNotifIds, deletedNotifIds, t]);

  const fetchRenewalsPage = useCallback(async (options = { silent: false }) => {
    if (!user || !isSuperAdmin || authLoading) return;

    if (!options.silent) setRenewalsLoading(true);

    try {
      await getValidatedSession();

      const { page, pageSize, status } = renewalQuery;

      let query = supabase
        .from("renewal_requests")
        .select("id, status, requested_at, details, company_id, companies(name, plan, settings)", { count: "exact" });

      if (status && status !== "All") {
        query = query.eq("status", status.toLowerCase());
      }

      query = query.order("requested_at", { ascending: false });

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error: queryError, count } = await query.range(from, to);
      if (queryError) throw queryError;

      if (!isMounted.current) return;
      setDashboardData((prev) => ({
        ...prev,
        renewals: data || [],
        renewalsTotal: count ?? (data || []).length,
      }));
    } catch (err) {
      handleError("Failed to load renewal requests", err);
    } finally {
      if (isMounted.current && !options.silent) setRenewalsLoading(false);
    }
  }, [authLoading, getValidatedSession, handleError, isSuperAdmin, renewalQuery, user]);

  // ── Payment Requests ──────────────────────────────────────────────────────
  const fetchPayments = useCallback(async () => {
    if (!user || !isSuperAdmin || authLoading) return;
    setPaymentsLoading(true);
    try {
      await getValidatedSession();
      let query = supabase
        .from('payment_requests')
        .select('*, companies(id, name, plan, subscription_expires_at)', { count: 'exact' });

      if (paymentStatusFilter !== 'all') {
        query = query.eq('status', paymentStatusFilter);
      }
      query = query.order('requested_at', { ascending: false });

      const { data, error: queryError, count } = await query.range(0, 49);
      if (queryError) throw queryError;
      setPayments(data || []);
      setPaymentsTotal(count ?? 0);

      // Update pending count in dashboardData
      const pending = (data || []).filter(p => p.status === 'pending').length;
      setDashboardData(prev => ({ ...prev, pendingPaymentsCount: pending }));
    } catch (err) {
      console.error('fetchPayments:', err.message);
    } finally {
      setPaymentsLoading(false);
    }
  }, [authLoading, getValidatedSession, isSuperAdmin, user, paymentStatusFilter]);

  const fetchPaymentConfig = useCallback(async () => {
    try {
      const { data } = await supabase.from('payment_config').select('key, value');
      const mapped = {};
      (data || []).forEach(row => { mapped[row.key] = row.value || ''; });
      setPaymentConfig(mapped);
    } catch (err) {
      console.error('fetchPaymentConfig:', err.message);
    }
  }, []);

  const savePaymentConfig = async (updates) => {
    setSavingConfig(true);
    try {
      const upserts = Object.entries(updates).map(([key, value]) => ({ key, value, updated_at: new Date().toISOString() }));
      const { error } = await supabase
        .from('payment_config')
        .upsert(upserts, { onConflict: 'key' });
      if (error) throw error;
      setPaymentConfig(prev => ({ ...prev, ...updates }));
      toast.success('تم حفظ إعدادات الدفع بنجاح ✅');
    } catch (err) {
      toast.error('فشل حفظ الإعدادات: ' + err.message);
    } finally {
      setSavingConfig(false);
    }
  };

  const approvePayment = async (paymentId) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke('approve-payment', {
        body: { action: 'approve', payment_id: paymentId, reviewer_id: sessionData?.session?.user?.id }
      });
      if (error) throw error;
      toast.success(`✅ تم تفعيل اشتراك ${data?.company || 'الشركة'} بنجاح`);
      fetchPayments();
      fetchOverviewData({ silent: true });
    } catch (err) {
      toast.error('فشل الموافقة: ' + err.message);
    }
  };

  const rejectPayment = async (paymentId, note) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const { error } = await supabase.functions.invoke('approve-payment', {
        body: { action: 'reject', payment_id: paymentId, rejection_note: note, reviewer_id: sessionData?.session?.user?.id }
      });
      if (error) throw error;
      toast.success('تم رفض طلب الدفع وإخطار الشركة');
      fetchPayments();
    } catch (err) {
      toast.error('فشل الرفض: ' + err.message);
    }
  };

  useEffect(() => { fetchPayments(); }, [fetchPayments]);
  useEffect(() => { fetchPaymentConfig(); }, [fetchPaymentConfig]);

  const approveRenewalRequest = async (requestId, companyId, nextEndDate, nextPlan) => {
    try {
      // 1. Fetch current settings to avoid overwriting
      const { data: currentCompany } = await supabase
        .from("companies")
        .select("settings")
        .eq("id", companyId)
        .single();
      const currentSettings = currentCompany?.settings || {};

      // 2. Update company's plan, settings (for dates), status in DB
      const { error: companyError } = await supabase
        .from("companies")
        .update({
          plan: nextPlan || "Pro",
          subscription_end_date: nextEndDate,
          subscription_expires_at: nextEndDate ? new Date(nextEndDate).toISOString() : null,
          settings: { 
            ...currentSettings, 
            subscription_end_date: nextEndDate, 
            trial_end_date: nextEndDate,
            subscription_expires_at: nextEndDate
          },
          status: "active"
        })
        .eq("id", companyId);

      if (companyError) throw companyError;

      // 2. Update request status to 'approved'
      const { error: requestError } = await supabase
        .from("renewal_requests")
        .update({ status: "approved" })
        .eq("id", requestId);

      if (requestError) throw requestError;

      toast.success("تم قبول طلب التجديد وتحديث باقة الشركة بنجاح! ✅");
      
      // 3. Refresh dashboard stats and lists
      fetchRenewalsPage({ silent: true });
      fetchOverviewData({ silent: true });
      fetchUsersPage({ silent: true });
    } catch (err) {
      console.error("Error approving renewal request:", err);
      toast.error("فشل في قبول طلب التجديد.");
    }
  };

  const rejectRenewalRequest = async (requestId) => {
    try {
      const { error } = await supabase
        .from("renewal_requests")
        .update({ status: "rejected" })
        .eq("id", requestId);

      if (error) throw error;

      toast.success("تم رفض طلب التجديد بنجاح.");
      
      // Refresh
      fetchRenewalsPage({ silent: true });
      fetchOverviewData({ silent: true });
    } catch (err) {
      console.error("Error rejecting renewal request:", err);
      toast.error("فشل في رفض طلب التجديد.");
    }
  };

  const handleMarkAllRead = useCallback(() => {
    const visibleIds = notifications.map((n) => n.id);
    setReadNotifIds((prev) => {
      const next = Array.from(new Set([...prev, ...visibleIds]));
      return next;
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
    toast.success(t.saAllNotificationsRead || "تم تحديد جميع الإشعارات كمقروءة");
  }, [notifications, t]);

  const handleDeleteNotification = useCallback((id) => {
    setDeletedNotifIds((prev) => {
      const next = Array.from(new Set([...prev, id]));
      return next;
    });
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    toast.success("تم حذف الإشعار بنجاح");
  }, []);

  const handleMarkNotificationRead = useCallback((id) => {
    setReadNotifIds((prev) => {
      if (prev.includes(id)) return prev;
      return [...prev, id];
    });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, unread: false } : n))
    );
  }, []);

  const handleMarkNotificationUnread = useCallback((id) => {
    setReadNotifIds((prev) => prev.filter((x) => x !== id));
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, unread: true } : n))
    );
  }, []);

  const handleClearAllNotifications = useCallback(() => {
    const visibleIds = notifications.map((n) => n.id);
    setDeletedNotifIds((prev) => {
      const next = Array.from(new Set([...prev, ...visibleIds]));
      return next;
    });
    setNotifications([]);
    toast.success("تم حذف جميع الإشعارات المعروضة");
  }, [notifications]);

  const handleNotificationClick = useCallback((n) => {
    // 1. Mark as read
    setReadNotifIds((prev) => {
      if (prev.includes(n.id)) return prev;
      return [...prev, n.id];
    });
    setNotifications((prev) =>
      prev.map((item) => (item.id === n.id ? { ...item, unread: false } : item))
    );

    // 2. Redirect/Change activeView
    if (n.id.startsWith("ticket-")) {
      setActiveView("tickets");
    } else if (n.id.startsWith("company-") || n.id.startsWith("expiring-")) {
      setActiveView("users");
    } else if (n.id.startsWith("renewal-")) {
      setActiveView("renewals");
    }
  }, []);

  const scheduleRefresh = useCallback((scope) => {
    if (!isMounted.current) return;
    if (refreshTimers.current[scope]) return;

    refreshTimers.current[scope] = setTimeout(() => {
      refreshTimers.current[scope] = null;
      if (scope === "companies") {
        fetchUsersPage({ silent: true });
        fetchOverviewData({ silent: true });
        fetchNotifications();
      }
      if (scope === "tickets") {
        fetchTicketsPage({ silent: true });
        fetchOverviewData({ silent: true });
        fetchNotifications();
      }
      if (scope === "renewals") {
        fetchRenewalsPage({ silent: true });
        fetchOverviewData({ silent: true });
        fetchNotifications();
      }
      if (scope === "alerts") {
        fetchAlerts({ silent: true });
      }
      if (scope === "activity") {
        fetchActivity({ silent: true });
      }
    }, 400);
  }, [fetchActivity, fetchAlerts, fetchOverviewData, fetchTicketsPage, fetchUsersPage, fetchNotifications, fetchRenewalsPage]);

  const handleRetry = useCallback(async () => {
    setError(null);
    await Promise.all([
      fetchUsersPage(),
      fetchTicketsPage(),
      fetchOverviewData(),
      fetchAlerts(),
      fetchActivity(),
      fetchNotifications(),
      fetchRenewalsPage(),
    ]);
  }, [fetchActivity, fetchAlerts, fetchOverviewData, fetchTicketsPage, fetchUsersPage, fetchNotifications, fetchRenewalsPage]);

  useEffect(() => {
    if (!user || !isSuperAdmin || authLoading) return;

    if (!initialLoadRef.current) return;

    const load = async () => {
      setInitialLoading(true);
      setError(null);

      await Promise.all([
        fetchUsersPage({ silent: true }),
        fetchTicketsPage({ silent: true }),
        fetchOverviewData({ silent: true }),
        fetchAlerts({ silent: true }),
        fetchActivity({ silent: true }),
        fetchNotifications(),
        fetchRenewalsPage({ silent: true }),
      ]);

      if (!isMounted.current) return;
      initialLoadRef.current = false;
      setInitialLoading(false);
      setUsersLoading(false);
      setTicketsLoading(false);
      setOverviewLoading(false);
      setAlertsLoading(false);
      setRenewalsLoading(false);
    };

    load();
  }, [authLoading, fetchActivity, fetchAlerts, fetchOverviewData, fetchTicketsPage, fetchUsersPage, fetchNotifications, fetchRenewalsPage, isSuperAdmin, user]);

  useEffect(() => {
    if (!user || !isSuperAdmin || authLoading) return;
    if (initialLoadRef.current) return;
    fetchUsersPage();
  }, [authLoading, fetchUsersPage, isSuperAdmin, user, userQuery]);

  useEffect(() => {
    if (!user || !isSuperAdmin || authLoading) return;
    if (initialLoadRef.current) return;
    fetchTicketsPage();
  }, [authLoading, fetchTicketsPage, isSuperAdmin, ticketQuery, user]);

  useEffect(() => {
    if (!user || !isSuperAdmin || authLoading) return;
    if (initialLoadRef.current) return;
    fetchRenewalsPage();
  }, [authLoading, fetchRenewalsPage, isSuperAdmin, renewalQuery, user]);

  useEffect(() => {
    if (!user || !isSuperAdmin || authLoading) return;
    if (initialLoadRef.current) return;
    fetchOverviewData();
    fetchAlerts();
    fetchActivity();
    fetchNotifications();
    fetchRenewalsPage({ silent: true });
  }, [authLoading, fetchActivity, fetchAlerts, fetchOverviewData, fetchNotifications, fetchRenewalsPage, isSuperAdmin, user]);

  useEffect(() => {
    if (!user || !isSuperAdmin || authLoading) return;

    const channel = supabase
      .channel("super-admin-dashboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "companies" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const company = payload.new;
            toast.success(t.saNewCompanyToast.replace('{name}', company.name), {
              description: t.saNewCompanyToastDesc.replace('{plan}', company.plan || 'Free'),
              duration: 6000,
              action: {
                label: t.saManageCompanies,
                onClick: () => setActiveView("users"),
              },
            });

            const newNotif = {
              id: `company-${company.id}`,
              type: "success",
              message: t.saNewCompanyToast.replace('{name}', company.name),
              time: t.saJustNow,
              unread: true,
              rawTime: company.created_at,
            };
            setNotifications((prev) => [newNotif, ...prev]);
          }
          scheduleRefresh("companies");
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_tickets" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const ticket = payload.new;
            toast.info(t.saNewTicketToast.replace('{subject}', ticket.subject), {
              description: t.saNewTicketToastDesc.replace('{priority}', ticket.priority),
              duration: 8000,
              action: {
                label: t.saViewTickets,
                onClick: () => setActiveView("tickets"),
              },
            });

            const newNotif = {
              id: `ticket-${ticket.id}`,
              type: ticket.priority === "Critical" || ticket.priority === "High" ? "error" : "info",
              message: t.saNewTicketToast.replace('{subject}', ticket.subject),
              time: t.saJustNow,
              unread: true,
              rawTime: ticket.created_at,
            };
            setNotifications((prev) => [newNotif, ...prev]);
          }
          scheduleRefresh("tickets");
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "system_alerts" },
        () => scheduleRefresh("alerts")
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "admin_activity" },
        () => scheduleRefresh("activity")
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "renewal_requests" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const req = payload.new;
            toast.success(`طلب تجديد جديد: تم استلام طلب من "${req.details?.company_name || 'شركة'}"`, {
              duration: 8000,
              action: {
                label: "عرض الطلبات",
                onClick: () => setActiveView("renewals"),
              },
            });

            const newNotif = {
              id: `renewal-${req.id}`,
              type: "warning",
              message: `طلب تجديد جديد من شركة "${req.details?.company_name || 'شركة'}"`,
              time: t.saJustNow,
              unread: true,
              rawTime: req.requested_at,
            };
            setNotifications((prev) => [newNotif, ...prev]);
          }
          scheduleRefresh("renewals");
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payment_requests" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const req = payload.new;
            toast.success(`💳 طلب دفع جديد من "${req.company_id || 'شركة'}" بمبلغ ${req.amount} جنيه`, {
              duration: 8000,
              action: {
                label: "عرض الطلبات",
                onClick: () => setActiveView("payments"),
              },
            });
            fetchPayments();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [authLoading, isSuperAdmin, scheduleRefresh, t, user, fetchPayments]);

  const handleUserQueryChange = useCallback((next) => {
    setUserQuery((prev) => ({ ...prev, ...next }));
  }, []);

  const handleShowExpiringUsers = useCallback(() => {
    setUserQuery((prev) => ({ ...prev, status: "expiring", page: 1 }));
    setActiveView("users");
  }, []);

  const handleTicketQueryChange = useCallback((next) => {
    setTicketQuery((prev) => ({ ...prev, ...next }));
  }, []);

  const handleRenewalQueryChange = useCallback((next) => {
    setRenewalQuery((prev) => ({ ...prev, ...next }));
  }, []);

  const updateCompanyStatus = useCallback(async (companyId, status) => {
    try {
      await getValidatedSession();
      const { error: updateError } = await supabase
        .from("companies")
        .update({ status })
        .eq("id", companyId);
      if (updateError) throw updateError;

      setDashboardData((prev) => ({
        ...prev,
        users: prev.users.map((u) => (u.id === companyId ? { ...u, status } : u)),
      }));
      fetchUsersPage({ silent: true });
      fetchOverviewData({ silent: true });
      toast.success(status === "suspended" ? t.saCompanySuspended : t.saCompanyReactivated);
    } catch (err) {
      handleError("Failed to update company status", err);
      toast.error(t.saCompanyStatusFailed);
      throw err;
    }
  }, [fetchOverviewData, fetchUsersPage, getValidatedSession, handleError, t]);

  const updateCompanySubscription = useCallback(async (companyId, updates) => {
    try {
      await getValidatedSession();
      // 1. Fetch current settings to avoid overwriting
      const { data: currentCompany } = await supabase
        .from("companies")
        .select("settings")
        .eq("id", companyId)
        .single();
      const currentSettings = currentCompany?.settings || {};

      const { error: updateError } = await supabase
        .from("companies")
        .update({
          plan: updates.plan,
          subscription_amount: updates.amount,
          subscription_expires_at: updates.expiryDate ? new Date(updates.expiryDate).toISOString() : null,
          subscription_end_date: updates.expiryDate,
          settings: { 
            ...currentSettings, 
            subscription_amount: updates.amount,
            subscription_expires_at: updates.expiryDate,
            subscription_end_date: updates.expiryDate,
            trial_end_date: updates.expiryDate
          }
        })
        .eq("id", companyId);

      if (updateError) throw updateError;

      setDashboardData((prev) => ({
        ...prev,
        users: prev.users.map((u) => (u.id === companyId ? {
          ...u,
          plan: updates.plan,
          subscription_amount: updates.amount,
          subscription_expires_at: updates.expiryDate,
          subscription_end_date: updates.expiryDate,
        } : u)),
      }));

      fetchUsersPage({ silent: true });
      fetchOverviewData({ silent: true });
      toast.success(t.saSubscriptionUpdated);
    } catch (err) {
      handleError("Failed to update company subscription", err);
      toast.error(t.saSubscriptionUpdateFailed);
      throw err;
    }
  }, [fetchOverviewData, fetchUsersPage, getValidatedSession, handleError, t]);

  // Danger deletion state — drives the confirmation modal in JSX (constitution §9: no window.confirm)
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

  const deleteCompanyCompletely = useCallback(async (companyId) => {
    // Step 1: show modal — actual deletion runs in confirmDeleteCompany
    setPendingDeleteId(companyId);
  }, []);

  const confirmDeleteCompany = useCallback(async () => {
    if (!pendingDeleteId) return;
    const companyId = pendingDeleteId;
    setPendingDeleteId(null);
    try {
      await getValidatedSession();
      const { error: deleteError } = await supabase.rpc('delete_tenant_completely', { target_company_id: companyId });
      if (deleteError) throw deleteError;
      toast.success(t.saCompanyDeleted);
      fetchUsersPage({ silent: true });
      fetchOverviewData({ silent: true });
    } catch (err) {
      handleError("Failed to delete company", err);
      toast.error(t.saCompanyDeleteFailed);
    }
  }, [pendingDeleteId, fetchOverviewData, fetchUsersPage, getValidatedSession, handleError, t]);

  const sendNotification = useCallback(async ({ companyId, title, message, sendEmail, type }) => {
    try {
      await getValidatedSession();
      const payload = {
        company_id: companyId,
        title,
        message,
        type: type || "info",
        send_email: !!sendEmail,
      };
      const { error: insertError } = await supabase
        .from("company_notifications")
        .insert([payload]);
      if (insertError) throw insertError;

      toast.success(t.saNotificationQueued);
      if (sendEmail) {
        toast.message(t.saEmailPending);
      }
    } catch (err) {
      handleError("Failed to send notification", err);
      toast.error(t.saNotificationFailed);
      throw err;
    }
  }, [getValidatedSession, handleError, t]);

  const handleImpersonate = useCallback((company) => {
    impersonateCompany(company);
    toast.success(t.saImpersonatingTitle || "جاري تفعيل المعاينة كعميل...");
    navigate("/dashboard");
  }, [impersonateCompany, navigate, t]);

  const handleForceRefresh = useCallback(async (companyId) => {
    try {
      await getValidatedSession();
      const payload = {
        company_id: companyId,
        title: "FORCE_REFRESH",
        message: "FORCE_REFRESH",
        type: "force_refresh",
        send_email: false,
      };
      const { error: insertError } = await supabase
        .from("company_notifications")
        .insert([payload]);
      if (insertError) throw insertError;

      toast.success(t.saForceRefreshSuccess || "تم إرسال طلب التحديث للمتصفح بنجاح ✅");
    } catch (err) {
      handleError("Failed to trigger force refresh", err);
      toast.error(t.saForceRefreshFailed || "فشل إرسال طلب التحديث.");
    }
  }, [getValidatedSession, handleError, t]);

  if (initialLoading) {
    return (
      <div className="admin-theme-wrapper flex items-center justify-center min-h-screen bg-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="admin-theme-wrapper">
      <div className="h-screen overflow-y-auto w-full" style={{ background: "var(--background)", fontFamily: "'Inter', sans-serif" }}>
        <Toaster position="top-center" richColors />

        {/* ── Danger Confirmation Modal (replaces window.confirm — constitution §9) ── */}
        {pendingDeleteId && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 99999, backdropFilter: 'blur(6px)'
          }}>
            <div style={{
              background: '#1a1a2e', border: '1px solid rgba(239,68,68,0.4)',
              borderRadius: 16, padding: 32, maxWidth: 440, width: '90%',
              boxShadow: '0 24px 64px rgba(239,68,68,0.2)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <span style={{ fontSize: 28 }}>⚠️</span>
                <h3 style={{ color: '#ef4444', fontWeight: 700, fontSize: '1.1rem', margin: 0 }}>{t.saDangerZoneTitle}</h3>
              </div>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.7, marginBottom: 24 }}>
                {t.saDangerZoneDesc}
                <br /><br />
                <strong style={{ color: '#fff' }}>{t.saDangerZoneWarning}</strong>
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setPendingDeleteId(null)}
                  style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}
                >
                  {t.cancelBtn}
                </button>
                <button
                  onClick={confirmDeleteCompany}
                  style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#ef4444,#b91c1c)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                >
                  {t.saConfirmDeleteBtn}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sidebar */}
        <AdminSidebar
          activeView={activeView}
          onViewChange={setActiveView}
          openTicketsCount={dashboardData.stats.openTickets}
          pendingRenewalsCount={dashboardData.pendingRenewalsCount}
          pendingPaymentsCount={dashboardData.pendingPaymentsCount}
          unreadNotificationsCount={notifications.filter((n) => n.unread).length}
        />

        {/* Main content offset from sidebar */}
        <div className="bg-gray-50 min-h-screen" style={{ marginRight: "var(--sidebar-width, 256px)" }}>
          {/* Fixed Header */}
          <AdminHeader
            activeView={activeView}
            notifications={notifications}
            onMarkAllRead={handleMarkAllRead}
            onDeleteNotification={handleDeleteNotification}
            onNotificationClick={handleNotificationClick}
            onViewAllNotifications={() => setActiveView("notifications")}
          />

          {/* Scrollable Content */}
          <main className="pt-16 min-h-screen">
            <div className="p-8 max-w-[1600px] mx-auto">
              {error && (
                <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-start justify-between gap-3" style={{ direction: "rtl" }}>
                  <div>
                    <div className="text-red-800" style={{ fontWeight: 700, fontSize: "0.9rem" }}>{error.title}</div>
                    <div className="text-red-600" style={{ fontSize: "0.78rem", marginTop: "4px" }}>{error.message}</div>
                  </div>
                  <button
                    onClick={handleRetry}
                    className="px-3 py-2 rounded-lg bg-red-600 text-white text-xs hover:bg-red-700 transition-colors"
                    style={{ fontWeight: 700 }}
                  >
                    {t.saRetry}
                  </button>
                </div>
              )}

              {/* Alert Banner */}
              <AlertBanner alerts={dashboardData.alerts} loading={alertsLoading} />

              {/* View Content */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeView}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  {activeView === "overview" && (
                    <OverviewView
                      onViewChange={setActiveView}
                      stats={dashboardData.stats}
                      users={dashboardData.users}
                      planDistribution={dashboardData.planDistribution}
                      growthData={dashboardData.growthData}
                      activity={dashboardData.activity}
                      expiringCount={dashboardData.expiringCount}
                      loading={overviewLoading}
                      onShowExpiringUsers={handleShowExpiringUsers}
                    />
                  )}

                  {activeView === "resellers" && (
                    <ResellersView />
                  )}

                  {activeView === "users" && (
                    <div className="space-y-6">
                      <UserManagementTable
                        users={dashboardData.users}
                        totalCount={dashboardData.usersTotal}
                        onUsersChange={(nextUsers) =>
                          setDashboardData((prev) => ({ ...prev, users: nextUsers }))
                        }
                        onQueryChange={handleUserQueryChange}
                        loading={usersLoading}
                        onStatusChange={updateCompanyStatus}
                        onSubscriptionChange={updateCompanySubscription}
                        onNotify={sendNotification}
                        onDelete={deleteCompanyCompletely}
                        onImpersonate={handleImpersonate}
                        onForceRefresh={handleForceRefresh}
                        initialStatus={userQuery.status}
                      />
                      <SupportTicketsWidget
                        tickets={dashboardData.tickets.slice(0, 5)}
                        stats={dashboardData.ticketStats}
                        loading={ticketsLoading}
                        onViewAll={() => setActiveView("tickets")}
                      />
                    </div>
                  )}

                  {activeView === "plans" && (
                    <SubscriptionPlansView
                      planStats={dashboardData.planStats}
                      loading={overviewLoading}
                    />
                  )}
                  {activeView === "tickets" && (
                    <SupportTicketsView
                      tickets={dashboardData.tickets}
                      totalCount={dashboardData.ticketsTotal}
                      stats={dashboardData.ticketStats}
                      loading={ticketsLoading}
                      onQueryChange={handleTicketQueryChange}
                      onRefresh={handleRetry}
                    />
                  )}
                  {activeView === "renewals" && (
                    <RenewalRequestsView
                      renewals={dashboardData.renewals}
                      totalCount={dashboardData.renewalsTotal}
                      loading={renewalsLoading}
                      onQueryChange={handleRenewalQueryChange}
                      onApprove={approveRenewalRequest}
                      onReject={rejectRenewalRequest}
                    />
                  )}
                  {activeView === "diagnostics" && (
                    <DevicesDiagnosticsView />
                  )}
                  {activeView === "settings" && <SystemSettingsView />}
                  {activeView === "payments" && (
                    <PaymentRequestsView
                      payments={payments}
                      total={paymentsTotal}
                      loading={paymentsLoading}
                      statusFilter={paymentStatusFilter}
                      onFilterChange={(s) => { setPaymentStatusFilter(s); }}
                      onApprove={approvePayment}
                      onReject={rejectPayment}
                      paymentConfig={paymentConfig}
                      onSaveConfig={savePaymentConfig}
                      savingConfig={savingConfig}
                    />
                  )}
                  {activeView === "broadcast" && (
                    <BroadcastAlertsView />
                  )}
                  {activeView === "notifications" && (
                    <NotificationsCenterView
                      notifications={notifications}
                      onMarkAllRead={handleMarkAllRead}
                      onDeleteNotification={handleDeleteNotification}
                      onNotificationClick={handleNotificationClick}
                      onMarkNotificationRead={handleMarkNotificationRead}
                      onMarkNotificationUnread={handleMarkNotificationUnread}
                      onClearAll={handleClearAllNotifications}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
