import React, { createContext, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { fetchExecutions } from '../api/executions';

const POLL_INTERVAL = 15000; // 15 seconds
const LAST_SEEN_KEY = 'hrflow_last_seen_execution_id';

export const ExecutionNotificationContext = createContext<void>(undefined);

export function ExecutionNotificationProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Load last seen execution ID from localStorage
    let lastSeenId = parseInt(localStorage.getItem(LAST_SEEN_KEY) || '0', 10);

    const poll = async () => {
      try {
        const executions = await fetchExecutions();

        if (executions.length === 0) return;

        // Find new executions
        const newExecutions = executions.filter(exec => exec.id > lastSeenId);

        if (newExecutions.length > 0) {
          // Update last seen ID
          const newestId = Math.max(...newExecutions.map(e => e.id));
          lastSeenId = newestId;
          localStorage.setItem(LAST_SEEN_KEY, newestId.toString());

          // Show toast for each new execution (max 3 to avoid spam)
          const toShow = newExecutions.slice(0, 3).reverse(); // Show oldest first

          toShow.forEach(execution => {
            const workflowName = execution.workflows?.name || 'Unknown Workflow';
            const status = execution.status;
            const triggerType = execution.trigger_type || 'manual';

            let message = `Workflow "${workflowName}"`;

            if (status === 'completed') {
              message += ' completed successfully';
            } else if (status === 'failed') {
              message += ' failed';
            } else if (status === 'running') {
              message += ' started';
            } else {
              message += ` status: ${status}`;
            }

            // Show toast with navigation
            toast(message, {
              description: `Triggered by: ${triggerType}`,
              action: {
                label: 'View',
                onClick: () => navigate(`/executions/${execution.id}`),
              },
              duration: 5000,
            });
          });

          // If more than 3, show summary toast
          if (newExecutions.length > 3) {
            toast.info(`${newExecutions.length - 3} more workflow executions`, {
              action: {
                label: 'View All',
                onClick: () => navigate('/executions'),
              },
            });
          }
        }
      } catch (error) {
        console.error('[ExecutionNotification] Polling error:', error);
        // Don't show toast for polling errors to avoid annoying users
      }
    };

    // Initial poll
    poll();

    // Set up polling interval
    pollTimerRef.current = setInterval(poll, POLL_INTERVAL);

    // Cleanup
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, [navigate]);

  return (
    <ExecutionNotificationContext.Provider value={undefined}>
      {children}
    </ExecutionNotificationContext.Provider>
  );
}
