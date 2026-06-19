// EBOLA-MONITOR v4.6 — Leaflet choropleth v45
// Corrections : accumulation markers, lookup ADM1_FR/EN, fallback PROVINCE_DATA, SVG→div robuste
// Charge /drc-provinces.geojson (formes officielles OCHA)

(function () {
  'use strict';

  // ── Alias normalisation GeoJSON OCHA ↔ noms dashboard ──
  var PROV_ALIAS = {
    'Kongo Central'   : 'Kongo-Central',
    'Kongo-Central'   : 'Kongo-Central',
    'Équateur'        : 'Equateur',
    'Equateur'        : 'Equateur',
    'Mai-Ndombe'      : 'Maï-Ndombe',
    'Maï-Ndombe'      : 'Maï-Ndombe',
    'Kasai-Oriental'  : 'Kasaï-Oriental',
    'Kasai Oriental'  : 'Kasaï-Oriental',
    'Kasaï-Oriental'  : 'Kasaï-Oriental',
    'Kasai Central'   : 'Kasaï-Central',
    'Kasai-Central'   : 'Kasaï-Central',
    'Kasaï-Central'   : 'Kasaï-Central',
    'Kasai'           : 'Kasaï',
    'Kasaï'           : 'Kasaï',
    'Nord Kivu'       : 'Nord-Kivu',
    'Nord-Kivu'       : 'Nord-Kivu',
    'Sud Kivu'        : 'Sud-Kivu',
    'Sud-Kivu'        : 'Sud-Kivu',
    'Bas Uele'        : 'Bas-Uele',
    'Bas-Uele'        : 'Bas-Uele',
    'Bas-Uélé'        : 'Bas-Uele',
    'Haut Uele'       : 'Haut-Uele',
    'Haut-Uele'       : 'Haut-Uele',
    'Haut-Uélé'       : 'Haut-Uele',
    'Lualaba'         : 'Lualaba',
    'Haut-Katanga'    : 'Haut-Katanga',
    'Haut-Lomami'     : 'Haut-Lomami',
    'Tanganyika'      : 'Tanganyika',
    'Maniema'         : 'Maniema',
    'Ituri'           : 'Ituri',
    'Kinshasa'        : 'Kinshasa',
  };

  window.normProvName = function (n) {
    if (!n) return n;
    var t = n.trim();
    return PROV_ALIAS[t] || t;
  };

  // Données statiques fallback (si window.PROVINCE_DATA absent ou vide)
  var STATIC_DATA = [
    { province: 'Ituri',     cases: 412, deaths: 84, recovered: 8,  suspected: 0, cfr: 20.4, status: 'Active', zone: 'Multi-ZS' },
    { province: 'Nord-Kivu', cases: 186, deaths: 37, recovered: 6,  suspected: 0, cfr: 19.9, status: 'Active', zone: 'Multi-ZS' },
    { province: 'Sud-Kivu',  cases: 37,  deaths: 6,  recovered: 1,  suspected: 0, cfr: 16.2, status: 'Active', zone: 'Uvira'    },
  ];

  window.getProvDataByName = function () {
    var src = (window.PROVINCE_DATA && window.PROVINCE_DATA.length > 0)
      ? window.PROVINCE_DATA
      : STATIC_DATA;
    var m = {};
    src.forEach(function (p) {
      if (p.country === 'Uganda' || p.province === 'Uganda') return;
      var key = window.normProvName(p.province);
      if (!m[key]) m[key] = { cases: 0, deaths: 0, recovered: 0, suspected: 0, cfr: 0, status: '', source: '', zones: [] };
      m[key].cases     += p.cases     || 0;
      m[key].deaths    += p.deaths    || 0;
      m[key].recovered += p.recovered || 0;
      m[key].suspected += p.suspected || 0;
      m[key].cfr        = p.cfr       || m[key].cfr;
      if (p.status) m[key].status = p.status;
      if (p.source) m[key].source = p.source;
      if (p.zone)   m[key].zones.push(p.zone);
    });
    return m;
  };

  // ── State Leaflet ──
  var _map        = null;
  var _geoLayer   = null;
  var _labelLayer = null;  // LayerGroup dédié labels — .clearLayers() à chaque redraw
  var _geo        = null;

  // Palette choroplèthe
  function getColor(cases, max) {
    if (!cases || cases === 0) return '#1b2436';
    var t = Math.min(1, cases / max);
    if (t > 0.75) return '#c1121f';
    if (t > 0.50) return '#e63946';
    if (t > 0.25) return '#f4a261';
    return '#f8c090';
  }

  // Résoudre le nom depuis les propriétés GeoJSON OCHA (plusieurs champs possibles)
  function resolveFeatureName(props) {
    return (props && (
      props.ADM1_FR || props.ADM1_EN || props.name ||
      props.NAME    || props.NAME_1  || props.nom  || ''
    )) || '';
  }

  function buildLeafletMap(geo) {
    _geo = geo;

    // Charger CSS Leaflet
    if (!document.getElementById('leaflet-css')) {
      var lnk  = document.createElement('link');
      lnk.id   = 'leaflet-css';
      lnk.rel  = 'stylesheet';
      lnk.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(lnk);
    }

    function initAfterLeaflet() {
      // Trouver l'élément carte (SVG legacy ou div Leaflet existante)
      var el = document.getElementById('mapDrc') || document.getElementById('mapLeaflet');
      if (!el) return;

      // Si c'est encore le SVG legacy → le remplacer par une div
      if (el.tagName && el.tagName.toLowerCase() === 'svg') {
        var div       = document.createElement('div');
        div.id        = 'mapLeaflet';
        div.style.cssText = 'width:100%;height:420px;border-radius:6px;background:#07090c;position:relative;z-index:0;';
        el.parentNode.replaceChild(div, el);
        el = div;
      }

      // Détruire carte précédente si elle existe
      if (_map) { _map.remove(); _map = null; _geoLayer = null; _labelLayer = null; }

      _map = L.map(el.id, {
        center: [-3.5, 24],
        zoom: 5,
        zoomControl: true,
        scrollWheelZoom: false,
        attributionControl: false,
      });

      // Fond CartoDB sombre sans labels
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
        maxZoom: 10,
        subdomains: 'abcd',
      }).addTo(_map);

      // LayerGroup pour labels — vidé proprement à chaque redraw
      _labelLayer = L.layerGroup().addTo(_map);

      // ── drawDrcMap ────────────────────────────────────────────────────────
      window.drawDrcMap = function () {
        if (!_map || !_geo) return;

        var provData = window.getProvDataByName();
        var mode     = window.mapMode || 'cases';

        // Calcul du max pour l'échelle de couleurs
        var vals = Object.values(provData).map(function (d) {
          return mode === 'cfr' ? d.cfr : mode === 'deaths' ? d.deaths : d.cases;
        }).filter(function (v) { return v > 0; });
        var maxVal = vals.length ? Math.max.apply(null, vals) : 1;

        // Nettoyage des layers précédents
        if (_geoLayer)   { _map.removeLayer(_geoLayer); _geoLayer = null; }
        if (_labelLayer) { _labelLayer.clearLayers(); }

        _geoLayer = L.geoJSON(_geo, {

          style: function (feature) {
            var rawName = resolveFeatureName(feature.properties);
            var k = window.normProvName(rawName);
            var d = provData[k];
            var v = d ? (mode === 'cfr' ? d.cfr : mode === 'deaths' ? d.deaths : d.cases) : 0;
            return {
              fillColor   : getColor(v, maxVal),
              fillOpacity : d && d.cases > 0 ? 0.82 : 0.28,
              color       : d && d.cases > 0 ? 'rgba(255,255,255,0.30)' : 'rgba(255,255,255,0.07)',
              weight      : d && d.cases > 0 ? 1.4 : 0.5,
            };
          },

          onEachFeature: function (feature, layer) {
            var rawName = resolveFeatureName(feature.properties);
            var k    = window.normProvName(rawName);
            var d    = provData[k];
            var name = rawName || k;

            if (d && d.cases > 0) {
              var cfr      = d.deaths && d.cases
                ? ((d.deaths / d.cases) * 100).toFixed(1)
                : (d.cfr || 0);
              var zonesStr = d.zones && d.zones.length ? d.zones.join(', ') : '—';
              var val      = mode === 'cfr'    ? (d.cfr || 0) + '%'
                           : mode === 'deaths' ? d.deaths
                           : d.cases;

              // Tooltip riche
              layer.bindTooltip(
                '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:12px;min-width:172px">' +
                '<strong style="font-size:13px;color:#fff">' + name + '</strong>' +
                '<div style="margin-top:4px;font-size:10px;color:#7a8694">Zones: ' + zonesStr + '</div>' +
                '<div style="display:flex;justify-content:space-between;margin-top:6px">' +
                  '<span style="color:#7a8694">Cas conf.</span>' +
                  '<span style="color:#ff8087;font-weight:600">' + d.cases + '</span></div>' +
                (d.suspected > 0
                  ? '<div style="display:flex;justify-content:space-between">' +
                    '<span style="color:#7a8694">Suspects</span>' +
                    '<span style="color:#f4a261">' + d.suspected + '</span></div>'
                  : '') +
                '<div style="display:flex;justify-content:space-between">' +
                  '<span style="color:#7a8694">Décès</span><span>' + d.deaths + '</span></div>' +
                (d.recovered > 0
                  ? '<div style="display:flex;justify-content:space-between">' +
                    '<span style="color:#7a8694">Guéris</span>' +
                    '<span style="color:#52b788">' + d.recovered + '</span></div>'
                  : '') +
                '<div style="display:flex;justify-content:space-between">' +
                  '<span style="color:#7a8694">CFR</span>' +
                  '<span style="color:' + (parseFloat(cfr) > 15 ? '#ff8087' : parseFloat(cfr) > 8 ? '#f4a261' : '#52b788') + '">' +
                  cfr + '%</span></div>' +
                '<div style="display:flex;justify-content:space-between">' +
                  '<span style="color:#7a8694">Statut</span><span>' + (d.status || '—') + '</span></div>' +
                '</div>',
                { sticky: true, className: 'ebola-tooltip', opacity: 1 }
              );

              // Label centré — dans _labelLayer pour éviter l'accumulation
              try {
                var center = layer.getBounds().getCenter();
                _labelLayer.addLayer(
                  L.marker(center, {
                    icon: L.divIcon({
                      className : '',
                      html      :
                        '<div style="' +
                        'font-family:\'IBM Plex Mono\',monospace;' +
                        'font-size:10px;font-weight:600;' +
                        'color:' + (d.status === 'Active' ? '#ff8087' : '#f4a261') + ';' +
                        'text-shadow:0 1px 3px #000,0 0 8px #000;' +
                        'white-space:nowrap;text-align:center;' +
                        'transform:translate(-50%,-50%);position:absolute;' +
                        'pointer-events:none">' +
                        '<div style="font-size:9px;color:rgba(255,255,255,0.75)">' +
                        name.substring(0, 12) + '</div>' +
                        '<div>' + val + '</div></div>',
                      iconSize  : [1, 1],
                      iconAnchor: [0, 0],
                    }),
                    interactive: false,
                  })
                );
              } catch (e) { /* province non-polygonale, skip */ }

            } else {
              layer.bindTooltip(
                '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:11px">' +
                '<strong style="color:#fff">' + name + '</strong>' +
                '<div style="color:#7a8694;font-size:10px;margin-top:3px">Aucun cas signalé</div></div>',
                { sticky: true, className: 'ebola-tooltip', opacity: 1 }
              );
            }

            layer.on('mouseover', function () { layer.setStyle({ fillOpacity: 0.95, weight: 2.5 }); });
            layer.on('mouseout',  function () { _geoLayer.resetStyle(layer); });
          },
        }).addTo(_map);

        // Légende
        var legEl = document.getElementById('mapLeg');
        if (legEl) {
          legEl.innerHTML = [
            { col: '#c1121f', label: 'Très élevé' },
            { col: '#e63946', label: 'Élevé'      },
            { col: '#f4a261', label: 'Modéré'     },
            { col: '#f8c090', label: 'Faible'     },
            { col: '#1b2436', label: 'Aucun cas'  },
          ].map(function (l) {
            return '<div class="leg-i">' +
              '<div class="leg-sw" style="background:' + l.col +
              ';border-radius:3px;width:12px;height:12px;flex-shrink:0"></div>' +
              l.label + '</div>';
          }).join('');
        }

        // Sync tabs mode [data-map-mode]
        document.querySelectorAll('[data-map-mode]').forEach(function (t) {
          t.classList.toggle('on', t.getAttribute('data-map-mode') === mode);
        });
      };

      window.mapMode = window.mapMode || 'cases';
      window.drawDrcMap();
    }

    if (typeof L !== 'undefined') {
      initAfterLeaflet();
    } else {
      var s    = document.createElement('script');
      s.src    = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      s.onload = initAfterLeaflet;
      document.head.appendChild(s);
    }
  }

  // ── CSS Leaflet & tooltip ──
  var style = document.createElement('style');
  style.textContent = [
    '.ebola-tooltip {',
    '  background: #0e1218 !important;',
    '  border: 1px solid rgba(255,255,255,0.15) !important;',
    '  border-radius: 8px !important;',
    '  color: #dde3ea !important;',
    '  padding: 10px 14px !important;',
    '  box-shadow: 0 8px 24px rgba(0,0,0,0.5) !important;',
    '}',
    '.ebola-tooltip::before { display:none !important; }',
    '.leaflet-container { background: #07090c !important; }',
    '.leaflet-control-zoom a {',
    '  background: #0e1218 !important;',
    '  color: #dde3ea !important;',
    '  border-color: rgba(255,255,255,0.12) !important;',
    '}',
    '.leaflet-control-zoom a:hover { background: #1b2436 !important; }',
    '#mapLeaflet { border-radius: 6px; overflow: hidden; }',
  ].join('\n');
  document.head.appendChild(style);

  // ── Chargement GeoJSON ──
  function initMapLeaflet() {
    fetch('/drc-provinces.geojson')
      .then(function (r) {
        if (!r.ok) throw new Error('GeoJSON HTTP ' + r.status);
        return r.json();
      })
      .then(buildLeafletMap)
      .catch(function (e) {
        console.warn('[MAP v45] GeoJSON load failed:', e.message);
        var el = document.getElementById('mapDrc') || document.getElementById('mapLeaflet');
        if (el) {
          el.innerHTML =
            '<div style="display:flex;align-items:center;justify-content:center;' +
            'height:200px;font-family:\'IBM Plex Mono\',monospace;font-size:12px;color:#7a8694">' +
            'Carte indisponible — ' + e.message + '</div>';
        }
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMapLeaflet);
  } else {
    initMapLeaflet();
  }

})();
