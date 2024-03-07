"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const bolt_1 = require("@slack/bolt");
const zod_1 = require("zod");
require("dotenv").config();
// Define a schema for the environment variables
const envSchema = zod_1.z.object({
    SLACK_BOT_TOKEN: zod_1.z.string(),
    SLACK_APP_TOKEN: zod_1.z.string().optional(),
    FORWARD_TO_CHANNEL: zod_1.z.string(),
    NODE_ENV: zod_1.z.enum(["development", "production"]).optional(),
    PORT: zod_1.z.string().optional(),
});
// Validate the environment variables
const env = envSchema.parse(process.env);
const app = new bolt_1.App({
    token: env.SLACK_BOT_TOKEN,
    socketMode: true,
    appToken: env.SLACK_APP_TOKEN,
});
function serializeMessageText(message) {
    return message.text || '';
}
function serializeMessageJson(message) {
    return "``` " + JSON.stringify(message, null, 2) + "```";
}
function forwardThread(_a) {
    return __awaiter(this, arguments, void 0, function* ({ client, thread, serializer }) {
        if (!thread.messages || thread.messages.length === 0) {
            console.error("No messages in thread");
            return;
        }
        const newThreadInitMessage = yield client.chat.postMessage({
            token: env.SLACK_BOT_TOKEN,
            channel: env.FORWARD_TO_CHANNEL,
            text: serializer(thread.messages[0]),
        });
        // Skip the first message if it's the original message in the thread
        const replies = thread.messages.slice(1);
        console.log(`Found ${replies.length} thread messages`);
        for (let threadMessage of replies) {
            const serializedText = serializer(threadMessage);
            console.log(`Forwarding thread message: ${serializedText}`);
            // Call sync to keep message order
            yield client.chat.postMessage({
                token: env.SLACK_BOT_TOKEN,
                channel: env.FORWARD_TO_CHANNEL,
                thread_ts: newThreadInitMessage.ts,
                text: serializedText,
            });
        }
    });
}
app.shortcut("forward_thread", (_a) => __awaiter(void 0, [_a], void 0, function* ({ ack, shortcut, client }) {
    try {
        console.log("Acknowledging the shortcut");
        const msgShortcut = shortcut;
        yield ack();
        console.log("Shortcut received");
        console.log(msgShortcut);
        const originalMessage = msgShortcut.message;
        const fwdFromChannel = msgShortcut.channel.id;
        console.log("Original message:", originalMessage);
        if (msgShortcut.channel.id !== env.FORWARD_TO_CHANNEL) {
            console.log(`Forwarding message to channel ${env.FORWARD_TO_CHANNEL}`);
            const thread = yield client.conversations.replies({
                token: env.SLACK_BOT_TOKEN,
                channel: fwdFromChannel,
                ts: originalMessage.ts,
            });
            forwardThread({
                client,
                channelId: fwdFromChannel,
                thread,
                serializer: serializeMessageJson,
                // serializer: serializeMessageText,
            });
        }
        else {
            console.log("Shortcut channel ID matches FORWARD_TO_CHANNEL, no action taken.");
        }
    }
    catch (error) {
        console.error("Error in forwardMessage function:", error);
    }
}));
const NODE_ENV = env.NODE_ENV;
console.log("NODE_ENV:", NODE_ENV);
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
    app.start().then(() => {
        console.log("⚡️ Bolt app is running!");
    }).catch((error) => {
        console.error(error);
        process.exit(1);
    });
}
