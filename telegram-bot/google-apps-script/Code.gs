/**
 * Monthly Key — Operations HQ Google Apps Script
 * ─────────────────────────────────────────────────────────────
 * This script acts as a webhook receiver for the Telegram bot.
 * It manages:
 *   - Tasks sheet (all tasks with status, assignee, priority, etc.)
 *   - KPIs sheet (weekly performance metrics)
 *   - Expenses sheet (all logged expenses)
 *   - Occupancy sheet (unit occupancy status)
 *   - Google Calendar events (tasks with due dates)
 *
 * Deploy as: Web App → Execute as: Me → Access: Anyone
 * ─────────────────────────────────────────────────────────────
 */

// ─── Configuration ──────────────────────────────────────────
const SPREADSHEET_NAME = "Monthly Key — Operations Dashboard";
const CALENDAR_NAME = "Monthly Key Operations";

// ─── Sheet Headers ──────────────────────────────────────────
const TASK_HEADERS = [
  "Task ID", "Title", "Status", "Priority", "Topic", "Thread ID",
  "Assigned To", "Property Tag", "Due Date", "Created By",
  "Created At", "Done At", "Updated At"
];

const KPI_HEADERS = [
  "Report Date", "Period", "Tasks Created", "Tasks Completed",
  "Tasks Pending", "Tasks Overdue", "Avg Resolution Hours",
  "Completion Rate %", "Top Topic", "Top Assignee"
];

const EXPENSE_HEADERS = [
  "Expense ID", "Amount (SAR)", "Category", "Description",
  "Property Tag", "Topic", "Recorded By", "Date", "Created At"
];

const OCCUPANCY_HEADERS = [
  "Unit ID", "Status", "Tenant Name", "Check-In", "Check-Out",
  "Monthly Rate (SAR)", "Notes", "Updated By", "Updated At"
];

// ─── Spreadsheet Management ────────────────────────────────

function getOrCreateSpreadsheet() {
  // Search for existing spreadsheet by name
  const files = DriveApp.getFilesByName(SPREADSHEET_NAME);
  if (files.hasNext()) {
    return SpreadsheetApp.open(files.next());
  }
  
  // Create new spreadsheet
  const ss = SpreadsheetApp.create(SPREADSHEET_NAME);
  
  // Set up all sheets
  setupSheet(ss, "Tasks", TASK_HEADERS);
  setupSheet(ss, "KPIs", KPI_HEADERS);
  setupSheet(ss, "Expenses", EXPENSE_HEADERS);
  setupSheet(ss, "Occupancy", OCCUPANCY_HEADERS);
  
  // Remove default "Sheet1" if it exists
  const defaultSheet = ss.getSheetByName("Sheet1");
  if (defaultSheet && ss.getSheets().length > 1) {
    ss.deleteSheet(defaultSheet);
  }
  
  // Format headers
  formatAllSheets(ss);
  
  Logger.log("Created new spreadsheet: " + ss.getUrl());
  return ss;
}

function setupSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  
  // Set headers if empty
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  
  return sheet;
}

function formatAllSheets(ss) {
  const sheets = ss.getSheets();
  for (const sheet of sheets) {
    const headerRange = sheet.getRange(1, 1, 1, sheet.getLastColumn());
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#1a73e8");
    headerRange.setFontColor("#ffffff");
    sheet.setFrozenRows(1);
    
    // Auto-resize columns
    for (let i = 1; i <= sheet.getLastColumn(); i++) {
      sheet.autoResizeColumn(i);
    }
  }
}

// ─── Calendar Management ───────────────────────────────────

function getOrCreateCalendar() {
  // Check if calendar exists
  const calendars = CalendarApp.getCalendarsByName(CALENDAR_NAME);
  if (calendars.length > 0) {
    return calendars[0];
  }
  
  // Create new calendar
  const cal = CalendarApp.createCalendar(CALENDAR_NAME, {
    summary: "Tasks and deadlines from Monthly Key Operations HQ",
    color: CalendarApp.Color.BLUE,
  });
  
  Logger.log("Created new calendar: " + CALENDAR_NAME);
  return cal;
}

// ─── Web App Entry Points ──────────────────────────────────

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    
    let result;
    
    switch (action) {
      case "sync_tasks":
        result = syncTasks(data.tasks);
        break;
      case "sync_kpis":
        result = syncKpis(data.kpis);
        break;
      case "sync_expenses":
        result = syncExpenses(data.expenses);
        break;
      case "sync_occupancy":
        result = syncOccupancy(data.occupancy);
        break;
      case "sync_all":
        result = syncAll(data);
        break;
      case "create_calendar_event":
        result = createCalendarEvent(data.event);
        break;
      case "update_calendar_event":
        result = updateCalendarEvent(data.event);
        break;
      case "delete_calendar_event":
        result = deleteCalendarEvent(data.taskId);
        break;
      case "sync_calendar":
        result = syncCalendar(data.tasks);
        break;
      case "get_spreadsheet_url":
        result = getSpreadsheetUrl();
        break;
      case "get_calendar_id":
        result = getCalendarId();
        break;
      case "setup":
        result = setupAll();
        break;
      default:
        result = { success: false, error: "Unknown action: " + action };
    }
    
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  // Health check / setup endpoint
  const action = (e && e.parameter && e.parameter.action) || "status";
  
  let result;
  if (action === "setup") {
    result = setupAll();
  } else {
    result = {
      success: true,
      message: "Monthly Key Operations HQ — Google Integration Active",
      timestamp: new Date().toISOString(),
    };
  }
  
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── Setup ─────────────────────────────────────────────────

function setupAll() {
  const ss = getOrCreateSpreadsheet();
  const cal = getOrCreateCalendar();
  
  return {
    success: true,
    spreadsheetUrl: ss.getUrl(),
    spreadsheetId: ss.getId(),
    calendarId: cal.getId(),
    calendarName: CALENDAR_NAME,
    message: "Setup complete. Spreadsheet and calendar are ready."
  };
}

function getSpreadsheetUrl() {
  const ss = getOrCreateSpreadsheet();
  return { success: true, url: ss.getUrl(), id: ss.getId() };
}

function getCalendarId() {
  const cal = getOrCreateCalendar();
  return { success: true, calendarId: cal.getId(), name: CALENDAR_NAME };
}

// ─── Task Sync ─────────────────────────────────────────────

function syncTasks(tasks) {
  if (!tasks || !Array.isArray(tasks)) {
    return { success: false, error: "No tasks array provided" };
  }
  
  const ss = getOrCreateSpreadsheet();
  const sheet = setupSheet(ss, "Tasks", TASK_HEADERS);
  
  // Clear existing data (keep headers)
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, TASK_HEADERS.length).clearContent();
  }
  
  if (tasks.length === 0) {
    return { success: true, message: "Tasks sheet cleared (no tasks)", count: 0 };
  }
  
  // Write all tasks
  const rows = tasks.map(t => [
    t.id || "",
    t.title || "",
    t.status || "",
    t.priority || "normal",
    t.topic_name || "",
    t.thread_id || "",
    t.assigned_to || "",
    t.property_tag || "",
    t.due_date || "",
    t.created_by || "",
    t.created_at || "",
    t.done_at || "",
    t.updated_at || "",
  ]);
  
  sheet.getRange(2, 1, rows.length, TASK_HEADERS.length).setValues(rows);
  
  // Apply conditional formatting
  applyTaskFormatting(sheet, rows.length);
  
  return { success: true, message: "Tasks synced", count: rows.length };
}

function applyTaskFormatting(sheet, rowCount) {
  if (rowCount === 0) return;
  
  const statusRange = sheet.getRange(2, 3, rowCount, 1); // Status column
  
  // Clear existing rules for this sheet
  const rules = sheet.getConditionalFormatRules();
  const newRules = [];
  
  // Done = green
  newRules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo("done")
    .setBackground("#c6efce")
    .setFontColor("#006100")
    .setRanges([statusRange])
    .build());
  
  // Pending = yellow
  newRules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo("pending")
    .setBackground("#ffeb9c")
    .setFontColor("#9c5700")
    .setRanges([statusRange])
    .build());
  
  // Cancelled = grey
  newRules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo("cancelled")
    .setBackground("#d9d9d9")
    .setFontColor("#666666")
    .setRanges([statusRange])
    .build());
  
  sheet.setConditionalFormatRules(newRules);
}

// ─── KPI Sync ──────────────────────────────────────────────

function syncKpis(kpis) {
  if (!kpis || !Array.isArray(kpis)) {
    return { success: false, error: "No KPIs array provided" };
  }
  
  const ss = getOrCreateSpreadsheet();
  const sheet = setupSheet(ss, "KPIs", KPI_HEADERS);
  
  // Append new KPI rows (don't clear — keep history)
  const rows = kpis.map(k => [
    k.report_date || new Date().toISOString().split("T")[0],
    k.period || "weekly",
    k.tasks_created || 0,
    k.tasks_completed || 0,
    k.tasks_pending || 0,
    k.tasks_overdue || 0,
    k.avg_resolution_hours || 0,
    k.completion_rate || 0,
    k.top_topic || "",
    k.top_assignee || "",
  ]);
  
  if (rows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, KPI_HEADERS.length).setValues(rows);
  }
  
  return { success: true, message: "KPIs synced", count: rows.length };
}

// ─── Expense Sync ──────────────────────────────────────────

function syncExpenses(expenses) {
  if (!expenses || !Array.isArray(expenses)) {
    return { success: false, error: "No expenses array provided" };
  }
  
  const ss = getOrCreateSpreadsheet();
  const sheet = setupSheet(ss, "Expenses", EXPENSE_HEADERS);
  
  // Clear and rewrite all expenses
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, EXPENSE_HEADERS.length).clearContent();
  }
  
  if (expenses.length === 0) {
    return { success: true, message: "Expenses sheet cleared", count: 0 };
  }
  
  const rows = expenses.map(e => [
    e.id || "",
    e.amount || 0,
    e.category || "",
    e.description || "",
    e.property_tag || "",
    e.topic_name || "",
    e.recorded_by || "",
    e.expense_date || "",
    e.created_at || "",
  ]);
  
  sheet.getRange(2, 1, rows.length, EXPENSE_HEADERS.length).setValues(rows);
  
  return { success: true, message: "Expenses synced", count: rows.length };
}

// ─── Occupancy Sync ────────────────────────────────────────

function syncOccupancy(occupancy) {
  if (!occupancy || !Array.isArray(occupancy)) {
    return { success: false, error: "No occupancy array provided" };
  }
  
  const ss = getOrCreateSpreadsheet();
  const sheet = setupSheet(ss, "Occupancy", OCCUPANCY_HEADERS);
  
  // Clear and rewrite
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, OCCUPANCY_HEADERS.length).clearContent();
  }
  
  if (occupancy.length === 0) {
    return { success: true, message: "Occupancy sheet cleared", count: 0 };
  }
  
  const rows = occupancy.map(o => [
    o.unit_id || "",
    o.status || "",
    o.tenant_name || "",
    o.check_in || "",
    o.check_out || "",
    o.monthly_rate || "",
    o.notes || "",
    o.updated_by || "",
    o.updated_at || "",
  ]);
  
  sheet.getRange(2, 1, rows.length, OCCUPANCY_HEADERS.length).setValues(rows);
  
  // Apply occupancy formatting
  applyOccupancyFormatting(sheet, rows.length);
  
  return { success: true, message: "Occupancy synced", count: rows.length };
}

function applyOccupancyFormatting(sheet, rowCount) {
  if (rowCount === 0) return;
  
  const statusRange = sheet.getRange(2, 2, rowCount, 1); // Status column
  const newRules = [];
  
  newRules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo("occupied")
    .setBackground("#c6efce")
    .setFontColor("#006100")
    .setRanges([statusRange])
    .build());
  
  newRules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo("vacant")
    .setBackground("#ffc7ce")
    .setFontColor("#9c0006")
    .setRanges([statusRange])
    .build());
  
  newRules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo("maintenance")
    .setBackground("#ffeb9c")
    .setFontColor("#9c5700")
    .setRanges([statusRange])
    .build());
  
  sheet.setConditionalFormatRules(newRules);
}

// ─── Sync All ──────────────────────────────────────────────

function syncAll(data) {
  const results = {};
  
  if (data.tasks) {
    results.tasks = syncTasks(data.tasks);
  }
  if (data.kpis) {
    results.kpis = syncKpis(data.kpis);
  }
  if (data.expenses) {
    results.expenses = syncExpenses(data.expenses);
  }
  if (data.occupancy) {
    results.occupancy = syncOccupancy(data.occupancy);
  }
  if (data.calendar_tasks) {
    results.calendar = syncCalendar(data.calendar_tasks);
  }
  
  return { success: true, results: results };
}

// ─── Calendar Events ───────────────────────────────────────

function createCalendarEvent(event) {
  if (!event) {
    return { success: false, error: "No event data provided" };
  }
  
  const cal = getOrCreateCalendar();
  
  const title = event.title || "Task";
  const dueDate = event.due_date ? new Date(event.due_date + "T09:00:00") : new Date();
  const description = buildEventDescription(event);
  
  const calEvent = cal.createAllDayEvent(title, dueDate, {
    description: description,
  });
  
  // Set color based on priority
  if (event.priority === "high" || event.priority === "urgent") {
    calEvent.setColor(CalendarApp.EventColor.RED);
  } else if (event.priority === "medium") {
    calEvent.setColor(CalendarApp.EventColor.YELLOW);
  } else {
    calEvent.setColor(CalendarApp.EventColor.CYAN);
  }
  
  return {
    success: true,
    eventId: calEvent.getId(),
    message: "Calendar event created: " + title,
  };
}

function updateCalendarEvent(event) {
  if (!event || !event.eventId) {
    return { success: false, error: "No event ID provided" };
  }
  
  const cal = getOrCreateCalendar();
  
  try {
    const calEvent = cal.getEventById(event.eventId);
    if (!calEvent) {
      return { success: false, error: "Event not found" };
    }
    
    if (event.title) calEvent.setTitle(event.title);
    if (event.description) calEvent.setDescription(event.description);
    
    if (event.status === "done") {
      calEvent.setTitle("✅ " + calEvent.getTitle());
      calEvent.setColor(CalendarApp.EventColor.GREEN);
    }
    
    return { success: true, message: "Event updated" };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function deleteCalendarEvent(taskId) {
  if (!taskId) {
    return { success: false, error: "No task ID provided" };
  }
  
  const cal = getOrCreateCalendar();
  
  // Search for events with this task ID in description
  const now = new Date();
  const future = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  const past = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  const events = cal.getEvents(past, future);
  
  let deleted = 0;
  for (const event of events) {
    const desc = event.getDescription() || "";
    if (desc.includes("Task #" + taskId + "\n") || desc.includes("Task #" + taskId + " ")) {
      event.deleteEvent();
      deleted++;
    }
  }
  
  return { success: true, message: "Deleted " + deleted + " event(s) for task #" + taskId };
}

function syncCalendar(tasks) {
  if (!tasks || !Array.isArray(tasks)) {
    return { success: false, error: "No tasks array provided" };
  }
  
  const cal = getOrCreateCalendar();
  
  // Get all existing events
  const now = new Date();
  const future = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  const past = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const existingEvents = cal.getEvents(past, future);
  
  // Build map of existing events by task ID
  const existingMap = {};
  for (const event of existingEvents) {
    const desc = event.getDescription() || "";
    const match = desc.match(/Task #(\d+)/);
    if (match) {
      existingMap[match[1]] = event;
    }
  }
  
  let created = 0, updated = 0, completed = 0;
  
  for (const task of tasks) {
    if (!task.due_date) continue;
    
    const taskIdStr = String(task.id);
    const existing = existingMap[taskIdStr];
    
    if (task.status === "done") {
      if (existing) {
        existing.setTitle("✅ " + task.title);
        existing.setColor(CalendarApp.EventColor.GREEN);
        existing.setDescription(buildEventDescription(task));
        completed++;
      }
      continue;
    }
    
    if (existing) {
      // Update existing event
      existing.setTitle(task.title);
      existing.setDescription(buildEventDescription(task));
      
      if (task.priority === "high" || task.priority === "urgent") {
        existing.setColor(CalendarApp.EventColor.RED);
      } else if (task.priority === "medium") {
        existing.setColor(CalendarApp.EventColor.YELLOW);
      }
      
      updated++;
    } else {
      // Create new event
      try {
        const dueDate = new Date(task.due_date + "T09:00:00");
        const calEvent = cal.createAllDayEvent(task.title, dueDate, {
          description: buildEventDescription(task),
        });
        
        if (task.priority === "high" || task.priority === "urgent") {
          calEvent.setColor(CalendarApp.EventColor.RED);
        } else if (task.priority === "medium") {
          calEvent.setColor(CalendarApp.EventColor.YELLOW);
        } else {
          calEvent.setColor(CalendarApp.EventColor.CYAN);
        }
        
        created++;
      } catch (e) {
        Logger.log("Error creating event for task #" + task.id + ": " + e.message);
      }
    }
    
    // Remove from map so we know it's been processed
    delete existingMap[taskIdStr];
  }
  
  return {
    success: true,
    created: created,
    updated: updated,
    completed: completed,
    message: `Calendar sync: ${created} created, ${updated} updated, ${completed} completed`,
  };
}

function buildEventDescription(task) {
  let desc = `Task #${task.id || "?"}\n`;
  desc += `Status: ${task.status || "pending"}\n`;
  desc += `Priority: ${task.priority || "normal"}\n`;
  if (task.topic_name) desc += `Topic: ${task.topic_name}\n`;
  if (task.assigned_to) desc += `Assigned to: ${task.assigned_to}\n`;
  if (task.property_tag) desc += `Property: ${task.property_tag}\n`;
  if (task.created_by) desc += `Created by: ${task.created_by}\n`;
  desc += `\n— Monthly Key Operations Bot`;
  return desc;
}
