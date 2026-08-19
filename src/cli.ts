import { createCli } from "@client-platform/kernel";
import { runAddRemote } from "./add-remote.js";
import { runDoctor } from "./doctor.js";
import { runInit } from "./init.js";
import { runPreview } from "./preview.js";
import { DEFAULT_PRESET } from "./types.js";
import { runValidate } from "./validate.js";

function fail(err: unknown): never {
  const message = err instanceof Error ? err.message : String(err);
  console.error(message);
  process.exit(1);
}

export async function run(argv: string[]): Promise<void> {
  const program = createCli({
    name: "microfrontend",
    version: "0.0.0",
    description: "Client platform microfrontend toolkit",
  });

  program
    .command("init")
    .description("Initialize microfrontend with default preset host-react-vite")
    .option("--preset <name>", "preset name", DEFAULT_PRESET)
    .action(async (opts: { preset: string }) => {
      try {
        const written = await runInit(process.cwd(), opts.preset);
        for (const file of written) {
          console.log(`wrote ${file}`);
        }
        console.log(`init complete (preset=${opts.preset})`);
      } catch (err) {
        fail(err);
      }
    });

  program
    .command("add-remote")
    .description("Register a remote against the host composition")
    .argument("<name>", "remote name")
    .option("--entry <url>", "remote entry URL")
    .action(async (name: string, opts: { entry?: string }) => {
      try {
        const result = await runAddRemote(process.cwd(), name, opts.entry);
        console.log(`added remote ${result.remote.name} → ${result.remote.entry}`);
        console.log(`updated ${result.configPath} (remotes=${result.remotes.length})`);
      } catch (err) {
        fail(err);
      }
    });

  program
    .command("validate")
    .description("Validate host/remote config and contracts")
    .action(async () => {
      try {
        const result = await runValidate(process.cwd());
        for (const check of result.checks) {
          console.log(`ok: ${check}`);
        }
        for (const warning of result.warnings) {
          console.warn(`warn: ${warning}`);
        }
        for (const error of result.errors) {
          console.error(`error: ${error}`);
        }
        if (!result.ok) {
          process.exit(1);
        }
        console.log("validate complete");
      } catch (err) {
        fail(err);
      }
    });

  program
    .command("preview")
    .description("Serve static host+remote composition preview")
    .option("--port <n>", "port", "4173")
    .option("--write-only", "write preview HTML and exit")
    .action(async (opts: { port: string; writeOnly?: boolean }) => {
      try {
        await runPreview(process.cwd(), {
          port: Number(opts.port) || 4173,
          writeOnly: Boolean(opts.writeOnly),
        });
      } catch (err) {
        fail(err);
      }
    });

  program
    .command("doctor")
    .description("Product diagnostics")
    .action(async () => {
      const findings = await runDoctor(process.cwd());
      let failed = false;
      for (const finding of findings) {
        console.log(`[${finding.severity}] ${finding.code}: ${finding.message}`);
        if (finding.severity === "error") {
          failed = true;
        }
      }
      if (failed) {
        process.exit(1);
      }
    });

  await program.parseAsync(argv);
}
