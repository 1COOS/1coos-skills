/**
 * 核心数据提取模块
 * 从 lunar-typescript 提取完整的中国传统日历/黄历信息
 */

import { Solar } from "lunar-typescript";

export interface ModulesConfig {
  ganZhi: boolean;
  yiJi: boolean;
  chongSha: boolean;
  jieQi: boolean;
  holiday: boolean;
  foto: boolean;
  tao: boolean;
  xiu: boolean;
  jiShen: boolean;
  positions: boolean;
}

export const DEFAULT_MODULES: ModulesConfig = {
  ganZhi: true,
  yiJi: true,
  chongSha: true,
  jieQi: true,
  holiday: true,
  foto: true,
  tao: true,
  xiu: true,
  jiShen: true,
  positions: true,
};

export interface CalendarData {
  solar: {
    year: number;
    month: number;
    day: number;
    weekday: string;
  };
  lunar: {
    yearCn: string;
    monthCn: string;
    dayCn: string;
    yearInGanZhi: string;
  };
  ganZhi: {
    year: string;
    month: string;
    day: string;
  };
  naYin: {
    year: string;
    month: string;
    day: string;
  };
  shengXiao: string;
  xingZuo: string;
  season: string;
  liuYao: string;
  yueXiang: string;
  jieQi: {
    current: string | null;
    nextName: string;
    nextDate: string;
  };
  yi: string[];
  ji: string[];
  chongSha: {
    desc: string;
    shengXiao: string;
    sha: string;
  };
  pengZu: {
    gan: string;
    zhi: string;
  };
  taiShen: string;
  jiShen: string[];
  xiongSha: string[];
  festivals: string[];
  fotoFestivals: string[];
  fotoZhai: string[];
  taoFestivals: string[];
  xiu: {
    name: string;
    luck: string;
    animal: string;
    gong: string;
    shou: string;
  };
  tianShen: string;
  tianShenType: string;
  tianShenLuck: string;
  zhiXing: string;
  positions: {
    xi: string;
    fu: string;
    cai: string;
    yangGui: string;
    yinGui: string;
  };
  dayLu: string;
}

export function getCalendarData(solar: Solar, modules: ModulesConfig = DEFAULT_MODULES): CalendarData {
  const lunar = solar.getLunar();

  // 节气
  const currentJieQi = modules.jieQi ? lunar.getCurrentJieQi() : null;
  const nextJieQi = modules.jieQi ? lunar.getNextJieQi() : null;

  // 农历节日始终包含
  let festivals: string[] = [
    ...lunar.getFestivals(),
    ...lunar.getOtherFestivals(),
  ];

  // 公历节日（法定节假日模块）
  if (modules.holiday) {
    festivals = [
      ...solar.getFestivals(),
      ...solar.getOtherFestivals(),
      ...festivals,
    ];
  }

  // 佛教节日/斋日
  let fotoFestivals: string[] = [];
  let fotoZhai: string[] = [];
  if (modules.foto) {
    const foto = lunar.getFoto();
    fotoFestivals = foto.getFestivals().map((f) => f.getName());
    if (foto.isMonthZhai()) fotoZhai.push("月斋");
    if (foto.isDayZhaiGuanYin()) fotoZhai.push("观音斋");
    if (foto.isDayZhaiShuoWang()) fotoZhai.push("朔望斋");
    if (foto.isDayZhaiSix()) fotoZhai.push("六斋日");
    if (foto.isDayZhaiTen()) fotoZhai.push("十斋日");
  }

  // 道教节日
  let taoFestivals: string[] = [];
  if (modules.tao) {
    taoFestivals = lunar.getTao().getFestivals().map((f) => f.getName());
  }

  const empty3 = { year: "", month: "", day: "" };

  return {
    solar: {
      year: solar.getYear(),
      month: solar.getMonth(),
      day: solar.getDay(),
      weekday: solar.getWeekInChinese(),
    },
    lunar: {
      yearCn: lunar.getYearInChinese(),
      monthCn: lunar.getMonthInChinese(),
      dayCn: lunar.getDayInChinese(),
      yearInGanZhi: lunar.getYearInGanZhi(),
    },
    ganZhi: modules.ganZhi
      ? { year: lunar.getYearInGanZhi(), month: lunar.getMonthInGanZhi(), day: lunar.getDayInGanZhi() }
      : empty3,
    naYin: modules.ganZhi
      ? { year: lunar.getYearNaYin(), month: lunar.getMonthNaYin(), day: lunar.getDayNaYin() }
      : empty3,
    shengXiao: lunar.getYearShengXiao(),
    xingZuo: solar.getXingZuo(),
    season: lunar.getSeason(),
    liuYao: lunar.getLiuYao(),
    yueXiang: lunar.getYueXiang(),
    jieQi: {
      current: currentJieQi ? currentJieQi.getName() : null,
      nextName: nextJieQi ? nextJieQi.getName() : "",
      nextDate: nextJieQi ? nextJieQi.getSolar().toYmd() : "",
    },
    yi: modules.yiJi ? lunar.getDayYi() : [],
    ji: modules.yiJi ? lunar.getDayJi() : [],
    chongSha: modules.chongSha
      ? { desc: lunar.getDayChongDesc(), shengXiao: lunar.getDayChongShengXiao(), sha: lunar.getDaySha() }
      : { desc: "", shengXiao: "", sha: "" },
    pengZu: modules.yiJi
      ? { gan: lunar.getPengZuGan(), zhi: lunar.getPengZuZhi() }
      : { gan: "", zhi: "" },
    taiShen: modules.chongSha ? lunar.getDayPositionTai() : "",
    jiShen: modules.jiShen ? lunar.getDayJiShen() : [],
    xiongSha: modules.jiShen ? lunar.getDayXiongSha() : [],
    festivals,
    fotoFestivals,
    fotoZhai,
    taoFestivals,
    xiu: modules.xiu
      ? {
          name: lunar.getXiu(),
          luck: lunar.getXiuLuck(),
          animal: lunar.getAnimal(),
          gong: lunar.getGong(),
          shou: lunar.getShou(),
        }
      : { name: "", luck: "", animal: "", gong: "", shou: "" },
    tianShen: lunar.getDayTianShen(),
    tianShenType: lunar.getDayTianShenType(),
    tianShenLuck: lunar.getDayTianShenLuck(),
    zhiXing: lunar.getZhiXing(),
    positions: modules.positions
      ? {
          xi: lunar.getDayPositionXiDesc(),
          fu: lunar.getDayPositionFuDesc(),
          cai: lunar.getDayPositionCaiDesc(),
          yangGui: lunar.getDayPositionYangGuiDesc(),
          yinGui: lunar.getDayPositionYinGuiDesc(),
        }
      : { xi: "", fu: "", cai: "", yangGui: "", yinGui: "" },
    dayLu: lunar.getDayLu(),
  };
}
