// EBOLA-MONITOR v4.5 — Leaflet choropleth (replaces D3 SVG map)
// Charge /drc-provinces.geojson et dessine une choroplèthe Leaflet
// Lit window.PROVINCE_DATA (synchronisé par dashboard.html)

(function () {

  // ── Alias normalisation GeoJSON OCHA ↔ noms Supabase ──
  var PROV_ALIAS = {
    'Kongo Central'  : 'Kongo-Central',
    'Équateur'       : 'Equateur',
    'Mai-Ndombe'     : 'Maï-Ndombe',
    'Maï-Ndombe'     : 'Maï-Ndombe',
    'Kasai-Oriental' : 'Kasaï-Oriental',
    'Kasai Oriental' : 'Kasaï-Oriental',
    'Kasai Central'  : 'Kasaï-Central',
    'Kasai-Central'  : 'Kasaï-Central',
    'Kasai'          : 'Kasaï',
    'Nord Kivu'      : 'Nord-Kivu',
    'Sud Kivu'       : 'Sud-Kivu',
    'Bas Uele'       : 'Bas-Uele',
    'Haut Uele'      : 'Haut-Uele',
    'Bas-Uélé'       : 'Bas-Uele',
    'Haut-Uélé'      : 'Haut-Uele',
    'Bas-Uele'       : 'Bas-Uele',
    'Haut-Uele'      : 'Haut-Uele',
    'Kasaï'          : 'Kasaï',
    'Kongo-Central'  : 'Kongo-Central',
    'Lualaba'        : 'Lualaba',
    'Haut-Katanga'   : 'Haut-Katanga',
    'Haut-Lomami'    : 'Haut-Lomami',
    'Tanganyika'     : 'Tanganyika',
    'Maniema'        : 'Maniema',
    'Ituri'          : 'Ituri',
    'Kinshasa'       : 'Kinshasa',
  };

  window.normProvName = function (n) {
    if (!n) return n;
    return PROV_ALIAS[n] || n;
  };

  window.getProvDataByName = function () {
    var m = {};
    (window.PROVINCE_DATA || []).forEach(function (p) {
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

  // ── Variables Leaflet ──
  var _map = null;
  var _geoLayer = null;
  var _geo = null;

  // Couleur choroplèthe
  function getColor(cases, max) {
    if (!cases || cases === 0) return '#1b2436';
    var t = Math.min(1, cases / max);
    if (t > 0.75) return '#c1121f';
    if (t > 0.50) return '#e63946';
    if (t > 0.25) return '#f4a261';
    return '#f8c090';
  }

  function buildLeafletMap(geo) {
    _geo = geo;

    // Charger Leaflet CSS si absent
    if (!document.getElementById('leaflet-css')) {
      var lnk = document.createElement('link');
      lnk.id   = 'leaflet-css';
      lnk.rel  = 'stylesheet';
      lnk.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(lnk);
    }

    // Charger Leaflet JS si absent
    function initAfterLeaflet() {
      var el = document.getElementById('mapDrc');
      if (!el) return;

      // Remplacer le SVG par une div Leaflet
      var container = el.parentNode;
      var div = document.createElement('div');
      div.id    = 'mapLeaflet';
      div.style.cssText = 'width:100%;height:400px;border-radius:6px;background:#07090c;position:relative;z-index:0;';
      container.replaceChild(div, el);

      if (_map) { _map.remove(); _map = null; }

      _map = L.map('mapLeaflet', {
        center: [-3.5, 24],
        zoom: 5,
        zoomControl: true,
        scrollWheelZoom: false,
        attributionControl: false,
      });

      // Fond sombre CartoDB
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
        maxZoom: 10,
        subdomains: 'abcd',
      }).addTo(_map);

      window.drawDrcMap = function () {
        if (!_map || !_geo) return;
        var provData = window.getProvDataByName();
        var mode     = window.mapMode || 'cases';

        // Calcul max
        var vals = Object.values(provData).map(function (d) {
          return mode === 'cfr' ? d.cfr : mode === 'deaths' ? d.deaths : d.cases;
        }).filter(function (v) { return v > 0; });
        var maxVal = vals.length ? Math.max.apply(null, vals) : 1;

        if (_geoLayer) { _map.removeLayer(_geoLayer); }

        _geoLayer = L.geoJSON(_geo, {
          style: function (feature) {
            var k = window.normProvName(feature.properties.name);
            var d = provData[k];
            var v = d ? (mode === 'cfr' ? d.cfr : mode === 'deaths' ? d.deaths : d.cases) : 0;
            return {
              fillColor  : getColor(v, maxVal),
              fillOpacity: d && d.cases ? 0.82 : 0.35,
              color      : d && d.cases ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)',
              weight     : d && d.cases ? 1.2 : 0.5,
            };
          },
          onEachFeature: function (feature, layer) {
            var k = window.normProvName(feature.properties.name);
            var d = provData[k];
            var name = feature.properties.name;

            if (d && d.cases > 0) {
              var cfr = d.deaths && d.cases ? ((d.deaths / d.cases) * 100).toFixed(1) : (d.cfr || 0);
              var zonesStr = d.zones && d.zones.length ? d.zones.join(', ') : '—';
              var html =
                '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:12px;min-width:160px">' +
                '<strong style="font-size:13px">' + name + '</strong>' +
                '<div style="margin-top:4px;font-size:10px;color:#7a8694">Zones: ' + zonesStr + '</div>' +
                '<div style="display:flex;justify-content:space-between;margin-top:6px"><span style="color:#7a8694">Cas conf.</span><span style="color:#ff8087;font-weight:600">' + d.cases + '</span></div>' +
                (d.suspected > 0 ? '<div style="display:flex;justify-content:space-between"><span style="color:#7a8694">Suspects</span><span style="color:#f4a261">' + d.suspected + '</span></div>' : '') +
                '<div style="display:flex;justify-content:space-between"><span style="color:#7a8694">Décès</span><span>' + d.deaths + '</span></div>' +
                (d.recovered > 0 ? '<div style="display:flex;justify-content:space-between"><span style="color:#7a8694">Guéris</span><span style="color:#52b788">' + d.recovered + '</span></div>' : '') +
                '<div style="display:flex;justify-content:space-between"><span style="color:#7a8694">CFR</span><span style="color:' + (parseFloat(cfr) > 15 ? '#ff8087' : parseFloat(cfr) > 8 ? '#f4a261' : '#52b788') + '">' + cfr + '%</span></div>' +
                '<div style="display:flex;justify-content:space-between"><span style="color:#7a8694">Statut</span><span>' + (d.status || '—') + '</span></div>' +
                '</div>';
              layer.bindTooltip(html, { sticky: true, className: 'ebola-tooltip', opacity: 1 });

              // Label valeur au centre
              var val = mode === 'cfr' ? (d.cfr || 0) + '%' : mode === 'deaths' ? d.deaths : d.cases;
              var c = layer.getBounds().getCenter();
              L.marker(c, {
                icon: L.divIcon({
                  className : '',
                  html      : '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:10px;font-weight:600;color:' +
                    (d.status === 'Active' ? '#ff8087' : '#f4a261') + ';text-shadow:0 1px 3px #000,0 0 8px #000;white-space:nowrap;text-align:center">' +
                    '<div style="font-size:9px;color:rgba(255,255,255,0.7)">' + name.substring(0, 8) + '</div>' +
                    '<div>' + val + '</div></div>',
                  iconSize  : [80, 32],
                  iconAnchor: [40, 16],
                }),
                interactive: false,
              }).addTo(_map);
            } else {
              layer.bindTooltip('<div style="font-family:\'IBM Plex Mono\',monospace;font-size:11px"><strong>' + name + '</strong><div style="color:#7a8694;font-size:10px">Aucun cas signalé</div></div>', { sticky: true, className: 'ebola-tooltip', opacity: 1 });
            }

            layer.on('mouseover', function () { layer.setStyle({ fillOpacity: 0.95, weight: 2 }); });
            layer.on('mouseout',  function () { _geoLayer.resetStyle(layer); });
          },
        }).addTo(_map);

        // Légende
        var legEl = document.getElementById('mapLeg');
        if (legEl) {
          legEl.innerHTML = [
            { col: '#c1121f',             label: 'Cas élevés' },
            { col: '#e63946',             label: 'Cas modérés' },
            { col: '#f4a261',             label: 'Cas faibles' },
            { col: '#f8c090',             label: 'Cas très faibles' },
            { col: '#1b2436',             label: 'Aucun cas' },
          ].map(function (l) {
            return '<div class="leg-i"><div class="leg-sw" style="background:' + l.col + ';border-radius:3px;width:12px;height:12px"></div>' + l.label + '</div>';
          }).join('');
        }
      };

      // Appel initial
      window.mapMode = window.mapMode || 'cases';
      window.drawDrcMap();
    }

    if (typeof L !== 'undefined') {
      initAfterLeaflet();
    } else {
      var s = document.createElement('script');
      s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      s.onload = initAfterLeaflet;
      document.head.appendChild(s);
    }
  }

  // ── CSS tooltip Leaflet ──
  var style = document.createElement('style');
  style.textContent = [
    '.ebola-tooltip {',
    '  background: #0e1218 !important;',
    '  border: 1px solid rgba(255,255,255,0.15) !important;',
    '  border-radius: 8px !important;',
    '  color: #dde3ea !important;',
    '  padding: 10px 14px !important;',
    '  box-shadow: 0 8px 24px rgba(0,0,0,0.5) !important;',
    '  font-family: "IBM Plex Mono", monospace;',
    '}',
    '.ebola-tooltip::before { display: none !important; }',
    '.leaflet-control-zoom a {',
    '  background: #0e1218 !important;',
    '  color: #dde3ea !important;',
    '  border-color: rgba(255,255,255,0.1) !important;',
    '}',
    '.leaflet-control-zoom a:hover { background: #1b2436 !important; }',
  ].join('\n');
  document.head.appendChild(style);

  // ── Chargement GeoJSON ──
  function initMap() {
    fetch('/drc-provinces.geojson')
      .then(function (r) {
        if (!r.ok) throw new Error('GeoJSON HTTP ' + r.status);
        return r.json();
      })
      .then(buildLeafletMap)
      .catch(function (e) {
        console.warn('[MAP] GeoJSON load failed:', e.message);
        var el = document.getElementById('mapDrc') || document.getElementById('mapLeaflet');
        if (el) el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:200px;font-family:IBM Plex Mono,monospace;font-size:12px;color:#7a8694">Carte indisponible</div>';
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMap);
  } else {
    initMap();
  }

})();
