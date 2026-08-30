import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { warmUpApi } from "@/lib/warmup";

// Before React even mounts. The auth screens already did this, but someone returning to
// /dashboard with a session goes nowhere near them and used to sit through the whole cold
// start on /auth/me - so the nudge belongs at the entrance, not on two of the pages.
warmUpApi();

createRoot(document.getElementById("root")!).render(<App />);
