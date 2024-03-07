import { App, MessageShortcut } from "@slack/bolt";
import { z } from "zod";

require("dotenv").config();

// Define a schema for the environment variables
const envSchema = z.object({
  SLACK_BOT_TOKEN: z.string(),
  SLACK_APP_TOKEN: z.string().optional(),
  FORWARD_TO_CHANNEL: z.string(),
  NODE_ENV: z.enum(["development", "production"]).optional(),
  PORT: z.string().optional(),
});

type Client = App["client"];
type Thread = Awaited<ReturnType<Client["conversations"]["replies"]>>;
type Message = NonNullable<Thread["messages"]>[0];

// Validate the environment variables
const env = envSchema.parse(process.env);

const app = new App({
  token: env.SLACK_BOT_TOKEN,
  socketMode: true,
  appToken: env.SLACK_APP_TOKEN,
});

function serializeMessageText(message: Message) {
  return message.text || "";
}

function serializeMessageJson(message: Message) {
  return "``` " + JSON.stringify(message, null, 2) + "```";
}

type ForwardThreadArgs = {
  client: Client;
  channelId: string;
  thread: Thread;
  serializer: (message: Message) => string;
};

async function forwardThread({
  client,
  thread,
  serializer,
}: ForwardThreadArgs) {
  if (!thread.messages || thread.messages.length === 0) {
    console.error("No messages in thread");
    return;
  }

  const newThreadInitialMessage = await client.chat.postMessage({
    token: env.SLACK_BOT_TOKEN,
    channel: env.FORWARD_TO_CHANNEL,
    text: serializer(thread.messages[0]),
  });

  // Skip the first message if it's the original message in the thread
  const replies = thread.messages.slice(1);

  for (let threadMessage of replies) {
    const serializedText = serializer(threadMessage);
    await client.chat.postMessage({
      token: env.SLACK_BOT_TOKEN,
      channel: env.FORWARD_TO_CHANNEL,
      thread_ts: newThreadInitialMessage.ts,
      text: serializedText,
    });
  }
}

app.shortcut("forward_thread", async ({ ack, shortcut, client }) => {
  try {
    const msgShortcut = shortcut as MessageShortcut;

    await ack();

    const originalMessage = msgShortcut.message;
    const fwdFromChannel = msgShortcut.channel.id;

    if (fwdFromChannel === env.FORWARD_TO_CHANNEL) {
      console.error("Attempting to forward message to the same channel.");
      return;
    }
    
    const thread = await client.conversations.replies({
      token: env.SLACK_BOT_TOKEN,
      channel: fwdFromChannel,
      ts: originalMessage.ts,
    });

    forwardThread({
      client,
      channelId: fwdFromChannel,
      thread,
      serializer: serializeMessageJson,
    });
    
  } catch (error) {
    console.error("Error in forwardMessage function:", error);
  }
});

const NODE_ENV = env.NODE_ENV;

// if (NODE_ENV === "production" || NODE_ENV === undefined) {
//   const port = env.PORT || 8080;
//   if (!receiver) {
//     throw new Error("Receiver not initialized");
//   }
//   receiver
//     .start(port)
//     .then(() => {
//       console.log(`⚡️ Bolt Slack app is running on port ${port}!`);
//     })
//     .catch((error) => {
//       console.error(error);
//     });
// }

if (NODE_ENV === "development") {
  app
    .start()
    .then(() => {
      console.log("⚡️ Bolt app is running!");
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
