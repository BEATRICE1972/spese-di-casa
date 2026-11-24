// Riconosce data, importo e categoria da una frase detta o scritta.
// Esempio: "ieri revisione macchina 85 euro" -> {data: ieri, descrizione: "revisione macchina", importo: 85, categoria: "Auto"}
(function (radice) {
  "use strict";

  var CATEGORIE_DI_PARTENZA = [
    { nome: "Spesa alimentare", parole: ["spesa", "supermercato", "esselunga", "coop", "conad", "lidl", "eurospin", "carrefour", "despar", "md", "penny", "aldi", "pam", "frutta", "verdura", "macelleria", "panetteria", "pane", "pescheria", "alimentari", "latte"] },
    { nome: "Ristoranti e cene", parole: ["ristorante", "cena", "pranzo", "pizza", "pizzeria", "trattoria", "osteria", "sushi", "kebab", "hamburger", "mcdonald", "burger", "asporto", "deliveroo", "glovo", "just eat", "aperitivo", "apericena"] },
    { nome: "Bar e colazioni", parole: ["bar", "caffè", "caffe", "colazione", "cappuccino", "cornetto", "brioche", "gelato", "gelateria", "pasticceria"] },
    { nome: "Carburante", parole: ["benzina", "gasolio", "diesel", "carburante", "rifornimento", "pieno", "metano", "gpl", "distributore", "ricarica auto", "colonnina"] },
    { nome: "Auto", parole: ["revisione", "tagliando", "meccanico", "gommista", "gomme", "pneumatici", "bollo auto", "bollo", "carrozziere", "carrozzeria", "autolavaggio", "lavaggio auto", "pedaggio", "autostrada", "telepass", "parcheggio", "multa", "olio motore", "officina", "macchina", "auto"] },
    { nome: "Assicurazioni", parole: ["assicurazione", "rca", "polizza", "kasko"] },
    { nome: "Affitto", parole: ["affitto", "canone", "pigione"] },
    { nome: "Casa: bollette e spese", parole: ["bolletta", "luce", "gas", "acqua", "condominio", "tari", "rifiuti", "riscaldamento", "enel", "hera"] },
    { nome: "Telefono e internet", parole: ["telefono", "cellulare", "ricarica", "internet", "fibra", "wifi", "tim", "vodafone", "iliad", "fastweb", "windtre", "wind"] },
    { nome: "Salute", parole: ["farmacia", "medicine", "medicina", "dottore", "medico", "dentista", "visita", "analisi", "ottico", "occhiali", "ticket"] },
    { nome: "Abbigliamento", parole: ["vestiti", "scarpe", "maglia", "maglione", "pantaloni", "giacca", "giubbotto", "jeans", "camicia", "zara", "abbigliamento"] },
    { nome: "Casa e arredamento", parole: ["ikea", "mobili", "arredamento", "ferramenta", "detersivo", "detersivi", "pulizie", "elettrodomestico", "lampadina", "leroy merlin", "brico"] },
    { nome: "Svago e abbonamenti", parole: ["cinema", "concerto", "netflix", "spotify", "disney", "amazon prime", "abbonamento", "palestra", "libro", "libri", "videogioco", "gioco", "discoteca", "teatro", "museo", "partita", "stadio"] },
    { nome: "Trasporti", parole: ["treno", "autobus", "bus", "biglietto", "taxi", "uber", "metro", "aereo", "volo", "traghetto", "trenitalia", "italo"] },
    { nome: "Regali", parole: ["regalo", "regali", "compleanno", "fiori"] },
    { nome: "Altro", parole: [] }
  ];

  var NUMERI_PAROLE = {
    zero: 0, uno: 1, una: 1, un: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9, dieci: 10,
    undici: 11, dodici: 12, tredici: 13, quattordici: 14, quindici: 15, sedici: 16, diciassette: 17, diciotto: 18,
    diciannove: 19, venti: 20, trenta: 30, quaranta: 40, cinquanta: 50, sessanta: 60, settanta: 70, ottanta: 80,
    novanta: 90, cento: 100, mille: 1000
  };
  var MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
  var GIORNI = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
  var GIORNI_SENZA_ACCENTO = ["domenica", "lunedi", "martedi", "mercoledi", "giovedi", "venerdi", "sabato"];

  function senzaAccenti(s) {
    return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  function aMezzanotte(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function dataIso(d) {
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var g = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + g;
  }

  // Trova la data nella frase. Restituisce {data, resto}.
  function trovaData(testo, oggi) {
    var base = aMezzanotte(oggi);
    var t = " " + testo + " ";
    var regole = [
      { re: /\s(l'altro ieri|l altro ieri|altro ieri|ieri l'altro|avantieri)\s/i, giorni: -2 },
      { re: /\s(ieri)\s/i, giorni: -1 },
      { re: /\s(oggi|stamattina|stasera|stamani|sta mattina|sta sera)\s/i, giorni: 0 }
    ];
    for (var i = 0; i < regole.length; i++) {
      var m = t.match(regole[i].re);
      if (m) {
        var d = new Date(base);
        d.setDate(d.getDate() + regole[i].giorni);
        return { data: d, resto: t.replace(m[0], " ") };
      }
    }
    // 12/11 oppure 12/11/2026 oppure 12-11
    var mNum = t.match(/\s(?:il\s)?(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?\s/);
    if (mNum) {
      var anno = mNum[3] ? Number(mNum[3].length === 2 ? "20" + mNum[3] : mNum[3]) : base.getFullYear();
      var dn = new Date(anno, Number(mNum[2]) - 1, Number(mNum[1]));
      if (!mNum[3] && dn > base) dn.setFullYear(anno - 1);
      if (dn.getDate() === Number(mNum[1])) return { data: dn, resto: t.replace(mNum[0], " ") };
    }
    // 12 novembre
    var reMese = new RegExp("\\s(?:il\\s|l')?(\\d{1,2})\\s(" + MESI.join("|") + ")(?:\\s(\\d{4}))?\\s", "i");
    var mMese = senzaAccenti(t).match(reMese);
    if (mMese) {
      var annoM = mMese[3] ? Number(mMese[3]) : base.getFullYear();
      var dm = new Date(annoM, MESI.indexOf(mMese[2].toLowerCase()), Number(mMese[1]));
      if (!mMese[3] && dm > base) dm.setFullYear(annoM - 1);
      return { data: dm, resto: senzaAccenti(t).replace(mMese[0], " ") };
    }
    // lunedì, martedì... = l'ultimo passato (oggi compreso se è lo stesso giorno)
    var tSenza = senzaAccenti(t);
    for (var g = 0; g < 7; g++) {
      var reG = new RegExp("\\s(?:lo scorso\\s|scorso\\s)?" + GIORNI_SENZA_ACCENTO[g] + "(?:\\sscorso)?\\s", "i");
      var mg = tSenza.match(reG);
      if (mg) {
        var diff = (base.getDay() - g + 7) % 7;
        var dg = new Date(base);
        dg.setDate(dg.getDate() - diff);
        return { data: dg, resto: tSenza.replace(mg[0], " ") };
      }
    }
    return { data: base, resto: t };
  }

  // Trasforma "ottantacinque" in 85 (fino a 9999). Restituisce null se non è un numero.
  function numeroDaParola(parola) {
    var p = senzaAccenti(parola.toLowerCase());
    if (NUMERI_PAROLE[p] !== undefined) return NUMERI_PAROLE[p];
    var totale = 0, resto = p, trovato = false;
    var mM = resto.match(/^(.*?)mila(.*)$/) || resto.match(/^(mille)(.*)$/);
    if (mM) {
      var migliaia = mM[1] === "mille" ? 1 : (mM[1] === "" ? 1 : numeroDaParola(mM[1]));
      if (migliaia === null) return null;
      totale += migliaia * 1000; resto = mM[2]; trovato = true;
    }
    var mC = resto.match(/^(.*?)cento(.*)$/);
    if (mC) {
      var centinaia = mC[1] === "" ? 1 : NUMERI_PAROLE[mC[1]];
      if (centinaia === undefined) return null;
      totale += centinaia * 100; resto = mC[2]; trovato = true;
    }
    if (resto === "") return trovato ? totale : null;
    var decine = ["venti", "trenta", "quaranta", "cinquanta", "sessanta", "settanta", "ottanta", "novanta"];
    for (var i = 0; i < decine.length; i++) {
      var radiceDecina = decine[i].slice(0, -1); // "vent", "trent"...
      if (resto.indexOf(decine[i]) === 0 || resto.indexOf(radiceDecina) === 0) {
        var lungh = resto.indexOf(decine[i]) === 0 ? decine[i].length : radiceDecina.length;
        var unita = resto.slice(lungh);
        var valU = unita === "" ? 0 : NUMERI_PAROLE[unita];
        if (valU === undefined || valU > 9) return null;
        return totale + NUMERI_PAROLE[decine[i]] + valU;
      }
    }
    if (NUMERI_PAROLE[resto] !== undefined && NUMERI_PAROLE[resto] < 20) return totale + NUMERI_PAROLE[resto];
    return null;
  }

  // Trova l'importo. Restituisce {importo, resto}.
  function trovaImporto(testo) {
    var t = " " + testo + " ";
    // 85,50 / 85.50 / 1.250,00 / 85 euro e 50 / 85 e 50
    var re = /\s(?:€\s?)?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s?(?:€|euro|eur)?(?:\s(?:e|virgola)\s(\d{1,2})(?:\s(?:centesimi|cent))?)?(?=\s)/gi;
    var m, scelto = null;
    while ((m = re.exec(t)) !== null) {
      var parteIntera = m[1];
      var valore;
      if (/\.\d{3}/.test(parteIntera)) valore = Number(parteIntera.replace(/\./g, "").replace(",", "."));
      else valore = Number(parteIntera.replace(",", "."));
      if (m[2]) valore = Math.floor(valore) + Number(m[2].length === 1 ? m[2] + "0" : m[2]) / 100;
      var conEuro = /€|euro|eur/i.test(m[0]);
      if (scelto === null || conEuro) scelto = { valore: valore, pezzo: m[0], conEuro: conEuro };
      if (conEuro) break;
    }
    if (scelto) return { importo: Math.round(scelto.valore * 100) / 100, resto: t.replace(scelto.pezzo, " ") };
    // numeri a parole: "ottantacinque euro", "venti euro e cinquanta"
    var parole = t.trim().split(/\s+/);
    for (var i = 0; i < parole.length; i++) {
      var n = numeroDaParola(parole[i]);
      if (n !== null && n > 0) {
        var usate = [i];
        var valore2 = n;
        var j = i + 1;
        if (parole[j] && /^(euro|€|eur)$/i.test(parole[j])) { usate.push(j); j++; }
        if (parole[j] && /^(e|virgola)$/i.test(parole[j]) && parole[j + 1]) {
          var c = numeroDaParola(parole[j + 1]);
          if (c === null && /^\d{1,2}$/.test(parole[j + 1])) c = Number(parole[j + 1]);
          if (c !== null && c < 100) { valore2 += c / 100; usate.push(j, j + 1); }
        }
        var restoParole = parole.filter(function (_, k) { return usate.indexOf(k) === -1; });
        return { importo: Math.round(valore2 * 100) / 100, resto: " " + restoParole.join(" ") + " " };
      }
    }
    return { importo: null, resto: t };
  }

  function pulisciDescrizione(s) {
    return (" " + s + " ")
      // La dettatura del telefono aggiunge punti e virgole: si tolgono (l'importo è già stato letto).
      .replace(/[.,;:!?]+(?=\s|$)/g, " ")
      .replace(/\s(euro|eur|€|ho speso|speso|spesi|pagato|pagata|pagati|ho pagato|di|per|il|la|lo|le|i|gli|un|una|uno|al|alla|allo|ai|del|della|dal|dalla)(?=\s)/gi, function (m, p, off, tutto) {
        return " " + p + " ";
      })
      .replace(/^\s*(ho speso|ho pagato|speso|pagato|spesi|pagati)\s/i, " ")
      .replace(/\s(euro|eur|€)(?=\s)/gi, " ")
      .replace(/\s+/g, " ")
      .replace(/^\s*(di|per|il|la|lo|al|alla|e)\s/i, "")
      .replace(/\s(di|per|e|il|la|a|da|in|al|alla)\s*$/i, "")
      .trim();
  }

  // Sceglie la categoria. "imparate" = {descrizioneMinuscola: nomeCategoria} dalle correzioni fatte a mano.
  function scegliCategoria(descrizione, categorie, imparate) {
    var d = senzaAccenti(descrizione.toLowerCase());
    if (imparate) {
      if (imparate[d]) return imparate[d];
      // parola per parola, la più lunga vince
      var parole = d.split(/\s+/).filter(function (p) { return p.length > 2; }).sort(function (a, b) { return b.length - a.length; });
      for (var p = 0; p < parole.length; p++) if (imparate["#" + parole[p]]) return imparate["#" + parole[p]];
    }
    var migliore = null, lunghezza = 0;
    var testo = " " + d.replace(/[^a-z0-9' ]/g, " ") + " ";
    for (var i = 0; i < categorie.length; i++) {
      var ps = categorie[i].parole || [];
      for (var k = 0; k < ps.length; k++) {
        var parola = senzaAccenti(ps[k].toLowerCase());
        if (testo.indexOf(" " + parola + " ") !== -1 && parola.length > lunghezza) {
          migliore = categorie[i].nome; lunghezza = parola.length;
        }
      }
    }
    return migliore || "Altro";
  }

  function riconosci(frase, oggi, categorie, imparate) {
    var testo = String(frase || "").replace(/[“”"]/g, " ").trim();
    var conData = trovaData(testo, oggi || new Date());
    var conImporto = trovaImporto(conData.resto);
    var descrizione = pulisciDescrizione(conImporto.resto);
    if (descrizione) descrizione = descrizione.charAt(0).toUpperCase() + descrizione.slice(1);
    return {
      data: dataIso(conData.data),
      descrizione: descrizione,
      importo: conImporto.importo,
      categoria: scegliCategoria(descrizione, categorie || CATEGORIE_DI_PARTENZA, imparate)
    };
  }

  var esporta = {
    riconosci: riconosci,
    scegliCategoria: scegliCategoria,
    numeroDaParola: numeroDaParola,
    dataIso: dataIso,
    CATEGORIE_DI_PARTENZA: CATEGORIE_DI_PARTENZA,
    senzaAccenti: senzaAccenti,
    GIORNI: GIORNI,
    MESI: MESI
  };
  if (typeof module !== "undefined" && module.exports) module.exports = esporta;
  else radice.Riconosci = esporta;
})(typeof self !== "undefined" ? self : this);
