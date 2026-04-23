import type { IconType } from 'react-icons';
import { FiTrendingUp, FiTrendingDown, FiMinus } from 'react-icons/fi';

interface StatCardProps {
    title: string;
    value: string | number;
    icon: IconType;
    trend?: 'up' | 'down' | 'neutral';
    trendValue?: string;
    trendLabel?: string;
    color?: 'blue' | 'cyan' | 'emerald' | 'purple' | 'rose' | 'amber';
    className?: string;
}

const colorMap = {
    blue: {
        bg: 'bg-blue-950/20',
        border: 'border-blue-500/20',
        text: 'text-blue-400',
        hover: 'group-hover:border-blue-500/50 group-hover:shadow-[0_0_20px_-5px_rgba(59,130,246,0.3)]'
    },
    cyan: {
        bg: 'bg-cyan-950/20',
        border: 'border-cyan-500/20',
        text: 'text-cyan-400',
        hover: 'group-hover:border-cyan-500/50 group-hover:shadow-[0_0_20px_-5px_rgba(6,182,212,0.3)]'
    },
    emerald: {
        bg: 'bg-emerald-950/20',
        border: 'border-emerald-500/20',
        text: 'text-emerald-400',
        hover: 'group-hover:border-emerald-500/50 group-hover:shadow-[0_0_20px_-5px_rgba(16,185,129,0.3)]'
    },
    purple: {
        bg: 'bg-purple-950/20',
        border: 'border-purple-500/20',
        text: 'text-purple-400',
        hover: 'group-hover:border-purple-500/50 group-hover:shadow-[0_0_20px_-5px_rgba(168,85,247,0.3)]'
    },
    rose: {
        bg: 'bg-rose-950/20',
        border: 'border-rose-500/20',
        text: 'text-rose-400',
        hover: 'group-hover:border-rose-500/50 group-hover:shadow-[0_0_20px_-5px_rgba(244,63,94,0.3)]'
    },
    amber: {
        bg: 'bg-amber-950/20',
        border: 'border-amber-500/20',
        text: 'text-amber-400',
        hover: 'group-hover:border-amber-500/50 group-hover:shadow-[0_0_20px_-5px_rgba(245,158,11,0.3)]'
    }
};

export default function StatCard({ 
    title, 
    value, 
    icon: Icon, 
    trend, 
    trendValue, 
    trendLabel,
    color = 'cyan',
    className = ''
}: StatCardProps) {
    const styles = colorMap[color];

    return (
        <div className={`group relative p-6 rounded-xl border bg-[#050b14] backdrop-blur-sm transition-all duration-300 ${styles.border} ${styles.hover} ${className}`}>
            {/* Background Gradient */}
            <div className={`absolute inset-0 bg-gradient-to-br from-transparent to-${color}-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-xl`} />
            
            <div className="relative flex justify-between items-start mb-4">
                <div className={`p-3 rounded-lg ${styles.bg} ${styles.text} border border-white/5`}>
                    <Icon size={24} />
                </div>
                {trend && (
                    <div className={`flex items-center gap-1 text-xs font-mono font-bold px-2 py-1 rounded-full border ${
                        trend === 'up' ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' :
                        trend === 'down' ? 'text-rose-400 border-rose-500/30 bg-rose-500/10' :
                        'text-slate-400 border-slate-500/30 bg-slate-500/10'
                    }`}>
                        {trend === 'up' && <FiTrendingUp />}
                        {trend === 'down' && <FiTrendingDown />}
                        {trend === 'neutral' && <FiMinus />}
                        <span>{trendValue}</span>
                    </div>
                )}
            </div>

            <div className="relative">
                <h3 className="text-slate-500 font-mono text-xs uppercase tracking-widest mb-1">{title}</h3>
                <div className="text-3xl font-bold text-white tracking-tight">{value}</div>
                {trendLabel && (
                    <p className="text-[10px] text-slate-500 font-mono mt-2 flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full bg-slate-500" />
                        {trendLabel}
                    </p>
                )}
            </div>
        </div>
    );
}
