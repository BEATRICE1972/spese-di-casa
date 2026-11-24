// App delle spese: tutto resta sul telefono (memoria del browser).
(function () {
  "use strict";
  var R = window.Riconosci;
  var CHIAVE = "spese-di-casa-v1";
  var $ = function (id) { return document.getElementById(id); };
  var euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", useGrouping: "always" });
  var NOMI_MESI = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

  // ---------- dati ----------
  function statoVuoto() {
    return {
      spese: [],
      categorie: R.CATEGORIE_DI_PARTENZA.map(function (c) { return { nome: c.nome, parole: c.parole.slice() }; }),
      budgetAnni: {},   // { "2026": { "Carburante": 80, ... }, "2027": {...} } budget mensile per anno
      imparate: {},
      ultimaCopia: null
    };
  }
  function annoOggi() { return String(new Date().getFullYear()); }
  var memoriaFunziona = true;
  function carica() {
    try {
      var testo = localStorage.getItem(CHIAVE);
      if (!testo) return statoVuoto();
      var s = JSON.parse(testo);
      var vuoto = statoVuoto();
      var budgetAnni = s.budgetAnni && typeof s.budgetAnni === "object" ? s.budgetAnni : {};
      // Prima versione: un solo budget per tutti gli anni -> diventa il budget dell'anno in corso.
      if (s.budget && typeof s.budget === "object" && Object.keys(s.budget).length && !Object.keys(budgetAnni).length) budgetAnni[annoOggi()] = s.budget;
      return {
        spese: Array.isArray(s.spese) ? s.spese : [],
        categorie: Array.isArray(s.categorie) && s.categorie.length ? s.categorie : vuoto.categorie,
        budgetAnni: budgetAnni,
        imparate: s.imparate && typeof s.imparate === "object" ? s.imparate : {},
        ultimaCopia: s.ultimaCopia || null
      };
    } catch (e) {
      memoriaFunziona = false;
      return statoVuoto();
    }
  }
  var stato = carica();
  function salva() {
    try { localStorage.setItem(CHIAVE, JSON.stringify(stato)); memoriaFunziona = true; }
    catch (e) { memoriaFunziona = false; mostraMessaggio("Non riesco a salvare sul telefono (memoria del browser piena o bloccata). Salva una copia da «Altro».", true); }
  }
  // Chiede al telefono di non cancellare i dati da solo (dove si può).
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* niente */ }

  function nuovoId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function nomiCategorie() { return stato.categorie.map(function (c) { return c.nome; }); }
  function arrotonda(n) { return Math.round(n * 100) / 100; }
  function leggiImporto(testo) {
    var t = String(testo || "").trim().replace(/€|\s/g, "");
    if (!t) return null;
    if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(t)) t = t.replace(/\./g, "").replace(",", ".");
    else t = t.replace(",", ".");
    if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
    return arrotonda(Number(t));
  }
  function scriviImporto(n) { return n === null || n === undefined ? "" : String(n.toFixed(2)).replace(".", ","); }
  function dataLeggibile(iso) {
    var p = iso.split("-");
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    return d.toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  }
  function oggiIso() { return R.dataIso(new Date()); }

  // ---------- messaggi ----------
  var timerMessaggio = null;
  function mostraMessaggio(testo, errore) {
    var m = $("messaggio");
    m.textContent = testo;
    m.className = "avviso" + (errore ? " errore" : "");
    m.hidden = false;
    clearTimeout(timerMessaggio);
    if (!errore) timerMessaggio = setTimeout(function () { m.hidden = true; }, 4000);
  }

  // ---------- conferma dentro la pagina ----------
  function chiedi(testo, siTesto) {
    return new Promise(function (risolvi) {
      var d = $("conferma");
      $("conferma-testo").textContent = testo;
      $("conferma-si").textContent = siTesto || "Sì, togli";
      function chiudi(v) { d.close(); $("conferma-si").onclick = null; $("conferma-no").onclick = null; risolvi(v); }
      $("conferma-si").onclick = function () { chiudi(true); };
      $("conferma-no").onclick = function () { chiudi(false); };
      if (d.showModal) d.showModal(); else d.setAttribute("open", "");
    });
  }

  // ---------- schede ----------
  var vistaAttuale = "aggiungi";
  function mostraVista(nome) {
    vistaAttuale = nome;
    ["aggiungi", "spese", "conti", "altro"].forEach(function (v) { $("vista-" + v).hidden = v !== nome; });
    document.querySelectorAll("nav button").forEach(function (b) {
      if (b.dataset.vista === nome) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });
    disegna();
    window.scrollTo(0, 0);
  }
  document.querySelectorAll("nav button").forEach(function (b) {
    b.addEventListener("click", function () { mostraVista(b.dataset.vista); });
  });

  // ---------- modulo ----------
  var inModifica = null; // id della spesa che si sta correggendo
  var categoriaProposta = null;
  function riempiSceltaCategorie(select, conTutte) {
    var attuale = select.value;
    select.textContent = "";
    if (conTutte) { var o = document.createElement("option"); o.value = ""; o.textContent = "Tutte"; select.appendChild(o); }
    nomiCategorie().forEach(function (n) { var op = document.createElement("option"); op.value = n; op.textContent = n; select.appendChild(op); });
    if (attuale && (conTutte && attuale === "" || nomiCategorie().indexOf(attuale) !== -1)) select.value = attuale;
  }
  function svuotaModulo() {
    inModifica = null;
    $("frase").value = "";
    $("campo-data").value = oggiIso();
    $("campo-importo").value = "";
    $("campo-descrizione").value = "";
    $("campo-categoria").value = "Altro";
    categoriaProposta = null;
    $("bottone-salva").textContent = "Salva la spesa";
    $("bottone-annulla-modifica").hidden = true;
    $("bottone-togli").hidden = true;
  }
  function applicaFrase(frase) {
    if (!frase.trim()) return;
    var r = R.riconosci(frase, new Date(), stato.categorie, stato.imparate);
    $("campo-data").value = r.data;
    if (r.importo !== null) $("campo-importo").value = scriviImporto(r.importo);
    $("campo-descrizione").value = r.descrizione;
    if (nomiCategorie().indexOf(r.categoria) === -1) r.categoria = "Altro";
    $("campo-categoria").value = r.categoria;
    categoriaProposta = r.categoria;
  }
  $("frase").addEventListener("input", function () { applicaFrase($("frase").value); });
  $("frase").addEventListener("change", function () { applicaFrase($("frase").value); });
  $("campo-descrizione").addEventListener("change", function () {
    if (inModifica) return;
    // Se la frase intera è stata scritta qui ("benzina a 50 euro"), si legge come la frase in alto.
    if (!$("campo-importo").value.trim() && /\d|euro|€/i.test($("campo-descrizione").value)) {
      applicaFrase($("campo-descrizione").value);
      return;
    }
    var c = R.scegliCategoria($("campo-descrizione").value, stato.categorie, stato.imparate);
    if (nomiCategorie().indexOf(c) !== -1) { $("campo-categoria").value = c; categoriaProposta = c; }
  });

  function imparaCategoria(descrizione, categoria) {
    var d = R.senzaAccenti(descrizione.toLowerCase()).trim();
    if (!d) return;
    stato.imparate[d] = categoria;
    var parole = d.split(/\s+/).filter(function (p) { return p.length > 3; }).sort(function (a, b) { return b.length - a.length; });
    if (parole.length) stato.imparate["#" + parole[0]] = categoria;
  }

  $("modulo").addEventListener("submit", function (ev) {
    ev.preventDefault();
    // Ultima occasione: importo vuoto ma frase scritta (in alto o nella descrizione) -> si rilegge.
    if (!inModifica && !$("campo-importo").value.trim()) {
      var daRileggere = $("frase").value.trim() || $("campo-descrizione").value.trim();
      if (daRileggere) applicaFrase(daRileggere);
    }
    var data = $("campo-data").value;
    var importo = leggiImporto($("campo-importo").value);
    var descrizione = $("campo-descrizione").value.trim();
    var categoria = $("campo-categoria").value || "Altro";
    if (!data) { mostraMessaggio("Manca la data.", true); return; }
    if (importo === null || importo <= 0) { mostraMessaggio("L'importo non è chiaro: scrivilo come 85 oppure 85,50.", true); $("campo-importo").focus(); return; }
    if (!descrizione) { mostraMessaggio("Scrivi che cosa hai comprato.", true); $("campo-descrizione").focus(); return; }
    if (categoriaProposta !== null && categoria !== categoriaProposta) imparaCategoria(descrizione, categoria);
    if (inModifica) {
      var s = stato.spese.find(function (x) { return x.id === inModifica; });
      if (s) {
        if (s.categoria !== categoria) imparaCategoria(descrizione, categoria);
        s.data = data; s.importo = importo; s.descrizione = descrizione; s.categoria = categoria;
      }
      mostraMessaggio("Corretta: " + descrizione + ", " + euro.format(importo) + ".");
    } else {
      stato.spese.push({ id: nuovoId(), data: data, descrizione: descrizione, importo: importo, categoria: categoria });
      mostraMessaggio("Salvata: " + dataLeggibile(data) + " · " + descrizione + " · " + categoria + " · " + euro.format(importo) + ".");
    }
    salva();
    svuotaModulo();
    disegna();
  });
  $("bottone-annulla-modifica").addEventListener("click", function () { svuotaModulo(); disegna(); });
  $("bottone-togli").addEventListener("click", function () {
    var s = stato.spese.find(function (x) { return x.id === inModifica; });
    if (!s) return;
    chiedi("Togliere «" + s.descrizione + "» del " + dataLeggibile(s.data) + " (" + euro.format(s.importo) + ")?").then(function (si) {
      if (!si) return;
      stato.spese = stato.spese.filter(function (x) { return x.id !== s.id; });
      salva(); svuotaModulo(); disegna();
      mostraMessaggio("Spesa tolta.");
    });
  });
  function apriModifica(id) {
    var s = stato.spese.find(function (x) { return x.id === id; });
    if (!s) return;
    mostraVista("aggiungi");
    inModifica = id;
    $("frase").value = "";
    $("campo-data").value = s.data;
    $("campo-importo").value = scriviImporto(s.importo);
    $("campo-descrizione").value = s.descrizione;
    $("campo-categoria").value = nomiCategorie().indexOf(s.categoria) !== -1 ? s.categoria : "Altro";
    categoriaProposta = null;
    $("bottone-salva").textContent = "Salva la correzione";
    $("bottone-annulla-modifica").hidden = false;
    $("bottone-togli").hidden = false;
    $("campo-importo").focus();
  }

  // ---------- microfono ----------
  var Riconoscitore = window.SpeechRecognition || window.webkitSpeechRecognition;
  var ascolto = null;
  var timerAscolto = null;
  // Su iPhone e iPad il riconoscimento vocale del browser si può bloccare (soprattutto aperto dall'icona):
  // lì si usa solo il microfono della tastiera, che è del telefono e funziona sempre.
  var suIphone = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  function chiudiAscolto() {
    if (timerAscolto) { clearTimeout(timerAscolto); timerAscolto = null; }
    if (!ascolto) return;
    var r = ascolto;
    ascolto = null;
    r.onresult = r.onerror = r.onend = null;
    try { r.abort(); } catch (e) { /* già fermo */ }
    $("bottone-microfono").classList.remove("ascolto");
    $("scritta-microfono").textContent = "Tocca e detta la spesa";
    if ($("frase").value.trim()) mostraMessaggio("Controlla i campi qui sotto e tocca «Salva la spesa».");
  }
  if (!Riconoscitore || suIphone) {
    $("bottone-microfono").hidden = true;
    $("frase").placeholder = "Tocca il microfono della tastiera e detta: es. «ieri revisione macchina 85 euro»";
  } else {
    $("bottone-microfono").addEventListener("click", function () {
      if (ascolto) {
        // Si chiede di fermarsi; se dopo un secondo e mezzo non si è fermato, si spegne d'autorità.
        try { ascolto.stop(); } catch (e) { /* niente */ }
        setTimeout(chiudiAscolto, 1500);
        return;
      }
      var r = new Riconoscitore();
      r.lang = "it-IT";
      r.interimResults = true;
      r.continuous = false;
      r.maxAlternatives = 1;
      ascolto = r;
      $("bottone-microfono").classList.add("ascolto");
      $("scritta-microfono").textContent = "Ti ascolto… tocca per fermare";
      r.onresult = function (ev) {
        var testo = "";
        for (var i = 0; i < ev.results.length; i++) testo += ev.results[i][0].transcript;
        $("frase").value = testo;
        applicaFrase(testo);
      };
      r.onerror = function (ev) {
        var spiega = {
          "not-allowed": "Il microfono non è permesso. Nelle impostazioni del telefono consenti il microfono al browser, oppure usa il microfono della tastiera.",
          "service-not-allowed": "Il riconoscimento vocale non è disponibile qui: usa il microfono della tastiera.",
          "no-speech": "Non ho sentito niente: riprova.",
          "network": "Per riconoscere la voce serve internet: usa il microfono della tastiera."
        };
        mostraMessaggio(spiega[ev.error] || "Il microfono non ha funzionato: usa il microfono della tastiera.", true);
      };
      r.onend = chiudiAscolto;
      // Rete di sicurezza: dopo 15 secondi il microfono si spegne comunque, così non resta mai appeso.
      timerAscolto = setTimeout(chiudiAscolto, 15000);
      try { r.start(); } catch (e) { chiudiAscolto(); mostraMessaggio("Il microfono non è partito: usa il microfono della tastiera.", true); }
    });
  }

  // ---------- elenchi ----------
  function voceSpesa(s) {
    var li = document.createElement("li");
    li.className = "voce";
    li.tabIndex = 0;
    li.setAttribute("role", "button");
    var a = document.createElement("span"); a.textContent = s.descrizione;
    var b = document.createElement("span"); b.className = "importo"; b.textContent = euro.format(s.importo);
    var c = document.createElement("span"); c.className = "sotto"; c.textContent = dataLeggibile(s.data) + " · " + s.categoria;
    li.append(a, b, c);
    li.addEventListener("click", function () { apriModifica(s.id); });
    li.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); apriModifica(s.id); } });
    return li;
  }
  function ordinate() {
    return stato.spese.slice().sort(function (x, y) { return x.data < y.data ? 1 : x.data > y.data ? -1 : 0; });
  }
  function disegnaUltime() {
    var ul = $("ultime"); ul.textContent = "";
    var lista = ordinate().slice(0, 5);
    if (!lista.length) {
      var li = document.createElement("li"); li.className = "nota";
      li.textContent = "Ancora nessuna spesa. Tocca il microfono e di' per esempio «oggi benzina 50 euro».";
      ul.appendChild(li); return;
    }
    lista.forEach(function (s) { ul.appendChild(voceSpesa(s)); });
  }
  function disegnaSpese() {
    riempiSceltaCategorie($("filtro-categoria"), true);
    riempiAnni($("filtro-anno"), true);
    var selMese = $("filtro-mese");
    if (!selMese.options.length) {
      var tutti = document.createElement("option"); tutti.value = ""; tutti.textContent = "Tutti i mesi"; selMese.appendChild(tutti);
      NOMI_MESI.forEach(function (n, i) { var o = document.createElement("option"); o.value = String(i + 1).padStart(2, "0"); o.textContent = n; selMese.appendChild(o); });
      selMese.value = oggiIso().slice(5, 7);
    }
    var anno = $("filtro-anno").value, mese = selMese.value, cat = $("filtro-categoria").value;
    var lista = ordinate().filter(function (s) { return (!anno || s.data.slice(0, 4) === anno) && (!mese || s.data.slice(5, 7) === mese) && (!cat || s.categoria === cat); });
    var ul = $("elenco-spese"); ul.textContent = "";
    var totale = 0;
    lista.forEach(function (s) { totale += s.importo; ul.appendChild(voceSpesa(s)); });
    if (!lista.length) { var li = document.createElement("li"); li.className = "nota"; li.textContent = "Nessuna spesa in questo periodo."; ul.appendChild(li); }
    $("conteggio-spese").textContent = lista.length + (lista.length === 1 ? " spesa" : " spese");
    $("totale-spese").textContent = euro.format(arrotonda(totale));
  }
  $("filtro-anno").addEventListener("change", disegnaSpese);
  $("filtro-mese").addEventListener("change", disegnaSpese);
  $("filtro-categoria").addEventListener("change", disegnaSpese);

  // ---------- budget e consuntivo ----------
  // Anni da scegliere: dall'anno scorso (o dalla spesa più vecchia) fino all'anno prossimo.
  function anniDisponibili() {
    var oggi = Number(annoOggi()), primo = oggi - 1, ultimo = oggi + 1;
    stato.spese.forEach(function (s) { var a = Number(s.data.slice(0, 4)); if (a < primo) primo = a; if (a > ultimo) ultimo = a; });
    Object.keys(stato.budgetAnni).forEach(function (a) { a = Number(a); if (a < primo) primo = a; if (a > ultimo) ultimo = a; });
    var anni = [];
    for (var a = ultimo; a >= primo; a--) anni.push(String(a));
    return anni;
  }
  function riempiAnni(sel, conTutti) {
    var primaVolta = !sel.dataset.pronto, scelto = sel.value, anni = anniDisponibili();
    sel.textContent = "";
    if (conTutti) { var t = document.createElement("option"); t.value = ""; t.textContent = "Tutti"; sel.appendChild(t); }
    anni.forEach(function (a) { var o = document.createElement("option"); o.value = a; o.textContent = a; sel.appendChild(o); });
    if (primaVolta || (!(conTutti && scelto === "") && anni.indexOf(scelto) === -1)) scelto = annoOggi();
    sel.value = scelto;
    sel.dataset.pronto = "1";
  }
  // Budget mensile di un anno: il suo, oppure (se non l'hai ancora scritto) quello dell'ultimo anno prima.
  function budgetDi(anno) {
    if (stato.budgetAnni[anno]) return { valori: stato.budgetAnni[anno], daAnno: anno };
    var prima = Object.keys(stato.budgetAnni).filter(function (a) { return a < anno; }).sort();
    if (prima.length) return { valori: stato.budgetAnni[prima[prima.length - 1]], daAnno: prima[prima.length - 1] };
    return { valori: {}, daAnno: null };
  }
  function mesiPerPeriodo(anno, periodo) {
    var oggi = new Date();
    var meseFinale = Number(anno) < oggi.getFullYear() ? 12 : Number(anno) > oggi.getFullYear() ? 0 : oggi.getMonth() + 1;
    return { mesi: periodo === "anno" ? 12 : periodo === "finora" ? meseFinale : 1, meseFinale: meseFinale };
  }
  function disegnaConti() {
    var selAnno = $("conti-anno"), selPeriodo = $("conti-periodo");
    riempiAnni(selAnno, false);
    var annoScelto = selAnno.value;
    if (!selPeriodo.options.length) {
      var o0 = document.createElement("option"); o0.value = "anno"; o0.textContent = "Tutto l'anno"; selPeriodo.appendChild(o0);
      var o1 = document.createElement("option"); o1.value = "finora"; o1.textContent = "Da gennaio a oggi"; selPeriodo.appendChild(o1);
      NOMI_MESI.forEach(function (n, i) { var o = document.createElement("option"); o.value = String(i + 1).padStart(2, "0"); o.textContent = n; selPeriodo.appendChild(o); });
      selPeriodo.value = "finora";
    }
    var periodo = selPeriodo.value || "anno";
    var mp = mesiPerPeriodo(annoScelto, periodo), mesi = mp.mesi, meseFinale = mp.meseFinale;
    var bud = budgetDi(annoScelto).valori;
    var dentro = function (data) {
      if (data.slice(0, 4) !== annoScelto) return false;
      if (periodo === "anno") return true;
      if (periodo === "finora") return Number(data.slice(5, 7)) <= meseFinale;
      return data.slice(5, 7) === periodo;
    };
    $("titolo-consuntivo").textContent = "Consuntivo " + (periodo === "anno" ? annoScelto : periodo === "finora" ? (meseFinale ? "da gennaio a " + NOMI_MESI[meseFinale - 1].toLowerCase() + " " + annoScelto : annoScelto + " (anno non ancora iniziato)") : NOMI_MESI[Number(periodo) - 1] + " " + annoScelto);

    var speso = {};
    stato.spese.forEach(function (s) { if (dentro(s.data)) speso[s.categoria] = (speso[s.categoria] || 0) + s.importo; });
    var nomi = nomiCategorie().slice();
    Object.keys(speso).forEach(function (n) { if (nomi.indexOf(n) === -1) nomi.push(n); });

    var t = $("tabella-consuntivo"); t.textContent = "";
    var thead = t.createTHead(), hr = thead.insertRow();
    ["Categoria", "Budget", "Speso", "Differenza"].forEach(function (h) { var th = document.createElement("th"); th.textContent = h; hr.appendChild(th); });
    var tb = t.createTBody();
    var totB = 0, totS = 0;
    nomi.forEach(function (n) {
      var b = arrotonda((Number(bud[n]) || 0) * mesi);
      var s = arrotonda(speso[n] || 0);
      if (!b && !s) return;
      totB += b; totS += s;
      var r = tb.insertRow();
      var c0 = r.insertCell(); c0.textContent = n;
      if (b) {
        var barra = document.createElement("div"); barra.className = "barra";
        var i = document.createElement("i"); i.style.width = Math.min(100, s / b * 100) + "%"; if (s > b) i.className = "oltre";
        barra.appendChild(i); c0.appendChild(barra);
      }
      var c1 = r.insertCell(); c1.className = "num"; c1.textContent = b ? euro.format(b) : "—";
      var c2 = r.insertCell(); c2.className = "num"; c2.textContent = euro.format(s);
      var c3 = r.insertCell(); c3.className = "num";
      var diff = arrotonda(s - b);
      c3.textContent = b ? (diff > 0 ? "+" : "") + euro.format(diff) : "—";
      if (b) c3.classList.add(diff > 0 ? "su" : "giu");
    });
    if (!tb.rows.length) { var rv = tb.insertRow(); var cv = rv.insertCell(); cv.colSpan = 4; cv.textContent = "Nessuna spesa e nessun budget per questo periodo."; cv.style.textAlign = "left"; }
    var tf = t.createTFoot(), fr = tf.insertRow();
    var dt = arrotonda(totS - totB);
    [["Totale", ""], [euro.format(arrotonda(totB)), "num"], [euro.format(arrotonda(totS)), "num"], [(dt > 0 ? "+" : "") + euro.format(dt), "num " + (totB ? (dt > 0 ? "su" : "giu") : "")]].forEach(function (v) {
      var c = fr.insertCell(); c.textContent = v[0]; c.className = v[1];
    });
    disegnaBudget(annoScelto);
  }
  function disegnaBudget(anno) {
    var info = budgetDi(anno), bud = info.valori;
    $("titolo-budget").textContent = "Budget mensile per categoria " + anno;
    $("nota-budget-anno").textContent = info.daAnno && info.daAnno !== anno
      ? "Per il " + anno + " non hai ancora scritto un budget: vedi quello del " + info.daAnno + ". Se cambi una cifra, diventa il budget del " + anno + " (il " + info.daAnno + " resta com'è)."
      : "";
    var tb2 = $("tabella-budget"); tb2.textContent = "";
    var h2 = tb2.createTHead().insertRow();
    ["Categoria", "Al mese", "All'anno"].forEach(function (h) { var th = document.createElement("th"); th.textContent = h; h2.appendChild(th); });
    var body2 = tb2.createTBody(); var totMese = 0;
    nomiCategorie().forEach(function (n, idx) {
      var r = body2.insertRow();
      r.insertCell().textContent = n;
      var c = r.insertCell();
      var inp = document.createElement("input");
      inp.type = "text"; inp.inputMode = "decimal"; inp.id = "budget-" + idx; inp.setAttribute("aria-label", "Budget mensile " + n);
      inp.value = bud[n] ? scriviImporto(Number(bud[n])) : "";
      inp.placeholder = "0,00"; inp.style.maxWidth = "110px"; inp.style.textAlign = "right";
      var cAnno = r.insertCell(); cAnno.className = "num";
      var m = Number(bud[n]) || 0; totMese += m;
      cAnno.textContent = m ? euro.format(arrotonda(m * 12)) : "—";
      inp.addEventListener("change", function () {
        var v = leggiImporto(inp.value);
        if (inp.value.trim() && v === null) { inp.setCustomValidity("Scrivi un importo come 120 o 120,50"); inp.reportValidity(); return; }
        inp.setCustomValidity("");
        // Il budget di quest'anno nasce come copia di quello che stavi vedendo.
        if (!stato.budgetAnni[anno]) stato.budgetAnni[anno] = Object.assign({}, budgetDi(anno).valori);
        if (v) stato.budgetAnni[anno][n] = v; else delete stato.budgetAnni[anno][n];
        salva(); disegnaConti();
      });
      c.appendChild(inp);
    });
    var f2 = tb2.createTFoot().insertRow();
    f2.insertCell().textContent = "Totale";
    var fm = f2.insertCell(); fm.className = "num"; fm.textContent = euro.format(arrotonda(totMese));
    var fa = f2.insertCell(); fa.className = "num"; fa.textContent = euro.format(arrotonda(totMese * 12));
  }
  $("conti-anno").addEventListener("change", disegnaConti);
  $("conti-periodo").addEventListener("change", disegnaConti);

  // Consuntivo dell'anno da aprire in Excel: categorie per righe, mesi per colonne, poi budget e differenza.
  function creaCsvConsuntivo(anno) {
    var bud = budgetDi(anno).valori;
    var nomi = nomiCategorie().slice();
    stato.spese.forEach(function (s) { if (s.data.slice(0, 4) === anno && nomi.indexOf(s.categoria) === -1) nomi.push(s.categoria); });
    var mesiCorti = NOMI_MESI.map(function (m) { return m.slice(0, 3); });
    var righe = [["Consuntivo " + anno].join(";"), ["Categoria"].concat(mesiCorti, ["Totale speso", "Budget anno", "Differenza"]).join(";")];
    var totMesi = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], totS = 0, totB = 0;
    nomi.forEach(function (n) {
      var m = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      stato.spese.forEach(function (s) { if (s.categoria === n && s.data.slice(0, 4) === anno) m[Number(s.data.slice(5, 7)) - 1] += s.importo; });
      var tot = arrotonda(m.reduce(function (a, b) { return a + b; }, 0));
      var b = arrotonda((Number(bud[n]) || 0) * 12);
      if (!tot && !b) return;
      m.forEach(function (v, i) { totMesi[i] += v; });
      totS += tot; totB += b;
      righe.push([csvCampo(n)].concat(m.map(function (v) { return scriviImporto(arrotonda(v)); }), [scriviImporto(tot), scriviImporto(b), scriviImporto(arrotonda(tot - b))]).join(";"));
    });
    righe.push(["Totale"].concat(totMesi.map(function (v) { return scriviImporto(arrotonda(v)); }), [scriviImporto(arrotonda(totS)), scriviImporto(arrotonda(totB)), scriviImporto(arrotonda(totS - totB))]).join(";"));
    return "﻿" + righe.join("\r\n");
  }
  $("bottone-consuntivo-excel").addEventListener("click", function () {
    var anno = $("conti-anno").value || annoOggi();
    var nome = "consuntivo-" + anno + ".csv";
    condividiOScarica(new Blob([creaCsvConsuntivo(anno)], { type: "text/csv;charset=utf-8" }), nome, function () {});
  });

  // ---------- categorie ----------
  function disegnaCategorie() {
    var ul = $("elenco-categorie"); ul.textContent = "";
    stato.categorie.forEach(function (c) {
      var li = document.createElement("li"); li.className = "voce"; li.style.cursor = "default";
      var n = document.createElement("span"); n.textContent = c.nome;
      var usate = stato.spese.filter(function (s) { return s.categoria === c.nome; }).length;
      var azione = document.createElement("span");
      if (c.nome !== "Altro") {
        var b = document.createElement("button"); b.type = "button"; b.className = "pericolo"; b.textContent = "Togli";
        b.style.padding = "4px 10px";
        b.addEventListener("click", function () {
          chiedi("Togliere la categoria «" + c.nome + "»?" + (usate ? " Le sue " + usate + " spese passano in «Altro»." : "")).then(function (si) {
            if (!si) return;
            stato.categorie = stato.categorie.filter(function (x) { return x.nome !== c.nome; });
            stato.spese.forEach(function (s) { if (s.categoria === c.nome) s.categoria = "Altro"; });
            Object.keys(stato.imparate).forEach(function (k) { if (stato.imparate[k] === c.nome) delete stato.imparate[k]; });
            Object.keys(stato.budgetAnni).forEach(function (a) { delete stato.budgetAnni[a][c.nome]; });
            salva(); disegna();
          });
        });
        azione.appendChild(b);
      }
      var sotto = document.createElement("span"); sotto.className = "sotto"; sotto.textContent = usate + (usate === 1 ? " spesa" : " spese");
      li.append(n, azione, sotto); ul.appendChild(li);
    });
  }
  $("bottone-aggiungi-categoria").addEventListener("click", function () {
    var nome = $("nuova-categoria").value.trim();
    if (!nome) return;
    if (nomiCategorie().some(function (n) { return n.toLowerCase() === nome.toLowerCase(); })) { $("nuova-categoria").setCustomValidity("Esiste già"); $("nuova-categoria").reportValidity(); return; }
    $("nuova-categoria").setCustomValidity("");
    var altro = stato.categorie.findIndex(function (c) { return c.nome === "Altro"; });
    stato.categorie.splice(altro === -1 ? stato.categorie.length : altro, 0, { nome: nome, parole: [nome.toLowerCase()] });
    $("nuova-categoria").value = "";
    salva(); disegna();
  });

  // ---------- copia di sicurezza (CSV che si apre in Excel) ----------
  function csvCampo(v) { var s = String(v); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  function creaCsv() {
    var righe = ["Data;Descrizione;Categoria;Importo"];
    ordinate().slice().reverse().forEach(function (s) {
      var p = s.data.split("-");
      righe.push([p[2] + "/" + p[1] + "/" + p[0], csvCampo(s.descrizione), csvCampo(s.categoria), scriviImporto(s.importo)].join(";"));
    });
    righe.push("");
    righe.push("Budget mensile;Categoria;Anno;Importo");
    Object.keys(stato.budgetAnni).sort().forEach(function (anno) {
      var b = stato.budgetAnni[anno];
      Object.keys(b).forEach(function (n) { if (b[n]) righe.push(["BUDGET", csvCampo(n), anno, scriviImporto(Number(b[n]))].join(";")); });
    });
    return "﻿" + righe.join("\r\n");
  }
  // Sul telefono apre «Condividi» (salva in File, manda per mail...); dove non si può, scarica il file.
  function condividiOScarica(blob, nome, fatto) {
    var file = null;
    try { file = new File([blob], nome, { type: "text/csv" }); } catch (e) { file = null; }
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: nome }).then(fatto).catch(function (e) {
        if (e && e.name === "AbortError") return;
        scarica(blob, nome); fatto();
      });
    } else { scarica(blob, nome); fatto(); }
  }
  $("bottone-esporta").addEventListener("click", function () {
    var nome = "spese-" + oggiIso() + ".csv";
    condividiOScarica(new Blob([creaCsv()], { type: "text/csv;charset=utf-8" }), nome, function () { stato.ultimaCopia = new Date().toISOString(); salva(); disegnaAltro(); });
  });
  function scarica(blob, nome) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = nome;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function leggiCsv(testo) {
    var righe = [], riga = [], campo = "", virgolette = false;
    testo = testo.replace(/^﻿/, "");
    for (var i = 0; i < testo.length; i++) {
      var ch = testo[i];
      if (virgolette) {
        if (ch === '"' && testo[i + 1] === '"') { campo += '"'; i++; }
        else if (ch === '"') virgolette = false;
        else campo += ch;
      } else if (ch === '"') virgolette = true;
      else if (ch === ";") { riga.push(campo); campo = ""; }
      else if (ch === "\n" || ch === "\r") { if (ch === "\r" && testo[i + 1] === "\n") i++; riga.push(campo); righe.push(riga); riga = []; campo = ""; }
      else campo += ch;
    }
    if (campo || riga.length) { riga.push(campo); righe.push(riga); }
    return righe;
  }
  $("bottone-importa").addEventListener("click", function () { $("file-importa").click(); });
  $("file-importa").addEventListener("change", function () {
    var f = $("file-importa").files[0];
    if (!f) return;
    var lettore = new FileReader();
    lettore.onload = function () {
      var righe = leggiCsv(String(lettore.result));
      var spese = [], budget = {}, scartate = 0;
      righe.forEach(function (r, idx) {
        if (idx === 0 || r.length < 4 || (r.length === 1 && !r[0])) return;
        if (r[0] === "Budget mensile") return;
        if (r[0] === "BUDGET") {
          var vb = leggiImporto(r[3]), ab = /^\d{4}$/.test(r[2]) ? r[2] : annoOggi();
          if (vb) { budget[ab] = budget[ab] || {}; budget[ab][r[1]] = vb; }
          return;
        }
        var m = r[0].match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        var imp = leggiImporto(r[3]);
        if (!m || imp === null || !r[1]) { if (r.join("").trim()) scartate++; return; }
        spese.push({ id: nuovoId(), data: m[3] + "-" + m[2].padStart(2, "0") + "-" + m[1].padStart(2, "0"), descrizione: r[1], categoria: r[2] || "Altro", importo: imp });
      });
      if (!spese.length) { mostraVista("altro"); alertAltro("Nel file non ho trovato spese da ricaricare.", true); $("file-importa").value = ""; return; }
      chiedi("Nel file ci sono " + spese.length + " spese" + (scartate ? " (" + scartate + " righe non leggibili lasciate fuori)" : "") + ". Sostituiscono le " + stato.spese.length + " che sono adesso sul telefono. Procedo?", "Sì, ricarica").then(function (si) {
        $("file-importa").value = "";
        if (!si) return;
        stato.spese = spese;
        Object.keys(budget).forEach(function (a) { stato.budgetAnni[a] = Object.assign(stato.budgetAnni[a] || {}, budget[a]); });
        spese.forEach(function (s) { if (nomiCategorie().indexOf(s.categoria) === -1) stato.categorie.splice(Math.max(0, stato.categorie.length - 1), 0, { nome: s.categoria, parole: [] }); });
        salva(); disegna();
        alertAltro("Ricaricate " + spese.length + " spese.", false);
      });
    };
    lettore.readAsText(f, "utf-8");
  });
  function alertAltro(testo, errore) {
    var p = $("ultima-copia");
    p.textContent = testo;
    p.style.color = errore ? "var(--rosso)" : "";
  }
  function disegnaAltro() {
    disegnaCategorie();
    var p = $("ultima-copia"); p.style.color = "";
    if (stato.ultimaCopia) p.textContent = "Ultima copia: " + new Date(stato.ultimaCopia).toLocaleString("it-IT", { dateStyle: "medium", timeStyle: "short" }) + ".";
    else p.textContent = stato.spese.length ? "Non hai ancora salvato nessuna copia." : "";
  }

  // ---------- disegno ----------
  function disegna() {
    riempiSceltaCategorie($("campo-categoria"), false);
    if (vistaAttuale === "aggiungi") disegnaUltime();
    if (vistaAttuale === "spese") disegnaSpese();
    if (vistaAttuale === "conti") disegnaConti();
    if (vistaAttuale === "altro") disegnaAltro();
  }

  riempiSceltaCategorie($("campo-categoria"), false);
  svuotaModulo();
  disegna();
  if (!memoriaFunziona) mostraMessaggio("Questo browser non lascia salvare i dati (forse navigazione privata): le spese si perderebbero.", true);
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js").catch(function () { /* senza fuori linea, l'app funziona lo stesso */ });
  }
})();
