// Cambiar colores al seleccionar país
const countrySelect = document.getElementById("country");
document.body.classList.add(countrySelect.value); // inicial

countrySelect.addEventListener("change", () => {
  document.body.classList.remove("peru", "chile");
  document.body.classList.add(countrySelect.value);
});

// Formulario
document.getElementById("studentForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const student = {
    name: document.getElementById("name").value,
    age: parseInt(document.getElementById("age").value),
    grade: document.getElementById("grade").value,
    sex: document.querySelector("input[name='sex']:checked").value,
    weight: parseFloat(document.getElementById("weight").value),
    height: parseInt(document.getElementById("height").value),
    activity: document.getElementById("activity").value,
    allergies: document.getElementById("allergies").value,
    country: document.getElementById("country").value,
  };

  const btn = document.getElementById("generateBtn");
  btn.disabled = true;
  btn.textContent = "Generando...";

  try {
    const res = await fetch("/api/generate-lunches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al generar ideas");

    // Mostrar resultados
    document.getElementById("results").classList.remove("hidden");

    const imcCard = document.getElementById("imc-card");
    imcCard.innerHTML = `
      <h2>Resultados de Salud</h2>
      <p><strong>IMC:</strong> ${data.imc.imc}</p>
      <p><strong>Interpretación:</strong> ${data.imc.interpretacion}</p>
      <p><strong>Grado escolar:</strong> ${student.grade}</p>
    `;

    const lunchesDiv = document.getElementById("lunches");
    lunchesDiv.innerHTML = "";
    data.lunches.forEach((lunch) => {
      const card = document.createElement("div");
      card.classList.add("lunch-card");
      card.innerHTML = `
        <h3>${lunch.nombre}</h3>
        <p><strong>Ingredientes:</strong></p>
        <ul>${lunch.ingredientes.map((i) => `<li>${i}</li>`).join("")}</ul>
        <p><strong>Explicación:</strong> ${lunch.explicacion}</p>
        <p><strong>Alternativas:</strong> ${lunch.alternativas}</p>
      `;
      lunchesDiv.appendChild(card);
    });
  } catch (err) {
    alert("Error: " + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Generar ideas";
  }
});