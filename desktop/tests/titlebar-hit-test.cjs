const assert = require("node:assert/strict");

const { app, BrowserWindow } = require("electron");

const timeout = setTimeout(() => {
  console.error("titlebar hit test timed out");
  app.exit(2);
}, 15_000);

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 800,
    height: 240,
    show: true,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 14, y: 16 },
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  try {
    const html = `<!doctype html>
      <html>
        <head>
          <style>
            * { box-sizing: border-box; }
            body { margin: 0; }
            #overlay { position: fixed; inset: 0; -webkit-app-region: no-drag; }
            header {
              height: 44px;
              display: flex;
              align-items: center;
              justify-content: flex-end;
              padding: 0 8px;
              background: #0a0a0a;
              -webkit-app-region: drag;
            }
            #back {
              width: 112px;
              height: 32px;
              color: white;
              background: #222;
              border: 1px solid #555;
              -webkit-app-region: no-drag;
            }
          </style>
        </head>
        <body>
          <section id="overlay">
            <header><button id="back">Back to task</button></header>
          </section>
          <script>
            window.__backClicks = 0;
            document.querySelector('#back').addEventListener('click', () => {
              window.__backClicks += 1;
            });
          </script>
        </body>
      </html>`;
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    win.show();
    win.focus();
    await new Promise((resolve) => setTimeout(resolve, 150));
    const rect = await win.webContents.executeJavaScript(`(() => {
      const rect = document.querySelector('#back').getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    })()`);
    const point = {
      x: Math.round(rect.x + rect.width / 2),
      y: Math.round(rect.y + rect.height / 2),
    };
    win.webContents.sendInputEvent({ type: "mouseMove", ...point });
    win.webContents.sendInputEvent({ type: "mouseDown", button: "left", clickCount: 1, ...point });
    win.webContents.sendInputEvent({ type: "mouseUp", button: "left", clickCount: 1, ...point });

    let clicks = 0;
    for (let attempt = 0; attempt < 20 && clicks === 0; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 25));
      clicks = await win.webContents.executeJavaScript("window.__backClicks");
    }
    assert.equal(clicks, 1, "hiddenInset titlebar button did not receive the native click");
    console.log("titlebar hit test passed");
  } finally {
    clearTimeout(timeout);
    win.destroy();
    app.exit(0);
  }
}).catch((error) => {
  clearTimeout(timeout);
  console.error(error);
  app.exit(1);
});
