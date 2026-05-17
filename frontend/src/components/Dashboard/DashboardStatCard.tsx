import type { IconType } from 'react-icons';
import { FiTrendingUp, FiTrendingDown, FiMinus } from 'react-icons/fi';

interface StatCardProps {
    title: string;
    value: string | number;
    icon: IconType;
    trend?: 'up' | 'down' | 'neutral';
    trendValue?: string;
    trendLabel?: string;
    color?: 'neutral' | 'mint' | 'ember';
    className?: string;
}

const colorMap = {
    neutral: {
        border: 'border-white/[0.08]',
        hover: 'hover:border-white/[0.18]',
        iconBg: 'bg-[#111214]',
        iconText: 'text-[#9c9c9d]',
    },
    mint: {
        border: 'border-[#59d499]/20',
        hover: 'hover:border-[#59d499]/40',
        iconBg: 'bg-[#0d2b1a]',
        iconText: 'text-[#59d499]',
    },
    ember: {
        border: 'border-[#ff6363]/20',
        hover: 'hover:border-[#ff6363]/40',
        iconBg: 'bg-[#452324]',
        iconText: 'text-[#ff6363]',
    },
};

export default function StatCard({ 
    title, 
    value, 
    icon: Icon, 
    trend, 
    trendValue, 
    trendLabel,
    color = 'neutral',
    className = ''
}: StatCardProps) {
    const styles = colorMap[color];

    return (
        <div className={`group relative p-5 rounded-2xl border bg-[#07080a] transition-all duration-300 ${styles.border} ${styles.hover} ${className}`}>
            <div className="relative flex justify-between items-start mb-4">
                <div className={`p-2.5 rounded-lg ${styles.iconBg} ${styles.iconText} border border-white/[0.08]`}>
                    <Icon size={20} />
                </div>
                {trend && (
                    <div className={`flex items-center gap-1 text-xs font-mono font-semibold px-2 py-0.5 rounded-md border ${
                        trend === 'up' ? 'text-[#59d499] border-[#59d499]/20 bg-[#0d2b1a]' :
                        trend === 'down' ? 'text-[#ff6363] border-[#ff6363]/20 bg-[#452324]' :
                        'text-[#9c9c9d] border-white/[0.08] bg-[#111214]'
                    }`}>
                        {trend === 'up' && <FiTrendingUp />}
                        {trend === 'down' && <FiTrendingDown />}
                        {trend === 'neutral' && <FiMinus />}
                        <span>{trendValue}</span>
                    </div>
                )}
            </div>

            <div className="relative">
                <h3 className="text-[#6a6b6c] font-mono text-[10px] uppercase tracking-widest mb-1">{title}</h3>
                <div className="text-2xl font-semibold text-white tracking-tight font-mono">{value}</div>
                {trendLabel && (
                    <p className="text-[10px] text-[#6a6b6c] font-mono mt-2 flex items-center gap-1">
                        <span className="size-1 rounded-full bg-[#6a6b6c]" />
                        {trendLabel}
                    </p>
                )}
            </div>
        </div>
    );
}
