const { App } = require("@slack/bolt");
require("dotenv").config();

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});

const forwardMessage = async ({ ack, shortcut, client }) => {
  try {
    await ack();

    const originalMessage = shortcut.message;

    if (shortcut.channel.id !== process.env.FORWARD_TO_CHANNEL) {
      const forwardedOgMessage = await client.chat.postMessage({
        token: process.env.SLACK_BOT_TOKEN,
        channel: process.env.FORWARD_TO_CHANNEL,
        text: originalMessage.text,
      });

      const originalMessageThreads = await client.conversations.replies({
        token: process.env.SLACK_BOT_TOKEN,
        channel: process.env.FORWARD_FROM_CHANNEL,
        ts: originalMessage.ts,
      });

      const threadMessages = originalMessageThreads.messages.slice(1);

      for (let threadMessage of threadMessages) {
        // Call sync to keep message order
        await client.chat.postMessage({
          token: process.env.SLACK_BOT_TOKEN,
          channel: process.env.FORWARD_TO_CHANNEL,
          thread_ts: forwardedOgMessage.ts,
          text: threadMessage.text,
        });
      }
    }
  } catch (error) {
    console.error(error);
  }
};

app.shortcut("forward_message", forwardMessage);

(async () => {
  await app.start();

  console.log("⚡️ Bolt app is running!");
})();
