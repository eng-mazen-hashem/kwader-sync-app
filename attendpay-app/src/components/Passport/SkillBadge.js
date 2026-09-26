import React from 'react';
import { User, ShieldCheck, Award } from 'lucide-react';

export default function SkillBadge({ type, title, subText }) {
  let badgeConfig = {
    color: '#64748B', // default gray
    bg: 'rgba(100, 116, 139, 0.1)',
    border: 'rgba(100, 116, 139, 0.3)',
    icon: <User className="w-4 h-4" />
  };

  if (type === 'self') {
    badgeConfig = {
      color: '#FDB813', // Yellow
      bg: 'rgba(253, 184, 19, 0.1)',
      border: 'rgba(253, 184, 19, 0.3)',
      icon: <User className="w-4 h-4" />
    };
  } else if (type === 'kwader') {
    badgeConfig = {
      color: '#2DCE89', // Green
      bg: 'rgba(45, 206, 137, 0.1)',
      border: 'rgba(45, 206, 137, 0.3)',
      icon: <Award className="w-4 h-4" />
    };
  } else if (type === 'employer') {
    badgeConfig = {
      color: '#8B5CF6', // Purple
      bg: 'rgba(139, 92, 246, 0.1)',
      border: 'rgba(139, 92, 246, 0.3)',
      icon: <ShieldCheck className="w-4 h-4" />
    };
  }

  return (
    <div 
      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-right shadow-sm backdrop-blur-sm transition-all duration-300 hover:scale-105"
      style={{
        backgroundColor: badgeConfig.bg,
        borderColor: badgeConfig.border,
        color: badgeConfig.color
      }}
    >
      <div>
        <p className="text-[10px] font-bold leading-tight">{title}</p>
        <p className="text-[9px] opacity-80 leading-tight whitespace-pre-line mt-0.5">{subText}</p>
      </div>
      <div className="p-1 rounded-md" style={{ backgroundColor: badgeConfig.bg }}>
        {badgeConfig.icon}
      </div>
    </div>
  );
}
