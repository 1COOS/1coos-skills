/**
 * 1coos-markdown-converter CLI entry point
 * Convert files to beautifully formatted Markdown
 */

import { parseArgs } from "node:util";
import { resolve, dirname, basename, extname, join } from "node:path";
import { mkdirSync } from "node:fs";
import { convertToMarkdown, type ConverterConfig, DEFAULT_CONVERTER_CONFIG } from "./converter";
import { formatMarkdown, type FormatStyle, type FormattingConfig, DEFAULT_FORMATTING_CONFIG } from "./formatter";

// ==================== Config loading ====================

interface Config {
  style: FormatStyle;
  outputDir: string;
  convertOnly: boolean;
  formatting: FormattingConfig;
  converter: ConverterConfig;
}

const DEFAULT_CONFIG: Config = {
  style: "obsidian",
  outputDir: join(resolve(dirname(import.meta.dir)), "output"),
  convertOnly: false,
  formatting: DEFAULT_FORMATTING_CONFIG,
  converter: DEFAULT_CONVERTER_CONFIG,
};

/**
 * Load config.json configuration file
 */
async function loadConfig(configPath: string): Promise<Partial<Config>> {
  const file = Bun.file(configPath);
  if (!(await file.exists())) {
    return {};
  }
  try {
    return await file.json();
  } catch {
    console.error(`Warning: failed to parse config file: ${configPath}`);
    return {};
  }
}

/**
 * Merge config: CLI args > config.json > defaults
 */
function mergeConfig(
  fileConfig: Partial<Config>,
  cliOverrides: Partial<Config>,
): Config {
  return {
    style: cliOverrides.style ?? fileConfig.style ?? DEFAULT_CONFIG.style,
    outputDir: cliOverrides.outputDir ?? fileConfig.outputDir ?? DEFAULT_CONFIG.outputDir,
    convertOnly:
      cliOverrides.convertOnly ??
      fileConfig.convertOnly ??
      DEFAULT_CONFIG.convertOnly,
    formatting: {
      ...DEFAULT_CONFIG.formatting,
      ...(fileConfig.formatting || {}),
      ...(cliOverrides.formatting || {}),
    },
    converter: {
      ...DEFAULT_CONFIG.converter,
      ...(fileConfig.converter || {}),
      ...(cliOverrides.converter || {}),
    },
  };
}

// ==================== Help text ====================

const HELP_TEXT = `
1coos-markdown-converter

Convert files to beautifully formatted Markdown.

Usage:
  bun run main.ts <file-path> [options]

Arguments:
  <file-path>              Path to the file to convert

Options:
  -s, --style <style>      Formatting style: obsidian (default), github, commonmark, clean
  -o, --output-dir <path>   Output directory (default: skills/1coos-markdown-converter/output)
  -c, --config <path>      Config file path (default: ../config.json)
  --convert-only           Convert only, skip formatting step
  -h, --help               Show help

Supported formats:
  PDF, Word (.docx), PowerPoint (.pptx), Excel (.xlsx/.xls),
  HTML, CSV, JSON, XML, Images (OCR), Audio (transcription), ZIP, EPub

Examples:
  bun run main.ts report.pdf
  bun run main.ts doc.docx --style clean --output-dir ~/notes
  bun run main.ts data.xlsx --convert-only
`;

// ==================== Main flow ====================

const VALID_STYLES: FormatStyle[] = ["obsidian", "github", "commonmark", "clean"];

async function main() {
  const { values, positionals } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      help: { type: "boolean", short: "h" },
      style: { type: "string", short: "s" },
      "output-dir": { type: "string", short: "o" },
      config: { type: "string", short: "c" },
      "convert-only": { type: "boolean" },
    },
    allowPositionals: true,
  });

  if (values.help) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  if (positionals.length === 0) {
    console.error("Error: please provide a file path to convert");
    console.error("Use --help for usage information");
    process.exit(2);
  }

  const inputPath = resolve(positionals[0]);

  const inputFile = Bun.file(inputPath);
  if (!(await inputFile.exists())) {
    console.error(`Error: file not found: ${inputPath}`);
    process.exit(2);
  }

  // Load config file
  const skillDir = resolve(dirname(import.meta.dir));
  const configPath = values.config
    ? resolve(values.config)
    : join(skillDir, "config.json");
  const fileConfig = await loadConfig(configPath);

  // CLI overrides
  const cliOverrides: Partial<Config> = {};
  if (values.style) {
    if (!VALID_STYLES.includes(values.style as FormatStyle)) {
      console.error(
        `Error: invalid style "${values.style}", available: ${VALID_STYLES.join(", ")}`,
      );
      process.exit(2);
    }
    cliOverrides.style = values.style as FormatStyle;
  }
  if (values["output-dir"]) {
    cliOverrides.outputDir = values["output-dir"];
  }
  if (values["convert-only"]) {
    cliOverrides.convertOnly = true;
  }

  const config = mergeConfig(fileConfig, cliOverrides);

  // Determine output path: outputDir + input filename with .md extension
  const outputDir = resolve(config.outputDir);
  const outputFileName = basename(inputPath, extname(inputPath)) + ".md";
  const outputPath = join(outputDir, outputFileName);

  // Step 1: Convert
  console.log(`Converting: ${inputPath}`);
  const convertResult = await convertToMarkdown(inputPath, config.converter);

  if (!convertResult.success) {
    console.error(`Conversion failed: ${convertResult.error}`);
    process.exit(4);
  }

  let markdown = convertResult.markdown;
  console.log(`Converted (${markdown.length} chars)`);

  // Step 2: Format
  if (!config.convertOnly) {
    console.log(`Formatting (${config.style} style)...`);
    markdown = formatMarkdown(markdown, config.style, config.formatting);
    console.log(`Formatted (${markdown.length} chars)`);
  }

  // Step 3: Write output
  mkdirSync(outputDir, { recursive: true });
  await Bun.write(outputPath, markdown);
  console.log(`Output: ${outputPath}`);
}

main().catch((err) => {
  console.error(`Unexpected error: ${err}`);
  process.exit(1);
});
