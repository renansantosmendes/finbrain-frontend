/*
 * Brain's reasoning for the V0 (simulated agent, no LLM).
 *
 * `think(question, context)` is pure: it reads the question and the current
 * context (selected asset, period and simulation) and returns the reply,
 * the state changes the reply implies and the tool calls to record in the
 * trail. The Brain screen applies the result; nothing is rendered here.
 */
(function (root, factory) {
  var FB = (root.FB = root.FB || {});
  FB.brainEngine = factory(FB.format, FB.market, FB.simulation);
  if (typeof module === "object" && module.exports) module.exports = FB.brainEngine;
})(typeof self !== "undefined" ? self : globalThis, function (format, market, simulation) {
  "use strict";

  var fmt = format.fmt, pc = format.pc, money = format.money;

  var GREETING = {
    tools: [],
    html: "Olá! Sou o <b>Brain</b>. Busco dados de mercado, explico o que aconteceu e simulo cenários. <b>Não recomendo</b> compra ou venda. Escolha um ativo no painel ou pergunte algo.",
    refs: [],
    note: "Todas as chamadas ficam registradas na aba Transparência.",
  };

  function num(value, trend) {
    return '<span class="num' + (trend ? " " + trend : "") + '">' + value + "</span>";
  }

  function mentionedAsset(normalized) {
    var found = null;
    market.ASSETS.forEach(function (asset) {
      var hit = normalized.indexOf(format.norm(asset.s)) >= 0 || asset.al.some(function (alias) { return normalized.indexOf(alias) >= 0; });
      if (hit && (!found || asset.s !== "IBOV")) found = asset;
    });
    return found;
  }

  function requestedRange(normalized, current) {
    var months = normalized.match(/(\d+)\s*mes/);
    if (months) {
      var k = Number(months[1]);
      return k <= 1 ? "1M" : k <= 3 ? "3M" : k <= 6 ? "6M" : "1A";
    }
    if (/\bano\b|12 meses|um ano/.test(normalized)) return "1A";
    return current;
  }

  function chartLink(asset) {
    return { tab: "dashboards", label: "Ver o gráfico de " + asset.s };
  }

  function think(question, context) {
    var s = format.norm(question);
    var mentioned = mentionedAsset(s);
    var A = mentioned || market.findAsset(context.sym);
    var rng = requestedRange(s, context.rng);
    var result = { changes: {}, calls: [], reply: null };
    if (A.s !== context.sym || rng !== context.rng) {
      result.changes.asset = { sym: A.s, rng: rng };
    }

    if (/\b(compre|venda|vender agora|comprar agora|abra uma ordem|execute|ordem de)\b/.test(s)) {
      result.reply = { cls: "blk", tools: [], refs: [], note: "Escopo respeitado", html: "<b>Não executo ordens.</b> O FinBrain não acessa corretoras nem realiza compras ou vendas. Posso mostrar o histórico de " + A.s + ", comparar com o Ibovespa ou simular um aporte mensal." };
      return result;
    }
    if (/devo (comprar|vender|investir)|recomend|vale a pena (comprar|investir)|melhor (acao|investimento)|onde investir|compro|vendo/.test(s)) {
      result.reply = { cls: "blk", tools: [], refs: [], note: "Escopo respeitado", html: "<b>Não faço recomendação de compra, venda ou manutenção de ativos.</b> Posso mostrar como " + A.s + " se comportou, comparar com o Ibovespa ou simular quanto um aporte mensal teria rendido em cenários diferentes." };
      return result;
    }

    if (/simul|aporte|juros compostos|quanto (rende|renderia|teria)/.test(s)) {
      var sim = Object.assign({}, context.sim);
      var amount = question.match(/r\$\s*([\d.]+(?:,\d+)?)/i), years = s.match(/(\d+)\s*anos?/);
      if (amount) sim.aporte = simulation.clamp("aporte", Math.round(parseFloat(amount[1].replace(/\./g, "").replace(",", ".")) / 100) * 100);
      if (years) sim.anos = simulation.clamp("anos", Number(years[1]));
      result.changes.sim = { aporte: sim.aporte, anos: sim.anos };
      var final = simulation.finalValues(simulation.run(sim));
      var params = "aporte R$ " + fmt(sim.aporte, 0) + "/mês · " + sim.anos + "a · " + fmt(sim.ret, 1) + "% real";
      result.calls.push(["simulate_dca", "Cálculo local", params]);
      result.reply = {
        tools: ["simulate_dca · " + params],
        refs: ["Cálculo local · Monte Carlo (" + simulation.PATHS + " trajetórias)"],
        goto: { tab: "simulacoes", label: "Ver na aba Simulações" },
        html: "Com aporte de <b class=\"num\">R$ " + fmt(sim.aporte, 0) + "/mês</b> por <b>" + sim.anos + " anos</b> (retorno real médio de " + fmt(sim.ret, 1) + "% a.a. e volatilidade de " + fmt(sim.vol, 1) + "%), você terá aportado " + num(money(final.invested)) + ". O cenário mediano chega a " + num(money(final.median)) + ", e em 80% das simulações o resultado fica entre " + num(money(final.low)) + " e " + num(money(final.high)) + ". Em cerca de 10% dos casos o resultado fica abaixo de " + money(final.low) + ". Atualizei a aba Simulações com essas hipóteses.",
      };
      return result;
    }

    if (/selic|cdi|ipca|inflac|juro/.test(s)) {
      var macro = market.MACRO;
      result.calls.push(["get_macro_series", "Banco Central · SGS 432", "Selic meta · 12m"]);
      result.calls.push(["get_macro_series", "Banco Central · SGS 4389", "CDI · 12m"]);
      result.calls.push(["get_macro_series", "Banco Central · SGS 13522", "IPCA 12m · 12m"]);
      result.reply = {
        tools: ["get_macro_series · Selic", "get_macro_series · CDI", "get_macro_series · IPCA 12m"],
        refs: ["Banco Central · SGS 432", "Banco Central · SGS 4389", "Banco Central · SGS 13522"],
        goto: { tab: "dashboards", label: "Ver o painel Brasil · macro" },
        html: "A Selic meta está em <b class=\"num\">" + fmt(macro.selic, 2) + "% a.a.</b> e o CDI em " + num(fmt(macro.cdi, 2) + "% a.a.") + ", estáveis nos últimos 6 meses. O IPCA em 12 meses está em " + num(fmt(macro.ipca, 1) + "%") + ". O juro real aproximado (CDI contra IPCA) é de " + num(fmt(market.realRate(), 1) + "% a.a.") + ".",
      };
      return result;
    }

    if (/volatil|oscil|risco/.test(s)) {
      var cl = market.closes(A.data);
      result.calls.push(["get_history", "Yahoo Finance · " + A.s, "1a · 1d"]);
      result.calls.push(["calc_volatility", "Cálculo local", A.s + " · 30d e 1A"]);
      result.reply = {
        tools: ["get_history · " + A.s + " · 1a", "calc_volatility · 30d, 1a"],
        refs: ["Yahoo Finance · " + A.s, "Cálculo local"],
        goto: chartLink(A),
        html: "A volatilidade anualizada de <b>" + A.s + "</b> é de " + num(fmt(market.volAnn(cl, 30), 1) + "%") + " nos últimos 30 pregões e de " + num(fmt(market.volAnn(cl, 251), 1) + "%") + " em 1 ano. A queda máxima no último ano (do topo ao fundo) foi de " + num(fmt(market.maxDrawdown(cl), 1) + "%", "d") + ".",
      };
      return result;
    }

    if (/drawdown|queda maxima|maior queda/.test(s)) {
      var p = market.performance(A, rng);
      result.calls.push(["get_history", "Yahoo Finance · " + A.s, rng + " · 1d"]);
      result.calls.push(["calc_drawdown", "Cálculo local", A.s + " · " + rng]);
      result.reply = {
        tools: ["get_history · " + A.s + " · " + rng, "calc_drawdown"],
        refs: ["Yahoo Finance · " + A.s],
        goto: chartLink(A),
        html: "Em <b>" + rng + "</b>, a maior queda de <b>" + A.s + "</b> entre um topo e o fundo seguinte foi de " + num(fmt(p.drawdown, 1) + "%", "d") + ".",
      };
      return result;
    }

    if (/compar|versus|\bvs\b|contra o/.test(s)) {
      if (A.s === "IBOV") {
        result.reply = { cls: "lim", tools: [], refs: [], html: "Você está vendo o próprio Ibovespa. Selecione outro ativo no painel para compará-lo com o índice." };
        return result;
      }
      var pa = market.performance(A, rng), pb = market.performance(market.findAsset("IBOV"), rng), diff = pa.change - pb.change;
      result.calls.push(["get_history", "Yahoo Finance · " + A.s, rng + " · 1d"]);
      result.calls.push(["get_history", "Yahoo Finance · IBOV", rng + " · 1d"]);
      result.calls.push(["calc_compare", "Cálculo local", A.s + " × IBOV"]);
      result.reply = {
        tools: ["get_history · " + A.s + " · " + rng, "get_history · IBOV · " + rng, "calc_compare"],
        refs: ["Yahoo Finance · " + A.s, "Yahoo Finance · IBOV"],
        goto: chartLink(A),
        html: "Em <b>" + rng + "</b>, <b>" + A.s + "</b> variou " + num(pc(pa.change), format.trend(pa.change)) + " e o <b>Ibovespa</b> " + num(pc(pb.change), format.trend(pb.change)) + ". A diferença é de " + num(fmt(Math.abs(diff), 2) + " p.p.") + " " + (diff >= 0 ? "a favor" : "contra") + " de " + A.s + ".",
      };
      return result;
    }

    if (mentioned || /desempenho|resum|como foi|variou|subiu|caiu|ultimos|ultimo|comport|mostre|historico|cotac|preco/.test(s)) {
      var perf = market.performance(A, rng);
      result.calls.push(["get_quote", "Yahoo Finance · " + A.s, "último"]);
      result.calls.push(["get_history", "Yahoo Finance · " + A.s, rng + " · 1d"]);
      result.reply = {
        tools: ["get_quote · " + A.s, "get_history · " + A.s + " · " + rng],
        refs: ["Yahoo Finance · " + A.s],
        goto: chartLink(A),
        html: "<b>" + A.s + "</b> (" + A.n + ") fechou em " + num(A.u + " " + fmt(perf.last, A.d)) + ". Em <b>" + rng + "</b>, variou " + num(pc(perf.change), format.trend(perf.change)) + ", com máxima de " + fmt(perf.high, A.d) + " e mínima de " + fmt(perf.low, A.d) + ". A volatilidade anualizada dos últimos 30 pregões é de " + fmt(perf.vol30, 1) + "% e a queda máxima no período foi de " + fmt(perf.drawdown, 1) + "%.",
      };
      return result;
    }

    result.reply = { cls: "lim", tools: [], refs: [], html: "<b>Não tenho dados ou ferramenta para responder isso.</b> Para não estimar sem base, prefiro dizer que não sei. Posso mostrar o desempenho e a volatilidade de um ativo, comparar com o Ibovespa, consultar Selic, CDI e IPCA ou simular um aporte mensal." };
    return result;
  }

  function suggestions(symbol) {
    return [
      "Resuma o desempenho de " + symbol + " nos últimos 3 meses",
      "Qual a volatilidade de " + symbol + "?",
      "Compare " + symbol + " com o Ibovespa",
      "Como estão a Selic e o IPCA?",
      "Simule aporte de R$ 800 por 15 anos",
      "Devo comprar " + symbol + "?",
    ];
  }

  return { GREETING: GREETING, think: think, suggestions: suggestions };
});
