"use client";

import { useEffect, useState } from "react";
import type { RepositoryUpdate } from "@/lib/types";

export interface RealTimeUpdatesState {
  updates: RepositoryUpdate[];
  isConnected: boolean;
  clearUpdates: () => void;
}

export function useRealTimeUpdates(): RealTimeUpdatesState {
  const [updates, setUpdates] = useState<RepositoryUpdate[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  useEffect(function subscribe() {
    const eventSource = new EventSource("/api/updates");

    function handleMessage(event: MessageEvent<string>): void {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "connected") {
          setIsConnected(true);
          return;
        }
        if (payload.type === "updates" && Array.isArray(payload.payload)) {
          const incoming = payload.payload as RepositoryUpdate[];
          setUpdates(function merge(previous) {
            return [...previous, ...incoming];
          });
        }
      } catch (error) {
        console.error("Failed to parse SSE payload", error);
        setIsConnected(false);
      }
    }

    function handleError(): void {
      setIsConnected(false);
    }

    eventSource.onmessage = handleMessage;
    eventSource.onerror = handleError;

    return function cleanup() {
      eventSource.close();
    };
  }, []);

  function clearUpdates(): void {
    setUpdates([]);
  }

  return { updates, isConnected, clearUpdates };
}

