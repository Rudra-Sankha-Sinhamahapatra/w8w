import { useParams, useNavigate } from "react-router-dom";
import type { Node } from '@xyflow/react';
import {
    ReactFlow,
    MiniMap,
    Controls,
    Background,
    BackgroundVariant,
    useReactFlow,
    ReactFlowProvider,
} from "@xyflow/react";
import type { FlowNodeData, WorkflowCredential } from '../types/workflow';
import { Platform } from '../types/platform';
import { useThemeStore } from "../store/useThemeStore";
import { nodeTypes } from "../components/nodes/nodeTypes";
import { useWorkflowEditor } from "../hooks/useWorkflowEditor";
import { useCredentials } from "../hooks/useCredentials";
import { useState, useCallback, useEffect } from "react";
import NodeConfigDialog from "../components/nodes/NodeConfigDialog";
import { nodeIcons } from "../lib/nodeIcons";
import { workflows, BACKEND_URL } from "../lib/api";
import { useWorkflowEvents } from "../hooks/useWorkflowEvents";

import "@xyflow/react/dist/style.css";
import { CheckIcon, Cross2Icon, Pencil2Icon } from "@radix-ui/react-icons";

function WorkflowEditContent() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { theme } = useThemeStore();
    const isDark = theme === "dark";

    const { nodes, edges, onNodesChange, onEdgesChange, onConnect, saveWorkflow, isLoading, workflow } =
        useWorkflowEditor(id);

    const { nodeStatuses, nodeOutputs } = useWorkflowEvents(id!);

    const { data, isLoading: isLoadingCredentials } = useCredentials();
    const credentials = data?.credentials ?? [];

    const [selectedNode, setSelectedNode] = useState<Node<FlowNodeData> | null>(null);
    const [showWebhookInfo, setShowWebhookInfo] = useState(false);

    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [workflowTitle, setWorkflowTitle] = useState("");

    const { setNodes } = useReactFlow();

    useEffect(() => {
        if (workflow?.title) setWorkflowTitle(workflow.title);
    }, [workflow?.title]);

    const availablePlatforms = Array.from(
        new Set([
            ...credentials.map((c: WorkflowCredential) => c.platform),
            Platform.Form,
        ])
    );


    const getNextPosition = useCallback(() => {
        const offset = 150;
        const existingPositions = nodes.map(node => node.position);
        const basePosition = { x: 250, y: 150 };

        let newPosition = { ...basePosition };
        while (existingPositions.some(pos => pos.x === newPosition.x && pos.y === newPosition.y)) {
            newPosition.x += offset;
            if (newPosition.x > 800) {
                newPosition.x = basePosition.x;
                newPosition.y += offset;
            }
        }
        return newPosition;
    }, [nodes]);

    const addNode = useCallback(
        (platform: Platform) => {
            const nodeNumber = nodes.length + 1;
            const nodeId = `node${nodeNumber}`;

            setNodes((nds) => [
                ...nds,
                {
                    id: nodeId,
                    type: platform,
                    position: getNextPosition(),
                    data: {
                        id: nodeId,
                        label: `${platform} ${nodeNumber}`,
                        credentialsId: null,
                        config: {},
                        type: platform
                    },
                },
            ]);
        },
        [setNodes, nodes]
    );

    const runWorkflow = async () => {
        if (!id) return;
        try {
            await workflows.run({ workflowId: id });
            alert(`Workflow execution started!`);
        } catch (error) {
            console.error("Error running workflow:", error);
            alert("Failed to run workflow. Please try again.");
        }
    };

    if (isLoading || isLoadingCredentials) {
        return (
            <div className="h-[calc(100vh-4rem)] flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            </div>
        );
    }

    if (!workflow) {
        return (
            <div className="h-[calc(100vh-4rem)] flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-xl font-bold mb-2">Workflow not found</h2>
                    <button
                        onClick={() => navigate("/workflows")}
                        className="text-blue-500 hover:underline"
                    >
                        Go back to workflows
                    </button>
                </div>
            </div>
        );
    }




    return (
        <div className="flex flex-col md:flex-row h-screen">
            <aside className={`w-full md:w-72 lg:w-80 border-r p-4 space-y-4  ${isDark ? "bg-zinc-900" : "bg-white"} overflow-y-auto`}>
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        {isEditingTitle ? (
                            <div className="flex items-center gap-2">
                                <input
                                    value={workflowTitle}
                                    onChange={(e) => setWorkflowTitle(e.target.value)}
                                    className={`px-2 py-1 rounded border text-sm ${isDark
                                        ? "bg-zinc-800 border-zinc-700 text-white"
                                        : "bg-white border-zinc-300 text-black"
                                        }`}
                                    autoFocus
                                />
                                <button
                                    onClick={() => setIsEditingTitle(false)}
                                    className={`p-1 rounded ${isDark ? "hover:bg-zinc-700" : "hover:bg-zinc-200"}`}
                                    title="Save title"
                                >
                                    <CheckIcon className="w-4 h-4 text-green-500" />
                                </button>
                                <button
                                    onClick={() => {
                                        setWorkflowTitle(workflow.title);
                                        setIsEditingTitle(false);
                                    }}
                                    className={`p-1 rounded ${isDark ? "hover:bg-zinc-700" : "hover:bg-zinc-200"}`}
                                    title="Cancel"
                                >
                                    <Cross2Icon className="w-4 h-4 text-red-500" />
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold">{workflowTitle}</h3>
                                <button
                                    onClick={() => setIsEditingTitle(true)}
                                    className={`p-1 rounded ${isDark ? "hover:bg-zinc-700" : "hover:bg-zinc-200"}`}
                                    title="Edit title"
                                >
                                    <Pencil2Icon className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                        {workflow.triggerType === "Manual" ? (
                            <button
                                onClick={runWorkflow}
                                className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                            >
                                Run
                            </button>
                        ) : (
                            <button
                                onClick={() => setShowWebhookInfo(!showWebhookInfo)}
                                className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                            >
                                Webhook Info
                            </button>
                        )}
                    </div>

                    {showWebhookInfo && workflow.triggerType === "Webhook" && workflow.webhookId && (
                        <div className={`p-4 rounded-lg ${isDark ? 'bg-zinc-800' : 'bg-zinc-100'
                            }`}>
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="font-medium">Webhook Details</h4>
                                <button
                                    onClick={() => {
                                        const webhookUrl = `${BACKEND_URL}/webhooks/${workflow.webhookId}`;
                                        navigator.clipboard.writeText(webhookUrl);
                                        alert('Webhook URL copied to clipboard!');
                                    }}
                                    className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                                >
                                    Copy URL
                                </button>
                            </div>
                            <div className="space-y-2 text-sm">
                                <div>
                                    <div className="font-medium">URL:</div>
                                    <code className="block p-2 rounded bg-black text-white overflow-x-auto">
                                        {`${BACKEND_URL}/webhooks/${workflow.webhookId}`}
                                    </code>
                                </div>
                                <div>
                                    <div className="font-medium">Secret:</div>
                                    <code className="block p-2 rounded bg-black text-white">
                                        {workflow.webhook?.secret || "No secret set"}
                                    </code>
                                </div>
                                <div>
                                    <div className="font-medium">Method:</div>
                                    <code className="block p-2 rounded bg-black text-white">
                                        {workflow.webhook?.method || "POST"}
                                    </code>
                                </div>
                                <div className="mt-4 text-xs text-zinc-500">
                                    <p>Example curl command:</p>
                                    <code className="block p-2 mt-1 rounded bg-black text-white overflow-x-auto whitespace-pre">
                                        {`curl -X ${workflow.webhook?.method || "POST"} \\
  ${BACKEND_URL}/webhooks/${workflow.webhookId} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: ${workflow.webhook?.secret || "your-secret"}" \\
  -d '{"name": "John", "email": "john@example.com"}'`}
                                    </code>
                                </div>
                            </div>
                        </div>
                    )}

                    <h3 className="font-bold mt-6">Add Node</h3>
                    <div className="relative">
                        <div className={`flex items-center gap-2 p-2 rounded border cursor-pointer ${isDark
                            ? 'bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700'
                            : 'bg-white border-zinc-200 text-black hover:bg-zinc-50'
                            }`}>
                            <select
                                onChange={(e) => {
                                    const platform = e.target.value as Platform;
                                    if (platform) {
                                        addNode(platform);
                                        e.target.value = '';
                                    }
                                }}
                                className="w-full appearance-none bg-transparent cursor-pointer focus:outline-none"
                            >
                                <option value="" className="hidden">Add a node...</option>
                                {availablePlatforms.map((p) => {
                                    const requiresCredentials = p !== Platform.Form;
                                    const hasCredentials = credentials.some(c => c.platform === p);

                                    if (requiresCredentials && !hasCredentials) return null;

                                    return (
                                        <option key={p} value={p} className="flex items-center">
                                            {p}
                                        </option>
                                    );
                                })}
                            </select>
                            <div className="flex items-center pointer-events-none">
                                <svg className="w-4 h-4 fill-current opacity-50" viewBox="0 0 20 20">
                                    <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                                </svg>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2 mt-2">
                            {availablePlatforms.slice(0, 5).map((p) => {
                                const requiresCredentials = p !== Platform.Form;
                                const hasCredentials = credentials.some(c => c.platform === p);

                                if (requiresCredentials && !hasCredentials) return null;

                                return (
                                    <button
                                        key={p}
                                        onClick={() => addNode(p)}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${isDark
                                            ? 'bg-zinc-800 hover:bg-zinc-700'
                                            : 'bg-zinc-100 hover:bg-zinc-200'
                                            }`}
                                        title={`Add ${p} node`}
                                    >
                                        <img src={nodeIcons[p]} alt={p} className="w-4 h-4" />
                                        <span>{p}</span>
                                    </button>
                                );
                            })}
                            {availablePlatforms.length > 5 && (
                                <button
                                    className={`px-3 py-1.5 rounded-full text-sm ${isDark
                                        ? 'bg-zinc-800 hover:bg-zinc-700'
                                        : 'bg-zinc-100 hover:bg-zinc-200'
                                        }`}
                                    title="More platforms available"
                                >
                                    +{availablePlatforms.length - 5} more
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <button
                    onClick={async () => {
                        try {
                            await saveWorkflow(workflowTitle, workflow.triggerType as "Manual" | "Webhook");
                            alert("Workflow updated successfully!");
                        } catch (error) {
                            console.error("Error saving workflow:", error);
                            alert("Failed to save workflow. Please try again.");
                        }
                    }}
                    className="w-full px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                >
                    Save Changes
                </button>
            </aside>

            <div className="flex-1 relative">
                <ReactFlow
                    nodes={nodes.map((n) => ({
                        ...n,
                        data: {
                            ...n.data,
                            status: nodeStatuses[n.id] ?? "idle",
                            output: nodeOutputs[n.id] ?? "",
                        },
                    }))}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    nodeTypes={nodeTypes}
                    className={isDark ? "react-flow-dark" : ""}
                    fitView
                    onNodeClick={(_, node) => setSelectedNode(node)}
                >
                    <Controls />
                    <MiniMap />
                    <Background
                        variant={BackgroundVariant.Dots}
                        gap={12}
                        size={1}
                        color={isDark ? "#666" : "#ccc"}
                    />
                </ReactFlow>
            </div>

            {selectedNode && (
                <NodeConfigDialog
                    node={selectedNode}
                    workflow={workflow}
                    nodes={nodes}
                    edges={edges}
                    credentials={credentials.filter((c: WorkflowCredential) => c.platform === selectedNode.type)}
                    onClose={() => setSelectedNode(null)}
                    onSave={(data) => {
                        setNodes((nds) =>
                            nds.map((n) => (n.id === selectedNode.id ? { ...n, data } : n))
                        );
                        setSelectedNode(null);
                    }}
                />
            )}
        </div>
    );
}

export default function WorkflowEdit() {
    return (
        <ReactFlowProvider>
            <WorkflowEditContent />
        </ReactFlowProvider>
    );
}
