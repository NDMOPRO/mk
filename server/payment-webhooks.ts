/**
 * Payment Webhook Handlers
 * 
 * Handles PSP webhooks (Moyasar, Tabby, Tamara).
 * These update the payment_ledger and booking_extensions when payments complete.
 * 
 * SECURITY: All webhooks require HMAC signature verification.
 * If the webhook secret is not configured, the webhook rejects with 503.
 */
import crypto from "crypto";
import { getPool } from "./db";
import { updateLedgerStatusSafe } from "./finance-registry";
import { activateExtension } from "./renewal";
import type { RowDataPacket } from "mysql2";
import type { Request, Response } from "express";

// ─── Shared HMAC Verification ──────────────────────────────────────
function verifyHmacSha256(
  rawBody: string | Buffer,
  signature: string | undefined,
  secret: string
): boolean {
  if (!signature || !secret) return false;
  try {
    // Strip "sha256=" prefix if present (Meta/Moyasar style)
    const sig = signature.startsWith("sha256=") ? signature.slice(7) : signature;
    const expected = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");
    return crypto.timingSafeEqual(
      Buffer.from(sig),
      Buffer.from(expected)
    );
  } catch {
    return false;
  }
}

// Helper: activate renewal extension if payment was for a renewal
async function tryActivateRenewalExtension(pool: import("mysql2/promise").Pool, ledgerEntryId: number) {
  const [extRows] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM booking_extensions WHERE ledgerEntryId = ? AND status = 'PAYMENT_PENDING'",
    [ledgerEntryId]
  );
  if (extRows[0]) {
    await activateExtension(extRows[0].id);
  }
}

// Moyasar webhooks are handled by handleMoyasarWebhookVerified in ./moyasar.

// ─── Tabby Webhook ──────────────────────────────────────────────────
export async function handleTabbyWebhook(req: Request, res: Response) {
  try {
    // Verify HMAC signature — MANDATORY
    const webhookSecret = process.env.TABBY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("[Tabby Webhook] TABBY_WEBHOOK_SECRET not configured — rejecting request");
      return res.status(503).json({ error: "Webhook not configured" });
    }
    const signature = req.headers["x-tabby-signature"] as string | undefined;
    const rawBody = JSON.stringify(req.body);
    if (!verifyHmacSha256(rawBody, signature, webhookSecret)) {
      console.warn("[Tabby Webhook] Invalid signature — rejecting");
      return res.status(401).json({ error: "Invalid signature" });
    }

    const { id, status, payment } = req.body;
    if (!id || !status) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const pool = getPool();
    if (!pool) return res.status(500).json({ error: "Database not available" });

    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM payment_ledger WHERE providerRef = ? AND provider = 'tabby'", [id]
    );

    if (!rows[0]) {
      console.log(`[Tabby Webhook] No ledger entry found for ref: ${id}`);
      return res.status(200).json({ received: true, matched: false });
    }

    const ledgerEntry = rows[0];
    let newStatus: string;

    switch (status) {
      case "AUTHORIZED":
      case "CLOSED":
        newStatus = "PAID";
        break;
      case "REJECTED":
      case "EXPIRED":
        newStatus = "FAILED";
        break;
      case "REFUNDED":
        newStatus = "REFUNDED";
        break;
      default:
        newStatus = "PENDING";
    }

    await updateLedgerStatusSafe(ledgerEntry.id, newStatus, {
      paymentMethod: "TABBY",
      provider: "tabby",
      providerRef: id,
      paidAt: newStatus === "PAID" ? new Date() : undefined,
      webhookVerified: true,
    });

    if (newStatus === "PAID") {
      await tryActivateRenewalExtension(pool, ledgerEntry.id);
    }

    console.log(`[Tabby Webhook] Updated ledger #${ledgerEntry.id} to ${newStatus}`);
    return res.status(200).json({ received: true, matched: true, newStatus });
  } catch (err: any) {
    console.error("[Tabby Webhook] Error:", err.message);
    return res.status(500).json({ error: "Internal error" });
  }
}

// ─── Tamara Webhook ─────────────────────────────────────────────────
export async function handleTamaraWebhook(req: Request, res: Response) {
  try {
    // Verify HMAC signature — MANDATORY
    const webhookSecret = process.env.TAMARA_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("[Tamara Webhook] TAMARA_WEBHOOK_SECRET not configured — rejecting request");
      return res.status(503).json({ error: "Webhook not configured" });
    }
    const signature = req.headers["x-tamara-signature"] as string | undefined;
    const rawBody = JSON.stringify(req.body);
    if (!verifyHmacSha256(rawBody, signature, webhookSecret)) {
      console.warn("[Tamara Webhook] Invalid signature — rejecting");
      return res.status(401).json({ error: "Invalid signature" });
    }

    const { order_id, event_type, data } = req.body;
    if (!order_id || !event_type) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const pool = getPool();
    if (!pool) return res.status(500).json({ error: "Database not available" });

    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM payment_ledger WHERE providerRef = ? AND provider = 'tamara'", [order_id]
    );

    if (!rows[0]) {
      console.log(`[Tamara Webhook] No ledger entry found for ref: ${order_id}`);
      return res.status(200).json({ received: true, matched: false });
    }

    const ledgerEntry = rows[0];
    let newStatus: string;

    switch (event_type) {
      case "order_approved":
      case "order_captured":
        newStatus = "PAID";
        break;
      case "order_declined":
      case "order_expired":
        newStatus = "FAILED";
        break;
      case "order_refunded":
        newStatus = "REFUNDED";
        break;
      default:
        newStatus = "PENDING";
    }

    await updateLedgerStatusSafe(ledgerEntry.id, newStatus, {
      paymentMethod: "TAMARA",
      provider: "tamara",
      providerRef: order_id,
      paidAt: newStatus === "PAID" ? new Date() : undefined,
      webhookVerified: true,
    });

    if (newStatus === "PAID") {
      await tryActivateRenewalExtension(pool, ledgerEntry.id);
    }

    console.log(`[Tamara Webhook] Updated ledger #${ledgerEntry.id} to ${newStatus}`);
    return res.status(200).json({ received: true, matched: true, newStatus });
  } catch (err: any) {
    console.error("[Tamara Webhook] Error:", err.message);
    return res.status(500).json({ error: "Internal error" });
  }
}
