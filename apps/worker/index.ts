import prisma from "@w8w/db";
import { redis } from "@w8w/shared";
import { runNode } from "./nodes/runner/runner";
import { publishEvent } from "./publish";

type XReadMessage = {
    id: string;
    message: Record<string, string>;
};

type XReadStream = {
    name: string;
    messages: XReadMessage[];
};

const GROUP = "workflowGroup";
const CONSUMER = `worker-${process.pid}`;

async function processExecution(message: XReadMessage) {
        const { executionId, workflowId } = message.message;
        console.log("Picked execution:", executionId);

        try {
            const workflow = await prisma.workflow.findUnique({
                where: { id: workflowId },
            });

            if (!workflow) {
                console.error("Workflow not found:", workflowId);
                await redis.xAck("workflow:executions", GROUP, message.id);
                return;
            }

            const execution = await prisma.execution.findUnique({
                where: { id: executionId },
            });

            if (!execution) {
                console.error("Execution not found:", workflowId);
                await redis.xAck("workflow:executions", GROUP, message.id);
                return;
            }

            const triggerPayload =
                (execution?.output as any)?.triggerPayload ?? {};


            await prisma.execution.update({
                where: { id: executionId },
                data: { status: "RUNNING" },
            });

            await publishEvent(workflowId!, { type: "execution_started", executionId, workflowId, totalTasks: execution?.totalTasks ?? 0 });

            const nodes = workflow.nodes as Record<string, any>;
            const connections = workflow.connections as Record<string, string[]>;

            let context: Record<string, any> = {
                $json: { body: triggerPayload },
                $node: {},

            };


            let tasksDone = 0;

            const indegree: Record<string, number> = {};
            Object.keys(nodes).forEach((n) => (indegree[n] = 0));
            Object.values(connections).forEach((targets) => {
                targets.forEach(
                    (t) => (indegree[t] = (indegree[t] || 0) + 1)
                );
            });


            const queue: string[] = Object.keys(indegree).filter(
                (n) => indegree[n] === 0
            );

            let executionFailed = false;

            while (queue.length > 0) {
                const nodeId = queue.shift()!;
                const node = nodes[nodeId];

                await publishEvent(workflowId!, { type: "node_started", executionId, workflowId, nodeId, nodeType: node.type });


                console.log(`Executing node ${nodeId} (${node.type})`);

                try {
                    const result = await runNode(node, context, workflowId, executionId, nodeId);
                    context.$node[nodeId] = result;

                    tasksDone++;

                    await prisma.execution.update({
                        where: { id: executionId },
                        data: {
                            tasksDone,
                            logs: { ...(execution!.logs as any), [nodeId]: "Success" },
                        },
                    });


                    await publishEvent(workflowId!, {
                        type: "node_succeeded",
                        executionId,
                        workflowId,
                        nodeId,
                        nodeType: node.type
                    });
                    
                    const nextNodes = connections[nodeId] || [];
                    nextNodes.forEach((n) => {
                        console.log(`→ Next: ${n}`);
                        if (indegree[n] !== undefined) {
                            indegree[n]--;
                            if (indegree[n] === 0) queue.push(n)
                        }
                    });

                } catch (err: any) {
                    console.error(`Error in node ${nodeId}:`, err.message);
                    const msg = err.message;

                    await prisma.execution.update({
                        where: { id: executionId },
                        data: {
                            status: "FAILED",
                            logs: {
                                ...(execution!.logs as any),
                                [nodeId]: `Error: ${err.message}`,
                            },
                        },
                    });

                    await publishEvent(workflowId!, {
                        type: "node_failed",
                        executionId,
                        workflowId,
                        nodeId,
                        nodeType: node.type,
                        error: msg
                    });

                    executionFailed = true;
                    break;
                }
            }


            if (executionFailed) {
                await publishEvent(workflowId!, {
                    type: "execution_finished",
                    executionId,
                    workflowId,
                    status: "FAILED",
                    tasksDone
                });

            } else {
                await prisma.execution.update({
                    where: { id: executionId },
                    data: { status: "SUCCESS", tasksDone },
                });

                await publishEvent(workflowId!, {
                    type: "execution_finished",
                    executionId,
                    workflowId,
                    status: "SUCCESS",
                    tasksDone,
                });
            }


            console.log("Execution finished:", executionId);

            await redis.xAck("workflow:executions", GROUP, message.id);
        } catch (err) {
            console.error("Failed execution:", err);
        }  
    }

async function main() {
    await redis.connect();

    console.log("Worker started, waiting for jobs...");

    await redis.xGroupCreate("workflow:executions", GROUP, "0", { MKSTREAM: true }).catch(() => { });

    while (true) {
        try {
            const resp = (await redis.xReadGroup(
                GROUP,
                CONSUMER,
                { key: "workflow:executions", id: ">" },
                { BLOCK: 1000, COUNT: 10 }
            )) as XReadStream[] | null;

            if (!resp) continue;

            if (resp && Array.isArray(resp)) {
                for (const stream of resp) {
                await Promise.all(stream.messages.map((m) => processExecution(m)));
                }
            }
        } catch (err: any) {
            console.error("Worker loop error:", err.message);
        }
    }
}

main();
