import { z } from "zod"
import { tool } from "@langchain/core/tools"

function calculateSum(a: number, b: number) {
  return a + b;
}

function calculateProduct(a: number, b: number) {
  return a * b;
}

function calculatePower(base: number, exponent: number) {
  return Math.pow(base, exponent);
} 

function generateContent(topic: string, style: string = "neutral", length: number = 300) {
  return `Here is a ${style} article about "${topic}" with approximately ${length} words. [Content generation logic goes here]`;
}

export const tools = [
  tool(
    async (input: any) => {
      const { a, b } = input;
      const result = calculateSum(a, b);
      console.log(`Sum calculation: ${a} + ${b} = ${result}`);
      return String(result)
    },
    {
      name: "sum",
      description: "Calculate the sum of two numbers",
      schema: z.object({
        a: z.number().describe("First number"),
        b: z.number().describe("Second number"),
      }),
    }
  ),

  tool(
    async (input: any) => {
      const { a, b } = input;
      const result = calculateProduct(a, b);
      console.log(`Multiply calculation: ${a} × ${b} = ${result}`);
      return String(result);
    },
    {
      name: "multiply",
      description: "Multiply two numbers",
      schema: z.object({ a: z.number(), b: z.number() }),
    }
  ),

  tool(
    async (input: any) => {
      const { base, exponent } = input;
      const result = calculatePower(base, exponent);
      console.log(`Power calculation: ${base}^${exponent} = ${result}`);
      return String(result);
    },
    {
      name: "power",
      description: "Raise base to an exponent",
      schema: z.object({ base: z.number(), exponent: z.number() }),
    }
  ),

  tool(
    async (input:any) => {
      const { topic, style, length } = input;
      const result = generateContent(topic, style, length);
      console.log(`Content writing: topic=${topic}, style=${style}, length=${length}`);
      return String(result)
    }, 
    {
      name: "content_writer",
         description: `
      Use this tool to write or generate content on any topic.
      Ideal for blog posts, LinkedIn posts, tweets, essays, summaries,articles, or creative text generation.
      The user doesn't need to mention the tool; detect writing intent automatically.`,
      schema: z.object({
        topic: z.string().describe("Topic to write about"),
        style: z.string().optional().describe("Writing style (e.g. formal, casual, neutral)"),
        length: z.number().optional().describe("Approximate word count"),
      })
    }
  )
];
