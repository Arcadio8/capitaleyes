from __future__ import annotations

import json
import math
import os
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any


BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
DEFAULT_PORT = 8000
DEFAULT_HOST = "127.0.0.1"
CLOUD_HOST = "0.0.0.0"
PAGE_ROUTES = {
    "/platform": "/platform.html",
    "/backtest": "/backtest.html",
    "/portfolio-tracker": "/portfolio-tracker.html",
    "/cycle-life-budgeting": "/cycle-life-budgeting.html",
    "/e-learning": "/e-learning.html",
}

DATA_CACHE: dict[str, tuple[float, "MarketHistory"]] = {}
SEARCH_CACHE: dict[str, tuple[float, list[dict[str, Any]]]] = {}
CACHE_TTL_SECONDS = 60 * 15
SUPPORTED_BASE_CURRENCIES = {"EUR", "USD", "GBP", "CHF", "JPY", "CAD", "AUD"}


class ApiError(Exception):
    def __init__(self, message: str, status: HTTPStatus = HTTPStatus.BAD_REQUEST):
        super().__init__(message)
        self.message = message
        self.status = status


@dataclass(frozen=True)
class AssetAllocation:
    symbol: str
    weight: float


@dataclass(frozen=True)
class PortfolioParams:
    assets: list[AssetAllocation]
    start: date
    end: date
    initial: float
    contribution: float
    contribution_frequency: str
    investment_mode: str
    rebalance: str
    fee_pct: float
    benchmark: str | None
    base_currency: str


@dataclass(frozen=True)
class MarketHistory:
    symbol: str
    rows: list[dict[str, Any]]
    currency: str
    exchange: str
    instrument_type: str
    short_name: str


def parse_date(value: str, field: str) -> date:
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError as exc:
        raise ApiError(f"Formato data non valido per {field}. Usa YYYY-MM-DD.") from exc


def clean_symbol(value: str) -> str:
    symbol = value.strip().upper()
    if not symbol:
        raise ApiError("Inserisci almeno un ticker.")
    if len(symbol) > 18:
        raise ApiError(f"Ticker troppo lungo: {symbol}.")
    if not all(ch.isalnum() or ch in ".-^=" for ch in symbol):
        raise ApiError(f"Ticker non valido: {symbol}.")
    return symbol


def parse_float_list(raw: str, field: str) -> list[float]:
    values: list[float] = []
    for item in raw.split(","):
        item = item.strip()
        if not item:
            continue
        try:
            values.append(float(item))
        except ValueError as exc:
            raise ApiError(f"Valore numerico non valido in {field}: {item}.") from exc
    return values


def parse_params(query: dict[str, list[str]]) -> PortfolioParams:
    raw_symbols = query.get("symbols", query.get("symbol", [""]))[0]
    symbols = [clean_symbol(item) for item in raw_symbols.split(",") if item.strip()]
    if not symbols:
        raise ApiError("Inserisci almeno un asset.")
    if len(symbols) > 12:
        raise ApiError("Usa al massimo 12 asset per questo backtest.")
    if len(set(symbols)) != len(symbols):
        raise ApiError("Rimuovi i ticker duplicati dal portafoglio.")

    weights = parse_float_list(query.get("weights", [""])[0], "weights")
    if len(weights) != len(symbols):
        raise ApiError("Il numero dei pesi deve corrispondere al numero degli asset.")
    if any(weight <= 0 for weight in weights):
        raise ApiError("Ogni peso deve essere maggiore di zero.")
    total_weight = sum(weights)
    if abs(total_weight - 100) > 0.05:
        raise ApiError("La somma dei pesi deve essere 100%.")

    today = date.today()
    start = parse_date(query.get("start", ["2021-01-01"])[0], "start")
    end = parse_date(query.get("end", [today.isoformat()])[0], "end")
    if end > today:
        end = today
    if start >= end:
        raise ApiError("La data iniziale deve precedere la data finale.")
    if (end - start).days < 80:
        raise ApiError("Usa almeno 80 giorni di storico.")

    try:
        initial = float(query.get("initial", ["10000"])[0])
        contribution = float(query.get("contribution", ["0"])[0])
        fee_pct = float(query.get("fee", ["0"])[0]) / 100.0
    except ValueError as exc:
        raise ApiError("Capitale, PAC o commissione non validi.") from exc
    if initial < 0:
        raise ApiError("Il capitale iniziale non puo essere negativo.")
    if contribution < 0:
        raise ApiError("Il versamento PAC non puo essere negativo.")
    if not 0 <= fee_pct <= 0.05:
        raise ApiError("La commissione deve essere tra 0% e 5%.")

    investment_mode = query.get("mode", ["pic"])[0].strip().lower()
    if investment_mode not in {"pic", "pac"}:
        raise ApiError("Modalita investimento non valida.")
    if investment_mode == "pic" and initial <= 0:
        raise ApiError("Per il PIC inserisci un capitale iniziale maggiore di zero.")
    if investment_mode == "pac" and initial <= 0 and contribution <= 0:
        raise ApiError("Per il PAC inserisci capitale iniziale o versamento periodico.")

    contribution_frequency = query.get("contributionFrequency", ["monthly"])[0].strip().lower()
    if contribution_frequency not in {"monthly", "quarterly", "yearly"}:
        raise ApiError("Frequenza PAC non valida.")

    rebalance = query.get("rebalance", ["monthly"])[0].strip().lower()
    if rebalance not in {"none", "monthly", "quarterly", "yearly"}:
        raise ApiError("Metodo di ribilanciamento non valido.")

    raw_benchmark = query.get("benchmark", ["SPY"])[0].strip()
    benchmark = None if raw_benchmark.lower() in {"", "none", "nessuno", "no"} else clean_symbol(raw_benchmark)
    base_currency = query.get("currency", query.get("baseCurrency", ["EUR"]))[0].strip().upper()
    if base_currency not in SUPPORTED_BASE_CURRENCIES:
        supported = ", ".join(sorted(SUPPORTED_BASE_CURRENCIES))
        raise ApiError(f"Valuta investimento non supportata. Usa una tra: {supported}.")
    normalized = [AssetAllocation(symbol, weight / 100.0) for symbol, weight in zip(symbols, weights)]
    return PortfolioParams(
        assets=normalized,
        start=start,
        end=end,
        initial=initial,
        contribution=contribution,
        contribution_frequency=contribution_frequency,
        investment_mode=investment_mode,
        rebalance=rebalance,
        fee_pct=fee_pct,
        benchmark=benchmark,
        base_currency=base_currency,
    )


def market_period(value: date) -> int:
    return int(datetime(value.year, value.month, value.day, tzinfo=timezone.utc).timestamp())


def safe_float(values: list[Any], index: int) -> float | None:
    if index >= len(values):
        return None
    value = values[index]
    if value is None:
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(number) or math.isinf(number):
        return None
    return number


def fetch_market_search(query: str) -> list[dict[str, Any]]:
    needle = query.strip()
    if len(needle) < 1:
        return []
    cache_key = needle.lower()
    cached = SEARCH_CACHE.get(cache_key)
    now = time.time()
    if cached and now - cached[0] < CACHE_TTL_SECONDS:
        return cached[1]

    params = urllib.parse.urlencode({"q": needle, "quotesCount": 8, "newsCount": 0})
    search_host = "query2.finance." + "ya" + "hoo.com"
    url = f"https://{search_host}/v1/finance/search?{params}"
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "CapitalEyes/2.1 (+local portfolio backtesting app)",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=12) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except Exception as exc:  # noqa: BLE001
        raise ApiError("Il provider dati non ha risposto alla ricerca.", HTTPStatus.BAD_GATEWAY) from exc

    quotes = []
    for quote in payload.get("quotes", []):
        symbol = quote.get("symbol")
        if not symbol:
            continue
        quotes.append(
            {
                "symbol": symbol,
                "name": quote.get("shortname") or quote.get("longname") or symbol,
                "exchange": quote.get("exchDisp") or quote.get("exchange") or "",
                "type": quote.get("quoteType") or "",
                "currency": quote.get("currency") or "",
            }
        )
    SEARCH_CACHE[cache_key] = (now, quotes)
    return quotes


def fetch_market_history(symbol: str, start: date, end: date) -> MarketHistory:
    cache_key = f"{symbol}:{start.isoformat()}:{end.isoformat()}"
    cached = DATA_CACHE.get(cache_key)
    now = time.time()
    if cached and now - cached[0] < CACHE_TTL_SECONDS:
        return cached[1]

    params = urllib.parse.urlencode(
        {
            "period1": market_period(start),
            "period2": market_period(end + timedelta(days=1)),
            "interval": "1d",
            "events": "history",
            "includeAdjustedClose": "true",
        }
    )
    chart_host = "query1.finance." + "ya" + "hoo.com"
    url = f"https://{chart_host}/v8/finance/chart/{urllib.parse.quote(symbol)}?{params}"
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "CapitalEyes/2.1 (+local portfolio backtesting app)",
            "Accept": "application/json",
        },
    )

    try:
        with urllib.request.urlopen(request, timeout=18) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except Exception as exc:  # noqa: BLE001
        raise ApiError(f"Il provider dati non ha risposto per {symbol}.", HTTPStatus.BAD_GATEWAY) from exc

    chart = payload.get("chart", {})
    error = chart.get("error")
    if error:
        raise ApiError(error.get("description") or f"Ticker non disponibile: {symbol}.")

    results = chart.get("result") or []
    if not results:
        raise ApiError(f"Nessun dato trovato per {symbol}.")

    result = results[0]
    meta = result.get("meta") or {}
    timestamps = result.get("timestamp") or []
    indicators = result.get("indicators", {})
    quote = (indicators.get("quote") or [{}])[0]
    adj_close = (indicators.get("adjclose") or [{}])[0].get("adjclose") or []
    close_values = quote.get("close") or []
    volume_values = quote.get("volume") or []

    rows: list[dict[str, Any]] = []
    for index, ts in enumerate(timestamps):
        close = safe_float(close_values, index)
        adjusted = safe_float(adj_close, index) if adj_close else close
        if adjusted is None or adjusted <= 0:
            continue
        rows.append(
            {
                "date": datetime.fromtimestamp(ts, tz=timezone.utc).date().isoformat(),
                "close": close or adjusted,
                "adjClose": adjusted,
                "volume": safe_float(volume_values, index),
            }
        )

    if len(rows) < 60:
        raise ApiError(f"Lo storico disponibile per {symbol} e troppo corto.")

    history = MarketHistory(
        symbol=symbol,
        rows=rows,
        currency=str(meta.get("currency") or "USD"),
        exchange=str(meta.get("fullExchangeName") or meta.get("exchangeName") or "Market Data"),
        instrument_type=str(meta.get("instrumentType") or "ASSET"),
        short_name=str(meta.get("shortName") or meta.get("symbol") or symbol),
    )
    DATA_CACHE[cache_key] = (now, history)
    return history


def pct_change(current: float, previous: float) -> float:
    if previous == 0:
        return 0.0
    return (current / previous) - 1.0


def max_drawdown(values: list[float]) -> tuple[float, list[float]]:
    peak = values[0]
    worst = 0.0
    curve: list[float] = []
    for value in values:
        peak = max(peak, value)
        drawdown = (value / peak) - 1.0 if peak else 0.0
        curve.append(drawdown)
        worst = min(worst, drawdown)
    return worst, curve


def annualized_volatility(returns: list[float]) -> float:
    if len(returns) < 2:
        return 0.0
    mean = sum(returns) / len(returns)
    variance = sum((value - mean) ** 2 for value in returns) / (len(returns) - 1)
    return math.sqrt(variance) * math.sqrt(252)


def annualized_downside_deviation(returns: list[float]) -> float:
    if len(returns) < 2:
        return 0.0
    downside = [min(value, 0.0) for value in returns]
    variance = sum(value**2 for value in downside) / (len(returns) - 1)
    return math.sqrt(variance) * math.sqrt(252)


def annualized_money_weighted_return(dates: list[str], cashflows: list[float], final_value: float) -> float | None:
    flows: list[tuple[date, float]] = []
    for day, cashflow in zip(dates, cashflows):
        if cashflow > 0:
            flows.append((datetime.strptime(day, "%Y-%m-%d").date(), -cashflow))
    if not flows or final_value <= 0:
        return None
    flows.append((datetime.strptime(dates[-1], "%Y-%m-%d").date(), final_value))
    if not any(value < 0 for _, value in flows) or not any(value > 0 for _, value in flows):
        return None

    origin = flows[0][0]

    def npv(rate: float) -> float:
        total = 0.0
        for flow_date, value in flows:
            years = max((flow_date - origin).days / 365.25, 0.0)
            total += value / ((1 + rate) ** years)
        return total

    low = -0.9999
    high = 10.0
    low_value = npv(low)
    high_value = npv(high)
    while low_value * high_value > 0 and high < 1000:
        high *= 2
        high_value = npv(high)
    if low_value * high_value > 0:
        return None

    for _ in range(100):
        mid = (low + high) / 2
        mid_value = npv(mid)
        if abs(mid_value) < 0.0001:
            return mid
        if low_value * mid_value <= 0:
            high = mid
            high_value = mid_value
        else:
            low = mid
            low_value = mid_value
    return (low + high) / 2


def period_summaries(
    dates: list[str],
    daily_returns: list[float],
    equity_values: list[float],
    invested_values: list[float],
    cashflows: list[float],
    period: str,
) -> list[dict[str, Any]]:
    buckets: dict[str, dict[str, float | str]] = {}
    for index, day in enumerate(dates):
        key = day[:4] if period == "yearly" else day[:7]
        bucket = buckets.setdefault(
            key,
            {
                "period": key,
                "factor": 1.0,
                "cashflow": 0.0,
                "endValue": 0.0,
                "investedCapital": 0.0,
            },
        )
        if index > 0:
            bucket["factor"] = float(bucket["factor"]) * (1 + daily_returns[index])
        bucket["cashflow"] = float(bucket["cashflow"]) + cashflows[index]
        bucket["endValue"] = equity_values[index]
        bucket["investedCapital"] = invested_values[index]

    return [
        {
            "period": key,
            "returnPct": round((float(bucket["factor"]) - 1) * 100, 2),
            "cashflow": round(float(bucket["cashflow"]), 2),
            "endValue": round(float(bucket["endValue"]), 2),
            "investedCapital": round(float(bucket["investedCapital"]), 2),
        }
        for key, bucket in sorted(buckets.items())
    ]


def rolling_annualized_volatility(returns: list[float], window: int = 63) -> list[float]:
    values: list[float] = []
    for index in range(len(returns)):
        start = max(1, index - window + 1)
        sample = returns[start : index + 1]
        values.append(annualized_volatility(sample) if len(sample) >= 2 else 0.0)
    return values


def daily_price_returns(dates: list[str], prices: dict[str, float]) -> list[float]:
    returns: list[float] = []
    for index in range(1, len(dates)):
        returns.append(pct_change(prices[dates[index]], prices[dates[index - 1]]))
    return returns


def pearson_correlation(left: list[float], right: list[float]) -> float:
    count = min(len(left), len(right))
    if count < 2:
        return 0.0
    a = left[:count]
    b = right[:count]
    mean_a = sum(a) / count
    mean_b = sum(b) / count
    numerator = sum((x - mean_a) * (y - mean_b) for x, y in zip(a, b))
    variance_a = sum((x - mean_a) ** 2 for x in a)
    variance_b = sum((y - mean_b) ** 2 for y in b)
    denominator = math.sqrt(variance_a * variance_b)
    return numerator / denominator if denominator else 0.0


def correlation_payload(symbols: list[str], returns_by_symbol: dict[str, list[float]]) -> dict[str, Any]:
    matrix: list[list[float]] = []
    for left in symbols:
        row = []
        for right in symbols:
            value = 1.0 if left == right else pearson_correlation(returns_by_symbol[left], returns_by_symbol[right])
            row.append(round(value, 3))
        matrix.append(row)
    return {"symbols": symbols, "matrix": matrix}


def safe_metric(value: float | None, digits: int = 2) -> float | None:
    if value is None or math.isnan(value) or math.isinf(value):
        return None
    return round(value, digits)


def period_changed(method: str, previous_date: date, current_date: date) -> bool:
    if method == "none":
        return False
    if method == "monthly":
        return previous_date.month != current_date.month or previous_date.year != current_date.year
    if method == "quarterly":
        previous_quarter = (previous_date.month - 1) // 3
        current_quarter = (current_date.month - 1) // 3
        return previous_quarter != current_quarter or previous_date.year != current_date.year
    if method == "yearly":
        return previous_date.year != current_date.year
    return False


def align_histories(histories: list[MarketHistory]) -> list[str]:
    common: set[str] | None = None
    for history in histories:
        dates = {row["date"] for row in history.rows}
        common = dates if common is None else common & dates
    dates = sorted(common or set())
    if len(dates) < 60:
        raise ApiError("Gli asset selezionati non hanno abbastanza date comuni.")
    return dates


def price_maps(histories: list[MarketHistory]) -> dict[str, dict[str, float]]:
    return {
        history.symbol: {row["date"]: float(row["adjClose"]) * currency_unit_scale(history.currency) for row in history.rows}
        for history in histories
    }


def normalized_currency_code(value: str) -> str:
    raw = (value or "USD").strip()
    if raw in {"GBp", "GBX"}:
        return "GBP"
    return raw.upper()


def currency_unit_scale(value: str) -> float:
    raw = (value or "").strip()
    if raw in {"GBp", "GBX"}:
        return 0.01
    return 1.0


def filled_price_series(rows: list[dict[str, Any]], dates: list[str], invert: bool = False) -> dict[str, float]:
    sorted_rows = sorted(rows, key=lambda row: row["date"])
    if not sorted_rows:
        raise ApiError("Serie dati vuota.")
    series: dict[str, float] = {}
    index = 0
    last_value: float | None = None
    for day in dates:
        while index < len(sorted_rows) and sorted_rows[index]["date"] <= day:
            last_value = float(sorted_rows[index]["adjClose"])
            index += 1
        if last_value is None:
            future = next((row for row in sorted_rows if row["date"] >= day), None)
            if future is None:
                raise ApiError(f"Nessun dato FX disponibile per {day}.")
            last_value = float(future["adjClose"])
        if last_value <= 0:
            raise ApiError(f"Dato FX non valido per {day}.")
        series[day] = (1 / last_value) if invert else last_value
    return series


def fetch_fx_conversion(
    from_currency: str,
    to_currency: str,
    dates: list[str],
    start: date,
    end: date,
) -> tuple[dict[str, float], dict[str, Any] | None]:
    source = normalized_currency_code(from_currency)
    target = normalized_currency_code(to_currency)
    if source == target:
        return {day: 1.0 for day in dates}, None

    lookup_start = start - timedelta(days=14)
    attempts = [(f"{source}{target}=X", False), (f"{target}{source}=X", True)]
    last_error: ApiError | None = None
    for symbol, invert in attempts:
        try:
            history = fetch_market_history(symbol, lookup_start, end)
            rates = filled_price_series(history.rows, dates, invert)
            return rates, {"from": source, "to": target, "symbol": symbol, "inverted": invert}
        except ApiError as exc:
            last_error = exc
    raise ApiError(f"Conversione FX non disponibile da {source} a {target}.") from last_error


def converted_price_maps(
    histories: list[MarketHistory],
    dates: list[str],
    base_currency: str,
    start: date,
    end: date,
) -> tuple[dict[str, dict[str, float]], dict[str, dict[str, float]], list[dict[str, Any]]]:
    local_maps = price_maps(histories)
    converted: dict[str, dict[str, float]] = {}
    fx_details: list[dict[str, Any]] = []
    rates_by_currency: dict[str, dict[str, float]] = {}
    for history in histories:
        currency = normalized_currency_code(history.currency)
        if currency not in rates_by_currency:
            rates, detail = fetch_fx_conversion(currency, base_currency, dates, start, end)
            rates_by_currency[currency] = rates
            if detail:
                fx_details.append(detail)
        converted[history.symbol] = {
            day: local_maps[history.symbol][day] * rates_by_currency[currency][day]
            for day in dates
            if day in local_maps[history.symbol]
        }
    return converted, local_maps, fx_details


def converted_benchmark_prices(
    benchmark: MarketHistory,
    base_currency: str,
    start: date,
    end: date,
) -> tuple[dict[str, float], list[dict[str, Any]]]:
    local_map = price_maps([benchmark])[benchmark.symbol]
    dates = sorted(local_map)
    rates, detail = fetch_fx_conversion(normalized_currency_code(benchmark.currency), base_currency, dates, start, end)
    converted = {day: local_map[day] * rates[day] for day in dates}
    return converted, [detail] if detail else []


def holdings_value(shares: list[float], prices: list[float]) -> float:
    return sum(share * price for share, price in zip(shares, prices))


def invest_cash_to_target(
    shares: list[float],
    cash: float,
    prices: list[float],
    weights: list[float],
    fee_pct: float,
) -> tuple[float, float]:
    if cash <= 0:
        return cash, 0.0
    investable = cash / (1 + fee_pct)
    fee = investable * fee_pct
    for index, weight in enumerate(weights):
        shares[index] += (investable * weight) / prices[index]
    return 0.0, fee


def rebalance_to_target(
    shares: list[float],
    cash: float,
    prices: list[float],
    weights: list[float],
    fee_pct: float,
) -> tuple[float, float, float]:
    gross_value = cash + holdings_value(shares, prices)
    if gross_value <= 0:
        return cash, 0.0, 0.0
    current_values = [share * price for share, price in zip(shares, prices)]
    current_weights = [value / gross_value for value in current_values]
    turnover = 0.5 * sum(abs(target - current) for target, current in zip(weights, current_weights))
    fee = gross_value * turnover * fee_pct
    net_value = max(gross_value - fee, 0)
    for index, weight in enumerate(weights):
        shares[index] = (net_value * weight) / prices[index]
    return 0.0, fee, turnover


def build_benchmark_curve(
    prices: dict[str, float],
    dates: list[str],
    cashflows: list[float],
    fee_pct: float,
) -> list[float]:
    shares = 0.0
    cash = 0.0
    last_price: float | None = None
    curve: list[float] = []
    for index, day in enumerate(dates):
        if day in prices:
            last_price = prices[day]
        if last_price is None:
            curve.append(cash)
            continue
        cash += cashflows[index]
        if cash > 0:
            investable = cash / (1 + fee_pct)
            shares += investable / last_price
            cash = 0.0
        curve.append(cash + shares * last_price)
    return curve


def aligned_price_values(prices: dict[str, float], dates: list[str]) -> list[float]:
    items = sorted(prices.items())
    if not items:
        raise ApiError("Serie benchmark vuota.")
    values: list[float] = []
    index = 0
    last_price: float | None = None
    for day in dates:
        while index < len(items) and items[index][0] <= day:
            last_price = items[index][1]
            index += 1
        if last_price is None:
            future = next((price for price_day, price in items if price_day >= day), None)
            if future is None:
                raise ApiError(f"Nessun dato benchmark disponibile per {day}.")
            last_price = future
        values.append(last_price)
    return values


def build_benchmark_twr_curve(prices: dict[str, float], dates: list[str], baseline: float) -> tuple[list[float], list[float]]:
    values = aligned_price_values(prices, dates)
    start_price = values[0]
    if start_price <= 0:
        raise ApiError("Prezzo benchmark iniziale non valido.")
    index_curve = [value / start_price for value in values]
    value_curve = [baseline * index_value for index_value in index_curve]
    return value_curve, index_curve


def build_portfolio_backtest(params: PortfolioParams) -> dict[str, Any]:
    histories = [fetch_market_history(asset.symbol, params.start, params.end) for asset in params.assets]
    benchmark_history = fetch_market_history(params.benchmark, params.start, params.end) if params.benchmark else None
    dates = align_histories(histories)
    maps, local_maps, fx_details = converted_price_maps(histories, dates, params.base_currency, params.start, params.end)
    benchmark_prices: dict[str, float] | None = None
    benchmark_fx_details: list[dict[str, Any]] = []
    if benchmark_history:
        benchmark_prices, benchmark_fx_details = converted_benchmark_prices(
            benchmark_history,
            params.base_currency,
            params.start,
            params.end,
        )
    fx_details_by_key = {
        (detail["from"], detail["to"], detail["symbol"]): detail
        for detail in [*fx_details, *benchmark_fx_details]
        if detail
    }
    fx_details = list(fx_details_by_key.values())
    weights = [asset.weight for asset in params.assets]
    shares = [0.0 for _ in params.assets]
    cash = 0.0
    fees_paid = 0.0
    invested_capital = 0.0
    twr_index = 1.0
    equity_values: list[float] = []
    invested_values: list[float] = []
    daily_returns: list[float] = []
    cashflows: list[float] = []
    events: list[dict[str, Any]] = []

    for index, day in enumerate(dates):
        prices = [maps[asset.symbol][day] for asset in params.assets]
        current_date = datetime.strptime(day, "%Y-%m-%d").date()
        previous_date = datetime.strptime(dates[index - 1], "%Y-%m-%d").date() if index > 0 else current_date
        previous_equity = equity_values[-1] if equity_values else 0.0
        contribution = 0.0
        initial_cashflow = 0.0
        pac_cashflow = 0.0

        if index == 0:
            if params.initial > 0:
                initial_cashflow = params.initial
            if params.investment_mode == "pac" and params.contribution > 0:
                pac_cashflow = params.contribution
        elif (
            params.investment_mode == "pac"
            and params.contribution > 0
            and period_changed(params.contribution_frequency, previous_date, current_date)
        ):
            pac_cashflow = params.contribution

        contribution += initial_cashflow + pac_cashflow

        if contribution > 0:
            cash += contribution
            invested_capital += contribution
            cash, fee = invest_cash_to_target(shares, cash, prices, weights, params.fee_pct)
            fees_paid += fee
            event_type = "START+PAC" if initial_cashflow > 0 and pac_cashflow > 0 else "PAC" if pac_cashflow > 0 else "START"
            events.append(
                {
                    "date": day,
                    "type": event_type,
                    "cashflow": round(contribution, 2),
                    "initialCashflow": round(initial_cashflow, 2),
                    "pacCashflow": round(pac_cashflow, 2),
                    "fee": round(fee, 2),
                }
            )

        if index > 0 and period_changed(params.rebalance, previous_date, current_date):
            cash, fee, turnover = rebalance_to_target(shares, cash, prices, weights, params.fee_pct)
            fees_paid += fee
            if turnover > 0:
                events.append({"date": day, "type": "REBALANCE", "turnoverPct": round(turnover * 100, 2), "fee": round(fee, 2)})

        equity = cash + holdings_value(shares, prices)
        if previous_equity > 0:
            daily_return = (equity - previous_equity - contribution) / previous_equity
        else:
            daily_return = 0.0
        if index > 0:
            twr_index *= 1 + daily_return
        equity_values.append(equity)
        invested_values.append(invested_capital)
        daily_returns.append(daily_return)
        cashflows.append(contribution)

    drawdown, drawdown_curve = max_drawdown(equity_values)
    final_value = equity_values[-1]
    total_return = pct_change(final_value, invested_capital) if invested_capital else 0.0
    benchmark_values: list[float | None] = [None for _ in dates]
    benchmark_index_curve: list[float] | None = None
    benchmark_return: float | None = None
    benchmark_cagr: float | None = None
    benchmark_baseline = equity_values[0] if equity_values else invested_capital
    if benchmark_prices:
        raw_benchmark_values, benchmark_index_curve = build_benchmark_twr_curve(benchmark_prices, dates, benchmark_baseline)
        benchmark_values = raw_benchmark_values
        benchmark_return = benchmark_index_curve[-1] - 1
    elapsed_years = max(
        (datetime.strptime(dates[-1], "%Y-%m-%d").date() - datetime.strptime(dates[0], "%Y-%m-%d").date()).days
        / 365.25,
        1 / 365.25,
    )
    cagr = twr_index ** (1 / elapsed_years) - 1 if twr_index > 0 else -1
    if benchmark_index_curve and benchmark_index_curve[-1] > 0:
        benchmark_cagr = benchmark_index_curve[-1] ** (1 / elapsed_years) - 1
    return_days = daily_returns[1:]
    volatility = annualized_volatility(return_days)
    downside_deviation = annualized_downside_deviation(return_days)
    mean_daily_return = sum(return_days) / len(return_days) if return_days else 0.0
    annualized_mean_return = mean_daily_return * 252
    sharpe = annualized_mean_return / volatility if volatility else 0.0
    sortino = annualized_mean_return / downside_deviation if downside_deviation else 0.0
    calmar = cagr / abs(drawdown) if drawdown else 0.0
    money_weighted_return = annualized_money_weighted_return(dates, cashflows, final_value)
    positive_days = [value for value in return_days if value > 0]
    annual_returns = period_summaries(dates, daily_returns, equity_values, invested_values, cashflows, "yearly")
    monthly_returns = period_summaries(dates, daily_returns, equity_values, invested_values, cashflows, "monthly")
    rolling_volatility = rolling_annualized_volatility(daily_returns)
    asset_returns_by_symbol = {
        asset.symbol: daily_price_returns(dates, maps[asset.symbol])
        for asset in params.assets
    }
    correlation = correlation_payload([asset.symbol for asset in params.assets], asset_returns_by_symbol)
    asset_risk = [
        {
            "symbol": asset.symbol,
            "volatilityPct": round(annualized_volatility(asset_returns_by_symbol[asset.symbol]) * 100, 2),
            "baseReturnPct": round(pct_change(maps[asset.symbol][dates[-1]], maps[asset.symbol][dates[0]]) * 100, 2),
            "localReturnPct": round(pct_change(local_maps[asset.symbol][dates[-1]], local_maps[asset.symbol][dates[0]]) * 100, 2),
            "fxEffectPct": round(
                (
                    pct_change(maps[asset.symbol][dates[-1]], maps[asset.symbol][dates[0]])
                    - pct_change(local_maps[asset.symbol][dates[-1]], local_maps[asset.symbol][dates[0]])
                )
                * 100,
                2,
            ),
            "currency": normalized_currency_code(histories[index].currency),
        }
        for index, asset in enumerate(params.assets)
    ]
    initial_contribution_count = sum(1 for event in events if event.get("initialCashflow", 0) > 0)
    pac_contribution_count = sum(1 for event in events if event.get("pacCashflow", 0) > 0)
    contribution_count = initial_contribution_count + pac_contribution_count
    cashflow_dates = sum(1 for value in cashflows if value > 0)
    rebalance_count = sum(1 for event in events if event["type"] == "REBALANCE")
    best_month = max((row["returnPct"] for row in monthly_returns), default=0.0)
    worst_month = min((row["returnPct"] for row in monthly_returns), default=0.0)
    best_year = max((row["returnPct"] for row in annual_returns), default=0.0)
    worst_year = min((row["returnPct"] for row in annual_returns), default=0.0)

    curve = [
        {
            "date": day,
            "equity": round(equity_values[index], 2),
            "invested": round(invested_values[index], 2),
            "benchmark": round(benchmark_values[index], 2) if benchmark_values[index] is not None else None,
            "drawdownPct": round(drawdown_curve[index] * 100, 2),
            "rollingVolatilityPct": round(rolling_volatility[index] * 100, 2),
            "dailyReturnPct": round(daily_returns[index] * 100, 3),
            "cashflow": round(cashflows[index], 2),
        }
        for index, day in enumerate(dates)
    ]

    final_prices = [maps[asset.symbol][dates[-1]] for asset in params.assets]
    portfolio_final = holdings_value(shares, final_prices) + cash
    assets: list[dict[str, Any]] = []
    for asset, history, share, price in zip(params.assets, histories, shares, final_prices):
        start_price = maps[asset.symbol][dates[0]]
        local_start_price = local_maps[asset.symbol][dates[0]]
        local_end_price = local_maps[asset.symbol][dates[-1]]
        local_return = pct_change(local_end_price, local_start_price)
        base_return = pct_change(price, start_price)
        value = share * price
        risk = next((item for item in asset_risk if item["symbol"] == asset.symbol), {})
        assets.append(
            {
                "symbol": asset.symbol,
                "name": history.short_name,
                "targetWeightPct": round(asset.weight * 100, 2),
                "finalWeightPct": round((value / portfolio_final) * 100, 2) if portfolio_final else 0.0,
                "returnPct": round(base_return * 100, 2),
                "localReturnPct": round(local_return * 100, 2),
                "fxEffectPct": round((base_return - local_return) * 100, 2),
                "volatilityPct": risk.get("volatilityPct", 0.0),
                "shares": round(share, 6),
                "startPrice": round(start_price, 4),
                "endPrice": round(price, 4),
                "localStartPrice": round(local_start_price, 4),
                "localEndPrice": round(local_end_price, 4),
                "currency": params.base_currency,
                "localCurrency": normalized_currency_code(history.currency),
                "exchange": history.exchange,
                "instrumentType": history.instrument_type,
            }
        )

    currencies = sorted({normalized_currency_code(history.currency) for history in histories})
    base_currency = params.base_currency
    warnings = []
    if fx_details:
        warnings.append(f"Prezzi e rendimenti convertiti in {base_currency}; l'effetto cambio e incluso nel backtest.")

    return {
        "name": "CapitalEyes Portfolio Backtest",
        "range": {"start": dates[0], "end": dates[-1], "bars": len(dates)},
        "market": {
            "currency": base_currency,
            "baseCurrency": base_currency,
            "currencies": currencies,
            "benchmark": params.benchmark,
            "benchmarkCurrency": normalized_currency_code(benchmark_history.currency) if benchmark_history else None,
            "fxConversions": fx_details,
        },
        "strategy": {
            "type": "PAC" if params.investment_mode == "pac" else "PIC",
            "currency": base_currency,
            "rebalance": params.rebalance,
            "contributionFrequency": params.contribution_frequency,
            "initial": params.initial,
            "contribution": params.contribution,
            "investedCapital": round(invested_capital, 2),
            "initialContributionCount": initial_contribution_count,
            "contributionCount": contribution_count,
            "pacContributionCount": pac_contribution_count,
            "cashflowDates": cashflow_dates,
            "rebalanceCount": rebalance_count,
            "feePct": round(params.fee_pct * 100, 4),
            "feesPaid": round(fees_paid, 2),
        },
        "metrics": {
            "finalValue": round(final_value, 2),
            "investedCapital": round(invested_capital, 2),
            "profit": round(final_value - invested_capital, 2),
            "returnPct": round(total_return * 100, 2),
            "timeWeightedReturnPct": round((twr_index - 1) * 100, 2),
            "moneyWeightedReturnPct": safe_metric(money_weighted_return * 100 if money_weighted_return is not None else None),
            "benchmarkPct": safe_metric(benchmark_return * 100 if benchmark_return is not None else None),
            "benchmarkCagrPct": safe_metric(benchmark_cagr * 100 if benchmark_cagr is not None else None),
            "benchmarkFinalValue": round(benchmark_values[-1], 2) if benchmark_values[-1] is not None else None,
            "benchmarkProfit": round(benchmark_values[-1] - benchmark_baseline, 2) if benchmark_values[-1] is not None else None,
            "alphaPct": safe_metric(((twr_index - 1) - benchmark_return) * 100 if benchmark_return is not None else None),
            "cagrPct": round(cagr * 100, 2),
            "maxDrawdownPct": round(drawdown * 100, 2),
            "volatilityPct": round(volatility * 100, 2),
            "downsideDeviationPct": round(downside_deviation * 100, 2),
            "sharpe": round(sharpe, 2),
            "sortino": round(sortino, 2),
            "calmar": round(calmar, 2),
            "positiveDaysPct": round((len(positive_days) / max(len(daily_returns) - 1, 1)) * 100, 2),
            "initialContributions": initial_contribution_count,
            "contributions": contribution_count,
            "pacContributions": pac_contribution_count,
            "cashflowDates": cashflow_dates,
            "rebalances": rebalance_count,
            "feesPaid": round(fees_paid, 2),
            "events": len(events),
            "bestDayPct": round(max(return_days, default=0.0) * 100, 2),
            "worstDayPct": round(min(return_days, default=0.0) * 100, 2),
            "bestMonthPct": round(best_month, 2),
            "worstMonthPct": round(worst_month, 2),
            "bestYearPct": round(best_year, 2),
            "worstYearPct": round(worst_year, 2),
        },
        "assets": assets,
        "assetRisk": asset_risk,
        "correlation": correlation,
        "curve": curve,
        "annualReturns": annual_returns,
        "monthlyReturns": monthly_returns,
        "events": events[-120:],
        "warnings": warnings,
    }


class CapitalEyesHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, directory=str(STATIC_DIR), **kwargs)

    def log_message(self, format: str, *args: Any) -> None:  # noqa: A002 - stdlib signature.
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {self.address_string()} {format % args}")

    def end_headers(self) -> None:
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        super().end_headers()

    def do_GET(self) -> None:  # noqa: N802 - stdlib hook.
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/health":
            self.send_json({"ok": True, "app": "CapitalEyes"})
            return
        if parsed.path == "/api/search":
            self.handle_search(parsed.query)
            return
        if parsed.path == "/api/backtest":
            self.handle_backtest(parsed.query)
            return
        if parsed.path == "/":
            self.path = "/index.html"
        if parsed.path in PAGE_ROUTES:
            self.path = PAGE_ROUTES[parsed.path]
        super().do_GET()

    def do_HEAD(self) -> None:  # noqa: N802 - stdlib hook.
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/":
            self.path = "/index.html"
        if parsed.path in PAGE_ROUTES:
            self.path = PAGE_ROUTES[parsed.path]
        super().do_HEAD()

    def handle_search(self, raw_query: str) -> None:
        try:
            query = urllib.parse.parse_qs(raw_query).get("q", [""])[0]
            self.send_json({"results": fetch_market_search(query)})
        except ApiError as exc:
            self.send_json({"error": exc.message}, exc.status)
        except Exception as exc:  # noqa: BLE001
            print(f"Unexpected search error: {exc}")
            self.send_json({"error": "Errore interno durante la ricerca."}, HTTPStatus.INTERNAL_SERVER_ERROR)

    def handle_backtest(self, raw_query: str) -> None:
        try:
            params = parse_params(urllib.parse.parse_qs(raw_query, keep_blank_values=True))
            result = build_portfolio_backtest(params)
            self.send_json(result)
        except ApiError as exc:
            self.send_json({"error": exc.message}, exc.status)
        except Exception as exc:  # noqa: BLE001
            print(f"Unexpected error: {exc}")
            self.send_json({"error": "Errore interno durante il backtest."}, HTTPStatus.INTERNAL_SERVER_ERROR)

    def send_json(self, payload: dict[str, Any], status: HTTPStatus = HTTPStatus.OK) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def run() -> None:
    port = int(os.environ.get("PORT", DEFAULT_PORT))
    host = os.environ.get("HOST", CLOUD_HOST if "PORT" in os.environ else DEFAULT_HOST)
    server = ThreadingHTTPServer((host, port), CapitalEyesHandler)
    display_host = "127.0.0.1" if host in {"0.0.0.0", ""} else host
    print(f"CapitalEyes running at http://{display_host}:{port}")
    if host in {"0.0.0.0", ""}:
        print(f"LAN access enabled on port {port}.")
    print("Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
    finally:
        server.server_close()


if __name__ == "__main__":
    run()
