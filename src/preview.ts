import http from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadProject } from "./config.js";
import { runValidate } from "./validate.js";
import { PREVIEW_DIR } from "./types.js";

function renderPreviewHtml(
  hostName: string,
  remotes: Array<{ name: string; entry: string }>,
): string {
  const rows = remotes
    .map(
      (r) =>
        `<tr><td><code>${escapeHtml(r.name)}</code></td><td><code>${escapeHtml(r.entry)}</code></td><td class="ph">placeholder mount</td></tr>`,
    )
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>microfrontend preview — ${escapeHtml(hostName)}</title>
  <style>
    :root { color-scheme: light; font-family: ui-sans-serif, system-ui, sans-serif; }
    body { margin: 2rem; background: #f6f7f9; color: #15202b; }
    h1 { font-size: 1.25rem; }
    .note { color: #516173; margin-bottom: 1.5rem; }
    table { border-collapse: collapse; width: 100%; background: white; }
    th, td { border: 1px solid #d7dde5; padding: 0.6rem 0.75rem; text-align: left; }
    th { background: #eef2f6; }
    .ph { color: #8a6d3b; }
    code { font-size: 0.9em; }
  </style>
</head>
<body>
  <h1>Host: ${escapeHtml(hostName)}</h1>
  <p class="note">Static composition preview (not full Module Federation runtime).</p>
  <table>
    <thead><tr><th>Remote</th><th>Entry</th><th>Mount</th></tr></thead>
    <tbody>
      ${rows || `<tr><td colspan="3">No remotes configured — run <code>microfrontend add-remote &lt;name&gt;</code></td></tr>`}
    </tbody>
  </table>
</body>
</html>
`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type PreviewOptions = {
  port?: number;
  writeOnly?: boolean;
};

export async function runPreview(
  cwd: string,
  options: PreviewOptions = {},
): Promise<{ url?: string; htmlPath: string }> {
  const validation = await runValidate(cwd);
  if (!validation.ok) {
    throw new Error(
      `validate failed:\n${validation.errors.map((e) => `  - ${e}`).join("\n")}`,
    );
  }

  const project = await loadProject(cwd);
  if (!project.product) {
    throw new Error("products.microfrontend missing or invalid");
  }

  const outDir = path.join(cwd, PREVIEW_DIR);
  await mkdir(outDir, { recursive: true });
  const htmlPath = path.join(outDir, "index.html");
  const html = renderPreviewHtml(
    project.product.host.name,
    project.product.remotes,
  );
  await writeFile(htmlPath, html, "utf8");
  console.log(`[microfrontend] wrote ${path.relative(cwd, htmlPath)}`);

  if (options.writeOnly) {
    return { htmlPath };
  }

  const port = options.port ?? 4173;
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve());
  });

  const url = `http://127.0.0.1:${port}/`;
  console.log(`[microfrontend] preview serving ${url}`);
  console.log("[microfrontend] press Ctrl+C to stop");

  await new Promise<void>((resolve) => {
    const stop = () => {
      server.close(() => resolve());
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  });

  return { url, htmlPath };
}
