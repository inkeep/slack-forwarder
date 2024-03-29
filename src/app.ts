import {
  App,
  MessageShortcut,
  AwsLambdaReceiver,
  CodedError,
} from "@slack/bolt";
import {
  AwsCallback,
  AwsEvent,
} from "@slack/bolt/dist/receivers/AwsLambdaReceiver";
import { z } from "zod";

require("dotenv").config();

// Define a schema for the environment variables
const envSchema = z.object({
  SLACK_BOT_TOKEN: z.string(),
  SLACK_APP_TOKEN: z.string().optional(),
  SLACK_SIGNING_SECRET: z.string(),
  FORWARD_TO_CHANNEL: z.string(),
  NODE_ENV: z.enum(["development", "production"]).optional(),
  PORT: z.string().optional(),
  ALLOWED_GROUP_IDS: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(",") : undefined)),
  ALLOWED_USER_IDS: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(",") : undefined)),
});

const env = envSchema.parse(process.env);

type Client = App["client"];
type Thread = Awaited<ReturnType<Client["conversations"]["replies"]>>;
type Message = NonNullable<Thread["messages"]>[0];

// Validate the environment variables
const NODE_ENV = env.NODE_ENV;
const isProduction = NODE_ENV === "production" || NODE_ENV === undefined;
const isDevelopment = NODE_ENV === "development";

console.log("environment vars");
console.log(env);
console.log("isProduction", isProduction);

// Initialize your custom receiver
const awsLambdaReceiver = isProduction
  ? new AwsLambdaReceiver({
      signingSecret: env.SLACK_SIGNING_SECRET,
    })
  : undefined;

const slackAppOptions = isProduction
  ? {
      token: env.SLACK_BOT_TOKEN,
      receiver: awsLambdaReceiver,
      appToken: env.SLACK_APP_TOKEN,
      signingSecret: env.SLACK_SIGNING_SECRET,
    }
  : {
      token: env.SLACK_BOT_TOKEN,
      socketMode: true,
      appToken: env.SLACK_APP_TOKEN,
      signingSecret: env.SLACK_SIGNING_SECRET,
    };

const app = new App({
  ...slackAppOptions,
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

async function isUserInValidGroup(userId: string, groupIds: string[]) {
  try {
    for (const groupId of groupIds) {
      const usersResult = await app.client.usergroups.users.list({
        token: process.env.SLACK_BOT_TOKEN,
        usergroup: groupId,
      });

      if (
        usersResult.ok &&
        usersResult.users &&
        usersResult.users.includes(userId)
      ) {
        return true;
      }
    }
  } catch (error) {
    console.error(error);
  }

  return false;
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

    const isAllowListEnabled = env.ALLOWED_USER_IDS || env.ALLOWED_GROUP_IDS;

    if (isAllowListEnabled && originalMessage.user) {
      const isUserInUserIdsAllowList =
        env.ALLOWED_USER_IDS &&
        env.ALLOWED_USER_IDS.includes(originalMessage.user);

      if (!isUserInUserIdsAllowList) {
        const isUserInGroupsAllowList =
          env.ALLOWED_GROUP_IDS &&
          (await isUserInValidGroup(
            originalMessage.user,
            env.ALLOWED_GROUP_IDS
          ));
        if (!isUserInGroupsAllowList) {
          console.error("User is not authorized to forward messages.");
          return;
        }
      }
    }

    let thread: Thread | undefined;

    try {
      thread = await client.conversations.replies({
        token: env.SLACK_BOT_TOKEN,
        channel: fwdFromChannel,
        ts: originalMessage.ts,
      });
    } catch (error) {
      console.error("Error fetching thread:", error);
      return;
    }

    forwardThread({
      client,
      channelId: fwdFromChannel,
      thread,
      serializer: serializeMessageJson,
    });

    try {
      await app.client.reactions.add({
        token: process.env.SLACK_BOT_TOKEN,
        channel: fwdFromChannel,
        name: "blue_book",
        timestamp: originalMessage.ts,
      });
    } catch (error: any) {
      if (error.data && error.data.error !== "already_reacted") {
        return;
      } else {
        console.error("Error adding reaction:", error);
        throw error;
      }
    }
  } catch (error) {
    console.error("Error in forwardMessage function:", error);
  }
});

// if (isProduction) {
module.exports.handler = async (
  event: AwsEvent,
  context: any,
  callback: AwsCallback
) => {
  const handler = await awsLambdaReceiver!.start();
  return handler(event, context, callback);
};
// }

if (isDevelopment) {
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
