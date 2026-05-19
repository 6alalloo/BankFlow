import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend,
    BarChart,
    Bar
} from 'recharts';

// --- Types ---
interface ActivityData {
    name: string;
    value: number;
}

interface StatusData {
    name: string;
    value: number;
    color: string;
    [key: string]: string | number;
}

interface VolumeData {
    name: string;
    value: number;
}

// --- Activity Area Chart ---
interface ActivityChartProps {
    data: ActivityData[];
    color?: string;
}

export function ActivityChart({ data, color = "#8f8f8f" }: ActivityChartProps) {
    const gradientId = `colorValue-${color.replace('#', '')}`;
    return (
        <div className="w-full h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={color} stopOpacity={0.2}/>
                            <stop offset="95%" stopColor={color} stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" opacity={0.5} vertical={false} />
                    <XAxis 
                        dataKey="name" 
                        stroke="#868788" 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false}
                        dy={10}
                    />
                    <YAxis 
                        stroke="#868788" 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false}
                    />
                    <Tooltip 
                        contentStyle={{ 
                            backgroundColor: '#fdfdfd', 
                            borderColor: 'rgba(15,16,18,0.08)', 
                            borderRadius: '10px', 
                            boxShadow: '0 8px 30px rgba(15,16,18,0.08)' 
                        }}
                        itemStyle={{ color: '#0f1012', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }}
                        labelStyle={{ color: '#8f8f8f', marginBottom: '4px', fontSize: '10px', textTransform: 'uppercase' }}
                    />
                    <Area 
                        type="monotone" 
                        dataKey="value" 
                        stroke={color} 
                        strokeWidth={1.5}
                        fillOpacity={1} 
                        fill={`url(#${gradientId})`} 
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

// --- Status Donut Chart ---
interface StatusChartProps {
    data: StatusData[];
}

export function StatusChart({ data }: StatusChartProps) {
    return (
        <div className="w-full h-[250px] flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                    >
                        {data.map((entry) => (
                            <Cell key={`cell-${entry.name}`} fill={entry.color} />
                        ))}
                    </Pie>
                    <Tooltip 
                        contentStyle={{ 
                            backgroundColor: '#fdfdfd', 
                            borderColor: 'rgba(15,16,18,0.08)', 
                            borderRadius: '10px'
                        }}
                        itemStyle={{ color: '#0f1012', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }}
                    />
                    <Legend 
                        layout="vertical" 
                        verticalAlign="middle" 
                        align="right"
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#8f8f8f' }}
                    />
                </PieChart>
            </ResponsiveContainer>
             {/* Center Text Overlay */}
             <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pr-14">
                <span className="text-2xl font-medium text-[#0f1012] font-mono">
                    {data.reduce((acc, curr) => acc + curr.value, 0)}
                </span>
                <span className="text-[9px] text-[#868788] font-mono uppercase tracking-widest">Total</span>
            </div>
        </div>
    );
}

// --- Thin Sparkline ---
interface SparklineProps {
    data: ActivityData[];
    color?: string;
    height?: number;
}

export function Sparkline({ data, color = "#8f8f8f", height = 40 }: SparklineProps) {
    if (data.length === 0) return <div className="w-full" style={{ height }} />;
    const max = Math.max(...data.map((d) => d.value), 1);
    const points = data
        .map((d, i) => {
            const x = (i / (data.length - 1)) * 100;
            const y = 100 - (d.value / max) * 100;
            return `${x},${y}`;
        })
        .join(" ");
    return (
        <div className="w-full" style={{ height }}>
            <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                <polyline
                    fill="none"
                    stroke={color}
                    strokeWidth="2"
                    points={points}
                    vectorEffect="non-scaling-stroke"
                />
                <polygon
                    fill={color}
                    fillOpacity="0.08"
                    points={`${points} 100,100 0,100`}
                />
            </svg>
        </div>
    );
}

// --- Volume Bar Chart ---
interface VolumeChartProps {
    data: VolumeData[];
}

export function VolumeChart({ data }: VolumeChartProps) {
    return (
        <div className="w-full h-[120px] mt-4">
             <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" opacity={0.3} vertical={false} />
                    <XAxis 
                        dataKey="name" 
                        stroke="#868788" 
                        fontSize={8} 
                        tickLine={false} 
                        axisLine={false}
                        dy={5}
                        interval={0}
                    />
                     <YAxis 
                        stroke="#868788" 
                        fontSize={8} 
                        tickLine={false} 
                        axisLine={false}
                    />
                    <Tooltip 
                        cursor={{ fill: 'rgba(15,16,18,0.03)' }}
                        contentStyle={{ 
                            backgroundColor: '#fdfdfd', 
                            borderColor: 'rgba(15,16,18,0.08)', 
                            borderRadius: '10px',
                            fontSize: '10px'
                        }}
                        itemStyle={{ color: '#0f1012', fontFamily: 'JetBrains Mono, monospace' }}
                    />
                    <Bar 
                        dataKey="value" 
                        fill="#8f8f8f"
                        radius={[2, 2, 0, 0]} 
                        barSize={4}
                    />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
