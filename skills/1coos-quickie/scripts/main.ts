/**
 * 1coos-quickie CLI entry point
 * Grab URL content and save as formatted Obsidian-style Markdown
 */

import { parseArgs } from "node:util";
import { resolve, dirname, join } from "node:path";
import { mkdirSync } from "node:fs";
import { extractFirstUrl } from "./url-extractor";
import {
  fetchWithXReader,
  type ReaderConfig,
  DEFAULT_READER_CONFIG,
} from "./reader";
import {
  formatObsidian,
  type FormattingConfig,
  DEFAULT_FORMATTING_CONFIG,
} from "./formatter";

// ==================== Config loading ====================

interface Config {
  outputDir: string;
  raw: boolean;
  formatting: FormattingConfig;
  reader: ReaderConfig;
}

const DEFAULT_CONFIG: Config = {
  outputDir: join(resolve(dirname(import.meta.dir)), "output"),
  raw: false,
  formatting: DEFAULT_FORMATTING_CONFIG,
  reader: DEFAULT_READER_CONFIG,
};

async function loadConfig(configPath: string): Promise<Partial<Config>> {
  const file = Bun.file(configPath);
  if (!(await file.exists())) return {};
  try {
    return await file.json();
  } catch {
    console.error(`Warning: failed to parse config file: ${configPath}`);
    return {};
  }
}

function mergeConfig(
  fileConfig: Partial<Config>,
  cliOverrides: Partial<Config>,
): Config {
  return {
    outputDir:
      cliOverrides.outputDir ?? fileConfig.outputDir ?? DEFAULT_CONFIG.outputDir,
    raw: cliOverrides.raw ?? fileConfig.raw ?? DEFAULT_CONFIG.raw,
    formatting: {
      ...DEFAULT_CONFIG.formatting,
      ...(fileConfig.formatting || {}),
      ...(cliOverrides.formatting || {}),
    },
    reader: {
      ...DEFAULT_CONFIG.reader,
      ...(fileConfig.reader || {}),
      ...(cliOverrides.reader || {}),
    },
  };
}

// ==================== Output filename ====================

function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

function generateOutputFilename(title: string, url: string): string {
  const sanitized = sanitizeFilename(title);
  if (sanitized.length >= 3) {
    return `${sanitized}.md`;
  }
  try {
    const domain = new URL(url).hostname.replace(/\./g, "-");
    const ts = new Date().toISOString().slice(0, 10);
    return `${domain}-${ts}.md`;
  } catch {
    return `quickie-${Date.now().toString(36)}.md`;
  }
}

// ==================== Help text ====================

const HELP_TEXT = `
1coos-quickie

Grab URL content and save as formatted Obsidian-style Markdown.

Usage:
  bun run main.ts <text-with-url> [options]

Arguments:
  <text>                    Any text containing a URL to fetch

Options:
  -o, --output-dir <path>   Output directory
  -c, --config <path>       Config file path (default: ../config.json)
  --raw                     Skip formatting, output raw x-reader result
  -h, --help                Show help

Supported platforms:
  YouTube, Bilibili, Twitter/X, WeChat, Xiaohongshu, Telegram, RSS, any URL

Examples:
  bun run main.ts "https://www.youtube.com/watch?v=xxx"
  bun run main.ts "看看这个 https://x.com/user/status/123"
  bun run main.ts "https://example.com/article" --output-dir ~/notes
`;

// ==================== Main flow ====================

async function main() {
  const { values, positionals } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      help: { type: "boolean", short: "h" },
      "output-dir": { type: "string", short: "o" },
      config: { type: "string", short: "c" },
      raw: { type: "boolean" },
    },
    allowPositionals: true,
  });

  if (values.help) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  const inputText = positionals.join(" ");
  if (!inputText.trim()) {
    console.error("Error: please provide text containing a URL");
    console.error("Use --help for usage information");
    process.exit(2);
  }

  // Step 1: Extract URL
  const url = extractFirstUrl(inputText);
  if (!url) {
    console.error("Error: no valid URL found in the provided text");
    console.error(`Input: "${inputText}"`);
    process.exit(2);
  }
  console.log(`URL: ${url}`);

  // Load config
  const skillDir = resolve(dirname(import.meta.dir));
  const configPath = values.config
    ? resolve(values.config)
    : join(skillDir, "config.json");
  const fileConfig = await loadConfig(configPath);

  const cliOverrides: Partial<Config> = {};
  if (values["output-dir"]) {
    cliOverrides.outputDir = values["output-dir"];
  }
  if (values.raw) {
    cliOverrides.raw = true;
  }

  const config = mergeConfig(fileConfig, cliOverrides);

  // Step 2: Fetch content via x-reader
  console.log("Fetching content...");
  const fetchResult = await fetchWithXReader(url, config.reader);

  if (!fetchResult.success) {
    console.error(`Fetch failed: ${fetchResult.error}`);
    if (fetchResult.error?.includes("uvx is not installed")) {
      process.exit(3);
    }
    process.exit(4);
  }

  let markdown = fetchResult.markdown;
  console.log(`Fetched: "${fetchResult.title}" (${markdown.length} chars)`);

  // Step 3: Format
  if (!config.raw) {
    console.log("Formatting (obsidian style)...");
    markdown = formatObsidian(markdown, config.formatting);
    console.log(`Formatted (${markdown.length} chars)`);
  }

  // Step 4: Write output
  const outputDir = resolve(config.outputDir);
  const outputFileName = generateOutputFilename(fetchResult.title, url);
  const outputPath = join(outputDir, outputFileName);

  try {
    mkdirSync(outputDir, { recursive: true });
    await Bun.write(outputPath, markdown);
    console.log(`Output: ${outputPath}`);
  } catch (err) {
    console.error(`Failed to write output: ${String(err)}`);
    process.exit(5);
  }
}

main().catch((err) => {
  console.error(`Unexpected error: ${err}`);
  process.exit(1);
});
