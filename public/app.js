let selectedCountry = null;
let selectedGender = null;

const btnPeru = document.getElementById("peru");
const btnChile = document.getElementById("chile");
const countryButtons = [btnPeru, btnChile];

const generoButtons = document.querySelectorAll(".btn-genero");
const countrySetColor = (country) => {
  if (country === "Perú") {
    document.documentElement.style.setProperty("--main-color", getComputedStyle(document.documentElement).getPropertyValue("--peru"));
  } else {
    document.documentElement.style.setProperty("--main-color", getComputedStyle(document.documentElement).getPropertyValue("--chile"));
  }
};

// country selection
countryButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    countryButtons.forEach(b => { b.classList.remove("active"); b.setAttribute("aria-pressed","false"); });
    btn.classList.add("active");
    btn.setAttribute("aria-pressed","true");

    selectedCountry = btn.textContent.includes("Perú") ? "Perú" : "Chile";
    countrySetColor(selectedCountry);
  });
});

// gender selection
generoButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    generoButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    selectedGender = btn.dataset.value || btn.textContent.trim().includes("Masculino") ? "Masculino" : "Femenino";
    // normalize: if btn has data-value use it
    if (btn.dataset.value) selectedGender = btn.dataset.value;
  });
});

document.getElementById("lunchForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!selectedCountry) { alert("Por favor selecciona un país (Perú o Chile)."); return; }
  if (!document.querySelector(".btn-genero.active")) { alert("Por favor selecciona un género."); return; }

  // collect values
  const student = {
    name: document.getElementById("name").value.trim(),
    age: Number(document.getElementById("age").value),
    sex: selectedGender,
    weight: Number(document.getElementById("weight").value),
    height: Number(document.getElementById("height").value),
    activity: document.getElementById("activity").value,
    allergies: document.getElementById("allergies").value.trim()
  };

  const ideasList = document.getElementById("ideasList");
  ideasList.innerHTML = ""; // clear previous
  document.getElementById("imcResult").innerHTML = "Generando...";

  try {
    const res = await fetch("/api/generate-lunches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student, country: selectedCountry })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error || "Error desconocido");

    // show IMC section
    document.getElementById("imcSection").classList.remove("hidden");
    const imcVal = Number(data.imc.valor).toFixed(1);
    document.getElementById("imcResult").innerHTML = `
      <div><strong>IMC:</strong> ${imcVal} — ${data.imc.categoria}</div>
      <div style="margin-top:8px;color:#444">${data.imc.explicacion}</div>
    `;

    // highlight table row based on value
    const val = Number(data.imc.valor);
    document.querySelectorAll(".imc-table tbody tr").forEach(tr => tr.classList.remove("highlight"));
    let selector = "";
    if (val < 18.5) selector = '[data-range="under"]';
    else if (val < 25) selector = '[data-range="normal"]';
    else if (val < 30) selector = '[data-range="over"]';
    else if (val < 35) selector = '[data-range="ob1"]';
    else if (val < 40) selector = '[data-range="ob2"]';
    else selector = '[data-range="ob3"]';
    const row = document.querySelector(selector);
    if (row) row.classList.add("highlight");

    // show loncheras as cards
    ideasList.innerHTML = "";
    (data.loncheras || []).forEach((l, i) => {
      const div = document.createElement("div");
      div.className = "lonchera";
      div.innerHTML = `
        <h3>Lonchera para ${selectedCountry} #${i+1}</h3>
        <ul>${(l.ingredientes || []).map(it => `<li>${it}</li>`).join("")}</ul>
        <p><strong>Explicación:</strong> ${l.explicacion || ""}</p>
        <p style="margin-top:8px"><strong>Alternativas:</strong> ${l.alternativas || "—"}</p>
      `;
      ideasList.appendChild(div);
    });

    document.getElementById("ideasSection").classList.remove("hidden");
  } catch (err) {
    console.error(err);
    document.getElementById("imcResult").innerHTML = `<span style="color:#b00020">Error: ${err.message}</span>`;
  }
});