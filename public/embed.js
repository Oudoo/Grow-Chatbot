/*
 * Grow-Chatbot embeddable widget loader.
 *
 * Usage (paste before </body>):
 *   <script src="https://YOUR_HOST/embed.js" data-bot="BOT_ID" async></script>
 *
 * Optional attributes:
 *   data-title    Launcher aria-label / tooltip (default "Chat")
 *   data-color    Accent color (default #0a9264)
 *   data-position "right" (default) or "left"
 */
(function () {
  var script = document.currentScript;
  if (!script) return;

  var botId = script.getAttribute("data-bot");
  if (!botId) {
    console.error("[grow-chatbot] embed.js: missing data-bot attribute");
    return;
  }

  var origin = new URL(script.src, window.location.href).origin;
  var color = script.getAttribute("data-color") || "#0a9264";
  var side = script.getAttribute("data-position") === "left" ? "left" : "right";
  var title = script.getAttribute("data-title") || "Chat";

  var OPEN_ICON =
    '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  var CLOSE_ICON =
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';

  // --- Launcher button -----------------------------------------------------
  var btn = document.createElement("button");
  btn.setAttribute("aria-label", title);
  btn.innerHTML = OPEN_ICON;
  style(btn, {
    position: "fixed",
    bottom: "20px",
    [side]: "20px",
    width: "56px",
    height: "56px",
    borderRadius: "50%",
    background: color,
    border: "none",
    boxShadow: "0 6px 20px rgba(0,0,0,0.18)",
    cursor: "pointer",
    zIndex: "2147483646",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "transform .15s ease",
  });
  btn.onmouseenter = function () {
    btn.style.transform = "scale(1.06)";
  };
  btn.onmouseleave = function () {
    btn.style.transform = "scale(1)";
  };

  // --- Iframe panel --------------------------------------------------------
  var frame = document.createElement("iframe");
  frame.src = origin + "/widget/" + encodeURIComponent(botId);
  frame.title = title;
  style(frame, {
    position: "fixed",
    bottom: "88px",
    [side]: "20px",
    width: "380px",
    maxWidth: "calc(100vw - 40px)",
    height: "600px",
    maxHeight: "calc(100vh - 120px)",
    border: "none",
    borderRadius: "16px",
    boxShadow: "0 12px 40px rgba(0,0,0,0.22)",
    zIndex: "2147483646",
    display: "none",
    background: "#fff",
  });

  var open = false;
  btn.addEventListener("click", function () {
    open = !open;
    frame.style.display = open ? "block" : "none";
    btn.innerHTML = open ? CLOSE_ICON : OPEN_ICON;
  });

  function mount() {
    document.body.appendChild(frame);
    document.body.appendChild(btn);
  }
  if (document.body) mount();
  else window.addEventListener("DOMContentLoaded", mount);

  function style(el, props) {
    for (var k in props) el.style[k] = props[k];
  }
})();
