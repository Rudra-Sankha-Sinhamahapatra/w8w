import { publishEvent } from "../../publish";
import { useForm } from "../form/useForm";
import { runGeminiNode } from "../gemini/gemini";
import { sendEmail } from "../resend";
import { sendSlack } from "../slack";
import { sendTelegramMessage } from "../telegram";

export async function runNode(
    node:any,
    context: Record<string,any>,
    workflowId?:string,
    executionId?: string, 
    nodeId?: string
) {
    try {
        switch (node.type) {
            case "ResendEmail":
                return await sendEmail(node.config,node.credentialsId,context);

            case "Telegram":
                return await sendTelegramMessage(node.config, node.credentialsId, context);

            case "Gemini":
                return runGeminiNode(node,context,workflowId, executionId!, nodeId!);

            case "Form":
                return useForm(node,workflowId);

            case "Slack":
                return sendSlack(node.config,node.credentialsId,context)
                
            default:
               throw new Error(`Unknown node type: ${node.type}`);
        }
    } catch (error:any) {
           console.error(`Node ${node.type} failed:`, error);
        throw new Error(`Some error happened in ${node.type}: ${error.message}`);
    }
}