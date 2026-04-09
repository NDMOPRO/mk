/**
 * Admin Dashboard Handler for Monthly Key Telegram Bot
 * Phase 3: Admin commands for bot owner/team
 *
 * Commands: /admin, /stats, /broadcast, /manage_bookings, /manage_listings
 * Only authorized Telegram user IDs (from ADMIN_IDS env) can use these.
 */
const { Markup } = require("telegraf");
const config = require("../config");
const { t } = require("../i18n");
const db = require("../services/database");
const api = require("../services/api");

// ─── Admin Authentication ──────────────────────────────────

/**
 * In-memory set of authenticated admin chat IDs for this session.
 * Cleared on bot restart — intentional for security.
 */
const authenticatedAdmins = new Set();

/**
 * Returns true if the user is authenticated as admin.
 * Accepts either:
 *  1. Telegram user ID in ADMIN_IDS env var (legacy)
 *  2. Username/password login via /admin command (new)
 */
function isAdmin(ctx) {
  const userId = ctx.from?.id;
  const chatId = ctx.chat?.id;
  if (!userId) return false;
  // Legacy: Telegram user ID whitelist
  if (config.adminIds.length > 0 && config.adminIds.includes(userId)) return true;
  // New: username/password session
  if (authenticatedAdmins.has(chatId)) return true;
  return false;
}

function requireAdmin(ctx) {
  if (!isAdmin(ctx)) {
    const lang = db.getUserLanguage(ctx.chat.id) || "en";
    ctx.reply(
      lang === "ar"
        ? "⛔ غير مصرح. هذا الأمر للمسؤولين فقط."
        : "⛔ Unauthorized. This command is for admins only."
    );
    return false;
  }
  return true;
}

/**
 * Handle /admin command — starts username/password login flow if credentials
 * are configured, otherwise falls through to the dashboard (legacy ID-based).
 */
async function handleAdminLogin(ctx) {
  const chatId = ctx.chat.id;

  // Already authenticated — go straight to dashboard
  if (isAdmin(ctx)) {
    return handleAdmin(ctx);
  }

  // No credentials configured and no ID match — deny
  if (!config.adminUsername || !config.adminPassword) {
    return ctx.reply("⛔ Admin access is not configured.");
  }

  // Start login flow
  ctx.session = ctx.session || {};
  ctx.session.adminLogin = { step: "username" };

  await ctx.reply(
    "🔐 *Admin Login*\n\nPlease enter your admin username:",
    { parse_mode: "Markdown" }
  );
}

/**
 * Handle text input during admin login flow.
 * Called from index.js text handler when ctx.session.adminLogin is set.
 * Returns true if the input was consumed by the login flow.
 */
async function handleAdminLoginInput(ctx) {
  const session = ctx.session?.adminLogin;
  if (!session) return false;

  const chatId = ctx.chat.id;
  const text = ctx.message.text.trim();

  if (session.step === "username") {
    ctx.session.adminLogin = { step: "password", username: text };
    await ctx.reply("🔑 Please enter your admin password:");
    return true;
  }

  if (session.step === "password") {
    const usernameOk = session.username === config.adminUsername;
    const passwordOk = text === config.adminPassword;

    // Clear login session regardless of outcome
    delete ctx.session.adminLogin;

    if (usernameOk && passwordOk) {
      authenticatedAdmins.add(chatId);
      console.log(`[Admin] Login successful for chat ${chatId}`);
      await ctx.reply("✅ *Login successful!* Welcome to the admin panel.", { parse_mode: "Markdown" });
      // Show dashboard
      return handleAdmin(ctx).then(() => true).catch(() => true);
    } else {
      console.warn(`[Admin] Failed login attempt for chat ${chatId}`);
      await ctx.reply("❌ *Incorrect credentials.* Access denied.", { parse_mode: "Markdown" });
      return true;
    }
  }

  return false;
}

// ─── /admin — Main Admin Dashboard ─────────────────────────

async function handleAdmin(ctx) {
  if (!requireAdmin(ctx)) return;

  const buttons = Markup.inlineKeyboard([
    [
      Markup.button.callback("📊 Statistics", "admin_stats"),
      Markup.button.callback("📋 Bookings", "admin_bookings"),
    ],
    [
      Markup.button.callback("🏠 Listings", "admin_listings"),
      Markup.button.callback("📢 Broadcast", "admin_broadcast"),
    ],
    [
      Markup.button.callback("🔔 Alerts Overview", "admin_alerts"),
      Markup.button.callback("👥 Users", "admin_users"),
    ],
  ]);

  await ctx.reply(
    `🔐 *Admin Dashboard*\n\nWelcome, ${ctx.from.first_name}.\nSelect an option:`,
    { parse_mode: "Markdown", ...buttons }
  );
}

// ─── /stats — Analytics Overview ────────────────────────────

async function handleStats(ctx) {
  if (!requireAdmin(ctx)) return;
  await sendStatsMessage(ctx);
}

async function sendStatsMessage(ctx) {
  const d = db.getDb();

  // User stats
  const totalUsers = d.prepare("SELECT COUNT(*) as c FROM users").get().c;
  const activeUsers = d.prepare("SELECT COUNT(*) as c FROM users WHERE is_active = 1").get().c;
  const blockedUsers = totalUsers - activeUsers;

  // Language breakdown
  const langBreakdown = d
    .prepare("SELECT language, COUNT(*) as c FROM users WHERE is_active = 1 GROUP BY language ORDER BY c DESC")
    .all();
  const langLines = langBreakdown.map((r) => `  ${r.language}: ${r.c}`).join("\n");

  // Booking stats
  const totalBookings = d.prepare("SELECT COUNT(*) as c FROM bookings").get().c;
  const pendingBookings = d.prepare("SELECT COUNT(*) as c FROM bookings WHERE status = 'pending'").get().c;
  const confirmedBookings = d.prepare("SELECT COUNT(*) as c FROM bookings WHERE status = 'confirmed'").get().c;
  const cancelledBookings = d.prepare("SELECT COUNT(*) as c FROM bookings WHERE status = 'cancelled'").get().c;

  // Revenue stats
  const totalRevenue = d.prepare("SELECT COALESCE(SUM(grand_total), 0) as s FROM bookings WHERE payment_status = 'paid'").get().s;
  const pendingRevenue = d.prepare("SELECT COALESCE(SUM(grand_total), 0) as s FROM bookings WHERE payment_status = 'unpaid' AND status != 'cancelled'").get().s;

  // Alert stats
  const activeAlerts = d.prepare("SELECT COUNT(*) as c FROM alert_subscriptions WHERE is_active = 1").get().c;

  // Notification stats
  const totalNotifications = d.prepare("SELECT COUNT(*) as c FROM notification_log").get().c;
  const sentNotifications = d.prepare("SELECT COUNT(*) as c FROM notification_log WHERE status = 'sent'").get().c;

  // Recent activity (last 24h)
  const newUsersToday = d.prepare("SELECT COUNT(*) as c FROM users WHERE created_at >= datetime('now', '-1 day')").get().c;
  const newBookingsToday = d.prepare("SELECT COUNT(*) as c FROM bookings WHERE created_at >= datetime('now', '-1 day')").get().c;

  const text = [
    `📊 *Monthly Key Bot — Statistics*`,
    ``,
    `👥 *Users*`,
    `  Total: ${totalUsers}`,
    `  Active: ${activeUsers}`,
    `  Blocked/Inactive: ${blockedUsers}`,
    `  New (24h): ${newUsersToday}`,
    ``,
    `🌐 *Languages*`,
    langLines || "  No data",
    ``,
    `📋 *Bookings*`,
    `  Total: ${totalBookings}`,
    `  Pending: ${pendingBookings}`,
    `  Confirmed: ${confirmedBookings}`,
    `  Cancelled: ${cancelledBookings}`,
    `  New (24h): ${newBookingsToday}`,
    ``,
    `💰 *Revenue*`,
    `  Collected: ${Number(totalRevenue).toLocaleString()} SAR`,
    `  Pending: ${Number(pendingRevenue).toLocaleString()} SAR`,
    ``,
    `🔔 *Alerts*`,
    `  Active subscriptions: ${activeAlerts}`,
    ``,
    `📨 *Notifications*`,
    `  Total sent: ${sentNotifications} / ${totalNotifications}`,
  ].join("\n");

  const buttons = Markup.inlineKeyboard([
    [Markup.button.callback("🔄 Refresh", "admin_stats")],
    [Markup.button.callback("◀️ Back to Dashboard", "admin_dashboard")],
  ]);

  // Try to edit existing message, otherwise send new
  try {
    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, { parse_mode: "Markdown", ...buttons });
    } else {
      await ctx.reply(text, { parse_mode: "Markdown", ...buttons });
    }
  } catch (e) {
    await ctx.reply(text, { parse_mode: "Markdown", ...buttons });
  }
}

// ─── /broadcast — Send message to all users ─────────────────

async function handleBroadcast(ctx) {
  if (!requireAdmin(ctx)) return;

  const text = ctx.message.text.replace(/^\/broadcast\s*/, "").trim();

  if (!text) {
    await ctx.reply(
      `📢 *Broadcast Message*\n\nUsage: \`/broadcast Your message here\`\n\nThe message will be sent to all active users.\n\nSupports Markdown formatting.`,
      { parse_mode: "Markdown" }
    );
    return;
  }

  // Confirm before sending
  ctx.session = ctx.session || {};
  ctx.session.broadcastMessage = text;

  const activeCount = db.getDb().prepare("SELECT COUNT(*) as c FROM users WHERE is_active = 1").get().c;

  const buttons = Markup.inlineKeyboard([
    [Markup.button.callback(`✅ Send to ${activeCount} users`, "admin_broadcast_confirm")],
    [Markup.button.callback("❌ Cancel", "admin_broadcast_cancel")],
  ]);

  await ctx.reply(
    `📢 *Broadcast Preview*\n\n${text}\n\n---\nThis will be sent to *${activeCount}* active users.`,
    { parse_mode: "Markdown", ...buttons }
  );
}

// ─── /manage_bookings — View and manage bookings ────────────

async function handleManageBookings(ctx) {
  if (!requireAdmin(ctx)) return;
  await sendBookingsManagement(ctx, "pending", 0);
}

async function sendBookingsManagement(ctx, statusFilter, offset) {
  const d = db.getDb();
  const limit = 5;

  let query = "SELECT b.*, u.username, u.first_name FROM bookings b LEFT JOIN users u ON b.chat_id = u.chat_id";
  const params = [];

  if (statusFilter && statusFilter !== "all") {
    query += " WHERE b.status = ?";
    params.push(statusFilter);
  }

  query += " ORDER BY b.created_at DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  const bookings = d.prepare(query).all(...params);

  // Count totals
  let countQuery = "SELECT COUNT(*) as c FROM bookings";
  const countParams = [];
  if (statusFilter && statusFilter !== "all") {
    countQuery += " WHERE status = ?";
    countParams.push(statusFilter);
  }
  const total = d.prepare(countQuery).get(...countParams).c;

  if (bookings.length === 0) {
    const buttons = Markup.inlineKeyboard([
      [
        Markup.button.callback("📋 All", "admin_bk_filter_all"),
        Markup.button.callback("⏳ Pending", "admin_bk_filter_pending"),
        Markup.button.callback("✅ Confirmed", "admin_bk_filter_confirmed"),
      ],
      [Markup.button.callback("◀️ Back", "admin_dashboard")],
    ]);

    const msg = `📋 *Manage Bookings*\n\nNo ${statusFilter !== "all" ? statusFilter : ""} bookings found.`;
    try {
      if (ctx.callbackQuery) {
        await ctx.editMessageText(msg, { parse_mode: "Markdown", ...buttons });
      } else {
        await ctx.reply(msg, { parse_mode: "Markdown", ...buttons });
      }
    } catch (e) {
      await ctx.reply(msg, { parse_mode: "Markdown", ...buttons });
    }
    return;
  }

  let text = `📋 *Manage Bookings* (${statusFilter || "all"})\n`;
  text += `Showing ${offset + 1}-${Math.min(offset + limit, total)} of ${total}\n\n`;

  for (const b of bookings) {
    const statusIcon = { pending: "⏳", confirmed: "✅", cancelled: "❌", active: "🟢", completed: "✔️" }[b.status] || "❓";
    const payIcon = b.payment_status === "paid" ? "💚" : "🟡";
    const user = b.username ? `@${b.username}` : b.first_name || `ID:${b.chat_id}`;

    text += `${statusIcon} *#${b.id}* — ${b.property_title || "Property " + b.property_id}\n`;
    text += `  👤 ${user} | 📍 ${b.property_city || "N/A"}\n`;
    text += `  📅 ${b.check_in_date} → ${b.check_out_date}\n`;
    text += `  💰 ${Number(b.grand_total || 0).toLocaleString()} SAR ${payIcon}\n\n`;
  }

  const buttonRows = [
    [
      Markup.button.callback("📋 All", "admin_bk_filter_all"),
      Markup.button.callback("⏳ Pending", "admin_bk_filter_pending"),
      Markup.button.callback("✅ Confirmed", "admin_bk_filter_confirmed"),
    ],
  ];

  // Pagination
  const navButtons = [];
  if (offset > 0) {
    navButtons.push(Markup.button.callback("⬅️ Prev", `admin_bk_page_${statusFilter}_${offset - limit}`));
  }
  if (offset + limit < total) {
    navButtons.push(Markup.button.callback("➡️ Next", `admin_bk_page_${statusFilter}_${offset + limit}`));
  }
  if (navButtons.length > 0) buttonRows.push(navButtons);

  // Action buttons for pending bookings
  if (statusFilter === "pending" && bookings.length > 0) {
    for (const b of bookings.slice(0, 3)) {
      buttonRows.push([
        Markup.button.callback(`✅ Approve #${b.id}`, `admin_bk_approve_${b.id}`),
        Markup.button.callback(`❌ Reject #${b.id}`, `admin_bk_reject_${b.id}`),
      ]);
    }
  }

  buttonRows.push([Markup.button.callback("◀️ Back", "admin_dashboard")]);

  const buttons = Markup.inlineKeyboard(buttonRows);

  try {
    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, { parse_mode: "Markdown", ...buttons });
    } else {
      await ctx.reply(text, { parse_mode: "Markdown", ...buttons });
    }
  } catch (e) {
    await ctx.reply(text, { parse_mode: "Markdown", ...buttons });
  }
}

// ─── /manage_listings — View listings from API ──────────────

async function handleManageListings(ctx) {
  if (!requireAdmin(ctx)) return;
  await sendListingsManagement(ctx, 0);
}

async function sendListingsManagement(ctx, offset) {
  const loadingMsg = ctx.callbackQuery ? null : await ctx.reply("🔄 Loading listings...");

  try {
    const result = await api.searchProperties({ limit: 5, offset });
    const properties = result?.items || result || [];
    const total = result?.total || properties.length;

    if (loadingMsg) {
      try { await ctx.deleteMessage(loadingMsg.message_id); } catch (e) {}
    }

    if (!properties || properties.length === 0) {
      const buttons = Markup.inlineKeyboard([
        [Markup.button.callback("🔄 Refresh", "admin_listings_0")],
        [Markup.button.callback("◀️ Back", "admin_dashboard")],
      ]);
      const msg = "🏠 *Manage Listings*\n\nNo listings found.";
      try {
        if (ctx.callbackQuery) {
          await ctx.editMessageText(msg, { parse_mode: "Markdown", ...buttons });
        } else {
          await ctx.reply(msg, { parse_mode: "Markdown", ...buttons });
        }
      } catch (e) {
        await ctx.reply(msg, { parse_mode: "Markdown", ...buttons });
      }
      return;
    }

    let text = `🏠 *Manage Listings*\n`;
    text += `Showing ${offset + 1}-${Math.min(offset + 5, total)} of ${total}\n\n`;

    for (const p of properties) {
      const title = p.titleEn || p.titleAr || "Untitled";
      const rent = Number(p.monthlyRent || 0).toLocaleString();
      const city = p.city || "N/A";
      const type = config.propertyTypes[p.propertyType]?.en || p.propertyType || "N/A";

      text += `🏠 *${title}* (ID: ${p.id})\n`;
      text += `  📍 ${city}${p.district ? ` — ${p.district}` : ""}\n`;
      text += `  🏷️ ${type} | 💰 ${rent} SAR/mo\n`;
      text += `  🛏️ ${p.bedrooms || "?"} BR | 🚿 ${p.bathrooms || "?"} BA\n\n`;
    }

    const buttonRows = [];

    // Pagination
    const navButtons = [];
    if (offset > 0) {
      navButtons.push(Markup.button.callback("⬅️ Prev", `admin_listings_${offset - 5}`));
    }
    if (offset + 5 < total) {
      navButtons.push(Markup.button.callback("➡️ Next", `admin_listings_${offset + 5}`));
    }
    if (navButtons.length > 0) buttonRows.push(navButtons);

    buttonRows.push([
      Markup.button.callback("🔄 Refresh", `admin_listings_${offset}`),
      Markup.button.callback("◀️ Back", "admin_dashboard"),
    ]);

    const buttons = Markup.inlineKeyboard(buttonRows);

    try {
      if (ctx.callbackQuery) {
        await ctx.editMessageText(text, { parse_mode: "Markdown", ...buttons });
      } else {
        await ctx.reply(text, { parse_mode: "Markdown", ...buttons });
      }
    } catch (e) {
      await ctx.reply(text, { parse_mode: "Markdown", ...buttons });
    }
  } catch (error) {
    console.error("[Admin Listings] Error:", error.message);
    if (loadingMsg) {
      try { await ctx.deleteMessage(loadingMsg.message_id); } catch (e) {}
    }
    await ctx.reply("❌ Error loading listings. Please try again.");
  }
}

// ─── Register Admin Callback Handlers ───────────────────────

function registerAdminCallbacks(bot) {
  // Dashboard
  bot.action("admin_dashboard", async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx)) return;

    const buttons = Markup.inlineKeyboard([
      [
        Markup.button.callback("📊 Statistics", "admin_stats"),
        Markup.button.callback("📋 Bookings", "admin_bookings"),
      ],
      [
        Markup.button.callback("🏠 Listings", "admin_listings_0"),
        Markup.button.callback("📢 Broadcast", "admin_broadcast_start"),
      ],
      [
        Markup.button.callback("🔔 Alerts Overview", "admin_alerts"),
        Markup.button.callback("👥 Users", "admin_users"),
      ],
    ]);

    try {
      await ctx.editMessageText(
        `🔐 *Admin Dashboard*\n\nWelcome, ${ctx.from.first_name}.\nSelect an option:`,
        { parse_mode: "Markdown", ...buttons }
      );
    } catch (e) {
      await ctx.reply(
        `🔐 *Admin Dashboard*\n\nWelcome, ${ctx.from.first_name}.\nSelect an option:`,
        { parse_mode: "Markdown", ...buttons }
      );
    }
  });

  // Stats
  bot.action("admin_stats", async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx)) return;
    await sendStatsMessage(ctx);
  });

  // Users overview
  bot.action("admin_users", async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx)) return;

    const d = db.getDb();
    const recentUsers = d
      .prepare("SELECT * FROM users ORDER BY created_at DESC LIMIT 10")
      .all();

    let text = `👥 *Users Overview*\n\nLast 10 registered users:\n\n`;
    for (const u of recentUsers) {
      const status = u.is_active ? "🟢" : "🔴";
      const name = u.username ? `@${u.username}` : u.first_name || `ID:${u.chat_id}`;
      text += `${status} ${name} — ${u.language} — ${u.created_at}\n`;
    }

    const buttons = Markup.inlineKeyboard([
      [Markup.button.callback("🔄 Refresh", "admin_users")],
      [Markup.button.callback("◀️ Back", "admin_dashboard")],
    ]);

    try {
      await ctx.editMessageText(text, { parse_mode: "Markdown", ...buttons });
    } catch (e) {
      await ctx.reply(text, { parse_mode: "Markdown", ...buttons });
    }
  });

  // Bookings management
  bot.action("admin_bookings", async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx)) return;
    await sendBookingsManagement(ctx, "pending", 0);
  });

  // Booking filter callbacks
  bot.action(/^admin_bk_filter_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx)) return;
    const filter = ctx.match[1];
    await sendBookingsManagement(ctx, filter, 0);
  });

  // Booking pagination
  bot.action(/^admin_bk_page_(.+)_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx)) return;
    const filter = ctx.match[1];
    const offset = parseInt(ctx.match[2], 10);
    await sendBookingsManagement(ctx, filter, offset);
  });

  // Approve booking
  bot.action(/^admin_bk_approve_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery("Booking approved");
    if (!isAdmin(ctx)) return;

    const bookingId = parseInt(ctx.match[1], 10);
    const booking = db.getBooking(bookingId);
    if (!booking) {
      await ctx.reply("❌ Booking not found.");
      return;
    }

    db.updateBookingStatus(bookingId, "confirmed");

    // Notify the user
    const userLang = db.getUserLanguage(booking.chat_id) || "en";
    try {
      await ctx.telegram.sendMessage(
        booking.chat_id,
        t(userLang, "bookingPaid").replace("Your booking is confirmed.", `Your booking #${bookingId} has been approved by admin.`),
        { parse_mode: "Markdown" }
      );
    } catch (e) {
      console.error("[Admin] Failed to notify user:", e.message);
    }

    await ctx.reply(`✅ Booking #${bookingId} approved. User notified.`);
    await sendBookingsManagement(ctx, "pending", 0);
  });

  // Reject booking
  bot.action(/^admin_bk_reject_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery("Booking rejected");
    if (!isAdmin(ctx)) return;

    const bookingId = parseInt(ctx.match[1], 10);
    const booking = db.getBooking(bookingId);
    if (!booking) {
      await ctx.reply("❌ Booking not found.");
      return;
    }

    db.cancelBooking(bookingId);

    // Notify the user
    const userLang = db.getUserLanguage(booking.chat_id) || "en";
    try {
      await ctx.telegram.sendMessage(
        booking.chat_id,
        userLang === "ar"
          ? `❌ *تم رفض الحجز*\n\nعذراً، تم رفض حجزك رقم #${bookingId}. يرجى التواصل معنا لمزيد من المعلومات.`
          : `❌ *Booking Rejected*\n\nSorry, your booking #${bookingId} has been rejected. Please contact us for more information.`,
        { parse_mode: "Markdown" }
      );
    } catch (e) {
      console.error("[Admin] Failed to notify user:", e.message);
    }

    await ctx.reply(`❌ Booking #${bookingId} rejected. User notified.`);
    await sendBookingsManagement(ctx, "pending", 0);
  });

  // Listings management
  bot.action(/^admin_listings_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx)) return;
    const offset = parseInt(ctx.match[1], 10);
    await sendListingsManagement(ctx, offset);
  });

  // Alerts overview
  bot.action("admin_alerts", async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx)) return;

    const d = db.getDb();
    const totalAlerts = d.prepare("SELECT COUNT(*) as c FROM alert_subscriptions WHERE is_active = 1").get().c;

    const cityBreakdown = d
      .prepare("SELECT COALESCE(city, 'All Cities') as city, COUNT(*) as c FROM alert_subscriptions WHERE is_active = 1 GROUP BY city ORDER BY c DESC")
      .all();

    let text = `🔔 *Alerts Overview*\n\nTotal active alerts: ${totalAlerts}\n\n*By City:*\n`;
    for (const r of cityBreakdown) {
      text += `  📍 ${r.city}: ${r.c}\n`;
    }

    const buttons = Markup.inlineKeyboard([
      [Markup.button.callback("🔄 Refresh", "admin_alerts")],
      [Markup.button.callback("◀️ Back", "admin_dashboard")],
    ]);

    try {
      await ctx.editMessageText(text, { parse_mode: "Markdown", ...buttons });
    } catch (e) {
      await ctx.reply(text, { parse_mode: "Markdown", ...buttons });
    }
  });

  // Broadcast start (from button)
  bot.action("admin_broadcast_start", async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx)) return;

    try {
      await ctx.editMessageText(
        `📢 *Broadcast Message*\n\nTo send a broadcast, use the command:\n\n\`/broadcast Your message here\`\n\nThe message will be sent to all active users.\nSupports Markdown formatting.`,
        { parse_mode: "Markdown" }
      );
    } catch (e) {
      await ctx.reply(
        `📢 *Broadcast Message*\n\nTo send a broadcast, use the command:\n\n\`/broadcast Your message here\`\n\nThe message will be sent to all active users.\nSupports Markdown formatting.`,
        { parse_mode: "Markdown" }
      );
    }
  });

  // Broadcast confirm
  bot.action("admin_broadcast_confirm", async (ctx) => {
    await ctx.answerCbQuery("Broadcasting...");
    if (!isAdmin(ctx)) return;

    const message = ctx.session?.broadcastMessage;
    if (!message) {
      await ctx.reply("❌ No broadcast message found. Use /broadcast again.");
      return;
    }

    await ctx.reply("📢 Broadcasting... Please wait.");

    const notifications = require("../services/notifications");
    const result = await notifications.broadcastNotification(ctx.telegram, message, {
      type: "admin_broadcast",
    });

    delete ctx.session.broadcastMessage;

    await ctx.reply(
      `📢 *Broadcast Complete*\n\n✅ Sent: ${result.sent}\n❌ Failed: ${result.failed}\n📊 Total: ${result.total}`,
      { parse_mode: "Markdown" }
    );
  });

  // Broadcast cancel
  bot.action("admin_broadcast_cancel", async (ctx) => {
    await ctx.answerCbQuery("Cancelled");
    if (!isAdmin(ctx)) return;

    if (ctx.session) delete ctx.session.broadcastMessage;

    try {
      await ctx.editMessageText("❌ Broadcast cancelled.");
    } catch (e) {
      await ctx.reply("❌ Broadcast cancelled.");
    }
  });
}

module.exports = {
  handleAdmin,
  handleAdminLogin,
  handleAdminLoginInput,
  handleStats,
  handleBroadcast,
  handleManageBookings,
  handleManageListings,
  registerAdminCallbacks,
  isAdmin,
};
