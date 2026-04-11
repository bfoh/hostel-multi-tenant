/* ── Injected CSS (single string, applied via <style>) ───────────────── */

export const CSS = `
.abw-root *, .abw-root *::before, .abw-root *::after { box-sizing: border-box; }
.abw-root {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 14px;
  color: #1a202c;
  line-height: 1.5;
}
/* Floating button */
.abw-fab {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 99999;
  background: #1B4F72;
  color: #fff;
  border: none;
  border-radius: 50px;
  padding: 12px 22px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(27,79,114,0.35);
  transition: transform 0.15s, box-shadow 0.15s;
}
.abw-fab:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(27,79,114,0.45); }

/* Overlay */
.abw-overlay {
  position: fixed; inset: 0; z-index: 99998;
  background: rgba(0,0,0,0.45);
  display: flex; align-items: center; justify-content: center;
  padding: 16px;
}
/* Panel */
.abw-panel {
  background: #fff;
  border-radius: 16px;
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0,0,0,0.2);
}
.abw-panel-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 20px 24px 16px;
  border-bottom: 1px solid #e2e8f0;
}
.abw-panel-title { font-size: 16px; font-weight: 700; color: #1B4F72; }
.abw-close-btn {
  background: none; border: none; cursor: pointer;
  color: #718096; font-size: 20px; line-height: 1; padding: 2px;
}
.abw-close-btn:hover { color: #1a202c; }
.abw-body { padding: 20px 24px 24px; }

/* Steps */
.abw-steps {
  display: flex; gap: 8px; margin-bottom: 20px;
}
.abw-step {
  flex: 1; height: 4px; border-radius: 2px; background: #e2e8f0;
  transition: background 0.2s;
}
.abw-step.active { background: #1B4F72; }

/* Room cards */
.abw-rooms { display: flex; flex-direction: column; gap: 10px; }
.abw-room-card {
  border: 2px solid #e2e8f0; border-radius: 10px; padding: 14px;
  cursor: pointer; transition: border-color 0.15s, background 0.15s;
}
.abw-room-card:hover { border-color: #1B4F72; background: #f0f7ff; }
.abw-room-card.selected { border-color: #1B4F72; background: #e8f0f8; }
.abw-room-name { font-weight: 600; color: #1a202c; }
.abw-room-meta { font-size: 12px; color: #718096; margin-top: 2px; }
.abw-room-price { font-weight: 700; color: #1B4F72; margin-top: 6px; font-size: 15px; }
.abw-room-avail { font-size: 11px; color: #38a169; margin-top: 2px; }

/* Form */
.abw-field { margin-bottom: 14px; }
.abw-label { display: block; font-size: 12px; font-weight: 500; color: #4a5568; margin-bottom: 4px; }
.abw-input {
  width: 100%; padding: 9px 12px;
  border: 1.5px solid #e2e8f0; border-radius: 8px;
  font-size: 14px; color: #1a202c; outline: none;
  transition: border-color 0.15s;
}
.abw-input:focus { border-color: #1B4F72; }
.abw-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

/* Button */
.abw-btn {
  display: block; width: 100%;
  background: #1B4F72; color: #fff;
  border: none; border-radius: 8px;
  padding: 11px; font-size: 15px; font-weight: 600;
  cursor: pointer; margin-top: 16px;
  transition: background 0.15s;
}
.abw-btn:hover { background: #154060; }
.abw-btn:disabled { background: #a0aec0; cursor: not-allowed; }
.abw-btn-secondary {
  background: none; color: #1B4F72; border: 1.5px solid #1B4F72;
}
.abw-btn-secondary:hover { background: #f0f7ff; }

/* Error / success */
.abw-error { color: #c53030; font-size: 12px; margin-top: 8px; }
.abw-success {
  text-align: center; padding: 24px;
}
.abw-success-icon { font-size: 48px; margin-bottom: 8px; }
.abw-success-title { font-size: 18px; font-weight: 700; color: #1B4F72; }
.abw-success-ref { font-size: 13px; color: #718096; margin-top: 4px; }

/* Spinner */
.abw-spinner {
  width: 20px; height: 20px;
  border: 2.5px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  display: inline-block;
  animation: abw-spin 0.7s linear infinite;
}
@keyframes abw-spin { to { transform: rotate(360deg); } }

/* Inline mode — no fixed positioning */
.abw-inline .abw-panel {
  max-height: none; box-shadow: 0 2px 12px rgba(0,0,0,0.1);
}
`
