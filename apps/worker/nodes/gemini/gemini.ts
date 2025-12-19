import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { AgentExecutor, createToolCallingAgent } from "langchain/agents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { tools } from "./tools/tools";
import prisma from "@w8w/db";
import { addMemory, getMemory } from "../../utils/memory";
import { publishEvent } from "../../publish";

function resolveTemplate(template: string, context: Record<string, any>): string {
  if (!template || typeof template !== 'string') {
    return template;
  }
  
  return template.replace(/\{\{\s*\$json\.body\.(\w+)\s*\}\}/g, (match, key) => {
    return context.$json?.body?.[key] || match;
  }).replace(/\{\{\s*\$node\.(\w+)\.(\w+)\s*\}\}/g, (match, nodeId, property) => {
    return context.$node?.[nodeId]?.[property] || match;
  });
}

export async function runGeminiNode(
  node: any, 
  context: any, 
  workflowId?: string,
  executionId?: string,
  nodeId?: string
) {
  try {
    let { prompt,memory } = node.config;
    
    if (prompt && typeof prompt === 'string' && prompt.includes('{{')) {
      prompt = resolveTemplate(prompt, context);
      // console.log("Original prompt:", node.config.prompt);
      // console.log("Resolved prompt:", prompt);
    }

    // console.log("Final prompt to Gemini:", prompt)

    const creds = await prisma.credentials.findUnique({
      where: { id: node.credentialsId },
    });

    if (!creds) {
      throw new Error("Gemini credentials not found");
    }

    const data = typeof creds.data === "string" ? JSON.parse(creds.data) : creds.data;
    const { geminiApiKey } = data;

    if (!geminiApiKey) {
      throw new Error("Missing Gemini API Key");
    }

    const model = new ChatGoogleGenerativeAI({
      apiKey: geminiApiKey,
      model: "gemini-2.5-flash-lite",
      temperature: 0.5
    });

    let history: { role: "user" | "assistant"; content: string }[] = [];
    if(memory && workflowId) {
    history = await getMemory(workflowId);
    }


    const promptTemplate = ChatPromptTemplate.fromMessages([
      [
        "system", 
        `You are a helpful AI assistant with access to various tools and functions.
        
        When responding to user requests:
        - If the task can be accomplished using available tools, use them appropriately
        - Always see if tools are needed or not before responsing , If no tools are needed, respond naturally with your knowledge
        - Always provide clear, helpful responses
        - Use tools when they can enhance your response or perform specific actions
        -  When asked to return JSON, return only valid JSON without extra text or backticks.

          You can generate content freely when tools aren't needed
        Choose the best approach based on what the user is asking for.`
      ],
      ...history.map((h) => [h.role, h.content] as [string,string]),
      ["user", "{input}"],
      ["placeholder", "{agent_scratchpad}"],
    ]);

    const agent = await createToolCallingAgent({
      llm: model,
      tools,
      prompt: promptTemplate
    });

    const executor = new AgentExecutor({
      agent,
      tools,
      verbose: true, 
      maxIterations: 10 
    });

    if (workflowId && executionId && nodeId) {
      await publishEvent(workflowId, {
        type: "node_output",
        workflowId,
        executionId,
        nodeId,
        nodeType: "Gemini",
        output: "Thinking..."
      })
    }

    const result = await executor.invoke({
      input: String(prompt)
    });

    if (!result) {
      throw new Error("No Result")
    }

    // console.log("Result: ", result)

   let rawText = result.output.trim();

    
   rawText = rawText.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();


   if(memory && workflowId) {
    await addMemory(workflowId, "user", prompt);
    await addMemory(workflowId, "assistant", rawText);
   }

      if (workflowId && executionId && nodeId) {
      await publishEvent(workflowId, {
        type: "node_output",
        workflowId,
        executionId,
        nodeId,
        nodeType: "Gemini",
        output: rawText
      })
    }

      try {
     const parsed = JSON.parse(rawText);
        if (parsed && typeof parsed === "object") {
        return {
          text: parsed, 
          query: String(prompt),
          intermediateSteps: result.intermediateSteps,
        };
      }
    } catch {
      console.warn("Gemini output not valid JSON, returning as text");
    }


    return {
      text: rawText,
      query: String(prompt),  
      intermediateSteps: result.intermediateSteps
    }

  } catch (error: any) {
    console.error("Failed to run gemini node error: ", error.message);
    throw error
  }
}