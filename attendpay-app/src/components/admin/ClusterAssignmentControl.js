import { useState, useEffect } from "react";
import { supabase } from "../../supabaseClient";
import { toast } from "sonner";
import { Server, Lock, AlertCircle } from "lucide-react";

export function ClusterAssignmentControl({ channels, nodes }) {
  const [loading, setLoading] = useState(false);
  const [nodeAssignments, setNodeAssignments] = useState({});
  const [forcedLeaders, setForcedLeaders] = useState({});

  useEffect(() => {
    fetchAssignments();
  }, []);

  const fetchAssignments = async () => {
    try {
      const { data: assignments } = await supabase.from("whatsapp_node_assignments").select("*");
      if (assignments) {
        const assignmentMap = {};
        assignments.forEach(a => { assignmentMap[a.node_id] = a.channel_id; });
        setNodeAssignments(assignmentMap);
      }
      
      const { data: chans } = await supabase.from("whatsapp_channels").select("id, forced_leader_node_id");
      if (chans) {
        const leaderMap = {};
        chans.forEach(c => { leaderMap[c.id] = c.forced_leader_node_id; });
        setForcedLeaders(leaderMap);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAssignNode = async (nodeId, channelId) => {
    setLoading(true);
    try {
      if (!channelId) {
        await supabase.from("whatsapp_node_assignments").delete().eq("node_id", nodeId);
        toast.success("تم إزالة تخصيص القناة للجهاز");
      } else {
        await supabase.from("whatsapp_node_assignments").upsert({
          node_id: nodeId,
          channel_id: channelId
        }, { onConflict: "node_id" });
        toast.success("تم تخصيص القناة للجهاز بنجاح");
      }
      fetchAssignments();
    } catch (err) {
      toast.error("فشل التخصيص: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForceLeader = async (channelId, nodeId) => {
    setLoading(true);
    try {
      await supabase.from("whatsapp_channels")
        .update({ forced_leader_node_id: nodeId || null })
        .eq("id", channelId);
      toast.success(nodeId ? "تم فرض القيادة بنجاح!" : "تم تحرير القيادة الإجبارية!");
      fetchAssignments();
    } catch (err) {
      toast.error("فشل فرض القيادة: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-8 space-y-6 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm" dir="rtl">
      <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
        <Server className="w-5 h-5 text-indigo-600" />
        <h4 className="text-sm font-bold text-gray-900">إدارة القنوات والاستحواذ الإجباري المتقدم</h4>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Node to Channel Assignment */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
            <Lock className="w-4 h-4 text-emerald-500" />
            <span>تخصيص الأجهزة للقنوات (Node Affinity)</span>
          </div>
          <div className="space-y-3">
            {nodes.map(node => (
              <div key={node.node_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200">
                <span className="text-xs font-mono font-bold text-gray-800 truncate max-w-[150px]" title={node.node_id}>{node.node_id}</span>
                <select
                  disabled={loading}
                  value={nodeAssignments[node.node_id] || ""}
                  onChange={(e) => handleAssignNode(node.node_id, e.target.value)}
                  className="text-xs p-2 rounded-lg border border-gray-300 outline-none focus:ring-2 focus:ring-emerald-500 max-w-[140px]"
                >
                  <option value="">القناة الافتراضية</option>
                  {channels.map(ch => (
                    <option key={ch.id} value={ch.id}>{ch.name}</option>
                  ))}
                </select>
              </div>
            ))}
            {nodes.length === 0 && <div className="text-xs text-gray-500 p-2">لا توجد أجهزة متصلة.</div>}
          </div>
        </div>

        {/* Forced Leader Configuration */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
            <AlertCircle className="w-4 h-4 text-rose-500" />
            <span>فرض الاستحواذ الإجباري (Forced Takeover)</span>
          </div>
          <div className="space-y-3">
            {channels.map(channel => (
              <div key={channel.id} className="flex flex-col gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200">
                <span className="text-xs font-bold text-gray-800">{channel.name}</span>
                <select
                  disabled={loading}
                  value={forcedLeaders[channel.id] || ""}
                  onChange={(e) => handleForceLeader(channel.id, e.target.value)}
                  className="text-xs p-2 rounded-lg border border-rose-200 outline-none focus:ring-2 focus:ring-rose-500"
                >
                  <option value="">تلقائي (الأسرع والأقل استهلاكاً)</option>
                  {nodes.map(node => (
                    <option key={node.node_id} value={node.node_id}>إجبار: {node.node_id}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
