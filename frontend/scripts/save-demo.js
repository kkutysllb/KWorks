import { config } from "dotenv";
import fs from "fs";
import path from "path";
import { env } from "process";

export async function main() {
  const url = new URL(process.argv[2]);
  const threadId = url.pathname.split("/").pop();
  const host = url.host;
  const apiURL = new URL(
    `/v1/threads/${threadId}`,
    `${url.protocol}//${host}`,
  );
  const response = await fetch(apiURL, {
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(`Failed to load thread ${threadId}: ${response.status}`);
  }

  const thread = await response.json();
  if (!thread) {
    console.error("No data found");
    return;
  }

  const data = threadRecordToAgentThread(thread);
  const title = data.values.title;

  const rootPath = path.resolve(process.cwd(), "public/demo/threads", threadId);
  if (fs.existsSync(rootPath)) {
    fs.rmSync(rootPath, { recursive: true });
  }
  fs.mkdirSync(rootPath, { recursive: true });
  fs.writeFileSync(
    path.resolve(rootPath, "thread.json"),
    JSON.stringify(data, null, 2),
  );
  const backendRootPath = path.resolve(
    process.cwd(),
    "../backend/.kkworks/threads",
    threadId,
  );
  copyFolder("user-data/outputs", rootPath, backendRootPath);
  copyFolder("user-data/uploads", rootPath, backendRootPath);
  console.info(`Saved demo "${title}" to ${rootPath}`);
}

function threadRecordToAgentThread(thread) {
  const messages = (thread.turns ?? []).flatMap((turn) =>
    (turn.items ?? []).map(turnItemToMessage),
  );
  return {
    thread_id: thread.id,
    created_at: thread.createdAt,
    updated_at: thread.updatedAt,
    status: thread.status === "running" ? "busy" : "idle",
    metadata: {},
    values: {
      title: thread.title,
      messages,
      artifacts: [],
      ...(thread.todos ? { todos: thread.todos } : {}),
      thread_data: { runtime: "qiongqi", thread_id: thread.id },
    },
    interrupts: {},
  };
}

function turnItemToMessage(item) {
  const id = item.id;
  const additional_kwargs = { qiongqi_item: item };
  if (item.kind === "user_message") {
    return {
      id,
      type: "human",
      role: "user",
      content: item.displayText ?? item.text,
      additional_kwargs,
    };
  }
  if (item.kind === "assistant_reasoning") {
    return {
      id,
      type: "ai",
      role: "assistant",
      content: "",
      additional_kwargs: { ...additional_kwargs, reasoning_content: item.text },
    };
  }
  if (item.kind === "assistant_text" || item.kind === "review") {
    return {
      id,
      type: "ai",
      role: "assistant",
      content: item.kind === "review" ? item.reviewText ?? "" : item.text,
      additional_kwargs,
    };
  }
  if (item.kind === "tool_result") {
    return {
      id,
      type: "tool",
      role: "tool",
      name: item.toolName,
      tool_call_id: item.callId,
      content:
        typeof item.output === "string"
          ? item.output
          : JSON.stringify(item.output),
      additional_kwargs,
    };
  }
  if (item.kind === "tool_call") {
    return {
      id,
      type: "ai",
      role: "assistant",
      content: item.summary ?? "",
      tool_calls: [
        { id: item.callId, name: item.toolName, args: item.arguments },
      ],
      additional_kwargs,
    };
  }
  if (item.kind === "error") {
    return {
      id,
      type: "ai",
      role: "assistant",
      content: item.message,
      additional_kwargs,
    };
  }
  return {
    id,
    type: "system",
    role: "system",
    content: JSON.stringify(item),
    additional_kwargs,
  };
}

function copyFolder(relPath, rootPath, backendRootPath) {
  const outputsPath = path.resolve(backendRootPath, relPath);
  if (fs.existsSync(outputsPath)) {
    fs.cpSync(outputsPath, path.resolve(rootPath, relPath), {
      recursive: true,
    });
  }
}

config();
main();
