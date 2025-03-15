# LangGraph.js - Quickstart

## Introduction

In this quickstart guide, you'll get up and running with a simple Reason + Act Agent (often called a ReAct Agent) that can search the web using Tavily Search API. The code is fully configurable. You can:

- swap out components
- customize the execution flow
- extend it with custom code or tooling
- change the Large Language Model (LLM) and provider being used

## Key Points

- LangGraph JavaScript is a framework for building AI agents, with tutorials available for evaluation via simulated user interactions.
- Research suggests setting up involves installing dependencies and configuring API keys, then creating agents for chat bot and simulated user evaluation.
- The evidence leans toward using multi-agent simulation for chat bot evaluation, involving defining nodes and running workflows in LangGraph.js.

## Getting Started with LangGraph JavaScript

LangGraph JavaScript is part of the LangChain AI project, designed for building resilient language agents as graphs. To start, create a project folder and install necessary dependencies like `@langchain/core`, `@langchain/langgraph`, `@langchain/openai`, and `@langchain/community`. Optionally, set up LangSmith for observability by configuring environment variables with your API keys.

## Prerequisites

To follow along, you'll need to have the following:

- NodeJS version 18 or newer
- A Tavily account and API key
- An OpenAI developer platform account and API key

Start by creating a new folder for the project. Open your terminal and run the following code:

```bash
mkdir langgraph-agent
cd langgraph-agent
```

You'll also need to install a few dependencies to create an agent:

- `langchain/langgraph` contains the building blocks used to assemble an agent
- `langchain/openai` enable your agent to use OpenAI's LLMs
- `langchain/community` includes the Tavily integration give your agent search capabilities

You can install these dependencies using by running following npm command in your terminal:

```bash
npm install @langchain/core @langchain/langgraph @langchain/openai @langchain/community
```

## LangSmith

Optionally, set up LangSmith for best-in-class observability. Setup is simple - add the following variables to your environment and update the LANGCHAIN_API_KEY value with your API key.

```javascript
// Optional, add tracing in LangSmith
// process.env.LANGCHAIN_API_KEY = "ls__...";
// process.env.LANGCHAIN_CALLBACKS_BACKGROUND = "true";
// process.env.LANGCHAIN_TRACING_V2 = "true";
// process.env.LANGCHAIN_PROJECT = "Quickstart: LangGraphJS";
```

## Making your first agent using LangGraph

Create a file named `agent.ts` (short for Reason + Act Agent) and add the below TypeScript code to it.

Make sure you update the environment variables at the top of the file to contain your API keys. If you don't, the OpenAI and Tavily API calls will produce errors and your agent will not work correctly.

Once you've added your API keys, save the file and run the code with the following command:

```bash
npx tsx agent.ts
```

```typescript
// agent.ts

// IMPORTANT - Add your API keys here. Be careful not to publish them.
process.env.OPENAI_API_KEY = "sk-...";
process.env.TAVILY_API_KEY = "tvly-...";

import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { ChatOpenAI } from "@langchain/openai";
import { MemorySaver } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";
import { createReactAgent } from "@langchain/langgraph/prebuilt";

// Define the tools for the agent to use
const agentTools = [new TavilySearchResults({ maxResults: 3 })];
const agentModel = new ChatOpenAI({ temperature: 0 });

// Initialize memory to persist state between graph runs
const agentCheckpointer = new MemorySaver();
const agent = createReactAgent({
  llm: agentModel,
  tools: agentTools,
  checkpointSaver: agentCheckpointer,
});

// Now it's time to use!
const agentFinalState = await agent.invoke(
  { messages: [new HumanMessage("what is the current weather in sf")] },
  { configurable: { thread_id: "42" } },
);

console.log(
  agentFinalState.messages[agentFinalState.messages.length - 1].content,
);

const agentNextState = await agent.invoke(
  { messages: [new HumanMessage("what about ny")] },
  { configurable: { thread_id: "42" } },
);

console.log(
  agentNextState.messages[agentNextState.messages.length - 1].content,
);
```

Example output:
```
The current weather in San Francisco is as follows:
- Temperature: 82.0°F (27.8°C)
- Condition: Sunny
- Wind: 11.9 mph from the NW
- Humidity: 41%
- Pressure: 29.98 in
- Visibility: 9.0 miles
- UV Index: 6.0

For more details, you can visit [Weather in San Francisco](https://www.weatherapi.com/).
The current weather in New York is as follows:
- Temperature: 84.0°F (28.9°C)
- Condition: Sunny
- Wind: 2.2 mph from SSE
- Humidity: 57%
- Pressure: 29.89 in
- Precipitation: 0.01 in
- Visibility: 9.0 miles
- UV Index: 6.0

For more details, you can visit [Weather in New York](https://www.weatherapi.com/).
```

## How does it work?

The `createReactAgent` constructor lets you create a simple tool-using LangGraph agent in a single line of code. Here's a visual representation of the graph:

```javascript
// Note: tslab only works inside a jupyter notebook. Don't worry about running this code yourself!
import * as tslab from "tslab";

const graph = agent.getGraph();
const image = await graph.drawMermaidPng();
const arrayBuffer = await image.arrayBuffer();

await tslab.display.png(new Uint8Array(arrayBuffer));
```

## Customizing agent behavior

`createReactAgent` can be great for simple agents, but sometimes you need something more powerful.

LangGraph really shines when you need fine-grained control over an agent's behavior. The following code creates an agent with the same behavior as the example above, but you can clearly see the execution logic and how you could customize it.

Update the code in your `agent.ts` file to match the example below. Once again, be sure to update the environment variables at the top.

After you've updated your environment variables and saved the file, you can run it with the same command as before:

```bash
npx tsx agent.ts
```

```typescript
// agent.ts

// IMPORTANT - Add your API keys here. Be careful not to publish them.
process.env.OPENAI_API_KEY = "sk-...";
process.env.TAVILY_API_KEY = "tvly-...";

import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { StateGraph, MessagesAnnotation } from "@langchain/langgraph";

// Define the tools for the agent to use
const tools = [new TavilySearchResults({ maxResults: 3 })];
const toolNode = new ToolNode(tools);

// Create a model and give it access to the tools
const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0,
}).bindTools(tools);

// Define the function that determines whether to continue or not
function shouldContinue({ messages }: typeof MessagesAnnotation.State) {
  const lastMessage = messages[messages.length - 1] as AIMessage;

  // If the LLM makes a tool call, then we route to the "tools" node
  if (lastMessage.tool_calls?.length) {
    return "tools";
  }
  // Otherwise, we stop (reply to the user) using the special "__end__" node
  return "__end__";
}

// Define the function that calls the model
async function callModel(state: typeof MessagesAnnotation.State) {
  const response = await model.invoke(state.messages);

  // We return a list, because this will get added to the existing list
  return { messages: [response] };
}

// Define a new graph
const workflow = new StateGraph(MessagesAnnotation)
  .addNode("agent", callModel)
  .addEdge("__start__", "agent") // __start__ is a special name for the entrypoint
  .addNode("tools", toolNode)
  .addEdge("tools", "agent")
  .addConditionalEdges("agent", shouldContinue);

// Finally, we compile it into a LangChain Runnable.
const app = workflow.compile();

// Use the agent
const finalState = await app.invoke({
  messages: [new HumanMessage("what is the weather in sf")],
});
console.log(finalState.messages[finalState.messages.length - 1].content);

const nextState = await app.invoke({
  // Including the messages from the previous run gives the LLM context.
  // This way it knows we're asking about the weather in NY
  messages: [...finalState.messages, new HumanMessage("what about ny")],
});
console.log(nextState.messages[nextState.messages.length - 1].content);
```

There are a few new things going on in this version of our ReAct Agent:

- A `ToolNode` enables the LLM to use tools. In this example, we made a `shouldContinue` function and passed it to `addConditionalEdge` so our ReAct Agent can either call a tool or respond to the request.
- Annotations are how graph state is represented in LangGraph. We're using `MessagesAnnotation`, a helper that implements a common pattern: keeping the message history in an array.

## Evaluating Chat Bots with Multi-Agent Simulation

For evaluation, you can define a chat bot (e.g., airline customer support using OpenAI's gpt-4o-mini) and a simulated user (e.g., Harrison seeking a refund). Use LangGraph.js to set up a workflow alternating between these agents, with nodes for each and conditions to stop after a certain number of messages or when a specific keyword is mentioned. Run the simulation to log interactions and assess performance.

Here's how to set it up:

```typescript
// Import necessary modules
import { ChatOpenAI } from "@langchain/openai";
import { StateGraph, MessagesAnnotation, State } from "@langchain/langgraph";

// Define the chat bot
const chatBot = new ChatOpenAI({
  modelName: "gpt-4o-mini",
  temperature: 0,
  systemMessage: "You are an airline customer support agent.",
});

// Define the simulated user
const simulatedUser = new ChatOpenAI({
  modelName: "gpt-4o-mini",
  temperature: 0,
  systemMessage: "You are Harrison, a customer seeking a refund for a trip to Alaska 5 years ago. You are persistent and will not give up easily.",
});

// Create a graph for the simulation
const graph = new StateGraph({
  annotations: new MessagesAnnotation(),
});

// Add nodes for each agent
const chatBotNode = graph.addNode("chatBot", async (state) => {
  const response = await chatBot.generate([state.getMessages()]);
  state.addMessage("assistant", response);
  return state;
});

const simulatedUserNode = graph.addNode("simulatedUser", async (state) => {
  const response = await simulatedUser.generate([state.getMessages()]);
  state.addMessage("user", response);
  return state;
});

// Add edges to define the conversation flow
graph.addEdge("start", "simulatedUser");
graph.addEdge("simulatedUser", "chatBot");
graph.addEdge("chatBot", "simulatedUser");

// Add a conditional edge to stop after 6 messages or when "FINISHED" is detected
graph.addConditionalEdge("chatBot", (state) => {
  if (state.getMessages().length >= 6 || state.lastMessage().content.includes("FINISHED")) {
    return "end";
  }
  return "simulatedUser";
});

// Run the simulation
const initialState = new State({ messages: [] });
const finalState = await graph.run(initialState);
console.log(finalState.getMessages());
```

## Comprehensive Guide for Using LangGraph JavaScript for Evaluation

LangGraph JavaScript, a component of the LangChain AI ecosystem, is a framework designed to build resilient language agents as graphs, particularly useful for creating and evaluating AI-driven chat bots through simulated interactions.

### Environment Setup and Prerequisites

To begin, create a dedicated project folder and navigate into it:
```bash
mkdir langgraph-agent && cd langgraph-agent
```

Install the required dependencies to leverage LangGraph.js functionalities:
```bash
npm install @langchain/core @langchain/langgraph @langchain/openai @langchain/community
```

For enhanced observability and debugging, consider integrating LangSmith, which requires setting environment variables:
- Variables: `LANGCHAIN_API_KEY`, `LANGCHAIN_CALLBACKS_BACKGROUND="true"`, `LANGCHAIN_TRACING_V2="true"`, `LANGCHAIN_PROJECT="Your Project Name"`
- Note: Ensure you have a LangSmith API key from [LangSmith Documentation](https://docs.smith.langchain.com/).

Additionally, for the agents to interact with external APIs, set up API keys for OpenAI and potentially Tavily Search:
```bash
export OPENAI_API_KEY="your_openai_api_key"
export TAVILY_API_KEY="your_tavily_api_key"
```

### Building a Basic Agent

The foundation of using LangGraph.js is understanding how to create a basic agent. This step involves constructing a simple Reason + Act Agent (ReAct Agent) capable of web searches using the Tavily Search API.

### Evaluating Chat Bots Through Multi-Agent Simulation

The evaluation process involves simulating user interactions to assess chat bot performance. This is particularly useful for testing customer support scenarios, such as airline assistance.

#### Defining the Chat Bot

First, define the chat bot using OpenAI's gpt-4o-mini model, configured as an airline customer support agent:
```typescript
import { ChatOpenAI } from "@langchain/openai";

const chatBot = new ChatOpenAI({
  modelName: "gpt-4o-mini",
  temperature: 0,
  systemMessage: "You are an airline customer support agent.",
});
```

Example response: "Hello! How can I assist you today?" with token usage: 23 input, 9 output, 32 total.

#### Defining the Simulated User

Create a simulated user, named Harrison, who persistently seeks a refund for a trip to Alaska 5 years ago:
```typescript
const simulatedUser = new ChatOpenAI({
  modelName: "gpt-4o-mini",
  temperature: 0,
  systemMessage: "You are Harrison, a customer seeking a refund for a trip to Alaska 5 years ago. You are persistent and will not give up easily.",
});
```

Example response: "Hello! I'm Harrison, and I need to discuss a refund..." with token usage: 108 input, 40 output, 148 total.

#### Setting Up the Agent Simulation

Use LangGraph.js to create a workflow that alternates between the chat bot and simulated user, ensuring reproducible interactions. The setup involves:
- Environment: Ensure OpenAI API key is set, and optionally, LangSmith tracing with project "Agent Simulation Evaluation: LangGraphJS".
- Graph Definition: Use `StateGraph` with `MessagesAnnotation` for state management

#### Running the Simulation

Initialize the state with empty messages and run the graph to simulate the conversation:
```typescript
const initialState = new State({ messages: [] });
const finalState = await graph.run(initialState);
console.log(finalState.getMessages());
```

The simulation logs the interaction, starting with the chat bot's greeting and the user's refund request, potentially ending with the user demanding escalation, providing insights into the chat bot's performance under persistent user interaction.

### Conclusion and Next Steps

This guide covers the essentials of using LangGraph JavaScript for evaluation, from setting up a basic agent to simulating user interactions for chat bot assessment. For further exploration, check additional tutorials at [LangGraph.js Tutorials](https://langchain-ai.github.io/langgraphjs/tutorials/) and how-to guides at [How-to Guides](https://langchain-ai.github.io/langgraphjs/how-tos/) for improving agent capabilities.

### Key Citations

- [LangGraph.js Tutorials Introduction](https://langchain-ai.github.io/langgraphjs/)
- [LangGraph.js Quick Start Guide](https://langchain-ai.github.io/langgraphjs/tutorials/quickstart/)
- [Chat Bot Evaluation as Multi-agent Simulation Tutorial](https://langchain-ai.github.io/langgraphjs/tutorials/chatbot-simulation-evaluation/agent-simulation-evaluation/)
- [LangSmith Documentation for Observability](https://docs.smith.langchain.com/)
- [Weather API for Example Outputs](https://www.weatherapi.com/)
