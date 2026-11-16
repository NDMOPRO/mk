import { router } from "./_shared";
import { adminSystemProcedures } from "./admin/system";
import { adminUserProcedures } from "./admin/users";
import { adminPropertyProcedures } from "./admin/properties";
import { adminBookingProcedures } from "./admin/bookings";
import { adminPaymentProcedures } from "./admin/payments";
import { waInboxRouter } from "./admin/wa-inbox";

// Domain: admin. Procedures live in ./admin/*, grouped by area; names and
// shapes are unchanged.
export const adminRouterDefs = {
  admin: router({
    ...adminSystemProcedures,
    ...adminUserProcedures,
    ...adminPropertyProcedures,
    ...adminBookingProcedures,
    ...adminPaymentProcedures,
  }),

  // ─── WhatsApp Inbox (Inbound Conversation Routing) ──────────────
  waInbox: waInboxRouter,
};
