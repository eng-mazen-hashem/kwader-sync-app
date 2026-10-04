import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient'; // Adjust path if needed

const AiIntelligenceDashboard = () => {
  const [iqMetrics, setIqMetrics] = useState(null);
  const [recentInsights, setRecentInsights] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchIntelligenceData();
    
    // Subscribe to live learning events (Realtime Brain Feed)
    const subscription = supabase
      .channel('global-brain-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ai_global_learning_insights' }, (payload) => {
        setRecentInsights(prev => [payload.new, ...prev].slice(0, 10));
        fetchIntelligenceData(); // Refresh IQ score
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const fetchIntelligenceData = async () => {
    try {
      const { data: metrics } = await supabase.from('ai_intelligence_metrics').select('*').single();
      const { data: insights } = await supabase
        .from('ai_global_learning_insights')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (metrics) setIqMetrics(metrics);
      if (insights) setRecentInsights(insights);
    } catch (error) {
      console.error('Error fetching AI brain data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center animate-pulse text-indigo-500">جاري الاتصال بالعقل المركزي للذكاء الاصطناعي... 🧠</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto bg-gray-50 min-h-screen" dir="rtl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 flex items-center gap-3">
            <span className="text-4xl">🧠</span> العقل المركزي الموحد (Shared AI Brain)
          </h1>
          <p className="text-gray-500 mt-2">راقب التطور اللحظي لذكاء مبيعات النظام عبر جميع القنوات المربوطة.</p>
        </div>
        <div className="flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-full font-bold">
          <span className="w-3 h-3 bg-green-500 rounded-full animate-ping"></span>
          التعلم المستمر: نشط
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {/* IQ Score Card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-indigo-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full -z-10"></div>
          <h3 className="text-gray-500 font-semibold mb-2">مؤشر ذكاء المبيعات (AI Sales IQ)</h3>
          <div className="text-5xl font-black text-indigo-600 flex items-baseline gap-2">
            {iqMetrics?.current_ai_iq || 100} <span className="text-lg text-indigo-400 font-medium">نقطة</span>
          </div>
          <p className="text-sm text-gray-400 mt-4">يرتفع تدريجياً مع كل مهارة جديدة يكتسبها عبر أي قناة.</p>
        </div>

        {/* Total Mastered Objections */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-orange-100">
          <h3 className="text-gray-500 font-semibold mb-2">اعتراضات تم قهرها</h3>
          <div className="text-4xl font-bold text-orange-500">
            {iqMetrics?.total_objections_mastered || 0}
          </div>
          <p className="text-sm text-gray-400 mt-4">عدد المواقف الصعبة التي استطاع الوكيل تحويلها لمبيعات.</p>
        </div>

        {/* Global Techniques */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-emerald-100">
          <h3 className="text-gray-500 font-semibold mb-2">تكتيكات بيعية مسجلة</h3>
          <div className="text-4xl font-bold text-emerald-500">
            {iqMetrics?.total_winning_techniques || 0}
          </div>
          <p className="text-sm text-gray-400 mt-4">قاعدة المعرفة الحية التي يعتمد عليها جميع الوكلاء حالياً.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gray-50">
          <h2 className="text-xl font-bold text-gray-800">⚡ شريط التعلم اللحظي (Live Neural Feed)</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {recentInsights.length === 0 ? (
            <div className="p-8 text-center text-gray-400">في انتظار أول عملية بيع ناجحة ليتم تحليلها...</div>
          ) : (
            recentInsights.map((insight) => (
              <div key={insight.id} className="p-6 hover:bg-indigo-50/50 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold shrink-0">
                    💡
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-1 rounded font-bold">
                        تكتيك مكتسب جديد
                      </span>
                      <span className="text-gray-400 text-xs">
                        {new Date(insight.created_at).toLocaleString('ar-EG')}
                      </span>
                    </div>
                    <h4 className="text-lg font-bold text-gray-900 mb-2">
                      {insight.extracted_principle}
                    </h4>
                    <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-600 border border-gray-200">
                      <p className="mb-2"><strong className="text-gray-800">العميل قال:</strong> "{insight.trigger_context}"</p>
                      <p><strong className="text-green-700">رد الايجنت الناجح:</strong> "{insight.ai_successful_response}"</p>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default AiIntelligenceDashboard;
