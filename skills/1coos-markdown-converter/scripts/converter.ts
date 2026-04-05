/**
 * uvx markitdown converter wrapper
 * Uses markitdown[all] to ensure full format support
 */

export interface ConverterConfig {
  timeout: number;
  charset: string;
}

export const DEFAULT_CONVERTER_CONFIG: ConverterConfig = {
  timeout: 60000,
  charset: "UTF-8",
};

export interface ConvertResult {
  success: boolean;
  markdown: string;
  error?: string;
}

/**
 * Check if uvx is available on the system
 */
export async function checkUvxAvailable(): Promise<boolean> {
  try {
    const proc = Bun.spawn(["which", "uvx"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const exitCode = await proc.exited;
    return exitCode === 0;
  } catch {
    return false;
  }
}

/**
 * Convert a file to markdown using uvx markitdown[all]
 */
export async function convertToMarkdown(
  inputPath: string,
  config: Partial<ConverterConfig> = {},
): Promise<ConvertResult> {
  const fullConfig = { ...DEFAULT_CONVERTER_CONFIG, ...config };

  // Check if input file exists
  const file = Bun.file(inputPath);
  if (!(await file.exists())) {
    return {
      success: false,
      markdown: "",
      error: `File not found: ${inputPath}`,
    };
  }

  // Check if uvx is available
  if (!(await checkUvxAvailable())) {
    return {
      success: false,
      markdown: "",
      error: "uvx is not installed. Please install uv first: https://docs.astral.sh/uv/getting-started/installation/",
    };
  }

  // Build command arguments
  const args = ["uvx", "markitdown[all]", inputPath];
  if (fullConfig.charset) {
    args.push("-c", fullConfig.charset);
  }

  try {
    const proc = Bun.spawn(args, {
      stdout: "pipe",
      stderr: "pipe",
    });

    // Wait with timeout
    const result = await Promise.race([
      (async () => {
        const exitCode = await proc.exited;
        const stdout = await new Response(proc.stdout).text();
        const stderr = await new Response(proc.stderr).text();
        return { exitCode, stdout, stderr, timedOut: false };
      })(),
      new Promise<{ exitCode: number; stdout: string; stderr: string; timedOut: boolean }>(
        (resolve) =>
          setTimeout(() => {
            proc.kill();
            resolve({
              exitCode: -1,
              stdout: "",
              stderr: "",
              timedOut: true,
            });
          }, fullConfig.timeout),
      ),
    ]);

    if (result.timedOut) {
      return {
        success: false,
        markdown: "",
        error: `Conversion timed out (${fullConfig.timeout / 1000}s)`,
      };
    }

    if (result.exitCode !== 0) {
      return {
        success: false,
        markdown: "",
        error: `markitdown failed (exit ${result.exitCode}): ${result.stderr.trim()}`,
      };
    }

    const markdown = result.stdout;
    if (!markdown.trim()) {
      return {
        success: false,
        markdown: "",
        error: "Conversion produced empty output — file format may not be supported",
      };
    }

    return { success: true, markdown };
  } catch (err) {
    return {
      success: false,
      markdown: "",
      error: `Conversion error: ${String(err)}`,
    };
  }
}
