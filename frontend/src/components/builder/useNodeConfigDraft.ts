import { useCallback, useEffect, useRef, useState } from "react";

type DraftNode = {
  id: number;
  config: Record<string, unknown>;
} | null;

export function useNodeConfigDraft(
  node: DraftNode,
  onUpdate: (id: number, update: { config?: Record<string, unknown>; name?: string }) => void
) {
  const [localConfig, setLocalConfig] = useState<Record<string, unknown>>({});
  const autosaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedConfigRef = useRef("");
  const nodeId = node?.id;

  useEffect(() => {
    const nextConfig = node?.config || {};
    // This hook owns a local editable draft that must reset when a different node is selected.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalConfig(nextConfig);
    lastSavedConfigRef.current = JSON.stringify(nextConfig);
  }, [nodeId, node?.config]);

  useEffect(() => {
    if (!node) return;

    const currentConfigStr = JSON.stringify(localConfig);
    if (currentConfigStr === lastSavedConfigRef.current) return;

    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }

    autosaveTimeoutRef.current = setTimeout(() => {
      onUpdate(node.id, { config: localConfig });
      lastSavedConfigRef.current = currentConfigStr;
    }, 500);

    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, [localConfig, node, onUpdate]);

  const handleChange = useCallback((key: string, val: unknown) => {
    setLocalConfig((prev) => ({ ...prev, [key]: val }));
  }, []);

  const saveNow = useCallback(() => {
    if (!node) return;
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }
    onUpdate(node.id, { config: localConfig });
    lastSavedConfigRef.current = JSON.stringify(localConfig);
  }, [node, localConfig, onUpdate]);

  return {
    localConfig,
    setLocalConfig,
    handleChange,
    saveNow,
  };
}
