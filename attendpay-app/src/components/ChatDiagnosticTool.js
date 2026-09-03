import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { Play, RotateCw, CheckCircle2, AlertOctagon, Info, Cpu, Zap, Activity } from "lucide-react";

export default function ChatDiagnosticTool() {
  const [isRunning, setIsRunning] = useState(false);
  const [currentIteration, setCurrentIteration] = useState(0);
  const [totalIterations] = useState(50);
  const [activeChannelsCount, setActiveChannelsCount] = useState(0);
  const [testResult, setTestResult] = useState(null); // 'pass', 'fail', null
  const [logs, setLogs] = useState([]);
  const [leakDetected, setLeakDetected] = useState(false);

  const addLog = (message, type = "info") => {
    setLogs((prev) => [
      {
        id: Date.now() + Math.random().toString(),
        timestamp: new Date().toLocaleTimeString(),
        message,
        type,
      },
      ...prev,
    ]);
  };

  const updateChannelCount = () => {
    // Retrieve currently active channels from the supabase client
    const channels = supabase.getChannels();
    setActiveChannelsCount(channels.length);
    return channels.length;
  };

  useEffect(() => {
    const interval = setInterval(updateChannelCount, 500);
    return () => clearInterval(interval);
  }, []);

  const runLeakTest = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setTestResult(null);
    setLeakDetected(false);
    setLogs([]);
    addLog("⚡ Starting automated WebSocket Connection Leak Test...", "start");

    let leakFound = false;

    // Phase 1: Ensure we start with a clean slate
    const initialChannels = updateChannelCount();
    addLog(`🔍 Initial active channels: ${initialChannels}`, "info");
    if (initialChannels > 0) {
      addLog("⚠️ Active channels detected before test. Attempting to clear...", "warning");
      const activeChannels = [...supabase.getChannels()];
      for (const ch of activeChannels) {
        await supabase.removeChannel(ch);
      }
      const clearedCount = updateChannelCount();
      addLog(`🧹 Cleaned up channels. Current active: ${clearedCount}`, "info");
    }

    // Phase 2: Run loop simulating mount/unmount and channel creation
    for (let i = 1; i <= totalIterations; i++) {
      setCurrentIteration(i);
      const ticketId = `mock-ticket-${Math.floor(Math.random() * 10000)}`;
      addLog(`🔄 Iteration ${i}/${totalIterations}: Simulating Mount for ticket ${ticketId}`, "info");

      // 1. Simulate Mount (Subscribe to Scoped Postgres Change Channel)
      const replyChannelName = `diagnostic-replies-${ticketId}`;
      const repliesChannel = supabase
        .channel(replyChannelName)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "support_ticket_replies",
            filter: `ticket_id=eq.${ticketId}`,
          },
          () => {}
        )
        .subscribe();

      // 2. Simulate Mount (Subscribe to Compressed Presence Channel)
      const presenceChannelName = `diagnostic-presence-${ticketId}`;
      const presenceChannel = supabase.channel(presenceChannelName).subscribe();

      // Pause to let socket register subscriptions
      await new Promise((resolve) => setTimeout(resolve, 50));
      let currentActive = updateChannelCount();
      addLog(`🟢 Subscribed 2 channels (Replies & Presence). Total active: ${currentActive}`, "success");

      // 3. Simulate Unmount (Guaranteed Cleanup)
      await supabase.removeChannel(repliesChannel);
      await supabase.removeChannel(presenceChannel);

      // Pause to let socket process unsubscriptions
      await new Promise((resolve) => setTimeout(resolve, 50));
      currentActive = updateChannelCount();
      addLog(`🔴 Removed 2 channels on Unmount. Total active: ${currentActive}`, "cleanup");

      if (currentActive > 0) {
        leakFound = true;
        setLeakDetected(true);
        addLog(`❌ Leak detected in iteration ${i}! Active channels remained: ${currentActive}`, "error");
        break;
      }
    }

    // Phase 3: Final assertion
    const finalChannels = updateChannelCount();
    if (finalChannels === 0 && !leakFound) {
      setTestResult("pass");
      addLog("✨ Leak Test Completed Successfully: 0 connections leaked!", "pass");
    } else {
      setTestResult("fail");
      addLog(`🚨 Leak Test Failed! ${finalChannels} zombie connections left in client state.`, "error");
    }

    setIsRunning(false);
  };

  return (
    <div className="max-w-4xl mx-auto my-8 p-6 bg-slate-950 text-slate-100 rounded-3xl border border-slate-800 shadow-2xl relative overflow-hidden" style={{ direction: "rtl", textAlign: "right" }}>
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-5 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Cpu className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold tracking-tight text-white">أداة فحص تسريب قنوات Supabase</h2>
            <p className="text-xs text-slate-400 mt-1">فحص ومحاكاة عمليات Mount / Unmount لمنع تكرار وزيادة قنوات WebSocket الميتة</p>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-2 flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-500 animate-pulse" />
          <span className="text-xs text-slate-400 font-bold">القنوات النشطة حالياً: </span>
          <span className={`text-sm font-extrabold ${activeChannelsCount > 0 ? "text-amber-500" : "text-emerald-500"}`}>
            {activeChannelsCount}
          </span>
        </div>
      </div>

      {/* Test Stats Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase">حالة الاختبار</span>
            <Zap className="w-4 h-4 text-blue-500" />
          </div>
          {testResult === "pass" && (
            <div className="flex items-center gap-2 text-emerald-500 mt-2">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-extrabold">اجتاز بنجاح (سليم)</span>
            </div>
          )}
          {testResult === "fail" && (
            <div className="flex items-center gap-2 text-red-500 mt-2">
              <AlertOctagon className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-extrabold">فشل (يوجد تسريب!)</span>
            </div>
          )}
          {!testResult && (
            <span className="text-sm font-extrabold text-slate-500 mt-2">انتظار بدء الفحص</span>
          )}
        </div>

        <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-400 uppercase">التقدم الحالي</span>
          <div className="w-full bg-slate-800 rounded-full h-2 mt-4 relative overflow-hidden">
            <div
              className="bg-blue-500 h-full rounded-full transition-all duration-150"
              style={{ width: `${(currentIteration / totalIterations) * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-400 mt-2">
            <span>التكرار: {currentIteration} / {totalIterations}</span>
            <span>{Math.round((currentIteration / totalIterations) * 100)}%</span>
          </div>
        </div>

        <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-5 flex items-center justify-center">
          <button
            onClick={runLeakTest}
            disabled={isRunning}
            className={`w-full py-4.5 rounded-2xl font-extrabold text-sm transition-all shadow-md flex items-center justify-center gap-2.5 ${
              isRunning
                ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/10 hover:shadow-blue-500/20 active:scale-[0.98]"
            }`}
          >
            {isRunning ? (
              <>
                <RotateCw className="w-4.5 h-4.5 animate-spin" />
                جاري الفحص والمحاكاة...
              </>
            ) : (
              <>
                <Play className="w-4.5 h-4.5" />
                تشغيل اختبار التسريب الآلي
              </>
            )}
          </button>
        </div>
      </div>

      {/* Logs and Output Details */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <h3 className="text-sm font-extrabold text-white">سجل العمليات والتحقق الآلي</h3>
          <span className="text-[0.65rem] px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400">
            تحديث حي
          </span>
        </div>

        <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-2" style={{ direction: "ltr", textAlign: "left" }}>
          {logs.length === 0 && (
            <div className="text-center py-12 text-slate-500 flex flex-col items-center justify-center gap-2">
              <Info className="w-8 h-8 opacity-40 text-slate-400" />
              <p className="text-xs font-semibold">اضغط على زر التشغيل لبدء محاكاة 50 عملية Mount/Unmount متتالية.</p>
            </div>
          )}
          {logs.map((log) => (
            <div
              key={log.id}
              className={`text-xs p-2.5 rounded-xl border flex items-start gap-2.5 transition-all ${
                log.type === "error"
                  ? "bg-red-500/10 border-red-500/20 text-red-400"
                  : log.type === "success"
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                  : log.type === "cleanup"
                  ? "bg-slate-800/30 border-slate-800/40 text-slate-400 font-mono"
                  : log.type === "pass"
                  ? "bg-emerald-600/20 border-emerald-600/30 text-emerald-300 font-extrabold"
                  : log.type === "start"
                  ? "bg-blue-600/20 border-blue-600/30 text-blue-300 font-extrabold"
                  : "bg-slate-900 border-slate-800/50 text-slate-300"
              }`}
            >
              <span className="text-[0.65rem] opacity-60 font-semibold flex-shrink-0 mt-0.5">{log.timestamp}</span>
              <p className="leading-relaxed font-semibold">{log.message}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
