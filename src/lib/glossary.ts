/**
 * Plain-language explanations of every metric surfaced in the UI.
 * Kept in one place so tooltips stay consistent between the screener,
 * filters and stock detail views.
 */
export const GLOSSARY = {
  price: "The current market price per share (typically delayed 15 minutes by the data provider).",

  avgTarget:
    "The average of all analysts' 12-month price targets. It is a collective opinion of fair value, not a promise, and is only as good as the analysts behind it.",

  targetLowHigh:
    "The lowest and highest individual analyst targets. The wider this range, the more the experts disagree — and the less reliable the average becomes.",

  upside:
    "How much the average analyst target sits above today's price: (target − price) ÷ price. Bigger means more potential room to rise, but analyst optimism is not guaranteed.",

  riskReward:
    "Reward divided by risk. Upside to the average target is the reward; downside to the lowest target is the risk. Above 1 means analysts see more upside than downside, below 1 the reverse.",

  dispersion:
    "How spread out analyst targets are (highest vs lowest) relative to the average. Under ~40% means analysts mostly agree; higher means they disagree and the consensus is shakier.",

  analysts:
    "How many Wall Street analysts cover the stock and feed into the consensus. More coverage usually makes the average target more meaningful; very low coverage means one opinion can swing it.",

  consensus:
    "The average analyst recommendation — Strong Buy through Strong Sell — built from each analyst's individual buy/hold/sell rating.",

  momentum:
    "The net direction of analyst activity over roughly 90 days. Target raises add points and cuts subtract (a 5% raise ≈ +1). Positive means analysts are turning more bullish.",

  targetMomentumPct:
    "The average percentage change in analysts' price targets over the last 90 days. Positive means targets are being raised; negative means they are being cut.",

  consensusTrend:
    "How the average analyst target has moved recently, using snapshots this app has stored over time. Rising means targets are trending up — but it needs several scans before it appears.",

  score:
    "A 0–100 summary blending five things: upside (40%), consensus rating (18%), analyst momentum (18%), analyst coverage (12%) and target agreement (12%). It ranks ideas to investigate — it is not a buy signal or advice.",

  marketCap:
    "The total value of the company's shares (share price × shares outstanding). Large caps are generally steadier; smaller caps can swing harder in both directions.",

  newsSentiment:
    "The tone of recent headlines — bearish, neutral or bullish — scored by the data provider. A quick read on the current narrative, but noisy and short-lived.",

  trailingPE:
    "Price-to-earnings on the last 12 months of actual profit: how many dollars you pay for each $1 of annual earnings. A high number can mean expected growth or simply an expensive stock.",

  forwardPE:
    "Price-to-earnings on forecast next-year profit. When it is lower than the trailing P/E, analysts expect earnings to grow.",

  eps: "Earnings per share — company profit divided by the number of shares. Higher, growing EPS is generally a healthier sign.",

  earningsGrowth:
    "How much profit has grown versus a year ago. Positive means growing earnings; negative means profit is shrinking.",

  revenueGrowth:
    "How much sales have grown versus a year ago. Positive means the business is expanding its top line.",

  volume: "The number of shares traded today. Heavy volume signals strong interest and easier trading.",

  avgVolume:
    "The typical number of shares traded per day. Lower volume can make it harder to buy or sell without moving the price.",

  industry: "The specific sub-industry the company operates in, which sits within its broader sector.",

  // --- Fundamentals factors ---
  valueFactor:
    "Valuation score (0–100): higher means cheaper on metrics like P/E, price-to-book, PEG, EV/EBITDA, free-cash-flow yield and dividend yield. High is not automatically good — very cheap stocks are often cheap for a reason.",

  qualityFactor:
    "Profitability score (0–100): return on equity and assets plus gross, operating and net margins. Higher means a more profitable, capital-efficient business.",

  growthFactor:
    "Growth score (0–100): revenue, earnings and EPS growth. Higher means the business is expanding quickly; negative growth pulls the score down.",

  healthFactor:
    "Balance-sheet score (0–100): debt relative to equity, current ratio, net-debt/EBITDA, interest cover and positive free cash flow. Higher means a sturdier balance sheet and less financial risk.",

  priceToBook:
    "Share price divided by book value (net assets per share). A low number may mean the market values the company below its accounting net worth — or that the business is struggling.",

  priceToSales:
    "Market value divided by annual revenue. Useful for comparing companies that are not yet profitable; lower can mean cheaper.",

  pegRatio:
    "P/E divided by the earnings growth rate. Roughly, under 1 is often considered cheap relative to growth; above 2 expensive. It is a rule of thumb, not a verdict.",

  evEbitda:
    "Enterprise value (market value plus debt) divided by EBITDA (profit before interest, tax and accounting charges). A common cross-company valuation measure; lower is usually cheaper.",

  fcfYield:
    "Free cash flow divided by market cap. How much real cash the business generates per dollar of stock value — higher means more cash return potential.",

  returnOnEquity:
    "Profit as a percentage of shareholders' equity — how efficiently the company turns investors' money into profit. Higher is generally better.",

  returnOnAssets:
    "Profit as a percentage of total assets — how efficiently the company uses everything it owns to generate profit.",

  grossMargin:
    "Revenue left after the direct cost of producing goods or services, as a percentage. Higher margins suggest pricing power.",

  operatingMargin:
    "Operating profit (before interest and tax) as a percentage of revenue — how much the core business earns per dollar of sales.",

  netMargin:
    "Net profit as a percentage of revenue — the bottom line: what the company actually keeps per dollar of sales.",

  debtToEquity:
    "Total debt divided by shareholders' equity. Lower means less reliance on borrowing and generally less risk, though some debt can be healthy.",

  currentRatio:
    "Current assets divided by current liabilities — the ability to pay near-term bills. Above 1 means it covers short-term obligations; around 1.5–2 is usually comfortable.",

  netDebtToEbitda:
    "Net debt divided by EBITDA — roughly how many years of profit it would take to repay debt. Lower is safer; above ~3–4 is highly leveraged.",

  interestCoverage:
    "How many times operating profit covers interest payments. Higher means more cushion to keep paying creditors if profit falls.",

  freeCashFlow:
    "Cash left after running the business and funding capital spending — the money available for dividends, buybacks or debt repayment. Positive is good.",
} as const;

export type GlossaryKey = keyof typeof GLOSSARY;
