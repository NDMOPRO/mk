/**
 * Main entry point — NO Manus dependencies
 * Uses Supabase Auth (via AuthContext) and direct API calls (via lib/api.ts)
 */
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
