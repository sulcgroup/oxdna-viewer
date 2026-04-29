#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { app, BrowserWindow } = require("electron");

const rootDir = path.resolve(__dirname, "..");

function printHelp() {
  console.log(`Usage:
  electron ./script/save-canvas-image.js --input <file> [--input <file> ...] [options]

Options:
  --input, -i <file>      Structure or auxiliary file to load. Can be passed multiple times.
  --output, -o <file>     Output PNG path. Defaults to ./canvas.png
  --scale, -s <number>    Scale factor passed to view.saveCanvasImage(). Default: 2
  --width <px>            Browser window width. Default: 1600
  --height <px>           Browser window height. Default: 900
  --delay-ms <ms>         Extra wait after the scene is ready. Default: 1000
  --timeout-ms <ms>       Max time to wait for oxView to load. Default: 120000
  --show                  Show the Electron window while exporting
  --verbose               Print renderer console output
  --help, -h              Show this help

Examples:
  electron ./script/save-canvas-image.js \\
    --input ./examples/2-free-form_design_example-tetrahedron/tetra.oxview \\
    --output ./tetra.png

  electron ./script/save-canvas-image.js \\
    --input ./examples/triangle/tri.json.top \\
    --input ./examples/triangle/tri.json.oxdna \\
    --output ./triangle.png \\
    --scale 3`);
}

function parseNumber(label, value, fallback) {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Expected ${label} to be a positive number, got "${value}".`);
  }
  return parsed;
}

function requireValue(argv, index, flag) {
  const value = argv[index + 1];
  if (value === undefined) {
    throw new Error(`Missing value after ${flag}.`);
  }
  return value;
}

function parseArgs(argv) {
  const options = {
    inputs: [],
    output: path.resolve(process.cwd(), "canvas.png"),
    scale: 2,
    width: 1600,
    height: 900,
    delayMs: 1000,
    timeoutMs: 120000,
    show: false,
    verbose: false,
    help: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    switch (arg) {
      case "--input":
      case "-i":
        options.inputs.push(path.resolve(requireValue(argv, i, arg)));
        i += 1;
        break;
      case "--output":
      case "-o":
        options.output = path.resolve(requireValue(argv, i, arg));
        i += 1;
        break;
      case "--scale":
      case "-s":
        options.scale = parseNumber("scale", requireValue(argv, i, arg));
        i += 1;
        break;
      case "--width":
        options.width = Math.round(parseNumber("width", requireValue(argv, i, arg)));
        i += 1;
        break;
      case "--height":
        options.height = Math.round(parseNumber("height", requireValue(argv, i, arg)));
        i += 1;
        break;
      case "--delay-ms":
        options.delayMs = Math.round(parseNumber("delay-ms", requireValue(argv, i, arg), options.delayMs));
        i += 1;
        break;
      case "--timeout-ms":
        options.timeoutMs = Math.round(parseNumber("timeout-ms", requireValue(argv, i, arg), options.timeoutMs));
        i += 1;
        break;
      case "--show":
        options.show = true;
        break;
      case "--verbose":
        options.verbose = true;
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      default:
        if (arg.startsWith("-")) {
          throw new Error(`Unknown option "${arg}". Use --help to see supported flags.`);
        }
        options.inputs.push(path.resolve(arg));
        break;
    }
  }

  return options;
}

function validateInputs(inputs) {
  const missing = inputs.filter((inputPath) => !fs.existsSync(inputPath));
  if (missing.length > 0) {
    throw new Error(`Input file not found: ${missing[0]}`);
  }
}

function getColorbarOutputPath(outputPath) {
  const ext = path.extname(outputPath) || ".png";
  const baseName = path.basename(outputPath, ext);
  return path.join(path.dirname(outputPath), `${baseName}-colorbar${ext}`);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForSceneReady(win, options) {
  const script = `
    new Promise((resolve, reject) => {
      const deadline = Date.now() + ${options.timeoutMs};
      const needsFiles = ${options.inputs.length > 0 ? "true" : "false"};

      const finish = () => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            try {
              render();
              resolve({
                systemCount: typeof systems === "undefined" ? 0 : systems.length,
                canvasWidth: typeof canvas === "undefined" ? 0 : canvas.width,
                canvasHeight: typeof canvas === "undefined" ? 0 : canvas.height
              });
            } catch (error) {
              reject(error instanceof Error ? error.message : String(error));
            }
          });
        });
      };

      const poll = () => {
        try {
          const hasCanvas = typeof canvas !== "undefined" && !!canvas;
          const hasView = typeof view !== "undefined" && !!view;
          const hasSystems = typeof systems !== "undefined" && systems.length > 0;

          if (hasCanvas && hasView && (!needsFiles || hasSystems)) {
            finish();
            return;
          }
        } catch (error) {
        }

        if (Date.now() > deadline) {
          reject(new Error(
            needsFiles
              ? "Timed out waiting for oxView to finish loading the input files."
              : "Timed out waiting for oxView to initialize."
          ));
          return;
        }

        setTimeout(poll, 100);
      };

      poll();
    });
  `;

  return win.webContents.executeJavaScript(script, true);
}

async function triggerSave(win, scale) {
  return win.webContents.executeJavaScript(`view.saveCanvasImage(${JSON.stringify(scale)});`, true);
}

function describeSavedFiles(savedFiles) {
  return savedFiles.map((entry) => path.relative(process.cwd(), entry)).join(", ");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  validateInputs(options.inputs);
  fs.mkdirSync(path.dirname(options.output), { recursive: true });

  app.commandLine.appendSwitch("ignore-gpu-blocklist");
  app.commandLine.appendSwitch("enable-webgl");
  app.commandLine.appendSwitch("use-gl", "swiftshader");
  app.commandLine.appendSwitch("disable-renderer-backgrounding");

  await app.whenReady();

  const savedFiles = [];
  let settled = false;
  let settleTimer = null;
  let canvasDone = false;
  const activeDownloads = new Map();

  const finish = (resolve, reject, error) => {
    if (settled) {
      return;
    }
    settled = true;
    if (settleTimer) {
      clearTimeout(settleTimer);
    }
    if (error) {
      reject(error);
      return;
    }
    resolve(savedFiles);
  };

  const win = new BrowserWindow({
    width: options.width,
    height: options.height,
    show: options.show,
    paintWhenInitiallyHidden: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      backgroundThrottling: false
    }
  });

  const exportPromise = new Promise((resolve, reject) => {
    win.webContents.session.on("will-download", (_event, item) => {
      const originalName = item.getFilename();
      const savePath = originalName === "colorbar.png"
        ? getColorbarOutputPath(options.output)
        : options.output;

      activeDownloads.set(item, { originalName, savePath });
      item.setSavePath(savePath);

      item.once("done", (_doneEvent, state) => {
        const entry = activeDownloads.get(item);
        if (!entry) {
          return;
        }

        activeDownloads.delete(item);

        if (state !== "completed") {
          finish(resolve, reject, new Error(`Download for ${entry.originalName} ended with state "${state}".`));
          return;
        }

        savedFiles.push(entry.savePath);

        if (entry.originalName === "canvas.png") {
          canvasDone = true;
        }

        if (canvasDone && activeDownloads.size === 0) {
          settleTimer = setTimeout(() => finish(resolve, reject), 250);
        }
      });
    });
  });

  if (options.verbose) {
    win.webContents.on("console-message", (_event, level, message, line, sourceId) => {
      console.log(`[renderer:${level}] ${sourceId}:${line} ${message}`);
    });
  }

  win.webContents.on("render-process-gone", (_event, details) => {
    console.error(`Renderer process exited: ${details.reason}`);
  });

  win.on("unresponsive", () => {
    console.error("The export window became unresponsive.");
  });

  await win.loadFile(path.join(rootDir, "index.html"));
  if (options.inputs.length > 0) {
    await win.webContents.executeJavaScript(
      `readFilesFromPathArgs(${JSON.stringify(options.inputs)});`,
      true
    );
  }
  const sceneInfo = await waitForSceneReady(win, options);

  if (options.delayMs > 0) {
    await wait(options.delayMs);
  }

  if (options.verbose) {
    console.log(`Scene ready: ${sceneInfo.systemCount} system(s), canvas ${sceneInfo.canvasWidth}x${sceneInfo.canvasHeight}`);
  }

  await triggerSave(win, options.scale);
  const writtenFiles = await Promise.race([
    exportPromise,
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error("Timed out waiting for oxView to produce the image download."));
      }, options.timeoutMs);
    })
  ]);

  console.log(`Saved ${describeSavedFiles(writtenFiles)}`);

  if (!options.show) {
    win.destroy();
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(() => {
    app.quit();
  });
