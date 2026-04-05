import { describe, expect, it } from "bun:test";
import { join } from "node:path";

const MAIN_PATH = join(import.meta.dir, "main.ts");

async function run(args: string[] = []) {
  const proc = Bun.spawn(["bun", "run", MAIN_PATH, ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const exitCode = await proc.exited;
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  return { exitCode, stdout, stderr };
}

describe("main", () => {
  it("--help shows usage information", async () => {
    const { exitCode, stdout } = await run(["--help"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("1coos-markdown-converter");
    expect(stdout).toContain("Usage");
    expect(stdout).toContain("--style");
  });

  it("no args exits with error", async () => {
    const { exitCode, stderr } = await run([]);
    expect(exitCode).toBe(2);
    expect(stderr).toContain("please provide a file path");
  });

  it("non-existent file exits with error", async () => {
    const { exitCode, stderr } = await run(["/nonexistent/file.pdf"]);
    expect(exitCode).toBe(2);
    expect(stderr).toContain("file not found");
  });

  it("invalid style exits with error", async () => {
    const { exitCode, stderr } = await run([MAIN_PATH, "--style", "invalid"]);
    expect(exitCode).toBe(2);
    expect(stderr).toContain("invalid style");
  });
});
