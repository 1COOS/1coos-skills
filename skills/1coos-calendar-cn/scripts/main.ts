/**
 * 1coos-calendar-cn CLI 入口
 * 查询中国传统日历/黄历信息
 */

import { parseArgs } from "node:util";
import { resolve, dirname, join } from "node:path";
import { Solar, Lunar, I18n } from "lunar-typescript";
import { getCalendarData, DEFAULT_MODULES, type ModulesConfig } from "./calendar";
import { formatCalendar } from "./formatter";

// ==================== 配置加载 ====================

interface Config {
  lang: string;
  modules: ModulesConfig;
}

const DEFAULT_CONFIG: Config = {
  lang: "cn",
  modules: DEFAULT_MODULES,
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

function mergeConfig(fileConfig: Partial<Config>): Config {
  return {
    lang: fileConfig.lang ?? DEFAULT_CONFIG.lang,
    modules: {
      ...DEFAULT_CONFIG.modules,
      ...(fileConfig.modules || {}),
    },
  };
}

// ==================== 日期解析 ====================

function parseDate(input: string): { year: number; month: number; day: number } | null {
  let m = input.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return { year: +m[1], month: +m[2], day: +m[3] };

  m = input.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (m) return { year: +m[1], month: +m[2], day: +m[3] };

  m = input.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return { year: +m[1], month: +m[2], day: +m[3] };

  return null;
}

// ==================== 帮助文本 ====================

const HELP_TEXT = `
1coos-calendar-cn

查询中国传统日历/黄历信息。

用法：
  bun run main.ts [日期] [选项]

参数：
  [日期]       公历日期，支持格式：YYYY-MM-DD, YYYY/MM/DD, YYYYMMDD
               不指定则默认今天

选项：
  --lunar      输入的日期是农历日期
  --config     指定配置文件路径
  --help       显示此帮助信息

配置文件（config.json）：
  lang         语言：cn（简体中文，默认）、en（英文）
  modules      数据模块开关：
    ganZhi     干支纪日、纳音五行
    yiJi       宜忌、彭祖百忌
    chongSha   冲煞、胎神
    jieQi      节气
    holiday    法定节假日（公历节日）
    foto       佛教节日/斋日
    tao        道教节日
    xiu        二十八星宿、值神、建除
    jiShen     吉神宜趋/凶煞宜忌
    positions  吉神方位

示例：
  bun run main.ts                    # 查询今天
  bun run main.ts 2024-01-15         # 查询指定公历日期
  bun run main.ts 2024-01-01 --lunar # 查询农历2024年正月初一
  bun run main.ts 20240915           # 紧凑格式
`.trim();

// ==================== 主函数 ====================

async function main() {
  const { values, positionals } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      lunar: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
      config: { type: "string" },
    },
    allowPositionals: true,
  });

  if (values.help) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  // 加载配置（限制 config 路径在 skill 目录内）
  const skillRoot = resolve(dirname(import.meta.dir));
  const configPath = values.config
    ? resolve(values.config)
    : join(skillRoot, "config.json");

  if (!configPath.startsWith(skillRoot + "/") && configPath !== join(skillRoot, "config.json")) {
    console.error("错误：配置文件路径必须在 skill 目录内");
    process.exit(2);
  }

  const fileConfig = await loadConfig(configPath);
  const config = mergeConfig(fileConfig);

  // 设置语言（cn 映射到库的 chs）
  const langMap: Record<string, string> = { cn: "chs", en: "en" };
  const libLang = langMap[config.lang] ?? "chs";
  if (libLang !== "chs") {
    I18n.setLanguage(libLang);
  }

  let solar: Solar;

  if (positionals.length === 0) {
    solar = Solar.fromDate(new Date());
  } else {
    const dateInput = positionals[0];
    const parsed = parseDate(dateInput);

    if (!parsed) {
      console.error(`错误：无效的日期格式 "${dateInput}"`);
      console.error("支持的格式：YYYY-MM-DD, YYYY/MM/DD, YYYYMMDD");
      process.exit(2);
    }

    try {
      if (values.lunar) {
        const lunar = Lunar.fromYmd(parsed.year, parsed.month, parsed.day);
        solar = lunar.getSolar();
      } else {
        solar = Solar.fromYmd(parsed.year, parsed.month, parsed.day);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`错误：无效的日期 "${dateInput}" - ${msg}`);
      process.exit(2);
    }
  }

  const data = getCalendarData(solar, config.modules);
  const output = formatCalendar(data, config.modules);
  console.log(output);
}

main();
