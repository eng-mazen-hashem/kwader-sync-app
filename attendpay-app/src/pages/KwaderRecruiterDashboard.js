import React, { useState } from 'react';
import { Search, MapPin, Briefcase, Calendar, CheckCircle2, ShieldCheck, Star } from 'lucide-react';

export default function KwaderRecruiterDashboard() {
  const [searchQuery, setSearchQuery] = useState('CNC Operator');

  const candidates = [
    {
      id: 1,
      name: 'Ahmed Rashid',
      role: 'CNC Machine Operator',
      match: 96,
      status: 'Active',
      verifiedSkills: ['CNC Milling', 'G-Code', 'Lathe Ops', 'Blueprints', 'Programming'],
      experience: '5 years (Full-time)',
      location: 'New York, NY',
      reasons: [
        '5 Years Experience',
        'Employer Verified Skills (CNC Ops)',
        'Precision Machining, Tooling Expertise',
        'Located: New York, NY'
      ]
    },
    {
      id: 2,
      name: 'Sarah Chen',
      role: 'CNC Machine Operator',
      match: 89,
      status: 'Active',
      experience: '3 years',
      location: 'New York, NY',
    },
    {
      id: 3,
      name: 'Maria Garcia',
      role: 'CNC Machine Operator',
      match: 91,
      status: 'Active',
      experience: '4 years',
      location: 'New York, NY',
    }
  ];

  return (
    <div className="min-h-screen bg-[#111317] text-gray-200 p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header / Search */}
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Recruiter Dashboard</h1>
          <p className="text-gray-400 text-sm mb-4">Search candidates by role, skill, or location...</p>
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#1A1D23] border border-gray-700 rounded-lg py-2.5 pl-10 pr-4 text-white focus:outline-none focus:border-[#2DCE89]"
              />
            </div>
            <button className="bg-[#2C313C] hover:bg-[#343B47] text-white px-6 py-2.5 rounded-lg font-medium transition-colors">
              Search
            </button>
          </div>
        </div>

        {/* Wage Predictor Widget */}
        <div>
          <h2 className="text-xl font-semibold text-white mb-4">Wage Predictor</h2>
          <div className="relative bg-gradient-to-br from-[#1E2734] to-[#15181E] border border-gray-700/50 rounded-2xl p-8 overflow-hidden shadow-2xl">
            {/* Glow effects */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-[#2DCE89] rounded-full blur-[100px] opacity-20"></div>
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-[#00D2FF] rounded-full blur-[100px] opacity-20"></div>

            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="flex-1">
                <p className="text-xs font-bold text-gray-400 tracking-wider mb-8">WAGE PREDICTOR: CNC Operator (New York, NY)</p>
                <div className="relative w-64 h-32 mx-auto overflow-hidden">
                  {/* Gauge Arc */}
                  <div className="absolute bottom-0 w-64 h-64 rounded-full border-[12px] border-transparent"
                       style={{ background: 'conic-gradient(from 180deg at 50% 50%, #FF5A5F 0deg, #FDB813 90deg, #2DCE89 180deg)' }}></div>
                  <div className="absolute bottom-0 w-64 h-64 rounded-full border-[16px] border-[#111317]"></div>
                  
                  {/* Gauge Needle */}
                  <div className="absolute bottom-0 left-1/2 w-1.5 h-24 bg-gray-300 origin-bottom rounded-t-full shadow-lg"
                       style={{ transform: 'translateX(-50%) rotate(45deg)' }}></div>
                  
                  {/* Gauge Pin */}
                  <div className="absolute bottom-[-8px] left-1/2 w-4 h-4 bg-white rounded-full transform -translate-x-1/2"></div>
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-2 px-4">
                  <div className="text-center">Low:<br/>$1100</div>
                  <div className="text-center">Market Avg:<br/>$1500</div>
                  <div className="text-center">High:<br/>$2000</div>
                </div>
              </div>
              
              <div className="flex-1 text-center md:text-left space-y-4">
                <div className="inline-block px-4 py-2 bg-gray-800/50 rounded-lg border border-gray-700/50">
                  <span className="text-sm text-gray-400">Your Offer: </span>
                  <span className="text-lg font-bold text-white">$1750</span>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white">Average market salary: $1500</h3>
                  <p className="text-[#2DCE89] font-medium mt-1">Your offer is highly competitive</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Search Results */}
        <div>
          <h2 className="text-xl font-semibold text-white mb-4">Candidate Search Results</h2>
          <div className="space-y-4">
            
            {/* Top Match Card */}
            <div className="bg-[#1A1D23] border border-gray-700 rounded-xl p-6 relative overflow-hidden group hover:border-gray-600 transition-colors">
              <div className="flex items-start gap-6">
                <div className="w-16 h-16 bg-gray-700 rounded-full flex-shrink-0 relative">
                  <img src="https://i.pravatar.cc/150?u=a042581f4e29026024d" alt="Candidate" className="w-full h-full rounded-full object-cover" />
                  <div className="absolute bottom-0 right-0 w-4 h-4 bg-[#2DCE89] border-2 border-[#1A1D23] rounded-full"></div>
                </div>
                
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="text-xl font-bold text-white">{candidates[0].name}</h3>
                        <span className="px-2.5 py-0.5 bg-[#2DCE89]/10 text-[#2DCE89] text-xs font-semibold rounded-full flex items-center gap-1">
                          <div className="w-1.5 h-1.5 bg-[#2DCE89] rounded-full"></div>
                          {candidates[0].status}
                        </span>
                      </div>
                      <p className="text-gray-400 text-sm mt-1">{candidates[0].role}</p>
                    </div>
                    <div className="bg-[#2DCE89]/20 text-[#2DCE89] px-4 py-1.5 rounded-full font-bold text-sm">
                      {candidates[0].match}% MATCH
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <div className="flex items-start gap-2 text-sm">
                        <ShieldCheck className="w-5 h-5 text-[#8B5CF6] flex-shrink-0" />
                        <div>
                          <span className="text-gray-400">Verified Skills: </span>
                          <span className="text-gray-200">{candidates[0].verifiedSkills.join(', ')}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <Briefcase className="w-4 h-4" />
                        <span>Years of Experience: {candidates[0].experience}</span>
                      </div>
                    </div>
                    
                    <div>
                      <p className="text-sm font-semibold text-gray-300 mb-2">Match reasons:</p>
                      <ul className="text-sm text-gray-400 space-y-1.5 list-disc list-inside">
                        {candidates[0].reasons.map((reason, idx) => (
                          <li key={idx}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Other Candidates */}
            {candidates.slice(1).map((candidate) => (
              <div key={candidate.id} className="bg-[#1A1D23] border border-gray-700/50 rounded-xl p-4 flex items-center justify-between hover:border-gray-600 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gray-700 rounded-full relative">
                    <img src={`https://i.pravatar.cc/150?u=${candidate.id}`} alt="Candidate" className="w-full h-full rounded-full object-cover opacity-80" />
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-[#2DCE89] border-2 border-[#1A1D23] rounded-full"></div>
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-gray-300">{candidate.name}</h4>
                    <p className="text-gray-500 text-sm">{candidate.role}</p>
                    <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3"/> {candidate.experience}</span>
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3"/> {candidate.location}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full border-2 border-[#2DCE89] text-[#2DCE89] font-bold text-sm">
                    {candidate.match}%
                  </div>
                  <div className="flex gap-2">
                    <button className="px-4 py-2 border border-gray-600 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors">
                      View Profile
                    </button>
                    <button className="px-4 py-2 bg-gray-200 text-gray-900 hover:bg-white rounded-lg text-sm font-medium transition-colors">
                      Contact
                    </button>
                  </div>
                </div>
              </div>
            ))}

          </div>
        </div>
      </div>
    </div>
  );
}
