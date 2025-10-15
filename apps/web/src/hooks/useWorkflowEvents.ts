import { useEffect, useState } from "react";
import type { WorkflowEvent } from "../types/workflow";
import type { NodeStatus } from "../types/node";

export function useWorkflowEvents(workflowId: string) {
    const [events, setEvents] = useState<WorkflowEvent[]>([]);
    const [nodeStatuses, setNodeStatuses] = useState<Record<string, NodeStatus>>({});
    const [nodeOutputs, setNodeOutputs] = useState<Record<string, string>>({});

    useEffect(() => {
        if (!workflowId) return;

        const ws = new WebSocket(import.meta.env.VITE_WS_URL);

        ws.onopen = () => {
            console.log("WS Connected");

            ws.send(JSON.stringify({ type: "subscribe", workflowId }));
        };

        ws.onmessage = (msg) => {
            try {
                const event = JSON.parse(msg.data);

                if (event.workflowId === workflowId) {
                    setEvents((prev) => [...prev, event]);

                    switch (event.type) {
                        case "node_started":
                            setNodeStatuses((prev) => ({ ...prev, [event.nodeId]: "running" }));
                            break;

                        case "node_succeeded":
                            setNodeStatuses((prev) => ({ ...prev, [event.nodeId]: "success" }));
                            break;

                        case "node_failed":
                            setNodeStatuses((prev) => ({ ...prev, [event.nodeId]: "failed" }));
                            break;

                        case "node_output":
                            setNodeOutputs((p) => ({ ...p, [event.nodeId]: event.output }));
                            break;
                    }

                }
            } catch (error) {
                console.error("Invalid WS message:", msg.data);
            }
        };

        ws.onclose = () => {
            console.log("WS disconnected");
        };


        return () => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: "unsubscribe", workflowId }));
            }
            ws.close();
        };

    }, [workflowId])

    return { events, nodeStatuses, nodeOutputs }
}