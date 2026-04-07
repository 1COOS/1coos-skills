/**
 * 输出格式化模块
 * 将 CalendarData 渲染为清晰美观的文本输出
 */

import type { CalendarData, ModulesConfig } from "./calendar";
import { DEFAULT_MODULES } from "./calendar";

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function wrapItems(items: string[], perLine = 6): string {
  if (items.length === 0) return "（无）";
  const lines: string[] = [];
  for (let i = 0; i < items.length; i += perLine) {
    lines.push("   " + items.slice(i, i + perLine).join(" "));
  }
  return lines.join("\n");
}

export function formatCalendar(
  data: CalendarData,
  modules: ModulesConfig = DEFAULT_MODULES,
): string {
  const {
    solar, lunar, ganZhi, naYin, shengXiao, xingZuo,
    season, liuYao, yueXiang, jieQi, yi, ji,
    chongSha, pengZu, taiShen, jiShen, xiongSha,
    festivals, fotoFestivals, fotoZhai, taoFestivals,
    xiu, tianShen, tianShenType, tianShenLuck, zhiXing,
    positions, dayLu,
  } = data;

  const dateStr = `${solar.year}年${pad(solar.month)}月${pad(solar.day)}日`;
  const lunarStr = `${lunar.yearInGanZhi}年 ${lunar.monthCn}月${lunar.dayCn}`;

  const lines: string[] = [];

  // 标题行
  lines.push(`${dateStr} 星期${solar.weekday} | 农历${lunarStr}`);
  lines.push("━".repeat(42));

  // 基本信息
  lines.push("");
  lines.push("【基本信息】");
  lines.push(`   公历：${dateStr} 星期${solar.weekday}`);
  lines.push(`   农历：${lunarStr}`);
  lines.push(`   生肖：${shengXiao}          星座：${xingZuo}`);
  lines.push(`   季节：${season}          六曜：${liuYao}`);
  lines.push(`   月相：${yueXiang}`);

  // 干支
  if (modules.ganZhi) {
    lines.push("");
    lines.push("【干支纪日】");
    lines.push(
      `   年柱：${ganZhi.year}        月柱：${ganZhi.month}        日柱：${ganZhi.day}`,
    );
    lines.push(
      `   纳音：${naYin.year}    纳音：${naYin.month}    纳音：${naYin.day}`,
    );
  }

  // 冲煞
  if (modules.chongSha) {
    lines.push("");
    lines.push("【冲煞】");
    lines.push(`   ${chongSha.desc}    煞${chongSha.sha}`);
  }

  // 宜忌
  if (modules.yiJi) {
    lines.push("");
    lines.push("【宜】");
    lines.push(wrapItems(yi));

    lines.push("");
    lines.push("【忌】");
    lines.push(wrapItems(ji));

    lines.push("");
    lines.push("【彭祖百忌】");
    lines.push(`   ${pengZu.gan}`);
    lines.push(`   ${pengZu.zhi}`);
  }

  // 胎神
  if (modules.chongSha) {
    lines.push("");
    lines.push("【胎神】");
    lines.push(`   ${taiShen}`);
  }

  // 吉神宜趋 / 凶煞宜忌
  if (modules.jiShen) {
    lines.push("");
    lines.push("【吉神宜趋】");
    lines.push(wrapItems(jiShen));

    lines.push("");
    lines.push("【凶煞宜忌】");
    lines.push(wrapItems(xiongSha));
  }

  // 节气
  if (modules.jieQi) {
    lines.push("");
    lines.push("【节气】");
    if (jieQi.current) {
      lines.push(`   当前节气：${jieQi.current}`);
    }
    if (jieQi.nextName) {
      lines.push(`   下一节气：${jieQi.nextName}（${jieQi.nextDate}）`);
    }
  }

  // 节日
  if (festivals.length > 0) {
    lines.push("");
    lines.push("【节日】");
    lines.push(`   ${festivals.join("  ")}`);
  }

  // 佛教节日/斋日
  if (modules.foto && (fotoFestivals.length > 0 || fotoZhai.length > 0)) {
    lines.push("");
    lines.push("【佛教节日/斋日】");
    const parts: string[] = [];
    if (fotoFestivals.length > 0) parts.push(fotoFestivals.join("  "));
    if (fotoZhai.length > 0) parts.push(fotoZhai.join("  "));
    lines.push(`   ${parts.join(" | ")}`);
  }

  // 道教节日
  if (modules.tao && taoFestivals.length > 0) {
    lines.push("");
    lines.push("【道教节日】");
    lines.push(`   ${taoFestivals.join("  ")}`);
  }

  // 星宿
  if (modules.xiu) {
    lines.push("");
    lines.push("【星宿】");
    lines.push(`   ${xiu.name}（${xiu.animal}）- ${xiu.gong}${xiu.shou} [${xiu.luck}]`);
    lines.push(`   值神：${tianShen}（${tianShenType} - ${tianShenLuck}）`);
    lines.push(`   建除：${zhiXing}`);
  }

  // 吉神方位
  if (modules.positions) {
    lines.push("");
    lines.push("【吉神方位】");
    lines.push(`   喜神：${positions.xi}    福神：${positions.fu}    财神：${positions.cai}`);
    lines.push(`   阳贵：${positions.yangGui}    阴贵：${positions.yinGui}`);
  }

  // 日禄
  lines.push("");
  lines.push("【日禄】");
  lines.push(`   ${dayLu}`);

  lines.push("");
  return lines.join("\n");
}
