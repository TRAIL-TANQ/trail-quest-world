import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

function renderFatal(message: string) {
  const root = document.getElementById("root");
  if (!root) return;
  root.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#0b1128;color:#f0f0f0;font-family:system-ui,sans-serif;">
      <div style="max-width:560px;text-align:center;">
        <h1 style="color:#ffd700;font-size:20px;margin-bottom:12px;">読み込みエラー</h1>
        <p style="font-size:14px;line-height:1.6;margin-bottom:16px;">${message}</p>
        <button onclick="location.reload()" style="background:#ffd700;color:#0b1128;border:none;padding:12px 24px;border-radius:8px;font-weight:bold;cursor:pointer;">再読み込み</button>
      </div>
    </div>`;
}

window.addEventListener("error", (ev) => {
  console.error("[global error]", ev.error ?? ev.message);
});
window.addEventListener("unhandledrejection", (ev) => {
  console.error("[unhandled rejection]", ev.reason);
});

try {
  const container = document.getElementById("root");
  if (!container) {
    throw new Error("#root element not found");
  }
  createRoot(container).render(<App />);
} catch (err) {
  console.error("[mount failure]", err);
  renderFatal(err instanceof Error ? err.message : String(err));
}
