import { router } from "../_core/trpc";
import { systemRouter } from "../_core/systemRouter";
import { financeRouter } from "../finance-routers";
import { submissionRouter } from "../submission-routers";
import { integrationRouter } from "../integration-routers";
import { base44Router } from "../base44-routers";
import { adminRouterDefs } from "./admin.router";
import { aiRouterDefs } from "./ai.router";
import { authRouterDefs } from "./auth.router";
import { bookingRouterDefs } from "./booking.router";
import { cmsRouterDefs } from "./cms.router";
import { geoRouterDefs } from "./geo.router";
import { leaseRouterDefs } from "./lease.router";
import { maintenanceRouterDefs } from "./maintenance.router";
import { managerRouterDefs } from "./manager.router";
import { notificationRouterDefs } from "./notification.router";
import { paymentRouterDefs } from "./payment.router";
import { propertyRouterDefs } from "./property.router";
import { rolesRouterDefs } from "./roles.router";
import { userRouterDefs } from "./user.router";

export const appRouter = router({
  system: systemRouter,
  ...adminRouterDefs,
  ...aiRouterDefs,
  ...authRouterDefs,
  ...bookingRouterDefs,
  ...cmsRouterDefs,
  ...geoRouterDefs,
  ...leaseRouterDefs,
  ...maintenanceRouterDefs,
  ...managerRouterDefs,
  ...notificationRouterDefs,
  ...paymentRouterDefs,
  ...propertyRouterDefs,
  ...rolesRouterDefs,
  ...userRouterDefs,
  submission: submissionRouter,
  finance: financeRouter,
  integration: integrationRouter,
  base44: base44Router,
});

export type AppRouter = typeof appRouter;
