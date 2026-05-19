import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform, useSpring, useMotionValue } from 'framer-motion';
import {
    LuZap,
    LuShield,
    LuChartLine,
    LuArrowRight,
    LuClock,
    LuUsers,
    LuGitBranch,
    LuMousePointerClick,
    LuBrainCircuit,
    LuTarget,
} from 'react-icons/lu';
import { Logo } from '../components/common/Logo';

/* ------------------------------------------------------------------ */
/*  Animated particle grid background (Canvas)                        */
/* ------------------------------------------------------------------ */
function ParticleField() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const particles: { x: number; y: number; vx: number; vy: number; size: number }[] = [];

        const resize = () => {
            canvas.width = canvas.offsetWidth * window.devicePixelRatio;
            canvas.height = canvas.offsetHeight * window.devicePixelRatio;
            ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        };
        resize();
        window.addEventListener('resize', resize);

        const count = 60;
        for (let i = 0; i < count; i++) {
            particles.push({
                x: Math.random() * canvas.offsetWidth,
                y: Math.random() * canvas.offsetHeight,
                vx: (Math.random() - 0.5) * 0.3,
                vy: (Math.random() - 0.5) * 0.3,
                size: Math.random() * 2 + 1,
            });
        }

        let frame = 0;
        const animate = () => {
            frame = requestAnimationFrame(animate);
            ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);

            particles.forEach((p, i) => {
                p.x += p.vx;
                p.y += p.vy;
                if (p.x < 0 || p.x > canvas.offsetWidth) p.vx *= -1;
                if (p.y < 0 || p.y > canvas.offsetHeight) p.vy *= -1;

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(0,113,227,0.15)';
                ctx.fill();

                for (let j = i + 1; j < particles.length; j++) {
                    const q = particles[j];
                    const dx = p.x - q.x;
                    const dy = p.y - q.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 150) {
                        ctx.beginPath();
                        ctx.moveTo(p.x, p.y);
                        ctx.lineTo(q.x, q.y);
                        ctx.strokeStyle = `rgba(0,113,227,${0.08 * (1 - dist / 150)})`;
                        ctx.lineWidth = 0.5;
                        ctx.stroke();
                    }
                }
            });
        };
        animate();
        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener('resize', resize);
        };
    }, []);

    return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" style={{ opacity: 0.6 }} />;
}

/* ------------------------------------------------------------------ */
/*  Floating mockup card                                              */
/* ------------------------------------------------------------------ */
function MockupCard({
    children,
    className = '',
    delay = 0,
}: {
    children: React.ReactNode;
    className?: string;
    delay?: number;
}) {
    const y = useMotionValue(0);
    const springY = useSpring(y, { stiffness: 50, damping: 15 });

    useEffect(() => {
        const interval = setInterval(() => {
            y.set(Math.sin(Date.now() / 2000 + delay) * 8);
        }, 16);
        return () => clearInterval(interval);
    }, [y, delay]);

    return (
        <motion.div
            style={{ y: springY }}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: delay * 0.3, ease: 'easeOut' }}
            className={`rounded-[10px] border border-[#0f1012]/[0.08] bg-[#fdfdfd]/90 shadow-elevated backdrop-blur-xl ${className}`}
        >
            {children}
        </motion.div>
    );
}

/* ------------------------------------------------------------------ */
/*  Section wrapper with scroll reveal                                */
/* ------------------------------------------------------------------ */
function Section({
    children,
    className = '',
    delay = 0,
}: {
    children: React.ReactNode;
    className?: string;
    delay?: number;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 60 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.7, delay, ease: 'easeOut' }}
            className={className}
        >
            {children}
        </motion.div>
    );
}

/* ------------------------------------------------------------------ */
/*  Stat counter                                                      */
/* ------------------------------------------------------------------ */
function Counter({ target, suffix = '' }: { target: number; suffix?: string }) {
    const [count, setCount] = useState(0);
    const ref = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    const duration = 2000;
                    const startTime = performance.now();
                    const tick = (now: number) => {
                        const progress = Math.min((now - startTime) / duration, 1);
                        const eased = 1 - Math.pow(1 - progress, 3);
                        setCount(Math.floor(eased * target));
                        if (progress < 1) requestAnimationFrame(tick);
                    };
                    requestAnimationFrame(tick);
                    observer.disconnect();
                }
            },
            { threshold: 0.5 }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [target]);

    return (
        <span ref={ref}>
            {count.toLocaleString()}
            {suffix}
        </span>
    );
}

/* ------------------------------------------------------------------ */
/*  Main Landing Page                                                 */
/* ------------------------------------------------------------------ */
export default function LandingPage() {
    const navigate = useNavigate();
    const heroRef = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
    const heroOpacity = useTransform(scrollYProgress, [0, 0.85], [1, 0]);
    const heroY = useTransform(scrollYProgress, [0, 0.85], [0, -60]);

    return (
        <div className="relative min-h-[100dvh] overflow-x-hidden bg-[#f2f2f4]">
            {/* Navigation */}
            <nav className="fixed left-0 right-0 top-0 z-50 border-b border-[#0f1012]/[0.06] bg-[#fdfdfd]/80 backdrop-blur-xl">
                <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
                    <div className="flex items-center gap-2">
                        <Logo style={{ height: '28px', width: 'auto' }} />
                    </div>
                    <button
                        onClick={() => navigate('/login')}
                        className="rounded-[10px] bg-[#0f1012] px-5 py-2 text-sm font-medium text-white shadow-card transition-all hover:bg-[#020201] hover:scale-[1.02]"
                    >
                        Log In
                    </button>
                </div>
            </nav>

            {/* Hero Section */}
            <section ref={heroRef} className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden pt-14">
                <ParticleField />

                {/* Gradient orbs */}
                <div className="pointer-events-none absolute -left-32 top-1/4 size-96 rounded-full bg-[#0071e3]/10 blur-3xl" />
                <div className="pointer-events-none absolute -right-32 bottom-1/4 size-96 rounded-full bg-[#0071e3]/5 blur-3xl" />

                <motion.div
                    style={{ opacity: heroOpacity, y: heroY }}
                    className="relative z-10 mx-auto max-w-6xl px-6 text-center"
                >
                    {/* Headline */}
                    <motion.h1
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.1 }}
                        className="mx-auto max-w-4xl text-5xl font-semibold leading-[1.1] tracking-tight text-[#0f1012] sm:text-6xl md:text-7xl"
                    >
                        Orchestrate{' '}
                        <span className="relative inline-block">
                            <span className="bg-gradient-to-r from-[#0071e3] via-[#0071e3] to-[#0f1012] bg-clip-text text-transparent">
                                banking operations
                            </span>
                            <svg
                                className="absolute -bottom-2 left-0 w-full"
                                viewBox="0 0 400 12"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <motion.path
                                    d="M2 8C100 2 300 2 398 8"
                                    stroke="#0071e3"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    initial={{ pathLength: 0 }}
                                    animate={{ pathLength: 1 }}
                                    transition={{ duration: 1.2, delay: 0.8, ease: 'easeInOut' }}
                                />
                            </svg>
                        </span>{' '}
                        at scale
                    </motion.h1>

                    {/* Subtitle */}
                    <motion.p
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.25 }}
                        className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[#8f8f8f]"
                    >
                        Build intelligent case workflows, automate compliance checks, and route tasks across teams,
                        all in one unified platform designed for modern financial institutions.
                    </motion.p>

                    {/* CTAs */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.4 }}
                        className="mt-10 flex items-center justify-center gap-4"
                    >
                        <button
                            onClick={() => navigate('/login')}
                            className="group flex items-center gap-2 rounded-[10px] bg-[#0f1012] px-6 py-3 text-base font-medium text-white shadow-elevated transition-all hover:bg-[#020201] hover:scale-[1.02]"
                        >
                            Start Building
                            <LuArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                        </button>
                        <button
                            onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                            className="rounded-[10px] border border-[#0f1012]/[0.08] bg-[#fdfdfd] px-6 py-3 text-base font-medium text-[#0f1012] shadow-card transition-all hover:bg-[#f2f2f4]"
                        >
                            See How It Works
                        </button>
                    </motion.div>

                    {/* Floating mockups */}
                    <div className="relative mx-auto mt-20 max-w-5xl">
                        <div className="relative grid grid-cols-1 gap-4 md:grid-cols-3">
                            {/* Flow builder mockup */}
                            <MockupCard delay={0.5} className="md:col-span-2 md:row-span-2 p-5">
                                <div className="mb-4 flex items-center gap-2">
                                    <div className="h-2 w-2 rounded-full bg-[#b71c1c]" />
                                    <div className="h-2 w-2 rounded-full bg-[#f57f17]" />
                                    <div className="h-2 w-2 rounded-full bg-[#1b5e20]" />
                                    <span className="ml-2 text-xs text-[#868788]">Flow Builder</span>
                                </div>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3 rounded-[8px] border border-[#0f1012]/[0.06] bg-[#f2f2f4] p-3">
                                        <div className="flex size-8 items-center justify-center rounded-[6px] bg-[#1b5e20]">
                                            <LuZap className="size-4 text-white" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-xs font-medium text-[#0f1012]">Trigger: New Case</div>
                                            <div className="text-[10px] text-[#868788]">Case-AML-1042 · Financial Crime</div>
                                        </div>
                                    </div>
                                    <div className="ml-4 flex items-center gap-3 rounded-[8px] border border-[#0f1012]/[0.06] bg-[#f2f2f4] p-3">
                                        <div className="flex size-8 items-center justify-center rounded-[6px] bg-[#0071e3]">
                                            <LuShield className="size-4 text-white" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-xs font-medium text-[#0f1012]">Approval: Risk Review</div>
                                            <div className="text-[10px] text-[#868788]">Assigned to Compliance Team</div>
                                        </div>
                                    </div>
                                    <div className="ml-8 flex items-center gap-3 rounded-[8px] border border-[#0f1012]/[0.06] bg-[#f2f2f4] p-3">
                                        <div className="flex size-8 items-center justify-center rounded-[6px] bg-[#f57f17]">
                                            <LuGitBranch className="size-4 text-white" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-xs font-medium text-[#0f1012]">Decision: High Risk?</div>
                                            <div className="text-[10px] text-[#868788]">Branch to escalation or close</div>
                                        </div>
                                    </div>
                                </div>
                            </MockupCard>

                            {/* Stats card */}
                            <MockupCard delay={1} className="p-4">
                                <div className="mb-3 text-xs font-medium text-[#868788]">Today's Activity</div>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-[#0f1012]">Cases Opened</span>
                                        <span className="text-sm font-semibold text-[#0071e3]">142</span>
                                    </div>
                                    <div className="h-px bg-[#0f1012]/[0.06]" />
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-[#0f1012]">Resolved</span>
                                        <span className="text-sm font-semibold text-[#1b5e20]">98</span>
                                    </div>
                                    <div className="h-px bg-[#0f1012]/[0.06]" />
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-[#0f1012]">Pending</span>
                                        <span className="text-sm font-semibold text-[#f57f17]">23</span>
                                    </div>
                                </div>
                            </MockupCard>

                            {/* Task card */}
                            <MockupCard delay={1.5} className="p-4">
                                <div className="mb-3 text-xs font-medium text-[#868788]">Next Task</div>
                                <div className="rounded-[8px] border border-[#0f1012]/[0.06] bg-[#f2f2f4] p-3">
                                    <div className="text-xs font-medium text-[#0f1012]">Review KYC Documents</div>
                                    <div className="mt-1 text-[10px] text-[#868788]">Due in 2 hours</div>
                                    <div className="mt-2 flex items-center gap-1 text-[10px] text-[#b71c1c]">
                                        <LuClock className="size-3" />
                                        High Priority
                                    </div>
                                </div>
                                <div className="mt-2 flex items-center gap-1 text-[10px] text-[#868788]">
                                    <LuUsers className="size-3" />
                                    Assigned to you
                                </div>
                            </MockupCard>
                        </div>
                    </div>
                </motion.div>
            </section>

            {/* Stats Strip */}
            <section className="relative border-y border-[#0f1012]/[0.06] bg-[#fdfdfd] py-16">
                <div className="mx-auto grid max-w-5xl grid-cols-2 gap-8 px-6 md:grid-cols-4">
                    {[
                        { value: 50000, suffix: '+', label: 'Cases Processed' },
                        { value: 99, suffix: '%', label: 'SLA Compliance' },
                        { value: 12, suffix: 'h', label: 'Avg. Resolution' },
                        { value: 240, suffix: '+', label: 'Financial Clients' },
                    ].map((stat, i) => (
                        <Section key={i} className="text-center">
                            <div className="text-3xl font-semibold text-[#0f1012] md:text-4xl">
                                <Counter target={stat.value} suffix={stat.suffix} />
                            </div>
                            <div className="mt-1 text-sm text-[#868788]">{stat.label}</div>
                        </Section>
                    ))}
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="relative py-24">
                <div className="mx-auto max-w-6xl px-6">
                    <Section className="mb-16 text-center">
                        <h2 className="text-3xl font-semibold text-[#0f1012] md:text-4xl">
                            Everything you need to{' '}
                            <span className="bg-gradient-to-r from-[#0071e3] to-[#0f1012] bg-clip-text text-transparent">
                                run operations
                            </span>
                        </h2>
                        <p className="mx-auto mt-4 max-w-xl text-[#8f8f8f]">
                            From case intake to resolution, every step is visible, automated, and auditable.
                        </p>
                    </Section>

                    <div className="grid gap-6 md:grid-cols-3">
                        {[
                            {
                                icon: LuMousePointerClick,
                                color: '#0071e3',
                                title: 'Visual Flow Builder',
                                desc: 'Design complex workflows with drag-and-drop nodes. No code required.',
                            },
                            {
                                icon: LuShield,
                                color: '#1b5e20',
                                title: 'Compliance Built-In',
                                desc: 'Every action is logged, every decision is traceable. Audit-ready by default.',
                            },
                            {
                                icon: LuChartLine,
                                color: '#f57f17',
                                title: 'Real-Time Insights',
                                desc: 'Track SLAs, bottlenecks, and team performance from a single dashboard.',
                            },
                            {
                                icon: LuBrainCircuit,
                                color: '#0071e3',
                                title: 'Smart Routing',
                                desc: 'Route cases to the right team automatically based on rules and workload.',
                            },
                            {
                                icon: LuTarget,
                                color: '#f57f17',
                                title: 'Decision Logic',
                                desc: 'Branch workflows based on conditions, data fields, and risk scores.',
                            },
                            {
                                icon: LuUsers,
                                color: '#1b5e20',
                                title: 'Team Collaboration',
                                desc: 'Claims, approvals, and escalations. All in one shared workspace.',
                            },
                        ].map((feature, i) => (
                            <Section key={i} delay={i * 0.1}>
                                <motion.div
                                    whileHover={{ y: -4, transition: { duration: 0.2 } }}
                                    className="group h-full rounded-[10px] border border-[#0f1012]/[0.08] bg-[#fdfdfd] p-6 shadow-card transition-shadow hover:shadow-elevated"
                                >
                                    <feature.icon className="mb-4 size-7" style={{ color: feature.color }} strokeWidth={1.5} />
                                    <h3 className="text-base font-semibold text-[#0f1012]">{feature.title}</h3>
                                    <p className="mt-2 text-sm leading-relaxed text-[#868788]">{feature.desc}</p>
                                </motion.div>
                            </Section>
                        ))}
                    </div>
                </div>
            </section>

            {/* How It Works */}
            <section className="relative bg-[#0f1012] py-24 text-white">
                <div className="pointer-events-none absolute inset-0 opacity-20">
                    <div className="absolute left-1/4 top-0 size-96 rounded-full bg-[#0071e3] blur-3xl" />
                    <div className="absolute bottom-0 right-1/4 size-96 rounded-full bg-[#0071e3] blur-3xl" />
                </div>

                <div className="relative mx-auto max-w-6xl px-6">
                    <Section className="mb-16 text-center">
                        <h2 className="text-3xl font-semibold md:text-4xl">How it works</h2>
                        <p className="mx-auto mt-4 max-w-xl text-[#868788]">
                            From the first alert to the final sign-off, Bankflow keeps every case moving.
                        </p>
                    </Section>

                    <div className="grid gap-8 md:grid-cols-3">
                        {[
                            {
                                step: '01',
                                title: 'Ingest',
                                desc: 'Connect your alerts, forms, and systems. Every new signal becomes a case automatically.',
                            },
                            {
                                step: '02',
                                title: 'Route',
                                desc: 'Flows decide who does what. Cases go to the right team with the right context instantly.',
                            },
                            {
                                step: '03',
                                title: 'Resolve',
                                desc: 'Track every step, meet every SLA, and close every case with a full audit trail.',
                            },
                        ].map((item, i) => (
                            <Section key={i}>
                                <div className="relative">
                                    <div className="mb-4 text-5xl font-bold" style={{ color: '#4a9eff' }}>{item.step}</div>
                                    <h3 className="text-xl font-semibold">{item.title}</h3>
                                    <p className="mt-2 text-sm leading-relaxed text-[#868788]">{item.desc}</p>
                                </div>
                            </Section>
                        ))}
                    </div>
                </div>
            </section>

            {/* Final CTA */}
            <section className="relative pb-24 pt-12">
                <Section>
                    <div className="mx-auto max-w-4xl rounded-[10px] border border-[#0f1012]/[0.08] bg-[#fdfdfd] p-12 text-center shadow-elevated">
                        <h2 className="text-3xl font-semibold text-[#0f1012] md:text-4xl">
                            Ready to streamline your operations?
                        </h2>
                        <p className="mx-auto mt-4 max-w-lg text-[#8f8f8f]">
                            Join hundreds of financial institutions that use Bankflow to move faster and stay compliant.
                        </p>
                        <div className="mt-8 flex items-center justify-center gap-4">
                            <button
                                onClick={() => navigate('/login')}
                                className="group flex items-center gap-2 rounded-[10px] bg-[#0f1012] px-6 py-3 text-base font-medium text-white shadow-elevated transition-all hover:bg-[#020201] hover:scale-[1.02]"
                            >
                                Get Started
                                <LuArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                            </button>
                        </div>
                    </div>
                </Section>
            </section>

            {/* Footer */}
            <footer className="border-t border-[#0f1012]/[0.06] bg-[#fdfdfd] py-12">
                <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-6 md:flex-row">
                    <div className="flex items-center gap-2">
                        <Logo style={{ height: '24px', width: 'auto' }} />
                    </div>
                    <p className="text-xs text-[#868788]">
                        &copy; {new Date().getFullYear()} Bankflow. Built for financial operations teams.
                    </p>
                </div>
            </footer>
        </div>
    );
}
