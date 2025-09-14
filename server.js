/**
 * server.js — Servidor Node/Express que actúa como proxy hacia Gemini
 * y calcula IMC + grado escolar.
 */

require('dotenv').config();
const express = require('express');
const fetch = (...args) =>
  import('node-fetch').then(({ default: f }) => f(...args));
const path = require('path');
const app = express();

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) console.warn('⚠️ GEMINI_API_KEY no configurada en .env');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// === Función para calcular IMC ===
function calcularIMC(peso, tallaCm) {
  const tallaM = tallaCm / 100;
  const imc = (peso / (tallaM * tallaM)).toFixed(2);
  let interpretacion = '';

  if (imc < 18.5) {
    interpretacion =
      'Bajo peso: el alumno podría necesitar más calorías y nutrientes.';
  } else if (imc >= 18.5 && imc < 24.9) {
    interpretacion = 'Normal: el IMC es adecuado para su edad y talla.';
  } else if (imc >= 25 && imc < 29.9) {
    interpretacion = 'Sobrepeso: se recomienda moderar azúcares y grasas.';
  } else {
    interpretacion =
      'Obesidad: se debe promover una alimentación saludable y actividad física.';
  }

  return { imc, interpretacion };
}

// === Función para determinar grado escolar ===
function determinarGrado(edad) {
  if (edad >= 6 && edad <= 11) {
    return `Primaria, ${edad - 5}° grado`;
  } else if (edad >= 12 && edad <= 16) {
    return `Secundaria, ${edad - 11}° grado`;
  } else if (edad === 17) {
    return `Secundaria, 5° grado`;
  } else if (edad === 18) {
    return `Último año de secundaria o egresado reciente`;
  } else {
    return `Fuera del rango escolar (6-18 años)`;
  }
}

// === Endpoint principal ===
app.post('/api/generate-lunches', async (req, res) => {
  try {
    const { student } = req.body;
    if (!student)
      return res.status(400).json({ error: 'Falta objeto student en el body' });

    // Calcular IMC y grado
    const imcData = calcularIMC(student.weight, student.height);
    const grado = determinarGrado(student.age);

    const prompt = `
Eres un nutricionista infantil experto en ${
      student.country === 'peru' ? 'Perú' : 'Chile'
    }.

Genera exactamente 3 propuestas de lonchera escolar saludables y variadas (sin repetir nombres),
con ingredientes comunes de ${student.country === 'peru' ? 'Perú' : 'Chile'},
adecuadas para escolares según edad, grado y nivel de actividad.

Datos del alumno:
- Nombre: ${student.name}
- Edad: ${student.age} años
- Grado escolar: ${grado}
- Sexo: ${student.sex}
- Peso: ${student.weight} kg
- Talla: ${student.height} cm
- Nivel de actividad: ${student.activity}
- Alergias, restricciones o preferencias: ${
      student.allergies || 'Ninguna'
    }

Responde estrictamente en JSON válido con esta estructura:

[
  {
    "nombre": "Nombre creativo y variado de la lonchera",
    "ingredientes": ["Ingrediente 1 con cantidad", "Ingrediente 2 con cantidad", "..."],
    "explicacion": "Explicación breve de por qué es adecuada para su edad, grado y nivel de actividad",
    "alternativas": "Opciones según alergias, restricciones o preferencias, o 'Ninguna'"
  },
  { ... },
  { ... }
]
    `;

    const body = {
      contents: [{ parts: [{ text: prompt }] }],
    };

    const response = await fetch(`${GEMINI_URL}?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(500).json({
        error: 'Error desde Gemini',
        details: text,
      });
    }

    const json = await response.json();

    // Extraer texto crudo
    const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log('🔎 Respuesta cruda de Gemini:', rawText);

    // Intentar detectar JSON dentro del texto
    let lunches = [];
    try {
      const match = rawText.match(/\[[\s\S]*\]/); // busca bloque entre corchetes
      if (match) {
        lunches = JSON.parse(match[0]);
      } else {
        throw new Error('No se encontró JSON en la respuesta');
      }
    } catch (e) {
      return res.status(500).json({
        error: 'Gemini no devolvió JSON válido',
        raw: rawText,
      });
    }

    res.json({ imc: imcData, grado, lunches });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// === Arrancar servidor ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Servidor iniciado en http://localhost:${PORT}`);
});