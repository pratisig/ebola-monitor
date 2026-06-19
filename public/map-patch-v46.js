// EBOLA-MONITOR — Leaflet choropleth v46
// Charge /drc-provinces.geojson (26 provinces, coordonnees reelles GADM/NaturalEarth)
// Corrections v46 : GeoJSON embarque dans le repo, lookup ADM1_FR/EN, LayerGroup labels, fallback data

(function () {
  'use strict';

  var PROV_ALIAS = {
    'Kongo Central'   : 'Kongo-Central',
    'Kongo-Central'   : 'Kongo-Central',
    '\u00c9quateur'   : 'Equateur',
    'Equateur'        : 'Equateur',
    'Mai-Ndombe'      : 'Ma\u00ef-Ndombe',
    'Ma\u00ef-Ndombe' : 'Ma\u00ef-Ndombe',
    'Kasai-Oriental'  : 'Kasa\u00ef-Oriental',
    'Kasai Oriental'  : 'Kasa\u00ef-Oriental',
    'Kasa\u00ef-Oriental' : 'Kasa\u00ef-Oriental',
    'Kasai Central'   : 'Kasa\u00ef-Central',
    'Kasai-Central'   : 'Kasa\u00ef-Central',
    'Kasa\u00ef-Central'  : 'Kasa\u00ef-Central',
    'Kasai'           : 'Kasa\u00ef',
    'Kasa\u00ef'       : 'Kasa\u00ef',
    'Nord Kivu'       : 'Nord-Kivu',
    'Nord-Kivu'       : 'Nord-Kivu',
    'Sud Kivu'        : 'Sud-Kivu',
    'Sud-Kivu'        : 'Sud-Kivu',
    'Bas Uele'        : 'Bas-Uele',
    'Bas-Uele'        : 'Bas-Uele',
    'Bas-U\u00e9l\u00e9': 'Bas-Uele',
    'Haut Uele'       : 'Haut-Uele',
    'Haut-Uele'       : 'Haut-Uele',
    'Haut-U\u00e9l\u00e9': 'Haut-Uele',
    'Lualaba'         : 'Lualaba',
    'Haut-Katanga'    : 'Haut-Katanga',
    'Haut-Lomami'     : 'Haut-Lomami',
    'Tanganyika'      : 'Tanganyika',
    'Maniema'         : 'Maniema',
    'Ituri'           : 'Ituri',
    'Kinshasa'        : 'Kinshasa',
    'Tshopo'          : 'Tshopo',
    'Mongala'         : 'Mongala',
    'Nord-Ubangi'     : 'Nord-Ubangi',
    'Sud-Ubangi'      : 'Sud-Ubangi',
    'Lomami'          : 'Lomami',
    'Sankuru'         : 'Sankuru',
    'Tshuapa'         : 'Tshuapa',
  };

  window.normProvName = function (n) {
    if (!n) return n;
    return PROV_ALIAS[n.trim()] || n.trim();
  };

  var STATIC_DATA = [
    { province: 'Ituri',     cases: 412, deaths: 84, recovered: 8,  suspected: 0, cfr: 20.4, status: 'Active', zone: 'Multi-ZS' },
    { province: 'Nord-Kivu', cases: 186, deaths: 37, recovered: 6,  suspected: 0, cfr: 19.9, status: 'Active', zone: 'Multi-ZS' },
    { province: 'Sud-Kivu',  cases: 37,  deaths: 6,  recovered: 1,  suspected: 0, cfr: 16.2, status: 'Active', zone: 'Uvira'    },
  ];

  window.getProvDataByName = function () {
    var src = (window.PROVINCE_DATA && window.PROVINCE_DATA.length > 0)
      ? window.PROVINCE_DATA : STATIC_DATA;
    var m = {};
    src.forEach(function (p) {
      if (p.country === 'Uganda' || p.province === 'Uganda') return;
      var key = window.normProvName(p.province);
      if (!m[key]) m[key] = { cases:0, deaths:0, recovered:0, suspected:0, cfr:0, status:'', zones:[] };
      m[key].cases     += p.cases     || 0;
      m[key].deaths    += p.deaths    || 0;
      m[key].recovered += p.recovered || 0;
      m[key].suspected += p.suspected || 0;
      m[key].cfr        = p.cfr       || m[key].cfr;
      if (p.status) m[key].status = p.status;
      if (p.zone)   m[key].zones.push(p.zone);
    });
    return m;
  };

  var _map = null, _geoLayer = null, _labelLayer = null, _geo = null;

  function getColor(v, max) {
    if (!v || v === 0) return '#1b2436';
    var t = Math.min(1, v / max);
    if (t > 0.75) return '#c1121f';
    if (t > 0.50) return '#e63946';
    if (t > 0.25) return '#f4a261';
    return '#f8c090';
  }

  function resolveName(props) {
    return (props && (props.ADM1_FR || props.ADM1_EN || props.name || props.NAME || props.NAME_1 || '')) || '';
  }

  function buildMap(geo) {
    _geo = geo;
    if (!document.getElementById('leaflet-css')) {
      var lnk = document.createElement('link');
      lnk.id = 'leaflet-css'; lnk.rel = 'stylesheet';
      lnk.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(lnk);
    }
    function init() {
      var el = document.getElementById('mapDrc') || document.getElementById('mapLeaflet');
      if (!el) { console.warn('[MAP v46] no map container found'); return; }

      // Remplacer SVG ou tout element non-div par une vraie div
      if (!el || el.tagName.toLowerCase() !== 'div') {
        var div = document.createElement('div');
        div.id = 'mapLeaflet';
        div.style.cssText = 'width:100%;height:460px;border-radius:6px;background:#07090c;position:relative;z-index:0;';
        el.parentNode.replaceChild(div, el);
        el = div;
      } else {
        el.id = 'mapLeaflet';
        el.style.height = el.style.height || '460px';
      }

      if (_map) { _map.remove(); _map = null; _geoLayer = null; _labelLayer = null; }

      _map = L.map('mapLeaflet', {
        center: [-3.5, 24], zoom: 5,
        zoomControl: true, scrollWheelZoom: false, attributionControl: false,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
        maxZoom: 10, subdomains: 'abcd',
      }).addTo(_map);

      _labelLayer = L.layerGroup().addTo(_map);

      // ── drawDrcMap ───────────────────────────────────────────
      window.drawDrcMap = function () {
        if (!_map || !_geo) return;
        var provData = window.getProvDataByName();
        var mode     = window.mapMode || 'cases';
        var vals = Object.values(provData).map(function (d) {
          return mode === 'cfr' ? d.cfr : mode === 'deaths' ? d.deaths : d.cases;
        }).filter(function (v) { return v > 0; });
        var maxVal = vals.length ? Math.max.apply(null, vals) : 1;

        if (_geoLayer)   { _map.removeLayer(_geoLayer); _geoLayer = null; }
        if (_labelLayer) { _labelLayer.clearLayers(); }

        _geoLayer = L.geoJSON(_geo, {
          style: function (feature) {
            var k = window.normProvName(resolveName(feature.properties));
            var d = provData[k];
            var v = d ? (mode === 'cfr' ? d.cfr : mode === 'deaths' ? d.deaths : d.cases) : 0;
            return {
              fillColor   : getColor(v, maxVal),
              fillOpacity : d && d.cases > 0 ? 0.82 : 0.25,
              color       : d && d.cases > 0 ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.07)',
              weight      : d && d.cases > 0 ? 1.4 : 0.5,
            };
          },
          onEachFeature: function (feature, layer) {
            var rawName = resolveName(feature.properties);
            var k       = window.normProvName(rawName);
            var d       = provData[k];
            var name    = rawName || k;

            if (d && d.cases > 0) {
              var cfr      = d.deaths && d.cases ? ((d.deaths / d.cases) * 100).toFixed(1) : (d.cfr || 0);
              var zonesStr = d.zones && d.zones.length ? d.zones.join(', ') : '\u2014';
              var val      = mode === 'cfr' ? (d.cfr || 0) + '%' : mode === 'deaths' ? d.deaths : d.cases;
              var cfrCol   = parseFloat(cfr) > 15 ? '#ff8087' : parseFloat(cfr) > 8 ? '#f4a261' : '#52b788';

              layer.bindTooltip(
                '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:12px;min-width:172px">' +
                '<strong style="font-size:13px;color:#fff">' + name + '</strong>' +
                '<div style="margin-top:4px;font-size:10px;color:#7a8694">Zones: ' + zonesStr + '</div>' +
                '<div style="display:flex;justify-content:space-between;margin-top:6px">' +
                '<span style="color:#7a8694">Cas conf.</span><span style="color:#ff8087;font-weight:600">' + d.cases + '</span></div>' +
                (d.suspected > 0 ? '<div style="display:flex;justify-content:space-between"><span style="color:#7a8694">Suspects</span><span style="color:#f4a261">' + d.suspected + '</span></div>' : '') +
                '<div style="display:flex;justify-content:space-between"><span style="color:#7a8694">D\u00e9c\u00e8s</span><span>' + d.deaths + '</span></div>' +
                (d.recovered > 0 ? '<div style="display:flex;justify-content:space-between"><span style="color:#7a8694">Gu\u00e9ris</span><span style="color:#52b788">' + d.recovered + '</span></div>' : '') +
                '<div style="display:flex;justify-content:space-between"><span style="color:#7a8694">CFR</span><span style="color:' + cfrCol + '">' + cfr + '%</span></div>' +
                '<div style="display:flex;justify-content:space-between"><span style="color:#7a8694">Statut</span><span>' + (d.status || '\u2014') + '</span></div></div>',
                { sticky: true, className: 'ebola-tooltip', opacity: 1 }
              );

              try {
                var center = layer.getBounds().getCenter();
                _labelLayer.addLayer(L.marker(center, {
                  icon: L.divIcon({
                    className: '',
                    html: '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:10px;font-weight:600;' +
                          'color:' + (d.status === 'Active' ? '#ff8087' : '#f4a261') + ';' +
                          'text-shadow:0 1px 3px #000,0 0 8px #000;white-space:nowrap;text-align:center;' +
                          'transform:translate(-50%,-50%);position:absolute;pointer-events:none">' +
                          '<div style="font-size:9px;color:rgba(255,255,255,0.75)">' + name.substring(0,12) + '</div>' +
                          '<div>' + val + '</div></div>',
                    iconSize: [1,1], iconAnchor: [0,0],
                  }),
                  interactive: false,
                }));
              } catch(e) {}
            } else {
              layer.bindTooltip(
                '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:11px">' +
                '<strong style="color:#fff">' + name + '</strong>' +
                '<div style="color:#7a8694;font-size:10px;margin-top:3px">Aucun cas signal\u00e9</div></div>',
                { sticky: true, className: 'ebola-tooltip', opacity: 1 }
              );
            }
            layer.on('mouseover', function () { layer.setStyle({ fillOpacity: 0.95, weight: 2.5 }); });
            layer.on('mouseout',  function () { _geoLayer.resetStyle(layer); });
          },
        }).addTo(_map);

        var legEl = document.getElementById('mapLeg');
        if (legEl) {
          legEl.innerHTML = [
            { col:'#c1121f', label:'Tr\u00e8s \u00e9lev\u00e9' },
            { col:'#e63946', label:'\u00c9lev\u00e9'      },
            { col:'#f4a261', label:'Mod\u00e9r\u00e9'     },
            { col:'#f8c090', label:'Faible'     },
            { col:'#1b2436', label:'Aucun cas'  },
          ].map(function(l){
            return '<div class="leg-i"><div class="leg-sw" style="background:'+l.col+';border-radius:3px;width:12px;height:12px;flex-shrink:0"></div>'+l.label+'</div>';
          }).join('');
        }
        document.querySelectorAll('[data-map-mode]').forEach(function(t){
          t.classList.toggle('on', t.getAttribute('data-map-mode') === mode);
        });
      };

      window.mapMode = window.mapMode || 'cases';
      window.drawDrcMap();
    }

    if (typeof L !== 'undefined') { init(); }
    else {
      var s = document.createElement('script');
      s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      s.onload = init;
      document.head.appendChild(s);
    }
  }

  // CSS
  var style = document.createElement('style');
  style.textContent = '.ebola-tooltip{background:#0e1218!important;border:1px solid rgba(255,255,255,.15)!important;border-radius:8px!important;color:#dde3ea!important;padding:10px 14px!important;box-shadow:0 8px 24px rgba(0,0,0,.5)!important}.ebola-tooltip::before{display:none!important}.leaflet-container{background:#07090c!important}.leaflet-control-zoom a{background:#0e1218!important;color:#dde3ea!important;border-color:rgba(255,255,255,.12)!important}.leaflet-control-zoom a:hover{background:#1b2436!important}#mapLeaflet{border-radius:6px;overflow:hidden}';
  document.head.appendChild(style);

  // Init
  function initMapLeaflet() {
    fetch('/drc-provinces.geojson')
      .then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
      .then(buildMap)
      .catch(function(e){
        console.warn('[MAP v46] GeoJSON load failed:', e.message);
        var el = document.getElementById('mapDrc') || document.getElementById('mapLeaflet');
        if (el) el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:200px;font-family:\'IBM Plex Mono\',monospace;font-size:12px;color:#7a8694">Carte indisponible \u2014 ' + e.message + '</div>';
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initMapLeaflet);
  else initMapLeaflet();
})();
