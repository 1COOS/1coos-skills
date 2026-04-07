import { describe, test, expect } from "bun:test";
import { getCalendarData } from "./calendar";
import { formatCalendar } from "./formatter";
import { Solar } from "lunar-typescript";

const SCRIPT = import.meta.dir + "/main.ts";

function run(...args: string[]) {
  const proc = Bun.spawnSync(["bun", "run", SCRIPT, ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });
  return {
    exitCode: proc.exitCode,
    stdout: proc.stdout.toString(),
    stderr: proc.stderr.toString(),
  };
}

describe("CLI", () => {
  test("--help 显示帮助信息", () => {
    const { exitCode, stdout } = run("--help");
    expect(exitCode).toBe(0);
    expect(stdout).toContain("1coos-calendar-cn");
    expect(stdout).toContain("--lunar");
  });

  test("无参数默认今天，退出码 0", () => {
    const { exitCode, stdout } = run();
    expect(exitCode).toBe(0);
    expect(stdout).toContain("星期");
    expect(stdout).toContain("【基本信息】");
  });

  test("指定公历日期 2024-02-10（春节）", () => {
    const { exitCode, stdout } = run("2024-02-10");
    expect(exitCode).toBe(0);
    expect(stdout).toContain("2024年02月10日");
    expect(stdout).toContain("正月");
    expect(stdout).toContain("初一");
    expect(stdout).toContain("龙");
    expect(stdout).toContain("春节");
  });

  test("紧凑格式 20240210", () => {
    const { exitCode, stdout } = run("20240210");
    expect(exitCode).toBe(0);
    expect(stdout).toContain("2024年02月10日");
    expect(stdout).toContain("春节");
  });

  test("斜杠格式 2024/02/10", () => {
    const { exitCode, stdout } = run("2024/02/10");
    expect(exitCode).toBe(0);
    expect(stdout).toContain("2024年02月10日");
  });

  test("--lunar 农历输入（农历2024年二月十九 观音诞）", () => {
    const { exitCode, stdout } = run("2024-02-19", "--lunar");
    expect(exitCode).toBe(0);
    expect(stdout).toContain("二月十九");
    expect(stdout).toContain("观音");
  });

  test("无效日期格式返回退出码 2", () => {
    const { exitCode, stderr } = run("not-a-date");
    expect(exitCode).toBe(2);
    expect(stderr).toContain("无效的日期格式");
  });
});

describe("getCalendarData", () => {
  test("2024-02-10（春节）数据正确", () => {
    const solar = Solar.fromYmd(2024, 2, 10);
    const data = getCalendarData(solar);

    expect(data.solar.year).toBe(2024);
    expect(data.solar.month).toBe(2);
    expect(data.solar.day).toBe(10);
    expect(data.lunar.monthCn).toBe("正");
    expect(data.lunar.dayCn).toBe("初一");
    expect(data.shengXiao).toBe("龙");
    expect(data.ganZhi.year).toBe("甲辰");
    expect(data.festivals).toContain("春节");
  });

  test("2024-04-04（清明）节气正确", () => {
    const solar = Solar.fromYmd(2024, 4, 4);
    const data = getCalendarData(solar);

    expect(data.jieQi.current).toBe("清明");
  });

  test("佛教节日 - 农历二月十九观音诞", () => {
    // 2024年农历二月十九 = 公历2024-03-28
    const solar = Solar.fromYmd(2024, 3, 28);
    const data = getCalendarData(solar);

    expect(data.fotoFestivals.length).toBeGreaterThan(0);
    expect(data.fotoFestivals.some((f) => f.includes("观音"))).toBe(true);
    expect(data.fotoZhai).toContain("观音斋");
  });

  test("宜忌数组非空", () => {
    const solar = Solar.fromYmd(2024, 6, 15);
    const data = getCalendarData(solar);

    expect(data.yi.length).toBeGreaterThan(0);
    expect(data.ji.length).toBeGreaterThan(0);
  });

  test("吉神方位字段存在", () => {
    const solar = Solar.fromYmd(2024, 1, 1);
    const data = getCalendarData(solar);

    expect(data.positions.xi).toBeTruthy();
    expect(data.positions.fu).toBeTruthy();
    expect(data.positions.cai).toBeTruthy();
  });
});

describe("formatCalendar", () => {
  test("格式化输出包含所有主要段落", () => {
    const solar = Solar.fromYmd(2024, 2, 10);
    const data = getCalendarData(solar);
    const output = formatCalendar(data);

    expect(output).toContain("【基本信息】");
    expect(output).toContain("【干支纪日】");
    expect(output).toContain("【冲煞】");
    expect(output).toContain("【宜】");
    expect(output).toContain("【忌】");
    expect(output).toContain("【彭祖百忌】");
    expect(output).toContain("【胎神】");
    expect(output).toContain("【吉神宜趋】");
    expect(output).toContain("【凶煞宜忌】");
    expect(output).toContain("【节气】");
    expect(output).toContain("【星宿】");
    expect(output).toContain("【吉神方位】");
    expect(output).toContain("【日禄】");
  });
});
