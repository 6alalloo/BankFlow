import { useState, useEffect, useRef, useMemo } from 'react';
import { LuX, LuSearch, LuCommand } from 'react-icons/lu';
import { LazyMotion, domAnimation, m, AnimatePresence } from 'framer-motion';
import { NODE_TYPES, type NodeTypeDef } from './nodePickerOptions';

type NodePickerProps = {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (kind: string) => void;
    position?: { x: number; y: number } | null;
};

const CATEGORY_LABELS: Record<string, string> = {
    case: 'Case Steps',
    decision: 'Decisions',
    utility: 'Utilities',
};

const CATEGORY_ORDER = ['case', 'decision', 'utility'];

export default function NodePicker({ isOpen, onClose, onSelect, position }: NodePickerProps) {
    const [query, setQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [isOpen, onClose]);

    const filtered = useMemo(() => {
        const q = query.toLowerCase().trim();
        if (!q) return NODE_TYPES;
        return NODE_TYPES.filter(
            (t) =>
                t.label.toLowerCase().includes(q) ||
                t.kind.toLowerCase().includes(q) ||
                t.description.toLowerCase().includes(q)
        );
    }, [query]);

    const grouped = useMemo(() => {
        const map: Record<string, NodeTypeDef[]> = {};
        filtered.forEach((t) => {
            if (!map[t.category]) map[t.category] = [];
            map[t.category].push(t);
        });
        return CATEGORY_ORDER.filter((c) => map[c]?.length > 0).map((c) => ({
            category: c,
            label: CATEGORY_LABELS[c],
            items: map[c],
        }));
    }, [filtered]);

    if (!isOpen) return null;

    const content = (
        <m.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative z-50 w-[520px] overflow-hidden rounded-[10px] border border-[#0f1012]/[0.08] bg-[#fdfdfd] shadow-elevated"
            onClick={(e) => e.stopPropagation()}
        >
            {/* Search Header */}
            <div className="flex items-center gap-3 border-b border-[#0f1012]/[0.06] px-4 py-3">
                <LuSearch className="size-4 text-[#868788]" />
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search nodes..."
                    className="flex-1 bg-transparent text-sm text-[#0f1012] outline-none placeholder:text-[#868788]"
                />
                <div className="flex items-center gap-1 rounded-[6px] border border-[#0f1012]/[0.08] bg-[#f2f2f4] px-1.5 py-0.5 text-[10px] text-[#868788]">
                    <LuCommand className="size-3" />
                    <span>K</span>
                </div>
                <button onClick={onClose} className="text-[#868788] transition-colors hover:text-[#0f1012]">
                    <LuX size={16} />
                </button>
            </div>

            {/* Results */}
            <div className="max-h-[400px] overflow-y-auto p-2 custom-scrollbar">
                {grouped.length === 0 ? (
                    <div className="py-8 text-center text-sm text-[#868788]">No nodes match "{query}"</div>
                ) : (
                    grouped.map((group) => (
                        <div key={group.category} className="mb-2">
                            <div className="px-2 py-1.5 text-[9px] font-semibold uppercase tracking-wider text-[#868788]">
                                {group.label}
                            </div>
                            <div className="space-y-0.5">
                                {group.items.map((item) => (
                                    <button
                                        key={item.kind}
                                        type="button"
                                        onClick={() => onSelect(item.kind)}
                                        className="group flex w-full items-center gap-3 rounded-[8px] border border-transparent px-2.5 py-2 text-left transition hover:border-[#0f1012]/[0.06] hover:bg-[#0f1012]/[0.03]"
                                    >
                                        <div
                                            className="flex size-7 items-center justify-center rounded-[6px] border border-white/10 shadow-sm"
                                            style={{ backgroundColor: item.accent }}
                                        >
                                            <item.icon className="size-3.5 text-white" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-sm font-medium text-[#0f1012]">{item.label}</div>
                                            <div className="truncate text-[11px] text-[#868788]">{item.description}</div>
                                        </div>
                                        <span className="text-[10px] text-[#868788] opacity-0 transition-opacity group-hover:opacity-100">
                                            Select
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Footer hint */}
            <div className="flex items-center justify-between border-t border-[#0f1012]/[0.06] bg-[#0f1012]/[0.02] px-3 py-2 text-[10px] text-[#868788]">
                <span>{filtered.length} node type{filtered.length !== 1 ? 's' : ''}</span>
                <span className="flex items-center gap-1">
                    <kbd className="rounded-[4px] border border-[#0f1012]/[0.08] bg-[#f2f2f4] px-1 py-0.5 font-mono text-[9px]">↑↓</kbd>
                    to navigate
                    <kbd className="ml-1 rounded-[4px] border border-[#0f1012]/[0.08] bg-[#f2f2f4] px-1 py-0.5 font-mono text-[9px]">Enter</kbd>
                    to select
                </span>
            </div>
        </m.div>
    );

    return (
        <LazyMotion features={domAnimation}>
            <AnimatePresence>
                {position ? (
                    <div className="pointer-events-none absolute left-0 top-0 z-50 h-full w-full">
                        <div
                            className="pointer-events-auto"
                            style={{ position: 'absolute', left: position.x, top: position.y, transform: 'translate(20px, -50%)' }}
                        >
                            {content}
                        </div>
                        <button
                            type="button"
                            aria-label="Close node picker"
                            className="absolute inset-0 z-40"
                            onClick={onClose}
                        />
                    </div>
                ) : (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f1012]/20 backdrop-blur-sm">
                        <button type="button" aria-label="Close node picker" className="absolute inset-0" onClick={onClose} />
                        {content}
                    </div>
                )}
            </AnimatePresence>
        </LazyMotion>
    );
}
