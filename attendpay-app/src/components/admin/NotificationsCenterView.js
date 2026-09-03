import { useState } from "react";
import { 
  Bell, Search, Trash2, CheckCircle, Clock, Eye, AlertTriangle, Info, Check, Filter, X
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useLocale } from "../../context/LocaleContext";

const typeStyles = {
  error: {
    bg: "bg-red-50 border-red-100 hover:border-red-200",
    text: "text-red-700",
    dot: "bg-red-500",
    icon: AlertTriangle,
    iconBg: "bg-red-100 text-red-600"
  },
  warning: {
    bg: "bg-amber-50 border-amber-100 hover:border-amber-200",
    text: "text-amber-700",
    dot: "bg-amber-500",
    icon: AlertTriangle,
    iconBg: "bg-amber-100 text-amber-600"
  },
  success: {
    bg: "bg-emerald-50 border-emerald-100 hover:border-emerald-200",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
    icon: CheckCircle,
    iconBg: "bg-emerald-100 text-emerald-600"
  },
  info: {
    bg: "bg-blue-50 border-blue-100 hover:border-blue-200",
    text: "text-blue-700",
    dot: "bg-blue-500",
    icon: Info,
    iconBg: "bg-blue-100 text-blue-600"
  }
};

export function NotificationsCenterView({
  notifications = [],
  onMarkAllRead,
  onDeleteNotification,
  onNotificationClick,
  onMarkNotificationRead,
  onMarkNotificationUnread,
  onClearAll
}) {
  const { language } = useLocale();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState("all"); // all, unread, read
  const [filterType, setFilterType] = useState("all"); // all, ticket, company, expiring
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Search filter
  const filteredNotifications = notifications.filter((n) => {
    // 1. Search Query
    const messageMatch = n.message.toLowerCase().includes(searchQuery.toLowerCase());
    
    // 2. Tab Filter
    let tabMatch = true;
    if (filterTab === "unread") tabMatch = n.unread;
    if (filterTab === "read") tabMatch = !n.unread;

    // 3. Type Filter
    let typeMatch = true;
    if (filterType === "ticket") typeMatch = n.id.startsWith("ticket-");
    if (filterType === "company") typeMatch = n.id.startsWith("company-");
    if (filterType === "expiring") typeMatch = n.id.startsWith("expiring-");

    return messageMatch && tabMatch && typeMatch;
  });

  const getNotificationIcon = (n) => {
    const style = typeStyles[n.type] || typeStyles.info;
    const IconComponent = style.icon;
    return (
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${style.iconBg}`}>
        <IconComponent className="w-5.5 h-5.5" />
      </div>
    );
  };

  const getSourceLabel = (id) => {
    if (id.startsWith("ticket-")) return language === "en" ? "Support Ticket" : "تذكرة دعم";
    if (id.startsWith("company-")) return language === "en" ? "Registration" : "تسجيل شركة";
    if (id.startsWith("expiring-")) return language === "en" ? "Subscription" : "اشتراك";
    return language === "en" ? "System" : "النظام";
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto" style={{ textAlign: "right", direction: "rtl" }}>
      {/* Title & Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-150 shadow-xs">
        <div>
          <h2 className="text-gray-900" style={{ fontWeight: 800, fontSize: "1.35rem" }}>
            {language === "en" ? "Notification Center" : "مركز الإشعارات"}
          </h2>
          <p className="text-gray-400 mt-1" style={{ fontSize: "0.825rem" }}>
            {language === "en" 
              ? "Manage, search, and respond to recent events in real time" 
              : "إدارة والبحث والاستجابة للأحداث الأخيرة في الوقت الفعلي"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-xl text-center min-w-[90px]">
            <div className="text-xl" style={{ fontWeight: 800 }}>
              {notifications.filter(n => n.unread).length}
            </div>
            <div className="text-[0.65rem] font-bold uppercase tracking-wider text-blue-500">
              {language === "en" ? "Unread" : "غير مقروء"}
            </div>
          </div>
          <div className="bg-slate-50 text-slate-700 px-4 py-2 rounded-xl text-center min-w-[90px]">
            <div className="text-xl" style={{ fontWeight: 800 }}>
              {notifications.length}
            </div>
            <div className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-400">
              {language === "en" ? "Total" : "الإجمالي"}
            </div>
          </div>
        </div>
      </div>

      {/* Filters, Search & Bulk Actions Bar */}
      <div className="bg-white rounded-2xl border border-gray-150 shadow-xs p-4 flex flex-col gap-4">
        {/* Row 1: Search & Type Filter */}
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Search */}
          <div className="relative w-full md:flex-1">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={language === "en" ? "Search notifications..." : "البحث في الإشعارات..."}
              className="w-full pr-10 pl-4 py-2.5 rounded-xl text-xs bg-gray-50 border border-gray-200 outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-50 transition-all font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-650"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Type Dropdown */}
          <div className="flex items-center gap-2 w-full md:w-auto flex-shrink-0">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full md:w-44 text-xs px-3 py-2.5 rounded-xl border border-gray-200 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all font-semibold bg-white"
            >
              <option value="all">{language === "en" ? "All Sources" : "جميع المصادر"}</option>
              <option value="ticket">{language === "en" ? "Support Tickets" : "تذاكر الدعم"}</option>
              <option value="company">{language === "en" ? "Registrations" : "عمليات التسجيل"}</option>
              <option value="expiring">{language === "en" ? "Expiring Subscriptions" : "الاشتراكات الموشكة على الانتهاء"}</option>
            </select>
          </div>
        </div>

        {/* Row 2: Status tabs & bulk actions */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-3 border-t border-gray-100">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 bg-gray-50 p-1 rounded-xl w-full md:w-auto">
            {[
              { id: "all", label: language === "en" ? "All" : "الكل" },
              { id: "unread", label: language === "en" ? "Unread" : "غير مقروءة" },
              { id: "read", label: language === "en" ? "Read" : "المقروءة" }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterTab(tab.id)}
                className={`flex-1 md:flex-initial px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filterTab === tab.id
                    ? "bg-white text-blue-600 shadow-xs border border-gray-100"
                    : "text-gray-400 hover:text-gray-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Bulk actions */}
          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <button
              onClick={onMarkAllRead}
              disabled={!notifications.some(n => n.unread)}
              className="text-xs px-4 py-2 border border-gray-200 hover:border-blue-400 hover:text-blue-600 bg-white rounded-xl font-bold text-gray-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {language === "en" ? "Mark all read" : "تحديد الكل كمقروء"}
            </button>
            <button
              onClick={() => setShowClearConfirm(true)}
              disabled={filteredNotifications.length === 0}
              className="text-xs px-4 py-2 border border-gray-200 hover:border-red-400 hover:text-red-600 hover:bg-red-50/20 bg-white rounded-xl font-bold text-gray-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {language === "en" ? "Clear visible" : "حذف المعروض"}
            </button>
          </div>
        </div>
      </div>

      {/* Clear All Confirmation block */}
      <AnimatePresence>
        {showClearConfirm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-red-50 border border-red-150 p-4 rounded-2xl flex items-center justify-between gap-3">
              <div>
                <h4 className="text-red-800 font-bold text-xs">
                  {language === "en" ? "Are you sure?" : "هل أنت متأكد من الحذف؟"}
                </h4>
                <p className="text-red-650 text-[0.72rem] mt-0.5">
                  {language === "en" 
                    ? `This will remove the ${filteredNotifications.length} currently filtered notification cards from view.`
                    : `سيؤدي هذا إلى إزالة بطاقات الإشعارات الـ ${filteredNotifications.length} المفلترة حالياً من العرض.`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  {language === "en" ? "Cancel" : "إلغاء"}
                </button>
                <button
                  onClick={() => {
                    onClearAll();
                    setShowClearConfirm(false);
                  }}
                  className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors"
                >
                  {language === "en" ? "Delete All" : "نعم، حذف الكل"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notifications Stack */}
      <div className="space-y-3">
        {filteredNotifications.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-150 p-12 text-center flex flex-col items-center justify-center gap-3">
            <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
              <Bell className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-gray-900 font-bold text-sm">
                {language === "en" ? "No notifications found" : "لا توجد إشعارات"}
              </h3>
              <p className="text-gray-400 text-xs mt-0.5">
                {language === "en" 
                  ? "We couldn't find any notifications matching your filters." 
                  : "لم نتمكن من العثور على أي إشعارات تطابق خيارات التصفية الخاصة بك."}
              </p>
            </div>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {filteredNotifications.map((n) => {
              return (
                <motion.div
                  key={n.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.18 }}
                  className={`bg-white border rounded-2xl shadow-2xs p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:shadow-xs group relative overflow-hidden ${
                    n.unread ? "border-blue-200/80 bg-blue-50/10" : "border-gray-150"
                  }`}
                >
                  {/* Read/Unread Left Bar indicator */}
                  {n.unread && (
                    <div className="absolute right-0 top-0 bottom-0 w-1 bg-blue-600" />
                  )}

                  {/* Left Side: Icon, message & metadata */}
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    {getNotificationIcon(n)}
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[0.68rem] font-bold px-2 py-0.5 rounded-md bg-gray-100 text-gray-500 uppercase tracking-wider">
                          {getSourceLabel(n.id)}
                        </span>
                        {n.unread && (
                          <span className="text-[0.62rem] font-bold px-1.5 py-0.5 rounded-md bg-blue-600 text-white uppercase tracking-wider flex items-center gap-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                            {language === "en" ? "New" : "جديد"}
                          </span>
                        )}
                      </div>
                      
                      <p className="text-gray-800 text-xs mt-1.5 leading-5" style={{ fontWeight: n.unread ? 700 : 400 }}>
                        {n.message}
                      </p>

                      <div className="flex items-center gap-3.5 text-gray-400 mt-2 text-[0.7rem] font-semibold">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-gray-350" />
                          {n.time}
                        </span>
                        {n.rawTime && (
                          <span className="text-gray-300">
                            {new Date(n.rawTime).toLocaleDateString(language === "en" ? "en-US" : "ar-SA", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Side: Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0 self-end md:self-auto pt-3 md:pt-0 border-t md:border-0 border-gray-50 justify-end">
                    {/* Mark Read/Unread toggler */}
                    {n.unread ? (
                      <button
                        onClick={() => onMarkNotificationRead(n.id)}
                        className="p-2 rounded-xl text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                        title={language === "en" ? "Mark as read" : "تحديد كمقروء"}
                      >
                        <Check className="w-4.5 h-4.5" />
                      </button>
                    ) : (
                      <button
                        onClick={() => onMarkNotificationUnread(n.id)}
                        className="p-2 rounded-xl text-emerald-600 bg-emerald-50 hover:bg-slate-100 hover:text-gray-400 transition-colors"
                        title={language === "en" ? "Mark as unread" : "تحديد كغير مقروء"}
                      >
                        <Check className="w-4.5 h-4.5" />
                      </button>
                    )}

                    {/* View details */}
                    <button
                      onClick={() => onNotificationClick(n)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-50 border border-slate-100 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/30 rounded-xl font-bold text-slate-700 transition-all shadow-3xs"
                    >
                      <Eye className="w-4 h-4" />
                      <span>{language === "en" ? "Explore" : "عرض التفاصيل"}</span>
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => onDeleteNotification(n.id)}
                      className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title={language === "en" ? "Delete notification" : "حذف الإشعار"}
                    >
                      <Trash2 className="w-4.5 h-4.5" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
