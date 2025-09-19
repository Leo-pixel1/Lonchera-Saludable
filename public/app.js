// app.js - control UI y fetch a /api/generate-lunches
document.addEventListener('DOMContentLoaded', () => {
  // elementos
  const form = document.getElementById('lunchForm');
  const countrySelect = document.getElementById('country');
  const resultsSection = document.getElementById('resultsSection');
  const ideasContainer = document.getElementById('ideasContainer');
  const imcValueEl = document.getElementById('imcValue');
  const imcExplanationEl = document.getElementById('imcExplanation');
  const tooltipEl = document.querySelector('.imc-tooltip');

  // Inicializar tema segun select
  function applyTheme() {
    const val = countrySelect.value === 'Chile' ? 'chile-theme' : 'peru-theme';
    document.body.classList.remove('peru-theme', 'chile-theme');
    document.body.classList.add(val);
  }
  applyTheme();
  countrySelect.addEventListener('change', applyTheme);

  // tooltip: toggle en click (mejor para moviles) y hover ya funciona via CSS
  if (tooltipEl) {
    tooltipEl.addEventListener('click', (e) => {
      tooltipEl.classList.toggle('open');
    });
    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (!tooltipEl.contains(e.target)) tooltipEl.classList.remove('open');
    });
  }

  // Util helper: extraer imc robustamente
  function extractImc(obj) {
    if (!obj) return null;
    const cand = obj.imc || obj.IMC || obj.imcData || obj.imc_result || obj.imcResult;
    if (!cand) return null;
    // cand may be object with diferent keys
    return {
      valor: (cand.valor ?? cand.imc ?? cand.value ?? cand.valor_imc ?? null),
      categoria: (cand.categoria ?? cand.categoria_imc ?? cand.category ?? null),
      explicacion: (cand.explicacion ?? cand.interpretacion ?? cand.explanation ?? cand.info ?? '')
    };
  }

  // Normalizar loncheras array
  function extractLoncheras(obj) {
    return obj.loncheras || obj.lunches || obj.lunchesList || obj.lunch || [];
  }

  // Helper: ensure there is a bebida in ingredients (simple keyword test)
  function hasBeverage(ingredients) {
    if (!Array.isArray(ingredients)) return false;
    const joined = ingredients.join(' ').toLowerCase();
    return /agua|jugo|emoliente|infusión|infusion|batido|resfresco|te\b|té\b|leche|bebida|fruta líquida|zumo|jugos?/.test(joined);
  }

  // Mostrar resultados en DOM
  function renderResults(data) {
    // Imc
    const imc = extractImc(data) || {};
    const imcVal = imc.valor ?? '—';
    const imcCat = imc.categoria ?? '';
    const imcExp = imc.explicacion ?? '';

    imcValueEl.textContent = typeof imcVal === 'number' || !isNaN(Number(imcVal)) ? Number(imcVal).toFixed(1) : imcVal;
    imcExplanationEl.textContent = imcExp || (imcCat ? imcCat : '');

    // Loncheras
    const loncheras = extractLoncheras(data);
    ideasContainer.innerHTML = '';
    if (!Array.isArray(loncheras) || loncheras.length === 0) {
      ideasContainer.innerHTML = `<div class="lunch-card"><p>No se encontraron loncheras en la respuesta.</p></div>`;
      return;
    }

    loncheras.forEach((l) => {
      const nombre = l.nombre || l.name || 'Lonchera';
      const ingredientes = Array.isArray(l.ingredientes) ? l.ingredientes : (typeof l.ingredientes === 'string' ? l.ingredientes.split(/\n|,/) : []);
      const explicacion = l.explicacion || l.explanation || '';
      const alternativas = l.alternativas || l.alternatives || '';
      // Si no viene bebida, añadimos sugerencia de agua
      const bebidaSugerida = hasBeverage(ingredientes) ? '' : 'Bebida sugerida: Agua (500 ml).';

      const card = document.createElement('div');
      card.className = 'lunch-card';
      card.innerHTML = `
        <h3>${nombre}</h3>
        <strong>Ingredientes:</strong>
        <ul>${ingredientes.map(i => `<li>${i.trim()}</li>`).join('')}</ul>
        <p class="meta"><strong>Por que:</strong> ${explicacion}</p>
        <p class="meta"><strong>Alternativas:</strong> ${alternativas || 'Ninguna'}</p>
        ${bebidaSugerida ? `<p class="meta"><em>${bebidaSugerida}</em></p>` : ''}
      `;
      ideasContainer.appendChild(card);
    });
  }

  // Submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    // ocultar resultados y limpiar
    resultsSection.classList.add('hidden');
    ideasContainer.innerHTML = '';
    imcValueEl.textContent = '';
    imcExplanationEl.textContent = '';

    // leer campos
    const student = {
      name: document.getElementById('name').value.trim(),
      age: Number(document.getElementById('age').value || 0),
      sex: document.querySelector("input[name='sex']:checked")?.value || '',
      weight: Number(document.getElementById('weight').value || 0),
      height: Number(document.getElementById('height').value || 0),
      activity: document.getElementById('activity').value,
      allergies: document.getElementById('allergies').value.trim()
    };
    const country = countrySelect.value;

    // boton y feedback
    const btn = document.getElementById('generateBtn');
    btn.disabled = true;
    const prevText = btn.textContent;
    btn.textContent = 'Generando...';

    try {
      const resp = await fetch('/api/generate-lunches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student, country })
      });

      const data = await resp.json();
      if (!resp.ok) {
        // muestra raw error si viene
        const msg = data?.error || 'Error al obtener datos del servidor';
        throw new Error(msg);
      }

      // Renderiza resultados (IMC + loncheras)
      renderResults(data);

      // mostrar resultados
      resultsSection.classList.remove('hidden');
      // hacer scroll suave
      resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      console.error(err);
      ideasContainer.innerHTML = `<div class="lunch-card"><p style="color:#b00020">Error: ${err.message}</p></div>`;
      resultsSection.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.textContent = prevText;
    }
  });
});