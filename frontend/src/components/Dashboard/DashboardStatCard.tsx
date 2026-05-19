import type { IconType } from 'react-icons';
import { FiTrendingUp, FiTrendingDown, FiMinus } from 'react-icons/fi';

interface StatCardProps {
    title: string;
    value: string | number;
    icon: IconType;
    trend?: 'up' | 'down' | 'neutral';
    trendValue?: string;
    trendLabel?: string;
    color?: 'neutral' | 'success' | 'danger';
    className?: string;
}

const colorMap = {
    neutral: {
        border: 'border-[#0f1012]/[0.08]',
        hover: 'hover:border-[#0f1012]/[0.18]',
        iconBg: 'bg-[#f2f2f4]',
        iconText: 'text-[#8f8f8f]',
    },
    success: {
        border: 'border-[#1b5e20]/20',
        hover: 'hover:border-[#1b5e20]/40',
        iconBg: 'bg-[#e8f5e9]',
        iconText: 'text-[#1b5e20]',
    },
    danger: {
        border: 'border-[#b71c1c]/20',
        hover: 'hover:border-[#b71c1c]/40',
        iconBg: 'bg-[#ffebee]',
        iconText: 'text-[#b71c1c]',
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
        <div className={`group relative p-5 rounded-[10px] border bg-[#fdfdfd] transition-all duration-200 ${styles.border} ${styles.hover} ${className}`}>
            <div className="relative flex justify-between items-start mb-4">
                <div className={`p-2.5 rounded-[6px] ${styles.iconBg} ${styles.iconText} border border-[#0f1012]/[0.08]`}>
                    <Icon size={20} />
                </div>
                {trend && (
                    <div className={`flex items-center gap-1 text-xs font-mono font-medium px-2 py-0.5 rounded-[6px] border ${
                        trend === 'up' ? 'text-[#1b5e20] border-[#1b5e20]/20 bg-[#e8f5e9]' :
                        trend === 'down' ? 'text-[#b71c1c] border-[#b71c1c]/20 bg-[#ffebee]' :
                        'text-[#8f8f8f] border-[#0f1012]/[0.08] bg-[#f2f2f4]'
                    }`}>
                        {trend === 'up' && <FiTrendingUp />}
                        {trend === 'down' && <FiTrendingDown />}
                        {trend === 'neutral' && <FiMinus />}
                        <span>{trendValue}</span>
                    </div>
                )}
            </div>

            <div className="relative">
                <h3 className="text-[#868788] font-mono text-[10px] uppercase tracking-widest mb-1">{title}</h3>
                <div className="text-2xl font-medium text-[#0f1012] tracking-tight font-mono">{value}</div>
                {trendLabel && (
                    <p className="text-[10px] text-[#868788] font-mono mt-2 flex items-center gap-1">
                        <span className="size-1 rounded-full bg-[#868788]" />
                        {trendLabel}
                    </p>
                )}
            </div>
        </div>
    );
}
