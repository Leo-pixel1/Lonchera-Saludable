require("dotenv").config();
const express = require("express");
const fetch = (...args) =>
  import("node-fetch").then(({ default: f }) => f(...args));
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.error("❌ Error: GEMINI_API_KEY no está configurada en tu .env");
  process.exit(1);
}

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function calcularIMC(peso, tallaCm) {
  const tallaM = tallaCm / 100;
  const imc = +(peso / (tallaM * tallaM)).toFixed(2);

  let categoria = "";
  if (imc < 18.5) categoria = "Peso Bajo";
  else if (imc < 25) categoria = "Peso Normal";
  else if (imc < 30) categoria = "Sobrepeso";
  else if (imc < 35) categoria = "Obesidad Leve";
  else if (imc < 40) categoria = "Obesidad Media";
  else categoria = "Obesidad Mórbida";

  const explicacion =
    "El IMC es una medida que relaciona peso y estatura. En niños y adolescentes se interpreta considerando la edad y el crecimiento. Ayuda a detectar si el estudiante está en un rango saludable.";

  return { valor: imc, categoria, explicacion };
}

app.post("/api/generate-lunches", async (req, res) => {
  try {
    const { student, country } = req.body;
    if (!student || !country) {
      return res
        .status(400)
        .json({ error: "Faltan datos del estudiante o país." });
    }

    const { name, age, sex, weight, height, activity, allergies } = student;
    const imcData = calcularIMC(weight, height);

const prompt = `
Eres un nutricionista especializado en alimentación escolar en ${country}.
Debes generar ideas de loncheras saludables y realistas, considerando ingredientes comunes de ${country}.

Datos del estudiante:
- Nombre: ${name}
- Edad: ${age} años
- Género: ${sex}
- Peso: ${weight} kg
- Estatura: ${height} cm
- Actividad física: ${activity}
- Alergias / preferencias: ${allergies || "Ninguna"}

1. Calcula el IMC y confirma si es bajo, normal, sobrepeso u obesidad.
2. Explica brevemente qué significa ese IMC para su edad.
3. Genera exactamente 5 propuestas de loncheras, variadas y no repetitivas.
   - Cada lonchera debe incluir obligatoriamente una bebida (agua, jugo natural, infusión, etc.).
   - Cada lonchera debe incluir:
     * Nombre de la lonchera (creativo y diferente en cada una).
     * Ingredientes con cantidades claras.
     * Explicación de por qué es adecuada para su edad y actividad.
     * Alternativas si hay alergias o preferencias.
4. Devuelve la respuesta en formato JSON ESTRICTO con esta estructura:

{
  "loncheras": [
    {
      "nombre": "<texto>",
      "ingredientes": ["<texto>", "<texto>"],
      "explicacion": "<texto>",
      "alternativas": "<texto>"
    }
  ]
}
`;

    const body = {
      contents: [{ parts: [{ text: prompt }] }],
    };

    const response = await fetch(`${GEMINI_URL}?key=${API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const json = await response.json();
    const candidates = json?.candidates || [];
    const content = candidates[0]?.content?.parts?.[0]?.text;

    let parsed;
    try {
      const cleanContent = content
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .replace(/^[^{]+/, "")
        .replace(/[^}]+$/, "")
        .trim();

      parsed = JSON.parse(cleanContent);
    } catch (e) {
      console.error("Respuesta cruda:", content);
      return res.status(500).json({ error: "Gemini no devolvió JSON válido" });
    }

    res.json({
      imc: imcData,
      loncheras: parsed.loncheras || [],
    });
  } catch (err) {
    console.error("❌ Error en servidor:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor en http://localhost:${PORT}`);
});