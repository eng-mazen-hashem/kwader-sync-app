import React, { useState } from 'react';
import { ChevronLeft, Search, CheckCircle2, QrCode } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SkillBadge from '../components/Passport/SkillBadge';
import { passportMockStates } from '../data/mockPassportData';

export default function KwaderSkillPassport() {
  const [activeState, setActiveState] = useState('external-new');
  const worker = passportMockStates[activeState];

  const getStatusColor = (readinessScore) => {
    if (readinessScore < 50) return '#FDB813'; // Yellow
    if (readinessScore < 85) return '#2DCE89'; // Green
    return '#8B5CF6'; // Purple
  };

  const statusColor = getStatusColor(worker.readinessScore);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col items-center p-4 sm:p-8 font-sans">
      
      {/* DEMO SWITCHER */}
      <div className="mb-8 p-4 bg-[var(--bg-card)] rounded-2xl shadow-[var(--shadow-md)] border border-[var(--border-color)] max-w-[600px] w-full z-10">
        <h3 className="text-sm font-bold text-[var(--text-secondary)] mb-3 uppercase tracking-wider text-center">Demo: Switch User Journey State</h3>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <button 
            onClick={() => setActiveState('external-new')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeState === 'external-new' ? 'bg-[#FDB813] text-white shadow-lg scale-105' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-glass)]'}`}
          >
            🟡 إعلان ذاتي (جديد)
          </button>
          <button 
            onClick={() => setActiveState('external-tested')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeState === 'external-tested' ? 'bg-[#2DCE89] text-white shadow-lg scale-105' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-glass)]'}`}
          >
            🟢 مختبر من كوادر
          </button>
          <button 
            onClick={() => setActiveState('internal-verified')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeState === 'internal-verified' ? 'bg-[#8B5CF6] text-white shadow-lg scale-105' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-glass)]'}`}
          >
            🟣 موثق من الشركة
          </button>
        </div>
      </div>

      {/* Mobile Frame Container (Premium Glassmorphism) */}
      <div className="w-full max-w-[420px] bg-[#0d0d1a] rounded-[40px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-[10px] border-[#1a1a2e] overflow-hidden relative flex flex-col h-[850px] max-h-[85vh]">
        
        {/* Decorative Background Glows */}
        <div className="absolute top-0 -left-20 w-60 h-60 bg-[#6c63ff] rounded-full mix-blend-screen filter blur-[100px] opacity-20 pointer-events-none"></div>
        <div className="absolute bottom-40 -right-20 w-60 h-60 bg-[#a78bfa] rounded-full mix-blend-screen filter blur-[100px] opacity-20 pointer-events-none"></div>

        {/* Header */}
        <div className="flex items-center justify-between p-6 pt-12 pb-4 z-10">
          <button className="w-10 h-10 bg-white/5 backdrop-blur-md rounded-xl flex items-center justify-center text-white border border-white/10 hover:bg-white/10 transition">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="text-center">
            <motion.h1 
              key={worker.id + '-title'}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xl font-bold text-white"
            >
              جواز مهارات {worker.name.split(' ')[0]}
            </motion.h1>
            <p className="text-gray-400 text-sm">{worker.fullName}</p>
          </div>
          <button className="w-10 h-10 bg-white/5 backdrop-blur-md rounded-xl flex items-center justify-center text-white border border-white/10 hover:bg-white/10 transition">
            <Search className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-24 space-y-8 z-10 custom-scrollbar">
          
          <AnimatePresence mode="wait">
            <motion.div
              key={worker.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-8"
            >
              
              {/* Profile & QR */}
              <div className="flex flex-col items-center relative">
                <div 
                  className="w-24 h-24 bg-gray-800 rounded-full p-1 overflow-hidden mb-4 shadow-[0_0_20px_rgba(0,0,0,0.5)]"
                  style={{ background: `linear-gradient(135deg, ${statusColor}, transparent)` }}
                >
                  <img src={worker.avatar} alt="Profile" className="w-full h-full object-cover rounded-full border-4 border-[#0d0d1a]" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-6">{worker.name.split(' ')[0]}</h2>

                {/* QR Code Container */}
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-5 rounded-3xl shadow-xl flex flex-col items-center">
                  <div className="bg-white p-3 rounded-2xl shadow-inner relative group cursor-pointer">
                    <QrCode className="w-32 h-32 text-gray-900 group-hover:scale-105 transition-transform" />
                    <div className="absolute inset-0 bg-gradient-to-t from-white/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-2">
                      <span className="text-xs font-bold text-gray-900">انقر للتكبير</span>
                    </div>
                  </div>
                  <p className="text-gray-400 text-[10px] mt-4 tracking-widest font-semibold uppercase">Skill Passport QR</p>
                  <p className="text-white text-xs mt-1 font-bold">تحقق | Scan to Verify</p>
                </div>
              </div>

              {/* Readiness Score Card */}
              <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-3xl p-5 flex items-center gap-5 relative overflow-hidden shadow-lg">
                 {/* Circular Progress */}
                 <div className="w-24 h-24 rounded-full bg-black/20 flex items-center justify-center relative shadow-inner">
                   <svg className="absolute top-0 left-0 w-full h-full transform -rotate-90 drop-shadow-md">
                     <circle cx="48" cy="48" r="42" stroke="rgba(255,255,255,0.1)" strokeWidth="6" fill="none" />
                     <motion.circle 
                       cx="48" cy="48" r="42" 
                       stroke={statusColor} 
                       strokeWidth="6" fill="none" strokeDasharray="264" 
                       initial={{ strokeDashoffset: 264 }}
                       animate={{ strokeDashoffset: 264 - (264 * worker.readinessScore) / 100 }}
                       transition={{ duration: 1.5, ease: "easeOut" }}
                       strokeLinecap="round"
                     />
                   </svg>
                   <div className="flex flex-col items-center justify-center leading-none">
                     <span className="text-2xl font-black text-white">{worker.readinessScore}%</span>
                   </div>
                 </div>
                 
                 <div className="flex-1">
                   <h3 className="text-xl font-bold text-white text-right mb-1">{worker.status}</h3>
                   <p className="text-gray-400 text-[10px] text-right mb-3 uppercase tracking-wider">Worker Readiness</p>
                   {/* Progress Bar Line */}
                   <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden shadow-inner">
                     <motion.div 
                       className="h-full rounded-full" 
                       style={{ backgroundColor: statusColor }}
                       initial={{ width: 0 }}
                       animate={{ width: `${worker.readinessScore}%` }}
                       transition={{ duration: 1.2, delay: 0.3 }}
                     ></motion.div>
                   </div>
                   <p className="text-[11px] font-bold mt-2 text-right tracking-wide" style={{ color: statusColor }}>{worker.statusSub}</p>
                 </div>
              </div>

              {/* Skills List */}
              <div>
                <div className="flex justify-between items-center mb-5 px-1">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Technical Skills</h3>
                  <h3 className="text-sm font-bold text-white">المهارات الفنية</h3>
                </div>
                
                <div className="space-y-4">
                  {worker.skills.map((skill, index) => (
                    <motion.div 
                      key={skill.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.15 }}
                      className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 relative overflow-hidden group hover:bg-white/10 transition-colors"
                    >
                      
                      {/* Skill Header */}
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-black/30 rounded-xl flex items-center justify-center text-white border border-white/5 shadow-inner">
                            <CheckCircle2 className="w-5 h-5 opacity-80"/>
                          </div>
                          <div>
                            <h4 className="font-bold text-white text-[13px] leading-tight mb-1">{skill.title}</h4>
                            <p className="text-gray-400 text-[11px]">{skill.level}</p>
                          </div>
                        </div>
                        
                        <SkillBadge 
                          type={skill.verificationType} 
                          title={skill.verificationText}
                          subText={skill.verificationSubText}
                        />
                      </div>

                      {/* Skill Progress */}
                      <div className="flex items-center gap-4 mt-2">
                        <div className="flex-1 h-1.5 bg-black/40 rounded-full overflow-hidden shadow-inner">
                          <motion.div 
                            className="h-full rounded-full" 
                            style={{ backgroundColor: statusColor }}
                            initial={{ width: 0 }}
                            animate={{ width: `${skill.score}%` }}
                            transition={{ duration: 1, delay: 0.5 + (index * 0.1) }}
                          ></motion.div>
                        </div>
                        <span className="text-xs font-bold text-white w-8 text-right">{skill.score}%</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

            </motion.div>
          </AnimatePresence>
        </div>

        {/* Bottom Navigation */}
        <div className="absolute bottom-0 w-full bg-[#0d0d1a]/80 backdrop-blur-xl border-t border-white/10 px-6 py-4 flex justify-between items-center pb-8 z-20">
           {['الرئيسية', 'جوازي', 'التدريب', 'حسابي'].map((item, i) => (
             <button key={item} className={`flex flex-col items-center gap-1.5 transition-colors ${i === 1 ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}>
               <div className={`w-1.5 h-1.5 rounded-full mb-0.5 transition-colors ${i === 1 ? 'bg-white shadow-[0_0_10px_white]' : 'bg-transparent'}`}></div>
               <span className="text-[11px] font-bold">{item}</span>
             </button>
           ))}
        </div>

      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
}
