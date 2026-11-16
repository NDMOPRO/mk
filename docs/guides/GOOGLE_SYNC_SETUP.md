# Google Sheets & Calendar Integration — Setup Guide

This guide walks you through setting up the Google Sheets and Calendar integration for the Monthly Key Operations Bot. The entire process takes about 5 minutes.

---

## How It Works

The bot sends data to a **Google Apps Script** web app that you deploy under your Google account (`hobart2040@gmail.com`). The script writes to a Google Sheet and creates Google Calendar events — all under your account, so you have full ownership of the data.

| Component | What It Does |
|-----------|-------------|
| **Google Sheet** | "Monthly Key — Operations Dashboard" with 4 tabs: Tasks, KPIs, Expenses, Occupancy |
| **Google Calendar** | "Monthly Key Operations" — tasks with due dates become calendar events |
| **Auto-Sync** | Runs daily at 9:15 PM KSA (right after the daily report) |
| **Manual Sync** | Use `/gsync now` in the ops group anytime |

---

## Step 1: Create the Google Apps Script

1. Go to [script.google.com](https://script.google.com) while logged in as `hobart2040@gmail.com`
2. Click **"New project"** (the blue `+` button)
3. You will see a default file called `Code.gs` with a `myFunction()` placeholder
4. **Delete all the placeholder code** in `Code.gs`
5. Copy the **entire contents** of the file `telegram-bot/google-apps-script/Code.gs` from the GitHub repo and paste it into the editor
6. Click the **floppy disk icon** (or press `Ctrl+S`) to save
7. Rename the project: Click "Untitled project" at the top and name it **"Monthly Key Operations"**

---

## Step 2: Deploy as a Web App

1. In the Apps Script editor, click **Deploy** (top right) then **"New deployment"**
2. Click the **gear icon** next to "Select type" and choose **"Web app"**
3. Fill in:
   - **Description:** `Monthly Key Operations Sync`
   - **Execute as:** `Me (hobart2040@gmail.com)`
   - **Who has access:** `Anyone`
4. Click **"Deploy"**
5. You may be asked to authorize — click **"Authorize access"**, select your Google account, and if you see "Google hasn't verified this app", click **"Advanced"** then **"Go to Monthly Key Operations (unsafe)"**, then **"Allow"**
6. After deployment, you will see a **Web app URL** that looks like:
   ```
   https://script.google.com/macros/s/AKfycbx.../exec
   ```
7. **Copy this URL** — you will need it in the next step

---

## Step 3: Add the URL to Railway

1. Go to your Railway dashboard for the bot service
2. Navigate to **Variables** (or **Settings > Environment Variables**)
3. Add a new variable:
   - **Key:** `GOOGLE_APPS_SCRIPT_URL`
   - **Value:** *(paste the web app URL from Step 2)*
4. Railway will automatically redeploy the bot with the new variable

**Alternative — via Railway CLI or API:**

```bash
# If you have Railway CLI installed:
railway variables set GOOGLE_APPS_SCRIPT_URL="https://script.google.com/macros/s/AKfycbx.../exec"
```

---

## Step 4: Initialize and Test

Once the bot redeploys with the new environment variable, go to the **Daily Operations HQ** group in Telegram and run:

```
/gsync setup
```

This will:
- Create the "Monthly Key — Operations Dashboard" spreadsheet in your Google Drive
- Create the "Monthly Key Operations" calendar
- Return the spreadsheet URL and calendar name

Then run:

```
/gsync now
```

This will immediately sync all current data (tasks, expenses, occupancy) to the Google Sheet and create calendar events for tasks with due dates.

---

## Available Commands

| Command | Description |
|---------|-------------|
| `/gsync setup` | Initialize the spreadsheet and calendar (run once) |
| `/gsync now` | Sync all data to Google Sheets and Calendar immediately |
| `/gsync url` | Get the link to the Google Sheet |

---

## Automatic Sync Schedule

Once configured, the bot automatically syncs to Google every day:

| Time (KSA) | Action |
|------------|--------|
| 9:15 PM | Full sync: all tasks, KPIs, expenses, occupancy, and calendar events |

The sync runs right after the daily report (9:00 PM), so the Google Sheet always reflects the end-of-day state.

---

## Google Sheet Tabs

### Tasks Tab
All tasks (pending, done, cancelled) with: Task ID, Title, Status, Priority, Topic, Assigned To, Property Tag, Due Date, Created By, timestamps. Color-coded: green = done, yellow = pending, grey = cancelled.

### KPIs Tab
Daily/weekly performance rows: tasks created vs completed, pending count, overdue count, average resolution time, completion rate, top topic, top assignee. Accumulates over time for trend analysis.

### Expenses Tab
All logged expenses: amount (SAR), category, description, property tag, topic, who recorded it, date.

### Occupancy Tab
Current unit status: unit ID, occupied/vacant/maintenance, tenant name, check-in/out dates, monthly rate, notes. Color-coded: green = occupied, red = vacant, yellow = maintenance.

---

## Google Calendar

Tasks with due dates automatically become all-day calendar events. Events are color-coded by priority:
- **Red** — High/Urgent priority
- **Yellow** — Medium priority
- **Cyan** — Normal/Low priority
- **Green** — Completed tasks (marked with a checkmark)

When a task is completed via `/done`, the calendar event is updated with a checkmark prefix.

---

## Troubleshooting

**"Google Sync not configured"** — The `GOOGLE_APPS_SCRIPT_URL` environment variable is not set in Railway. Add it and redeploy.

**"Setup failed" or timeout errors** — Make sure the Apps Script is deployed as a web app with "Anyone" access. Try visiting the URL directly in your browser — you should see a JSON response.

**Authorization errors** — Re-authorize the Apps Script: go to script.google.com, open the project, click Run > `setupAll`, and authorize when prompted.

**Data not appearing in the sheet** — Run `/gsync now` to force an immediate sync. Check the Apps Script execution logs at script.google.com > Executions.

---

## Updating the Apps Script

If you need to update the script later:

1. Go to [script.google.com](https://script.google.com)
2. Open the "Monthly Key Operations" project
3. Replace the code in `Code.gs` with the updated version
4. Click **Deploy > Manage deployments**
5. Click the **pencil icon** on the existing deployment
6. Change **Version** to **"New version"**
7. Click **Deploy**

The URL stays the same — no need to update Railway.
