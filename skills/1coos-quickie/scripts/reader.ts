/**
 * x-reader wrapper
 * Uses uvx to run x-reader for URL content extraction
 */

export interface ReaderConfig {
  timeout: number;
}

export const DEFAULT_READER_CONFIG: ReaderConfig = {
  timeout: 120000,
};

export interface ReaderResult {
  success: boolean;
  markdown: string;
  title: string;
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
 * Fetch URL content using x-reader via uvx
 */
export async function fetchWithXReader(
  url: string,
  config: Partial<ReaderConfig> = {},
): Promise<ReaderResult> {
  const fullConfig = { ...DEFAULT_READER_CONFIG, ...config };

  if (!(await checkUvxAvailable())) {
    return {
      success: false,
      markdown: "",
      title: "",
      error:
        "uvx is not installed. Please install uv first: https://docs.astral.sh/uv/getting-started/installation/",
    };
  }

  const args = [
    "uvx",
    "--from",
    "x-reader[all] @ git+https://github.com/runesleo/x-reader.git",
    "x-reader",
    url,
  ];

  try {
    const proc = Bun.spawn(args, {
      stdout: "pipe",
      stderr: "pipe",
    });

    const result = await Promise.race([
      (async () => {
        const exitCode = await proc.exited;
        const stdout = await new Response(proc.stdout).text();
        const stderr = await new Response(proc.stderr).text();
        return { exitCode, stdout, stderr, timedOut: false };
      })(),
      new Promise<{
        exitCode: number;
        stdout: string;
        stderr: string;
        timedOut: boolean;
      }>((resolve) =>
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
        title: "",
        error: `Fetch timed out (${fullConfig.timeout / 1000}s)`,
      };
    }

    if (result.exitCode !== 0) {
      return {
        success: false,
        markdown: "",
        title: "",
        error: `x-reader failed (exit ${result.exitCode}): ${result.stderr.trim()}`,
      };
    }

    const markdown = result.stdout;
    if (!markdown.trim()) {
      return {
        success: false,
        markdown: "",
        title: "",
        error: "x-reader produced empty output — URL may not be accessible",
      };
    }

    const title = extractTitle(markdown, url);
    return { success: true, markdown, title };
  } catch (err) {
    return {
      success: false,
      markdown: "",
      title: "",
      error: `Fetch error: ${String(err)}`,
    };
  }
}

/**
 * Extract title from markdown (first # heading) or fall back to URL domain
 */
function extractTitle(markdown: string, fallbackUrl: string): string {
  const headingMatch = markdown.match(/^#\s+(.+)$/m);
  if (headingMatch) {
    return headingMatch[1].trim();
  }
  try {
    return new URL(fallbackUrl).hostname;
  } catch {
    return "untitled";
  }
}
