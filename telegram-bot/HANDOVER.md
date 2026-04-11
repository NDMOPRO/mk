# Monthly Key Telegram Bot Handover Document

## 1. Project Overview and Architecture

The Monthly Key Telegram Bot is a critical operational tool designed to streamline and automate various aspects of property management and team coordination for Monthly Key in Riyadh, Saudi Arabia. It integrates with Telegram as its primary interface, allowing team members to interact with the system using natural language commands and AI-driven conversations. The bot is built on Node.js and uses SQLite for its local database, ensuring lightweight and efficient data management. It leverages the Telegram Bot API for communication, the OpenAI API for advanced AI capabilities (including function calling), and integrates with Google Sheets and Calendar for broader operational synchronization.

**Key Architectural Components:**
- **Telegram Bot API:** Handles all incoming and outgoing messages, commands, and callbacks.
- **Node.js Backend:** The core application logic, responsible for processing messages, executing commands, and interacting with databases and external APIs.
- **SQLite Database:** Stores operational data such as tasks, reminders, maintenance logs, cleaning records, expenses, team information, and configuration settings.
- **OpenAI API:** Powers the AI assistant, enabling natural language understanding, proactive task creation, and intelligent responses through function calling.
- **Google Sheets/Calendar Integration:** Synchronizes tasks, events, and other data with Google services for enhanced visibility and collaboration.
- **Scheduler:** A cron-job-like system for automated tasks, reminders, and reports.

## 2. File Structure

The project is organized into several key directories and files, each serving a specific purpose:

- `/home/ubuntu/mk/telegram-bot/`
  - `index.js`: The main entry point of the Telegram bot. It initializes the bot, registers all command handlers, sets up message processing, and integrates with the AI.
  - `config.js`: Contains global configuration settings, environment variable loading, and constants like topic IDs and team member details.
  - `keepalive.js`: A utility script to keep the bot running, potentially by responding to health checks or preventing idle timeouts.
  - `package.json`: Defines project metadata, scripts, and dependencies.
  - `Procfile`: (If present) Specifies commands to be executed by a process manager (e.g., Railway, Heroku).
  - `.env.example`: An example file for environment variables, detailing what needs to be configured.
  - `HANDOVER.md`: This document.
  - `src/`
    - `handlers/`
      - `ops.js`: Contains the core AI logic, `buildSystemPrompt`, `executeTool` function, and handlers for general operational commands and AI interactions. This file is central to the bot's intelligence.
      - `ops-v4.js`: Handlers for features introduced in 
v4 of the bot, including team management, onboarding, and performance tracking.
      - `ops-v5.js`: Handlers for features introduced in v5, such as maintenance logging, cleaning management, workflow automation, and property photo approvals.
    - `services/`
      - `ops-database.js`: Core database interaction logic for general operational tasks (tasks, reminders, expenses, SLA).
      - `ops-database-v4.js`: Database interaction logic specific to v4 features (team members, onboarding, performance, polls).
      - `ops-database-v5.js`: Database interaction logic specific to v5 features (maintenance, cleaning, workflows, templates, ideas, photos).
      - `ops-scheduler.js`: Manages scheduled tasks and cron jobs, such as daily weather checks, weekly standups, and SLA monitoring.
      - `google-sync.js`: Handles integration with Google Sheets and Calendar APIs.
      - `database.js`: (Base database module) Initializes the SQLite database and provides common database utilities.

## 3. All 49 Features Listed and Explained

The Monthly Key Telegram Bot is equipped with a comprehensive suite of 49 features, categorized for clarity. These features are designed to automate, track, and manage various operational aspects, enhancing efficiency and communication within the team.

| Category | Feature Name | Description | Related Files |
|---|---|---|---|
| **Task Management** | 1. Create Task | Allows users to create a new task with title, priority, assignee, property tag, and due date. | `ops.js`, `ops-database.js` |
| | 2. Create Batch Tasks | Enables creation of multiple tasks simultaneously. | `ops.js`, `ops-database.js` |
| | 3. List Tasks | Displays all pending tasks for the current topic. | `ops.js`, `ops-database.js` |
| | 4. Mark Task Done | Marks a specific task as completed. | `ops.js`, `ops-database.js` |
| | 5. Move Task | Transfers a task to a different topic/thread. | `ops.js`, `ops-database.js` |
| | 6. Task Dependencies | Links tasks, ensuring one cannot be completed before another. | `ops.js`, `ops-database.js` |
| | 7. Recurring Tasks | Sets up tasks that automatically re-create based on a schedule. | `ops.js`, `ops-database.js` |
| | 8. Task Summary | Provides an overview of task statuses and statistics. | `ops.js`, `ops-database.js` |
| **Reminders & Alerts** | 9. Create Reminder | Sets a timed reminder for any message. | `ops.js`, `ops-database.js` |
| | 10. SLA Monitoring | Tracks task completion against Service Level Agreements and sends alerts. | `ops.js`, `ops-database.js`, `ops-scheduler.js` |
| | 11. Mention Alerts | Notifies users when they are mentioned in a task or message. | `ops-v4.js`, `ops-database-v4.js` |
| **Facility Operations** | 12. Log Maintenance | Records maintenance work, including unit, description, and cost. | `ops.js`, `ops-database-v5.js` |
| | 13. Maintenance Summary | Provides an overview of maintenance logs and costs. | `ops-v5.js`, `ops-database-v5.js` |
| | 14. Log Cleaning | Records cleaning sessions (check-in, check-out, deep clean). | `ops.js`, `ops-database-v5.js` |
| | 15. Cleaning Summary | Offers statistics and details on cleaning activities. | `ops-v5.js`, `ops-database-v5.js` |
| | 16. Property Photos Approval | Manages the approval workflow for property photos. | `ops-v5.js`, `ops-database-v5.js` |
| | 17. Occupancy Tracking | Monitors and updates the occupancy status of units. | `ops.js`, `ops-database.js` |
| **Team Management** | 18. Add Team Member | Registers a new team member with their details. | `ops-v4.js`, `ops-database-v4.js` |
| | 19. List Team Members | Displays all registered team members. | `ops-v4.js`, `ops-database-v4.js` |
| | 20. Onboarding Checklist | Manages the onboarding process for new team members. | `ops-v4.js`, `ops-database-v4.js` |
| | 21. Performance Tracking | Monitors and reports on individual and team performance. | `ops-v4.js`, `ops-database-v4.js` |
| | 22. Leave Tracker | Records and manages team members' leave. | `ops-v4.js`, `ops-database-v4.js` |
| | 23. Polls | Creates and manages polls for team decisions. | `ops-v4.js`, `ops-database-v4.js` |
| | 24. Team Availability | Shows which team members are currently available. | `ops-v4.js`, `ops-database-v4.js` |
| **Financial Operations** | 25. Record Expense | Logs financial expenses with amount, description, and property tag. | `ops.js`, `ops-database.js` |
| | 26. Expense Summary | Provides a summary of expenses by category and property. | `ops.js`, `ops-database.js` |
| | 27. Revenue Tracking | (Implied/Future) Tracks income and revenue streams. | `ops-database.js` (schema) |
| **Communication & Reporting** | 28. Shift Handover | Generates a summary of activities for shift changes. | `ops.js`, `ops-database.js` |
| | 29. Monthly Report | Compiles a comprehensive monthly operational report. | `ops.js`, `ops-database.js` |
| | 30. Meeting Management | Facilitates starting, ending, and logging meeting discussions. | `ops.js`, `ops-database.js` |
| | 31. Voice Message Transcription | Transcribes incoming voice messages for easier processing. | `ops.js` |
| | 32. Media Logging | Logs incoming photos and other media for record-keeping. | `ops.js`, `ops-database.js` |
| | 33. Message Templates | Stores and retrieves predefined message templates. | `ops-v5.js`, `ops-database-v5.js` |
| | 34. Trends Analysis | Analyzes operational data to identify trends and insights. | `ops-v5.js`, `ops-database-v5.js` |
| **AI & Automation** | 35. AI Assistant (MKOI) | The core AI that understands natural language, uses tools proactively, and manages operations. | `ops.js` |
| | 36. AI Function Calling | Enables the AI to execute specific operational functions (e.g., create task, log maintenance). | `ops.js` |
| | 37. Proactive Task Creation | AI automatically creates tasks based on conversation context. | `ops.js` |
| | 38. Contextual Awareness | AI maintains conversation history and topic context. | `ops.js` |
| **Integrations** | 39. Google Sheets Sync | Synchronizes operational data with Google Sheets. | `ops.js`, `google-sync.js` |
| | 40. Google Calendar Sync | Creates and updates events in Google Calendar. | `ops.js`, `google-sync.js` |
| | 41. Weather Alerts | Provides daily weather updates and alerts. | `ops-v5.js`, `ops-scheduler.js` |
| **Workflow & Strategy** | 42. Workflow Automation | Defines and executes multi-step operational workflows. | `ops-v5.js`, `ops-database-v5.js` |
| | 43. Idea Management | Collects, tracks, and votes on new ideas. | `ops-v5.js`, `ops-database-v5.js` |
| | 44. Brainstorming Sessions | Facilitates and logs brainstorming discussions. | `ops-v5.js`, `ops-database-v5.js` |
| | 45. CEO Weekly Message | Sends a weekly summary message to the CEO. | `ops-scheduler.js` |
| | 46. Daily Standup | Facilitates daily team standup meetings. | `ops-scheduler.js` |
| | 47. KPI Tracking | Monitors and reports on Key Performance Indicators. | `ops.js`, `ops-database.js` |
| | 48. Property Tagging | Associates tasks, expenses, and logs with specific properties. | `ops.js`, `ops-database.js` |
| | 49. Bilingual Support | All user-facing interactions support both English and Arabic. | All files |

## 4. Database Schema

The bot uses an SQLite database to store its operational data. Below is a detailed breakdown of the main tables and their columns.

### `tasks` Table
| Column Name | Type | Description |
|---|---|---|
| `id` | INTEGER | Primary Key, auto-incrementing. |
| `chat_id` | INTEGER | Telegram chat ID where the task was created. |
| `thread_id` | INTEGER | Telegram message thread ID (topic ID). |
| `topic_name` | TEXT | Name of the topic the task belongs to. |
| `title` | TEXT | Description of the task. |
| `status` | TEXT | Current status of the task (e.g., `pending`, `done`, `cancelled`). |
| `priority` | TEXT | Priority level (e.g., `low`, `medium`, `high`, `urgent`). |
| `assigned_to` | TEXT | Username or name of the assignee. |
| `property_tag` | TEXT | Tag for the property associated with the task (e.g., `#unit5`). |
| `due_date` | TEXT | Due date of the task in `YYYY-MM-DD HH:MM:SS` format. |
| `created_by` | TEXT | User who created the task. |
| `created_at` | TEXT | Timestamp of task creation. |
| `completed_at` | TEXT | Timestamp of task completion. |

### `reminders` Table
| Column Name | Type | Description |
|---|---|---|
| `id` | INTEGER | Primary Key, auto-incrementing. |
| `chat_id` | INTEGER | Telegram chat ID. |
| `thread_id` | INTEGER | Telegram message thread ID. |
| `topic_name` | TEXT | Name of the topic. |
| `message_text` | TEXT | The reminder message. |
| `remind_at` | TEXT | Timestamp when the reminder should be sent. |
| `from_user` | TEXT | User who set the reminder. |
| `status` | TEXT | Status of the reminder (e.g., `pending`, `sent`). |
| `created_at` | TEXT | Timestamp of reminder creation. |

### `maintenance_log` Table
| Column Name | Type | Description |
|---|---|---|
| `id` | INTEGER | Primary Key, auto-incrementing. |
| `chat_id` | INTEGER | Telegram chat ID. |
| `thread_id` | INTEGER | Telegram message thread ID. |
| `topic_name` | TEXT | Name of the topic. |
| `unit_id` | TEXT | Identifier for the property unit. |
| `description` | TEXT | Description of the maintenance work. |
| `cost` | REAL | Cost associated with the maintenance. |
| `performed_by` | TEXT | Name of the person who performed the maintenance. |
| `created_at` | TEXT | Timestamp of log creation. |

### `cleaning_log` Table
| Column Name | Type | Description |
|---|---|---|
| `id` | INTEGER | Primary Key, auto-incrementing. |
| `chat_id` | INTEGER | Telegram chat ID. |
| `unit_id` | TEXT | Identifier for the property unit. |
| `cleaning_type` | TEXT | Type of cleaning (e.g., `checkin`, `checkout`, `deep`). |
| `cleaner_name` | TEXT | Name of the cleaner. |
| `notes` | TEXT | Additional notes about the cleaning. |
| `status` | TEXT | Status of the cleaning (e.g., `pending`, `completed`). |
| `started_at` | TEXT | Timestamp when cleaning started. |
| `completed_at` | TEXT | Timestamp when cleaning completed. |

### `expenses` Table
| Column Name | Type | Description |
|---|---|---|
| `id` | INTEGER | Primary Key, auto-incrementing. |
| `chat_id` | INTEGER | Telegram chat ID. |
| `thread_id` | INTEGER | Telegram message thread ID. |
| `topic_name` | TEXT | Name of the topic. |
| `amount` | REAL | Amount of the expense. |
| `description` | TEXT | Description of the expense. |
| `property_tag` | TEXT | Property associated with the expense. |
| `category` | TEXT | Category of the expense. |
| `created_by` | TEXT | User who recorded the expense. |
| `created_at` | TEXT | Timestamp of expense recording. |

### `sla_config` Table
| Column Name | Type | Description |
|---|---|---|
| `id` | INTEGER | Primary Key, auto-incrementing. |
| `chat_id` | INTEGER | Telegram chat ID. |
| `thread_id` | INTEGER | Telegram message thread ID. |
| `topic_name` | TEXT | Name of the topic. |
| `sla_hours` | INTEGER | Service Level Agreement in hours. |
| `created_at` | TEXT | Timestamp of configuration. |

### `approvals` Table
| Column Name | Type | Description |
|---|---|---|
| `id` | INTEGER | Primary Key, auto-incrementing. |
| `chat_id` | INTEGER | Telegram chat ID. |
| `thread_id` | INTEGER | Telegram message thread ID. |
| `topic_name` | TEXT | Name of the topic. |
| `request_text` | TEXT | The approval request message. |
| `requested_by` | TEXT | User who requested the approval. |
| `message_id` | INTEGER | Telegram message ID of the request. |
| `status` | TEXT | Status of the approval (e.g., `pending`, `approved`, `rejected`). |
| `decided_by` | TEXT | User who made the decision. |
| `decision_comment` | TEXT | Comment on the decision. |
| `created_at` | TEXT | Timestamp of request creation. |
| `decided_at` | TEXT | Timestamp of decision. |

### `recurring_tasks` Table
| Column Name | Type | Description |
|---|---|---|
| `id` | INTEGER | Primary Key, auto-incrementing. |
| `chat_id` | INTEGER | Telegram chat ID. |
| `thread_id` | INTEGER | Telegram message thread ID. |
| `topic_name` | TEXT | Name of the topic. |
| `title` | TEXT | Title of the recurring task. |
| `schedule_type` | TEXT | Type of schedule (e.g., `daily`, `weekly`, `monthly`). |
| `schedule_value` | TEXT | Value for the schedule (e.g., `Mon`, `15th`). |
| `assigned_to` | TEXT | Assignee for the recurring task. |
| `property_tag` | TEXT | Property tag. |
| `priority` | TEXT | Priority. |
| `created_by` | TEXT | User who created it. |
| `active` | INTEGER | 1 if active, 0 if inactive. |
| `last_created_at` | TEXT | Timestamp when the task was last created by the scheduler. |
| `created_at` | TEXT | Timestamp of recurring task creation. |

### `task_dependencies` Table
| Column Name | Type | Description |
|---|---|---|
| `id` | INTEGER | Primary Key, auto-incrementing. |
| `task_id` | INTEGER | ID of the task that depends on another. |
| `depends_on_id` | INTEGER | ID of the task it depends on. |
| `created_at` | TEXT | Timestamp of dependency creation. |

### `meetings` Table
| Column Name | Type | Description |
|---|---|---|
| `id` | INTEGER | Primary Key, auto-incrementing. |
| `chat_id` | INTEGER | Telegram chat ID. |
| `thread_id` | INTEGER | Telegram message thread ID. |
| `topic_name` | TEXT | Name of the topic. |
| `started_by` | TEXT | User who started the meeting. |
| `status` | TEXT | Status of the meeting (e.g., `active`, `ended`). |
| `summary` | TEXT | Summary of the meeting. |
| `started_at` | TEXT | Timestamp when meeting started. |
| `ended_at` | TEXT | Timestamp when meeting ended. |

### `meeting_messages` Table
| Column Name | Type | Description |
|---|---|---|
| `id` | INTEGER | Primary Key, auto-incrementing. |
| `meeting_id` | INTEGER | Foreign key to `meetings` table. |
| `from_user` | TEXT | User who sent the message. |
| `message_text` | TEXT | Content of the message. |
| `created_at` | TEXT | Timestamp of message. |

### `team_members` Table (v4)
| Column Name | Type | Description |
|---|---|---|
| `id` | INTEGER | Primary Key, auto-incrementing. |
| `chat_id` | INTEGER | Telegram chat ID. |
| `username` | TEXT | Telegram username. |
| `display_name` | TEXT | Display name of the team member. |
| `role` | TEXT | Role of the team member. |
| `status` | TEXT | Current status (e.g., `active`, `inactive`). |
| `created_at` | TEXT | Timestamp of creation. |

### `onboarding_checklist` Table (v4)
| Column Name | Type | Description |
|---|---|---|
| `id` | INTEGER | Primary Key, auto-incrementing. |
| `chat_id` | INTEGER | Telegram chat ID. |
| `member_id` | INTEGER | Foreign key to `team_members` table. |
| `item` | TEXT | Checklist item description. |
| `status` | TEXT | Status (e.g., `pending`, `completed`). |
| `created_at` | TEXT | Timestamp of creation. |

### `performance_reviews` Table (v4)
| Column Name | Type | Description |
|---|---|---|
| `id` | INTEGER | Primary Key, auto-incrementing. |
| `chat_id` | INTEGER | Telegram chat ID. |
| `member_id` | INTEGER | Foreign key to `team_members` table. |
| `score` | INTEGER | Performance score. |
| `feedback` | TEXT | Feedback provided. |
| `reviewed_by` | TEXT | User who reviewed. |
| `created_at` | TEXT | Timestamp of review. |

### `leave_tracker` Table (v4)
| Column Name | Type | Description |
|---|---|---|
| `id` | INTEGER | Primary Key, auto-incrementing. |
| `chat_id` | INTEGER | Telegram chat ID. |
| `member_id` | INTEGER | Foreign key to `team_members` table. |
| `start_date` | TEXT | Start date of leave. |
| `end_date` | TEXT | End date of leave. |
| `reason` | TEXT | Reason for leave. |
| `status` | TEXT | Status (e.g., `pending`, `approved`, `away`). |
| `created_at` | TEXT | Timestamp of creation. |

### `polls` Table (v4)
| Column Name | Type | Description |
|---|---|---|
| `id` | INTEGER | Primary Key, auto-incrementing. |
| `chat_id` | INTEGER | Telegram chat ID. |
| `thread_id` | INTEGER | Telegram message thread ID. |
| `question` | TEXT | Poll question. |
| `options` | TEXT | JSON string of poll options. |
| `created_by` | TEXT | User who created the poll. |
| `status` | TEXT | Status (e.g., `active`, `closed`). |
| `created_at` | TEXT | Timestamp of creation. |

### `poll_votes` Table (v4)
| Column Name | Type | Description |
|---|---|---|
| `id` | INTEGER | Primary Key, auto-incrementing. |
| `poll_id` | INTEGER | Foreign key to `polls` table. |
| `user_id` | INTEGER | Telegram user ID of the voter. |
| `option_index` | INTEGER | Index of the chosen option. |
| `created_at` | TEXT | Timestamp of vote. |

### `workflow_templates` Table (v5)
| Column Name | Type | Description |
|---|---|---|
| `id` | INTEGER | Primary Key, auto-incrementing. |
| `chat_id` | INTEGER | Telegram chat ID. |
| `name` | TEXT | Name of the workflow template. |
| `steps` | TEXT | JSON string of workflow steps. |
| `created_by` | TEXT | User who created the template. |
| `created_at` | TEXT | Timestamp of creation. |

### `workflow_instances` Table (v5)
| Column Name | Type | Description |
|---|---|---|
| `id` | INTEGER | Primary Key, auto-incrementing. |
| `chat_id` | INTEGER | Telegram chat ID. |
| `template_id` | INTEGER | Foreign key to `workflow_templates` table. |
| `unit_id` | TEXT | Property unit associated with the workflow. |
| `current_step` | INTEGER | Index of the current step. |
| `status` | TEXT | Status of the workflow (e.g., `active`, `completed`, `cancelled`). |
| `started_by` | TEXT | User who started the workflow. |
| `started_at` | TEXT | Timestamp when workflow started. |
| `completed_at` | TEXT | Timestamp when workflow completed. |

### `message_templates` Table (v5)
| Column Name | Type | Description |
|---|---|---|
| `id` | INTEGER | Primary Key, auto-incrementing. |
| `chat_id` | INTEGER | Telegram chat ID. |
| `name` | TEXT | Name of the message template. |
| `content` | TEXT | Content of the message template. |
| `created_by` | TEXT | User who created the template. |
| `created_at` | TEXT | Timestamp of creation. |

### `ideas` Table (v5)
| Column Name | Type | Description |
|---|---|---|
| `id` | INTEGER | Primary Key, auto-incrementing. |
| `chat_id` | INTEGER | Telegram chat ID. |
| `thread_id` | INTEGER | Telegram message thread ID. |
| `description` | TEXT | Description of the idea. |
| `submitted_by` | TEXT | User who submitted the idea. |
| `votes` | INTEGER | Number of votes for the idea. |
| `status` | TEXT | Status of the idea (e.g., `new`, `approved`, `rejected`). |
| `created_at` | TEXT | Timestamp of submission. |
| `updated_at` | TEXT | Timestamp of last update. |

### `idea_votes` Table (v5)
| Column Name | Type | Description |
|---|---|---|
| `id` | INTEGER | Primary Key, auto-incrementing. |
| `idea_id` | INTEGER | Foreign key to `ideas` table. |
| `user_id` | INTEGER | Telegram user ID of the voter. |
| `created_at` | TEXT | Timestamp of vote. |

### `brainstorm_sessions` Table (v5)
| Column Name | Type | Description |
|---|---|---|
| `id` | INTEGER | Primary Key, auto-incrementing. |
| `chat_id` | INTEGER | Telegram chat ID. |
| `thread_id` | INTEGER | Telegram message thread ID. |
| `topic` | TEXT | Topic of the brainstorming session. |
| `started_by` | TEXT | User who started the session. |
| `status` | TEXT | Status (e.g., `active`, `ended`). |
| `summary` | TEXT | Summary of the session. |
| `started_at` | TEXT | Timestamp when session started. |
| `ended_at` | TEXT | Timestamp when session ended. |

### `brainstorm_messages` Table (v5)
| Column Name | Type | Description |
|---|---|---|
| `id` | INTEGER | Primary Key, auto-incrementing. |
| `session_id` | INTEGER | Foreign key to `brainstorm_sessions` table. |
| `from_user` | TEXT | User who sent the message. |
| `message` | TEXT | Content of the message. |
| `created_at` | TEXT | Timestamp of message. |

### `property_photos` Table (v5)
| Column Name | Type | Description |
|---|---|---|
| `id` | INTEGER | Primary Key, auto-incrementing. |
| `chat_id` | INTEGER | Telegram chat ID. |
| `thread_id` | INTEGER | Telegram message thread ID. |
| `unit_id` | TEXT | Property unit ID. |
| `file_id` | TEXT | Telegram file ID of the photo. |
| `file_type` | TEXT | Type of file (e.g., `photo`). |
| `caption` | TEXT | Caption of the photo. |
| `submitted_by` | TEXT | User who submitted the photo. |
| `status` | TEXT | Status (e.g., `pending`, `approved`, `rejected`). |
| `reviewed_by` | TEXT | User who reviewed the photo. |
| `review_note` | TEXT | Notes from the review. |
| `website_ready` | INTEGER | 1 if ready for website, 0 otherwise. |
| `created_at` | TEXT | Timestamp of submission. |
| `reviewed_at` | TEXT | Timestamp of review. |

## 5. Environment Variables

The following environment variables are required for the bot to function correctly. They should be configured in a `.env` file in the root directory or set directly in the deployment environment (e.g., Railway).

| Variable Name | Description | Example Value |
|---|---|---|
| `BOT_TOKEN` | Your Telegram Bot API Token. | `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11` |
| `OPENAI_API_KEY` | Your OpenAI API Key for AI capabilities. | `sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `WEBHOOK_URL` | The public URL where Telegram sends updates. | `https://your-railway-app.up.railway.app/webhook` |
| `GOOGLE_SHEETS_WEBHOOK_URL` | Webhook URL for Google Sheets integration. | `https://your-google-sheets-service.up.railway.app/webhook` |
| `DATABASE_PATH` | Path to the SQLite database file. | `./data/monthlykey.db` |
| `CEO_CHAT_ID` | Telegram Chat ID of the CEO for weekly reports. | `123456789` |
| `CEO_THREAD_ID` | Telegram Thread ID of the CEO topic. | `1` |
| `OPS_CHAT_ID` | Telegram Chat ID of the main Operations group. | `987654321` |
| `OPS_THREAD_ID` | Telegram Thread ID of the main Operations topic. | `1` |
| `WEATHER_API_KEY` | API key for weather service (e.g., OpenWeatherMap). | `your_weather_api_key` |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID for Sheets/Calendar. | `your-client-id.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret. | `your-client-secret` |
| `GOOGLE_REDIRECT_URI` | Google OAuth Redirect URI. | `https://your-railway-app.up.railway.app/oauth2callback` |
| `GOOGLE_REFRESH_TOKEN` | Google Refresh Token (obtained after initial OAuth flow). | `1/AbCdEfGhIjKlMnOpQrStUvWxYz12345` |

## 6. Local Development Setup

To set up the Monthly Key Telegram Bot for local development, follow these steps:

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/NDMOPRO/mk.git
    cd mk/telegram-bot
    ```

2.  **Install Dependencies:**
    ```bash
    npm install
    ```

3.  **Configure Environment Variables:**
    Create a `.env` file in the `telegram-bot` directory based on `.env.example` and fill in all required values. Ensure `DATABASE_PATH` points to a local file (e.g., `./data/monthlykey.db`).

4.  **Initialize Database:**
    The database schema is automatically initialized on bot startup if the database file does not exist. You can force a re-initialization by deleting the database file specified in `DATABASE_PATH`.

5.  **Start the Bot:**
    ```bash
    npm start
    ```
    The bot should now be running locally. You will need to configure a webhook for Telegram to send updates to your local machine (e.g., using `ngrok` or a similar service to expose your local port).

## 7. Deployment to Railway

This project is designed for deployment on Railway. The `railway.toml` and `start.sh` (or `Procfile`) files in the root of the `mk` repository handle the deployment configuration. Assuming the `telegram-bot` directory is part of a larger monorepo or a specific service within Railway, the deployment process typically involves:

1.  **Connect to GitHub:** Link your Railway project to the `NDMOPRO/mk` GitHub repository.

2.  **Configure Service:** Create a new service in Railway and point it to the `telegram-bot` directory within your repository. Ensure the build command and start command are correctly configured. A typical `start.sh` for this service might look like:
    ```bash
    #!/bin/bash
    npm install
    npm start
    ```
    Or if using a `Procfile`:
    ```
    web: npm start
    ```

3.  **Set Environment Variables:** Add all the environment variables listed in Section 5 to your Railway service settings. These are crucial for the bot's operation.

4.  **Set Webhook:** Configure your Telegram bot with the `WEBHOOK_URL` provided by Railway after deployment. This is usually `https://<your-railway-service-domain>/webhook`.

5.  **Deploy:** Trigger a deployment on Railway. The platform will build and run your bot.

## 8. How the AI System Works

The AI system, powered by OpenAI's models, is the brain of the Monthly Key Telegram Bot. It operates on a sophisticated prompt engineering and function calling mechanism to provide intelligent and proactive assistance.

### 8.1. System Prompt (`buildSystemPrompt` in `ops.js`)

The `buildSystemPrompt` function dynamically constructs a detailed system message for the AI. This prompt is crucial for defining the AI's persona, capabilities, and interaction rules. Key elements include:

-   **Persona:** MKOI (Monthly Key Operations Intelligence), an elite AI assistant.
-   **Context:** Current KSA time, current Telegram topic, and the AI's specific role within that topic.
-   **Core Directives:** Emphasizes full context awareness, proactive management (using tools immediately), task intelligence (inferring details), and bilingual excellence.
-   **Operational Architecture:** Informs the AI about the full range of 49 features it has authority over, categorized into Task Management, Facility Ops, Team Ops, Financial Ops, and Strategy.
-   **Interaction Rules:** Provides specific guidelines for how the AI should respond to user inputs, such as creating tasks for 
commitments, logging maintenance, and confirming actions.

### 8.2. Function Calling (`OPS_TOOLS` in `ops.js`)

The `OPS_TOOLS` array defines the specific functions the AI can call. These tools map directly to operational actions in the database.

-   `create_task`: Creates a single task with priority, assignee, and property tag.
-   `create_tasks_batch`: Creates multiple tasks at once.
-   `create_reminder`: Sets a timed reminder.
-   `mark_task_done`: Marks a task as complete by ID.
-   `move_task`: Moves a task to a different topic thread.
-   `log_maintenance`: Logs maintenance work and costs for a property.
-   `log_cleaning`: Logs a cleaning session (checkin/checkout/deep).
-   `record_expense`: Records a financial expense.

### 8.3. Execution (`executeTool` in `ops.js`)

The `executeTool` function is the bridge between the AI's function calls and the database operations. It takes the tool name and arguments provided by the AI, executes the corresponding database function (e.g., `opsDb.addTask`, `v5Db.addMaintenanceLog`), and returns a success or error status.

## 9. How the Scheduler Works

The `ops-scheduler.js` file manages automated tasks and cron jobs, ensuring timely execution of operational routines. It uses `node-cron` to schedule functions based on specific times or intervals.

### 9.1. Scheduled Jobs

-   **Daily Weather Check:** Runs daily at 8:00 AM KSA time to fetch weather forecasts and send alerts if necessary.
-   **Weekly Standup:** Runs every Sunday at 9:00 AM KSA time to facilitate a team standup meeting.
-   **Weekly CEO Message:** Runs every Thursday at 5:00 PM KSA time to send a comprehensive operational summary to the CEO.
-   **SLA Monitoring:** Runs every hour to check for tasks that have breached their Service Level Agreements and send alerts.
-   **Follow-up Checks:** Runs every 15 minutes to check for pending follow-ups and send reminders.
-   **Reminder Checks:** Runs every minute to check for due reminders and send them.

### 9.2. Execution Flow

The scheduler initializes these cron jobs upon bot startup. Each job executes its corresponding function, which typically involves querying the database for relevant data (e.g., overdue tasks, pending reminders) and sending messages via the Telegram Bot API.

## 10. How the Ops Group Integration Works

The bot is deeply integrated with the main Operations group on Telegram, utilizing topic IDs and thread IDs to organize communication and tasks.

### 10.1. Topic IDs and Thread IDs

Telegram groups can be organized into topics (threads). The bot uses these IDs to route messages, tasks, and logs to the appropriate context.

-   **Topic Mapping:** The `config.js` file maps topic names (e.g., `ceo`, `ops`, `listings`) to their corresponding thread IDs.
-   **Contextual Awareness:** When a user sends a message in a specific topic, the bot captures the `message_thread_id`. This ID is used to retrieve the topic's context (name, role, emoji) via the `getTopicInfo` function in `ops.js`.
-   **Task Routing:** Tasks created within a topic are automatically associated with that topic's thread ID, ensuring they appear in the correct context when listed or queried.

## 11. Google Sheets/Calendar Integration Setup

The `google-sync.js` file handles integration with Google Sheets and Calendar, allowing for broader operational synchronization.

### 11.1. Setup Process

1.  **Google Cloud Console:** Create a project in the Google Cloud Console and enable the Google Sheets API and Google Calendar API.
2.  **OAuth Credentials:** Create OAuth 2.0 Client IDs and obtain the `Client ID` and `Client Secret`.
3.  **Environment Variables:** Set the `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` environment variables.
4.  **Authorization Flow:** Implement an OAuth flow to obtain a `Refresh Token` for the bot to access the user's Google account. This token should be stored securely (e.g., in the database or as an environment variable `GOOGLE_REFRESH_TOKEN`).
5.  **Webhook Configuration:** The bot uses a webhook (`GOOGLE_SHEETS_WEBHOOK_URL`) to communicate with a separate service or Google Apps Script that handles the actual data synchronization with Sheets and Calendar.

### 11.2. Functionality

-   **Sync All:** Triggers a full synchronization of operational data (tasks, expenses, logs) to Google Sheets.
-   **Create Calendar Event:** Creates an event in Google Calendar for tasks with due dates or scheduled meetings.
-   **Update Calendar Event:** Updates existing calendar events (e.g., marking a task as done).

## 12. API Endpoints

The bot primarily interacts via the Telegram Bot API, but it may expose internal endpoints for webhooks or integrations.

-   **Telegram Webhook:** `POST /webhook` - Receives updates from Telegram.
-   **Google Sync Webhook:** `POST /google-sync` - (Internal) Receives synchronization requests from the bot to update Google Sheets/Calendar.

## 13. Known Limitations and Future Improvement Ideas

While the Monthly Key Telegram Bot is highly capable, there are areas for potential enhancement:

### 13.1. Known Limitations

-   **Database Scalability:** SQLite is excellent for local, lightweight deployments but may face performance bottlenecks with extremely high concurrency or massive datasets. Migrating to PostgreSQL or PostgreSQL-compatible databases (like TiDB) could be necessary for significant scaling.
-   **Error Handling:** While robust, error handling in some asynchronous operations (e.g., API calls) could be more granular to provide specific feedback to users.
-   **State Management:** The bot relies heavily on the database for state. In a multi-instance deployment, ensuring consistent state across instances would require a centralized database or caching layer (e.g., Redis).

### 13.2. Future Improvement Ideas

-   **Advanced Analytics Dashboard:** Develop a web-based dashboard that visualizes the operational data stored in the database, providing deeper insights into team performance, expenses, and task completion rates.
-   **Enhanced NLP Capabilities:** Integrate more advanced NLP models or fine-tune existing ones to better understand complex, multi-intent user requests.
-   **Automated Reporting:** Implement automated generation and distribution of comprehensive PDF reports for stakeholders.
-   **Integration with external tools:** Expand integrations to include tools like Jira, Trello, or Slack for broader workflow management.

## 14. Troubleshooting Guide

If you encounter issues with the bot, follow these troubleshooting steps:

1.  **Bot Not Responding:**
    -   Check if the bot process is running (e.g., `pm2 status` or Railway dashboard).
    -   Verify the `BOT_TOKEN` in the environment variables is correct.
    -   Ensure the webhook URL is correctly configured in Telegram (`https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=<YOUR_WEBHOOK_URL>`).

2.  **Database Errors:**
    -   Check the application logs for SQLite errors (e.g., `SQLITE_BUSY`, `SQLITE_CORRUPT`).
    -   Ensure the `DATABASE_PATH` is accessible and has correct read/write permissions.
    -   If the database is corrupted, you may need to restore from a backup or reinitialize it (losing data).

3.  **AI Not Functioning Correctly:**
    -   Verify the `OPENAI_API_KEY` is valid and has sufficient quota.
    -   Check the logs for OpenAI API errors (e.g., rate limits, invalid requests).
    -   Review the `buildSystemPrompt` and `OPS_TOOLS` configurations in `ops.js` to ensure they align with the expected behavior.

4.  **Integration Issues (Google Sheets/Calendar):**
    -   Verify the Google OAuth credentials (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`) are correct.
    -   Check the logs for errors related to the Google APIs.
    -   Ensure the `GOOGLE_SHEETS_WEBHOOK_URL` is accessible and functioning correctly.

5.  **Scheduled Tasks Not Running:**
    -   Check the application logs to see if the cron jobs are being initialized.
    -   Verify the server time zone is correct (the scheduler relies on KSA time).
    -   Ensure the `ops-scheduler.js` file is correctly imported and started in `index.js`.
