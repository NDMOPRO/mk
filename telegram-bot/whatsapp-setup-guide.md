# WhatsApp Business API Integration Guide (Twilio)

This guide explains how to set up the WhatsApp integration for the Monthly Key Telegram Bot using Twilio. The integration allows the bot to send daily summaries, appointment reminders, and critical alerts directly to the CEO's WhatsApp, as well as handle two-way messaging between WhatsApp and the Telegram Admin Panel.

## 1. Create a Twilio Account

1. Go to [Twilio.com](https://www.twilio.com/) and sign up for a free account.
2. Verify your email address and phone number.
3. Once logged in, you will be taken to the Twilio Console Dashboard.
4. Locate your **Account SID** and **Auth Token** on the dashboard. You will need these later.

## 2. Set Up WhatsApp Sandbox for Testing

Before upgrading to a paid WhatsApp Business account, you can use the Twilio Sandbox for WhatsApp to test the integration for free.

1. In the Twilio Console, navigate to **Messaging > Try it out > Send a WhatsApp message**.
2. You will see a Twilio Sandbox number (e.g., `+14155238886`) and a join code (e.g., `join your-word`).
3. To allow the bot to send messages to your personal WhatsApp number, you must first opt-in to the sandbox:
   - Send a WhatsApp message with the join code (e.g., `join your-word`) to the Twilio Sandbox number.
   - You will receive a confirmation message from Twilio.
4. Set up the webhook to receive incoming messages:
   - Go to **Messaging > Settings > WhatsApp Sandbox Settings**.
   - In the **WHEN A MESSAGE COMES IN** field, enter your Railway bot's webhook URL:
     `https://telegram-bot-production-87a1.up.railway.app/whatsapp/webhook`
   - Save the settings.

## 3. Configure Environment Variables in Railway

To activate the WhatsApp features, you need to add the following environment variables to your Railway project.

1. Go to your [Railway Dashboard](https://railway.app/).
2. Select the `telegram-bot` project and navigate to the **Variables** tab.
3. Add the following variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `TWILIO_ACCOUNT_SID` | Your Twilio Account SID from the dashboard | `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `TWILIO_AUTH_TOKEN` | Your Twilio Auth Token from the dashboard | `1234567890abcdef1234567890abcdef` |
| `TWILIO_WHATSAPP_NUMBER` | The Twilio WhatsApp number (include `whatsapp:` prefix) | `whatsapp:+14155238886` |
| `WHATSAPP_CEO_NUMBER` | The CEO's personal WhatsApp number (must be opted into sandbox) | `+966535080045` |

4. Railway will automatically redeploy the bot with the new variables.
5. In the Telegram group, type `/whatsapp status` to verify the connection.

## 4. Upgrading to WhatsApp Business API for Production

Once testing is complete, you can upgrade to a full WhatsApp Business account to send messages to any number without requiring them to opt-in first.

1. In the Twilio Console, navigate to **Messaging > Senders > WhatsApp Senders**.
2. Click **Sign Up** or **Submit a WhatsApp Sender Profile**.
3. Follow the steps to link your Facebook Business Manager account and verify your business.
4. Once approved, you can register your own phone number as a WhatsApp Sender.
5. Update the `TWILIO_WHATSAPP_NUMBER` environment variable in Railway to your new approved number.
6. Update the webhook URL for your new number:
   - Go to **Messaging > Senders > WhatsApp Senders**.
   - Click on your approved number.
   - Set the webhook URL for incoming messages to `https://telegram-bot-production-87a1.up.railway.app/whatsapp/webhook`.

## 5. Graceful Degradation

The bot is designed to work perfectly even if Twilio is not configured.
- If the environment variables are missing, the bot will skip all WhatsApp-related actions without crashing.
- Typing `/whatsapp send ...` will politely inform the user that the integration is not configured.
- Appointment reminders and daily reports will continue to be sent to the Telegram group as usual.

## 6. Features

Once configured, the integration provides the following features:
- **Two-way Messaging**: Users can send a WhatsApp message to the Twilio number. It will appear in the Telegram Admin Panel (Thread 235). Replying to that message in Telegram will send the response back to the user on WhatsApp.
- **Daily Summaries**: A summary of completed, pending, and overdue tasks, as well as upcoming appointments, is sent to the CEO's WhatsApp every day at 9 PM KSA.
- **Appointment Reminders**: Reminders for scheduled appointments are sent 1 hour and 15 minutes before the start time.
- **Manual Sending**: Admins can send a WhatsApp message directly from Telegram using `/whatsapp send +966XXXXXXXXX "Message"`.
