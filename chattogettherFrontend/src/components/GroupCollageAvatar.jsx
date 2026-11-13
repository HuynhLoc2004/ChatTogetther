import React from 'react';
import { Users } from 'lucide-react';

const SECTOR_COLORS = [
  'bg-emerald-600 text-white',
  'bg-indigo-600 text-white',
  'bg-amber-600 text-white',
  'bg-rose-600 text-white',
  'bg-cyan-600 text-white',
  'bg-purple-600 text-white',
];

const getMonogram = (name) => {
  if (!name) return 'T';
  const clean = name.trim();
  return clean.charAt(0).toUpperCase();
};

const getColorClass = (name, index = 0) => {
  if (!name) return SECTOR_COLORS[index % SECTOR_COLORS.length];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % SECTOR_COLORS.length;
  return SECTOR_COLORS[idx];
};

export const GroupCollageAvatar = ({ 
  avatar, 
  name = 'Cộng đồng', 
  members = [], 
  users = [], 
  size = 44, 
  className = '', 
  style = {} 
}) => {
  // If custom avatar is set, render it directly
  if (avatar && typeof avatar === 'string' && avatar.trim().length > 0) {
    return (
      <div 
        className={`group-single-avatar rounded-2xl overflow-hidden flex-shrink-0 border border-white/10 shadow-sm ${className}`}
        style={{ width: size, height: size, ...style }}
      >
        <img 
          src={avatar} 
          alt={name} 
          className="w-full h-full object-cover"
          onError={(e) => {
            e.target.style.display = 'none';
          }}
        />
      </div>
    );
  }

  // Normalize members list
  const rawList = members.length > 0 ? members : users;
  const normalized = (rawList || []).map(m => {
    if (!m) return null;
    const user = m.userDTO || m.userEntity || m.user || m;
    const mAvatar = user.avatar || m.avatar;
    const mName = user.nickname || user.account || m.nickname || m.name || 'Member';
    return { avatar: mAvatar, name: mName };
  }).filter(Boolean);

  const count = normalized.length;

  // Case 0: No members yet -> Group Icon Monogram
  if (count === 0) {
    return (
      <div 
        className={`group-empty-avatar rounded-2xl bg-zinc-800 border border-white/10 flex items-center justify-center flex-shrink-0 text-zinc-400 shadow-sm ${className}`}
        style={{ width: size, height: size, ...style }}
      >
        <Users size={Math.round(size * 0.45)} strokeWidth={1.75} />
      </div>
    );
  }

  // Case 1: 1 member -> Single Avatar
  if (count === 1) {
    const mem = normalized[0];
    return (
      <div 
        className={`group-single-avatar rounded-2xl overflow-hidden flex items-center justify-center border border-white/10 flex-shrink-0 shadow-sm ${mem.avatar ? '' : getColorClass(mem.name, 0)} ${className}`}
        style={{ width: size, height: size, ...style }}
      >
        {mem.avatar ? (
          <img src={mem.avatar} alt={mem.name} className="w-full h-full object-cover" />
        ) : (
          <span className="font-bold select-none text-zinc-100" style={{ fontSize: Math.round(size * 0.42) }}>
            {getMonogram(mem.name)}
          </span>
        )}
      </div>
    );
  }

  // Case 2: 2 members -> Split Left & Right
  if (count === 2) {
    return (
      <div 
        className={`group-collage-split2 relative rounded-2xl overflow-hidden flex border border-white/10 flex-shrink-0 bg-zinc-900 shadow-sm ${className}`}
        style={{ width: size, height: size, ...style }}
      >
        {normalized.slice(0, 2).map((mem, idx) => (
          <div 
            key={idx} 
            className={`w-1/2 h-full relative overflow-hidden flex items-center justify-center ${idx === 0 ? 'border-r border-zinc-950/40' : ''} ${mem.avatar ? '' : getColorClass(mem.name, idx)}`}
          >
            {mem.avatar ? (
              <img src={mem.avatar} alt={mem.name} className="w-full h-full object-cover" />
            ) : (
              <span className="font-bold select-none text-zinc-100 text-[10px]">
                {getMonogram(mem.name)}
              </span>
            )}
          </div>
        ))}
      </div>
    );
  }

  // Case 3: 3 members -> Left half + Right top/bottom
  if (count === 3) {
    return (
      <div 
        className={`group-collage-split3 relative rounded-2xl overflow-hidden flex border border-white/10 flex-shrink-0 bg-zinc-900 shadow-sm ${className}`}
        style={{ width: size, height: size, ...style }}
      >
        {/* Left half */}
        <div className={`w-1/2 h-full relative overflow-hidden flex items-center justify-center border-r border-zinc-950/40 ${normalized[0].avatar ? '' : getColorClass(normalized[0].name, 0)}`}>
          {normalized[0].avatar ? (
            <img src={normalized[0].avatar} alt={normalized[0].name} className="w-full h-full object-cover" />
          ) : (
            <span className="font-bold select-none text-zinc-100 text-[11px]">
              {getMonogram(normalized[0].name)}
            </span>
          )}
        </div>
        {/* Right half stacked */}
        <div className="w-1/2 h-full flex flex-col">
          <div className={`w-full h-1/2 relative overflow-hidden flex items-center justify-center border-b border-zinc-950/40 ${normalized[1].avatar ? '' : getColorClass(normalized[1].name, 1)}`}>
            {normalized[1].avatar ? (
              <img src={normalized[1].avatar} alt={normalized[1].name} className="w-full h-full object-cover" />
            ) : (
              <span className="font-bold select-none text-zinc-100 text-[9px]">
                {getMonogram(normalized[1].name)}
              </span>
            )}
          </div>
          <div className={`w-full h-1/2 relative overflow-hidden flex items-center justify-center ${normalized[2].avatar ? '' : getColorClass(normalized[2].name, 2)}`}>
            {normalized[2].avatar ? (
              <img src={normalized[2].avatar} alt={normalized[2].name} className="w-full h-full object-cover" />
            ) : (
              <span className="font-bold select-none text-zinc-100 text-[9px]">
                {getMonogram(normalized[2].name)}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Case 4+: 4 quadrants 2x2 grid
  return (
    <div 
      className={`group-collage-quad relative rounded-2xl overflow-hidden grid grid-cols-2 grid-rows-2 border border-white/10 flex-shrink-0 bg-zinc-900 shadow-sm ${className}`}
      style={{ width: size, height: size, ...style }}
    >
      {normalized.slice(0, 4).map((mem, idx) => (
        <div 
          key={idx} 
          className={`w-full h-full relative overflow-hidden flex items-center justify-center border-zinc-950/30 ${idx % 2 === 0 ? 'border-r' : ''} ${idx < 2 ? 'border-b' : ''} ${mem.avatar ? '' : getColorClass(mem.name, idx)}`}
        >
          {mem.avatar ? (
            <img src={mem.avatar} alt={mem.name} className="w-full h-full object-cover" />
          ) : (
            <span className="font-bold select-none text-zinc-100 text-[8px]">
              {getMonogram(mem.name)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
};

export default GroupCollageAvatar;
