/**
 * Finance analysis module definitions for the 金融量化 workbench.
 *
 * Each module maps to a set of KSkills packages that are prioritized when the
 * user works within that module. All 29 finance skills are loaded under the
 * finance work mode regardless of module; these groupings help the UI present
 * focused entry points and guide the agent toward the relevant skills.
 */

export interface FinanceModule {
  /** URL-safe identifier used in the route /workspace/finance/[moduleId] */
  id: string;
  /** Display name shown on the module card and workbench header */
  name: string;
  /** Short description shown on the module card */
  description: string;
  /** Lucide icon name for rendering */
  icon: FinanceModuleIcon;
  /** Skill package IDs that this module prioritizes */
  skillIds: string[];
  /** Placeholder text for the input box when the module is active */
  promptHint: string;
  /** Example prompts to help the user get started */
  examples: string[];
}

export type FinanceModuleIcon =
  | "trending-up"
  | "candlestick-chart"
  | "layers"
  | "arrow-left-right"
  | "line-chart"
  | "building-2"
  | "filter"
  | "sigma"
  | "flask-conical";

export const FINANCE_MODULES: readonly FinanceModule[] = [
  {
    id: "market-analysis",
    name: "市场分析",
    description: "市场联动、宏观指标、财经资讯",
    icon: "trending-up",
    skillIds: [
      "kk-market-linkage-engine",
      "news-search",
      "kk-macro-query",
      "kk-zhishu-query",
    ],
    promptHint: "输入关注的指数、板块或宏观指标，如「上证指数 资金流向」",
    examples: [
      "今日北向资金流向和市场情绪",
      "近期CPI、PPI数据对市场的影响",
      "沪深300指数近期走势分析",
    ],
  },
  {
    id: "futures-analysis",
    name: "股指期货分析",
    description: "股指期货、商品期货数据与基差",
    icon: "candlestick-chart",
    skillIds: ["kk-futures-analysis", "kk-hithink-futures"],
    promptHint: "输入期货合约或品种代码，如「IF2509 持仓分析」",
    examples: [
      "IF主力合约基差与持仓分析",
      "螺纹钢期货近期行情",
      "股指期货跨期套利机会",
    ],
  },
  {
    id: "options-etf",
    name: "期权ETF分析",
    description: "期权希腊字母、波动率、ETF分析",
    icon: "layers",
    skillIds: [
      "kk-options-payoff",
      "kk-options-volatility",
      "kk-etf-analysis",
    ],
    promptHint: "输入期权合约或ETF代码，如「50ETF 期权波动率」",
    examples: [
      "50ETF期权隐含波动率分析",
      "沪深300ETF多维分析",
      "上证50期权Greeks计算",
    ],
  },
  {
    id: "convertible-bond",
    name: "可转债全景分析",
    description: "可转债筛选、定价、条款分析",
    icon: "arrow-left-right",
    skillIds: ["kk-cb-analysis"],
    promptHint: "输入可转债代码或名称，如「123125 搜特转债」",
    examples: [
      "低溢价率可转债筛选",
      "某可转债的债底、期权价值和回售分析",
      "可转债强赎风险排查",
    ],
  },
  {
    id: "stock-analysis",
    name: "个股分析",
    description: "个股多维度深度分析：财务、估值、技术、筹码",
    icon: "line-chart",
    skillIds: [
      "kk-stock-analysis",
      "kk-financial-statement",
      "kk-valuation-model",
      "kk-business-query",
      "kk-event-query",
      "kk-earnings-forecast",
      "kk-earnings-revision",
      "kk-mcf",
      "kk-report-search",
      "kk-announcement-search",
    ],
    promptHint: "输入股票代码或名称，如「600519 贵州茅台」",
    examples: [
      "贵州茅台(600519)全面分析",
      "腾讯控股财务三表与ROE趋势",
      "某公司估值PE历史分位",
    ],
  },
  {
    id: "industry-analysis",
    name: "行业分析",
    description: "A股行业六维分析与竞争格局",
    icon: "building-2",
    skillIds: ["kk-industry-analysis"],
    promptHint: "输入行业名称或板块关键词，如「半导体 行业分析」",
    examples: [
      "半导体行业竞争格局分析",
      "新能源汽车产业链全景",
      "白酒行业景气度追踪",
    ],
  },
  {
    id: "stock-screening",
    name: "量化选股",
    description: "多策略选股与条件筛选",
    icon: "filter",
    skillIds: ["a-stock-screener", "kk-selection-strategies"],
    promptHint: "描述选股策略或条件，如「低PE高ROE 大市值」",
    examples: [
      "价值投资策略选股：PE<15, ROE>20%",
      "高股息策略筛选：股息率>5%",
      "动量突破策略选股",
    ],
  },
  {
    id: "factor-research",
    name: "因子挖掘",
    description: "因子IC/IR分析、分层回测、多因子",
    icon: "sigma",
    skillIds: ["kk-factor-research"],
    promptHint: "描述因子研究方向，如「动量因子 分层回测」",
    examples: [
      "动量因子的IC和分层回测",
      "估值因子的多因子合成",
      "质量因子与市场收益相关性",
    ],
  },
  {
    id: "strategy-research",
    name: "策略研究及回测",
    description: "策略设计、编码、回测与评估",
    icon: "flask-conical",
    skillIds: ["kk-strategy-research", "backtrader_strategies"],
    promptHint: "描述策略思路，如「双均线策略 回测」",
    examples: [
      "双均线交叉策略回测",
      "均值回归策略设计与评估",
      "基于backtrader的海龟交易策略",
    ],
  },
];

/** Shared utility skills available across all finance modules. */
export const FINANCE_SHARED_SKILL_IDS = [
  "kk-common",
  "analysis-report",
  "chart-visualization",
  "md-to-html-converter",
] as const;

export function getFinanceModule(
  moduleId: string,
): FinanceModule | undefined {
  return FINANCE_MODULES.find((m) => m.id === moduleId);
}
