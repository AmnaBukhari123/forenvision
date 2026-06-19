import { useEffect, useRef, useCallback, useState } from "react";
import { BASE } from "../services/api";

const wsBase = BASE.replace(/^http/, "ws");
const WS_URL = import.meta.env.VITE_WS_URL || `${wsBase}/api/v1/ws/auth`;

export function useAuthSocket(onEvent) {
  const socketRef      = useRef(null);
  const onEventRef     = useRef(onEvent);
  const pendingRef     = useRef(null);
  const intentionalRef = useRef(false);   // ← tracks intentional close
  const [connected, setConnected] = useState(false);

  useEffect(() => { onEventRef.current = onEvent; }, [onEvent]);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    socketRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      if (pendingRef.current) {
        ws.send(JSON.stringify(pendingRef.current));
        pendingRef.current = null;
      }
    };

    ws.onclose = () => {
      setConnected(false);
      // ← Only show error if WE didn't close it (e.g. real network drop)
      if (!intentionalRef.current) {
        onEventRef.current({ event: "error", message: "Connection lost." });
      }
    };

    ws.onerror = () => {
      if (!intentionalRef.current) {
        onEventRef.current({ event: "error", message: "Connection error." });
      }
    };

    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);
        if (data.event === "ready") return;
        onEventRef.current(data);
      } catch {
        console.warn("Malformed WS message:", msg.data);
      }
    };

    return () => {
      intentionalRef.current = true;   // ← mark as intentional before cleanup
      ws.close();
    };
  }, []);

  const sendLogin = useCallback((email, password) => {
    const payload = { action: "login", email, password };
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(payload));
    } else {
      pendingRef.current = payload;
    }
  }, []);

  return { sendLogin, connected };
}