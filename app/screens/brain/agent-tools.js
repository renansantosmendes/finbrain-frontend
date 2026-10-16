/*
 * Plain-language descriptions of the tools the agent can call, shown while
 * they run (for example "Coletando dados da ação PETR4.SA…"). The arguments
 * come from the stream's tool-start event; without them the description
 * falls back to a generic phrase.
 */
(function (root, factory) {
  var FB = (root.FB = root.FB || {});
  FB.agentTools = factory();
  if (typeof module === "object" && module.exports) module.exports = FB.agentTools;
})(typeof self !== "undefined" ? self : globalThis, function () {
  "use strict";

  function text(value) {
    if (typeof value === "string") return value.trim();
    if (typeof value === "number") return String(value);
    if (Array.isArray(value)) return value.join(", ");
    return "";
  }

  var LABELS = {
    collect_yfinance_data: function (a) {
      return a.ticker ? "Coletando dados da ação " + text(a.ticker) : "Coletando dados de cotação";
    },
    collect_fundamental_indicators: function (a) {
      return a.ticker ? "Analisando os indicadores fundamentalistas de " + text(a.ticker) : "Analisando indicadores fundamentalistas";
    },
    collect_technical_indicators: function (a) {
      return a.ticker ? "Calculando os indicadores técnicos de " + text(a.ticker) : "Calculando indicadores técnicos";
    },
    compare_assets: function (a) {
      return a.tickers ? "Comparando " + text(a.tickers) : "Comparando ativos";
    },
    generate_synthetic_stock_series_garch_arch: function (a) {
      return a.ticker ? "Gerando uma série sintética de " + text(a.ticker) : "Gerando uma série sintética";
    },
    get_bcb_series: function (a) {
      return a.nome_serie ? "Consultando a série " + text(a.nome_serie) + " no Banco Central" : "Consultando séries do Banco Central";
    },
    get_ptax_dolar_periodo: function () {
      return "Consultando a PTAX do dólar no período";
    },
    get_market_expectations: function (a) {
      return a.indicador ? "Consultando as expectativas de mercado para " + text(a.indicador) : "Consultando expectativas de mercado";
    },
    get_world_bank_indicator: function (a) {
      return a.indicator_code ? "Consultando o indicador " + text(a.indicator_code) + " do Banco Mundial" : "Consultando indicadores do Banco Mundial";
    },
    search_world_bank_indicator: function (a) {
      return a.query ? "Buscando indicadores do Banco Mundial sobre " + text(a.query) : "Buscando indicadores do Banco Mundial";
    },
    compare_countries_latest: function () {
      return "Comparando indicadores entre países";
    },
    get_crypto_price: function (a) {
      return a.symbol ? "Consultando o preço de " + text(a.symbol) + (a.exchange_name ? " em " + text(a.exchange_name) : "") : "Consultando preço de cripto";
    },
    get_crypto_ohlcv: function (a) {
      return a.symbol ? "Consultando o histórico de " + text(a.symbol) + (a.exchange_name ? " em " + text(a.exchange_name) : "") : "Consultando histórico de cripto";
    },
    get_crypto_order_book: function (a) {
      return a.symbol ? "Consultando o livro de ofertas de " + text(a.symbol) : "Consultando livro de ofertas de cripto";
    },
    list_available_exchanges: function () {
      return "Listando as corretoras de cripto disponíveis";
    },
    read_credit_card_invoices: function () {
      return "Lendo as faturas de cartão enviadas";
    },
    write_todos: function () {
      return "Organizando as etapas da resposta";
    },
    task: function () {
      return "Delegando uma etapa da análise";
    },
    read_file: function () {
      return "Consultando arquivos de apoio";
    },
    ls: function () {
      return "Consultando arquivos de apoio";
    },
    glob: function () {
      return "Consultando arquivos de apoio";
    },
    grep: function () {
      return "Consultando arquivos de apoio";
    },
  };

  /**
   * Describe a tool call in plain Portuguese.
   *
   * Parameters
   * ----------
   * name : string
   *     Tool name as the agent reports it, for example "collect_yfinance_data".
   * input : object | undefined
   *     The arguments of the call, when the agent sent them.
   *
   * Returns
   * -------
   * string
   *     A short sentence, for example "Coletando dados da ação PETR4.SA".
   *
   * Example
   * -------
   * >>> describe("collect_yfinance_data", { ticker: "PETR4.SA" })
   * 'Coletando dados da ação PETR4.SA'
   */
  function describe(name, input) {
    var args = input && typeof input === "object" ? input : {};
    var label = LABELS[name];
    return label ? label(args) : "Usando " + (name || "uma ferramenta");
  }

  return { describe: describe, LABELS: LABELS };
});
