// EBOLA-MONITOR v4.4 — GeoJSON réel OCHA + carte avancée
// CORRECTION: suppression du commentaire HTML <!-- --> qui cassait le parsing JS
// CORRECTION: guard drawDrcMap avec retry si SVG pas encore dimensionné
// CORRECTION: suppression de la double définition de getProvDataByName

(function() {
  var PROV_ALIAS = {
    'Kongo Central':'Kongo-Central','Équateur':'Equateur','Mai-Ndombe':'Maï-Ndombe',
    'Kasai-Oriental':'Kasaï-Oriental','Kasai Oriental':'Kasaï-Oriental',
    'Kasai Central':'Kasaï-Central','Kasai-Central':'Kasaï-Central','Kasai':'Kasaï',
    'Nord Kivu':'Nord-Kivu','Sud Kivu':'Sud-Kivu',
    'Bas Uele':'Bas-Uele','Haut Uele':'Haut-Uele',
    'Bas-Uélé':'Bas-Uele','Haut-Uélé':'Haut-Uele','Maï-Ndombe':'Maï-Ndombe'
  };

  window.normProvName = function(n) { return PROV_ALIAS[n] || n; };

  // Override getProvDataByName avec la version normalisée (alias de noms)
  window.getProvDataByName = function() {
    var m = {};
    (window.PROVINCE_DATA || []).forEach(function(p) {
      var key = window.normProvName(p.province);
      if (!m[key]) m[key] = {cases:0, deaths:0, recovered:0, suspected:0, cfr:0, status:'', source:''};
      m[key].cases     += p.cases     || 0;
      m[key].deaths    += p.deaths    || 0;
      m[key].recovered += p.recovered || 0;
      m[key].suspected += p.suspected || 0;
      m[key].cfr        = p.cfr       || m[key].cfr;
      if (p.status) m[key].status = p.status;
      if (p.source) m[key].source = p.source;
    });
    return m;
  };

  function buildMap(geo) {
    window._DRC_GEO_REAL = geo;

    window.drawDrcMap = function() {
      var el = document.getElementById('mapDrc');
      if (!el || typeof d3 === 'undefined') return;

      // Guard: si l'élément n'est pas encore visible (width=0), réessayer dans 200ms
      var W = el.clientWidth;
      if (!W || W < 10) {
        setTimeout(window.drawDrcMap, 200);
        return;
      }
      var H = 420;

      el.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      el.setAttribute('width',  W);
      el.setAttribute('height', H);

      d3.select('#mapDrc').selectAll('*').remove();
      var svg = d3.select('#mapDrc');

      svg.append('rect').attr('width', W).attr('height', H).attr('fill', '#07090c');

      var proj = d3.geoMercator().fitSize([W, H], window._DRC_GEO_REAL);
      var path = d3.geoPath().projection(proj);

      var provData = window.getProvDataByName();
      var casVals  = Object.values(provData).map(function(d){ return d.cases; }).filter(function(v){ return v > 0; });
      var maxCas   = casVals.length ? Math.max.apply(null, casVals) : 1;

      var tt = document.getElementById('mtt');

      var mode = window.mapMode || 'cases';

      var cScale = function(v) {
        if (!v) return '#1e2530';
        var t = Math.min(1, v / maxCas);
        var r = Math.round(45  + t * 185);
        var g = Math.round(30  * (1 - t));
        var b = Math.round(30  * (1 - t));
        return 'rgb(' + r + ',' + g + ',' + b + ')';
      };

      svg.selectAll('path.prov')
        .data(window._DRC_GEO_REAL.features)
        .enter().append('path')
        .attr('class', 'prov')
        .attr('d', path)
        .attr('fill', function(f) {
          var k = window.normProvName(f.properties.name);
          var d = provData[k];
          if (!d || !d.cases) return '#1e2530';
          return cScale(mode === 'cfr' ? d.cfr : mode === 'deaths' ? d.deaths : d.cases);
        })
        .attr('stroke', 'rgba(255,255,255,.1)')
        .attr('stroke-width', '0.5')
        .style('cursor', function(f) {
          var k = window.normProvName(f.properties.name);
          return provData[k] && provData[k].cases ? 'pointer' : 'default';
        })
        .on('mousemove', function(ev, f) {
          var k = window.normProvName(f.properties.name);
          var d = provData[k];
          tt.style.display = 'block';
          tt.style.left = (ev.pageX + 14) + 'px';
          tt.style.top  = (ev.pageY - 20) + 'px';
          if (!d || !d.cases) {
            tt.innerHTML = '<strong>' + f.properties.name + '</strong><div class="mtt-row"><span style="color:var(--text3)">Aucun cas signalé</span></div>';
            return;
          }
          var cfr = d.deaths && d.cases ? ((d.deaths / d.cases) * 100).toFixed(1) : (d.cfr || 0);
          tt.innerHTML =
            '<strong>' + f.properties.name + '</strong>' +
            '<div class="mtt-row"><span>Cas conf.</span><span style="color:var(--red2)">' + d.cases + '</span></div>' +
            (d.suspected > 0 ? '<div class="mtt-row"><span>Suspects</span><span style="color:var(--amber)">' + d.suspected + '</span></div>' : '') +
            '<div class="mtt-row"><span>Décès</span><span>' + d.deaths + '</span></div>' +
            (d.recovered > 0 ? '<div class="mtt-row"><span>Guéris</span><span style="color:var(--green)">' + d.recovered + '</span></div>' : '') +
            '<div class="mtt-row"><span>CFR</span><span style="color:' + (parseFloat(cfr)>15?'var(--red2)':parseFloat(cfr)>8?'var(--amber)':'var(--green)') + '">' + cfr + '%</span></div>' +
            '<div class="mtt-row"><span>Statut</span><span><span class="status-dot ' + (d.status==='Active'?'active-dot':'monitoring-dot') + '"></span>' + (d.status||'—') + '</span></div>' +
            (d.source ? '<div class="mtt-row" style="font-size:9px;color:var(--text3)">' + d.source + '</div>' : '');
        })
        .on('mouseleave', function() { tt.style.display = 'none'; });

      // Cercles proportionnels décès
      var cd = window._DRC_GEO_REAL.features.map(function(f) {
        var k = window.normProvName(f.properties.name);
        var d = provData[k];
        return (d && d.cases > 0) ? {f:f, d:d, c:path.centroid(f)} : null;
      }).filter(Boolean);

      var mxD = Math.max.apply(null, cd.map(function(x){ return x.d.deaths; }).concat([1]));
      var mxR = Math.max.apply(null, cd.map(function(x){ return x.d.recovered; }).concat([1]));
      var rD  = function(v){ return Math.max(4, Math.sqrt(v/mxD)*22); };
      var rR  = function(v){ return Math.max(3, Math.sqrt(v/mxR)*16); };

      svg.selectAll('circle.dc')
        .data(cd.filter(function(x){ return x.d.deaths > 0; }))
        .enter().append('circle').attr('class','dc')
        .attr('cx', function(x){ return x.c[0]; }).attr('cy', function(x){ return x.c[1]; })
        .attr('r',  function(x){ return rD(x.d.deaths); })
        .attr('fill','rgba(230,57,70,.3)').attr('stroke','#e63946').attr('stroke-width','1.2')
        .style('pointer-events','none');

      svg.selectAll('circle.gc')
        .data(cd.filter(function(x){ return x.d.recovered > 0; }))
        .enter().append('circle').attr('class','gc')
        .attr('cx', function(x){ return x.c[0]; })
        .attr('cy', function(x){ return x.c[1] + rD(x.d.deaths||1) + rR(x.d.recovered) + 2; })
        .attr('r',  function(x){ return rR(x.d.recovered); })
        .attr('fill','rgba(82,183,136,.3)').attr('stroke','#52b788').attr('stroke-width','1')
        .style('pointer-events','none');

      // Labels provinces actives
      svg.selectAll('text.plabel')
        .data(window._DRC_GEO_REAL.features.filter(function(f) {
          var k = window.normProvName(f.properties.name);
          return provData[k] && provData[k].cases > 0;
        }))
        .enter().append('text').attr('class','plabel')
        .attr('transform', function(f) {
          var c = path.centroid(f);
          return 'translate(' + c[0] + ',' + c[1] + ')';
        })
        .attr('text-anchor','middle').attr('dominant-baseline','middle')
        .attr('font-family','IBM Plex Mono,monospace').attr('font-size','7.5')
        .attr('pointer-events','none')
        .each(function(f) {
          var k = window.normProvName(f.properties.name);
          var d = provData[k];
          var val = mode==='cfr' ? (d.cfr||0)+'%' : mode==='deaths' ? d.deaths : d.cases;
          var g = d3.select(this);
          g.append('tspan').attr('x',0).attr('dy','-4')
            .attr('fill','rgba(255,255,255,.85)').text(f.properties.name.split('-')[0].substring(0,7));
          g.append('tspan').attr('x',0).attr('dy','10')
            .attr('fill', d.status==='Active'?'#ff8087':'#f4a261')
            .attr('font-size','9').attr('font-weight','600').text(val);
        });

      svg.append('text')
        .attr('x',8).attr('y',14)
        .attr('font-family','IBM Plex Mono,monospace').attr('font-size','9')
        .attr('fill','#3e4a56')
        .text('RDC — PROVINCES EBOLA 2026 — ' + mode.toUpperCase() + ' — GeoJSON OCHA');

      var legEl = document.getElementById('mapLeg');
      if (legEl) {
        legEl.innerHTML = [
          {col:'#c1121f',             label:'Cumul élevé (cas confirmés)'},
          {col:'#2d3748',             label:'Cas faibles'},
          {col:'#1e2530',             label:'Sans cas'},
          {col:'rgba(230,57,70,.3)',  label:'◯ Décès (proportionnel)'},
          {col:'rgba(82,183,136,.3)', label:'◯ Guéris (proportionnel)'},
        ].map(function(l) {
          return '<div class="leg-i"><div class="leg-sw" style="background:' + l.col + ';border-radius:50%"></div>' + l.label + '</div>';
        }).join('');
      }
    };

    // Dessiner dès le chargement du GeoJSON
    window.drawDrcMap();
  }

  function initMap() {
    fetch('/drc-provinces.geojson')
      .then(function(r) {
        if (!r.ok) throw new Error('GeoJSON HTTP ' + r.status);
        return r.json();
      })
      .then(buildMap)
      .catch(function(e) {
        console.warn('[MAP] GeoJSON load failed:', e.message);
        var el = document.getElementById('mapDrc');
        if (el) {
          el.innerHTML = '<text x="50%" y="50%" text-anchor="middle" fill="#7a8694" font-family="IBM Plex Mono,monospace" font-size="12">Carte indisponible — GeoJSON non chargé</text>';
        }
      });
  }

  // Attendre que le DOM soit prêt
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMap);
  } else {
    initMap();
  }

})();
