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
    [key: string]: string | number; // Index signature for recharts compatibility
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

export function ActivityChart({ data, color = "#06b6d4" }: ActivityChartProps) {
    return (
        <div className="w-full h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                            <stop offset="95%" stopColor={color} stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} vertical={false} />
                    <XAxis 
                        dataKey="name" 
                        stroke="#94a3b8" 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false}
                        dy={10}
                    />
                    <YAxis 
                        stroke="#94a3b8" 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false}
                    />
                    <Tooltip 
                        contentStyle={{ 
                            backgroundColor: '#020617', 
                            borderColor: '#1e293b', 
                            borderRadius: '8px', 
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.5)' 
                        }}
                        itemStyle={{ color: '#e2e8f0', fontFamily: 'monospace', fontSize: '12px' }}
                        labelStyle={{ color: '#94a3b8', marginBottom: '4px', fontSize: '10px', textTransform: 'uppercase' }}
                    />
                    <Area 
                        type="monotone" 
                        dataKey="value" 
                        stroke={color} 
                        strokeWidth={2}
                        fillOpacity={1} 
                        fill="url(#colorValue)" 
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
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                    </Pie>
                    <Tooltip 
                        contentStyle={{ 
                            backgroundColor: '#020617', 
                            borderColor: '#1e293b', 
                            borderRadius: '8px'
                        }}
                        itemStyle={{ color: '#e2e8f0', fontFamily: 'monospace', fontSize: '12px' }}
                    />
                    <Legend 
                        layout="vertical" 
                        verticalAlign="middle" 
                        align="right"
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em' }}
                    />
                </PieChart>
            </ResponsiveContainer>
             {/* Center Text Overlay */}
             <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pr-14">
                <span className="text-2xl font-bold text-white">
                    {data.reduce((acc, curr) => acc + curr.value, 0)}
                </span>
                <span className="text-[9px] text-slate-500 font-mono uppercase tracking-widest">Total</span>
            </div>
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
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.1} vertical={false} />
                    <XAxis 
                        dataKey="name" 
                        stroke="#94a3b8" 
                        fontSize={8} 
                        tickLine={false} 
                        axisLine={false}
                        dy={5}
                        interval={0}
                    />
                     <YAxis 
                        stroke="#94a3b8" 
                        fontSize={8} 
                        tickLine={false} 
                        axisLine={false}
                    />
                    <Tooltip 
                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                        contentStyle={{ 
                            backgroundColor: '#020617', 
                            borderColor: '#1e293b', 
                            borderRadius: '8px',
                            fontSize: '10px'
                        }}
                        itemStyle={{ color: '#38bdf8' }}
                    />
                    <Bar 
                        dataKey="value" 
                        fill="#0ea5e9"
                        radius={[2, 2, 0, 0]} 
                        barSize={4}
                    />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
