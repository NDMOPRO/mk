import { router } from "../_core/trpc";
import { systemRouter } from "../_core/systemRouter";
import { financeRouter } from "../finance-routers";
import { submissionRouter } from "../submission-routers";
import { integrationRouter } from "../integration-routers";
import { adminRouterDefs } from "./admin.router";
import { aiRouterDefs } from "./ai.router";
import { authRouterDefs } from "./auth.router";
import { bookingRouterDefs } from "./booking.router";
import { cmsRouterDefs } from "./cms.router";
import { geoRouterDefs } from "./geo.router";
import { maintenanceRouterDefs } from "./maintenance.router";
import { miscRouterDefs } from "./misc.router";
import { notificationRouterDefs } from "./notification.router";
import { paymentRouterDefs } from "./payment.router";
import { propertyRouterDefs } from "./property.router";
import { userRouterDefs } from "./user.router";

export const appRouter = router({
  system: systemRouter,
  ...adminRouterDefs,
  ...aiRouterDefs,
  ...authRouterDefs,
  ...bookingRouterDefs,
  ...cmsRouterDefs,
  ...geoRouterDefs,
  ...maintenanceRouterDefs,
  ...miscRouterDefs,
  ...notificationRouterDefs,
  ...paymentRouterDefs,
  ...propertyRouterDefs,
  ...userRouterDefs,
  submission: submissionRouter,
  finance: financeRouter,
  integration: integrationRouter,
});

export type AppRouter = typeof appRouter;
