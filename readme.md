## 0. Set up local package
1. git clone `https://github.com/nick/forwader-app`
2. pnpm install
3. For local development, copy the `.env.example` file into a new file called `.env`

## 1. Register a bot on Slack

1. Go to [https://api.slack.com/apps](https://api.slack.com/apps) 
2. Click on **Create New App**
3. Select on **From an app manifest**
4. Pick the desired worksapce
5. Paste in the JSON file from `manifest.json`
6. Copy the **Signing Secret** in the **App Credentials** section to your `SLACK_SIGNING_SECRET` environment variable

### Customize appearance
1. In the "Basic Information" tab, you can customize the **App name**, **Short description** and **App icon** used for the bot.

### Get your Slack bot token
1. This token represents your bot.
2. Go to `OAuth & Permissions` tab
3. Copy the "**Bot User OAuth Token**"
4. paste into `SLACK_BOT_TOKEN`

### Get your "Forward to" channel
1. open your slack application
2. right click on the channel you want to forward threads to
3. copy the "**Channel ID**" (found at the bottom of the pop-up)
4. paste it into `FORWARD_TO_CHANNEL` env variable

## Run locally
The below steps apply to local development only.

1. Navigate to **Basic Information** tab on the Slack bot management dashboard
2. Under **App-Level Tokens**, click on "**Generate Token and Scopes**"
4. Give the token a name like `local-dev`
5. Choose `connections:write` as a scope
6. Copy the token into `SLACK_APP_TOKEN` in your `.env` file

Enable socket mode:
7. Ensure that **Socket mode** is toggled on in the `Socket Mode` tab of the dashboard

Run the service:
```
pnpm dev
```

## Deploying to production
Follow the "Register a bot on Slack" step again to register a different Slack bot for production use.

1. Deploy the app to any serverless function service that supports node.
2. Set the `SLACK_BOT_TOKEN` and `FORWARD_TO_CHANNEL` environment variables in your production environment
3. Ensure that **Socket mode** is toggled *off* in the `Socket Mode` tab of the dashboard
3. Get the endpoint that your service is reachable at
4. Navigate to **Event Subscriptions** in your Slack bot settings
5. Paste the service URL into `Request URL`

## Install the Inkeep Slack Ingester Bot

1. [Install](https://slack-ingester.inkeep.com/slack/install) the Inkeep "Knowledge Base Connector" bot to your desired workspace.
2. Add it to the `FORWARD_TO_CHANNEL` that should be ingested by Inkeep

The bot will automatically process all threads in this channel and add it to your knowledge base.

## (Optional) Allow listing users or groups
To only allow certain users to be able to forward threads using this Slack App, you can optionally set the following two environment variables:

```
ALLOWED_GROUP_IDS=groupOneId,groupTwoId
ALLOWED_USER_IDS=userOneId,userTwoId
```

If either env variable has a value, then the bot will check whether a user is in the user IDs OR a member of at least one of the allowed groups.

To create a new a group just for this purpose:
1. Follow the instructions [here](https://slack.com/help/articles/212906697-Create-a-user-group#create-a-user-group).
2. (optional) Set the "Default Channels" option to the`FORWARD_TO_CHANNEL` channel so that users in this group automatically get access to it.
3. Grab the Group ID by clicking on the **...** button and clicking the **Copy group ID** option.
4. Add it to `ALLOWED_GROUP_IDS` environment variable