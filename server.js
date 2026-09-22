require("dotenv").config();

const express = require("express");
const path = require("path");

const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();

const PORT = process.env.PORT || 3000;

/* =========================================================
   CONFIGURACIÓN DE GEMINI
========================================================= */

// Modelo rápido y ligero para reducir consumo y latencia.
const GEMINI_MODEL = "gemini-2.5-flash-lite";

const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const API_KEY = process.env.GEMINI_API_KEY;

/* =========================================================
   COMPROBAR API KEY
========================================================= */

if (!API_KEY) {
  console.error(
    "❌ Error: GEMINI_API_KEY no está configurada en tu archivo .env"
  );

  process.exit(1);
}

/* =========================================================
   MIDDLEWARE
========================================================= */

app.use(express.json());

app.use(express.static(path.join(__dirname, "public")));

/* =========================================================
   FUNCIÓN PARA CALCULAR IMC
========================================================= */

function calcularIMC(peso, tallaCm) {
  const pesoNumero = Number(peso);
  const tallaNumero = Number(tallaCm);

  if (
    !Number.isFinite(pesoNumero) ||
    !Number.isFinite(tallaNumero) ||
    pesoNumero <= 0 ||
    tallaNumero <= 0
  ) {
    return {
      valor: null,
      categoria: "No disponible",
      explicacion:
        "No se pudo calcular el IMC porque el peso o la estatura no son válidos."
    };
  }

  const tallaM = tallaNumero / 100;

  const imc = Number(
    (pesoNumero / (tallaM * tallaM)).toFixed(2)
  );

  /*
    IMPORTANTE:
    En niños y adolescentes, el IMC no debe interpretarse
    utilizando automáticamente los rangos de adultos.

    La interpretación requiere considerar edad, sexo
    y crecimiento.
  */

  return {
    valor: imc,
    categoria: "Requiere interpretación según edad y sexo",
    explicacion:
      "El IMC relaciona el peso con la estatura. En niños y adolescentes debe interpretarse considerando la edad, el sexo y el crecimiento."
  };
}

/* =========================================================
   ESQUEMA JSON PARA GEMINI
========================================================= */

const lunchSchema = {
  type: "object",

  properties: {
    loncheras: {
      type: "array",

      minItems: 5,
      maxItems: 5,

      items: {
        type: "object",

        properties: {
          nombre: {
            type: "string",
            description:
              "Nombre creativo y diferente para la lonchera."
          },

          ingredientes: {
            type: "array",

            items: {
              type: "string"
            },

            description:
              "Lista de ingredientes con cantidades claras."
          },

          explicacion: {
            type: "string",
            description:
              "Explicación de por qué la lonchera puede ser adecuada para el estudiante."
          },

          alternativas: {
            type: "string",
            description:
              "Alternativas para alergias o preferencias alimentarias."
          }
        },

        required: [
          "nombre",
          "ingredientes",
          "explicacion",
          "alternativas"
        ],

        additionalProperties: false
      }
    }
  },

  required: ["loncheras"],

  additionalProperties: false
};

/* =========================================================
   RUTA PRINCIPAL
   GENERAR LONCHERAS
========================================================= */

app.post("/api/generate-lunches", async (req, res) => {
  try {
    console.log("========================================");
    console.log("📥 Nueva solicitud de loncheras");
    console.log("========================================");

    const { student, country } = req.body;

    /* -----------------------------------------------------
       VALIDAR DATOS PRINCIPALES
    ----------------------------------------------------- */

    if (!student || !country) {
      return res.status(400).json({
        error: "Faltan datos del estudiante o país."
      });
    }

    const {
      name,
      age,
      sex,
      weight,
      height,
      activity,
      allergies
    } = student;

    /* -----------------------------------------------------
       VALIDAR CAMPOS DEL ESTUDIANTE
    ----------------------------------------------------- */

    if (
      !name ||
      age === undefined ||
      age === null ||
      !sex ||
      weight === undefined ||
      weight === null ||
      height === undefined ||
      height === null ||
      !activity
    ) {
      return res.status(400).json({
        error:
          "Faltan uno o más datos obligatorios del estudiante."
      });
    }

    /* -----------------------------------------------------
       CALCULAR IMC
    ----------------------------------------------------- */

    const imcData = calcularIMC(weight, height);

    console.log("👤 Estudiante:", name);
    console.log("🌎 País:", country);
    console.log("📊 IMC:", imcData.valor);

    /* =====================================================
       PROMPT
    ===================================================== */

    const prompt = `
Eres un asistente especializado en alimentación escolar saludable.

Tu función es ayudar a generar ideas de loncheras escolares variadas,
realistas y apropiadas para estudiantes.

IMPORTANTE:

- No inventes datos médicos.
- No presentes el IMC de un niño o adolescente utilizando automáticamente
  los rangos de IMC para adultos.
- En niños y adolescentes, la interpretación del IMC depende de la edad,
  el sexo y las curvas de crecimiento.
- Puedes explicar que el valor calculado debe interpretarse considerando
  esos factores.
- No diagnostiques enfermedades.
- No sustituyas la evaluación de un médico o nutricionista.
- Evita recomendaciones extremas o dietas restrictivas.
- Prioriza alimentos variados y cantidades razonables.

PAÍS:
${country}

DATOS DEL ESTUDIANTE:

Nombre:
${name}

Edad:
${age} años

Género:
${sex}

Peso:
${weight} kg

Estatura:
${height} cm

Actividad física:
${activity}

Alergias o preferencias:
${allergies || "Ninguna"}

IMC CALCULADO:
${imcData.valor}

=========================================================
TAREA
=========================================================

Genera exactamente 5 propuestas de loncheras saludables.

Las 5 propuestas deben ser:

1. Diferentes entre sí.
2. Realistas para un estudiante.
3. Elaboradas con ingredientes que puedan encontrarse
   normalmente en ${country}.
4. Adecuadas considerando la edad y actividad física indicada.
5. Variadas nutricionalmente.
6. Fáciles de preparar.
7. Claras y fáciles de entender.
8. Apropiadas para llevar como lonchera escolar.

=========================================================
CADA LONCHERA DEBE CONTENER
=========================================================

- Un nombre creativo.
- Una bebida obligatoriamente.
- Ingredientes con cantidades claras.
- Una explicación de por qué puede ser adecuada para el estudiante.
- Alternativas para alergias o preferencias.

=========================================================
BEBIDAS
=========================================================

Cada propuesta debe incluir obligatoriamente una bebida.

Puedes utilizar alternativas como:

- Agua.
- Leche.
- Yogur bebible.
- Jugo natural.
- Infusión apropiada.
- Otra bebida razonable.

Procura no repetir exactamente la misma bebida
en las cinco propuestas si existen alternativas razonables.

=========================================================
VARIEDAD
=========================================================

Evita generar cinco loncheras prácticamente iguales.

Procura variar:

- Frutas.
- Cereales.
- Fuentes de proteína.
- Preparaciones.
- Bebidas.
- Ingredientes.
- Presentación.

=========================================================
IMC
=========================================================

El valor calculado del IMC es:

${imcData.valor}

Si explicas el IMC:

- Indica que es un valor calculado.
- Recuerda que en niños y adolescentes debe interpretarse
  según edad, sexo y crecimiento.
- No diagnostiques sobrepeso u obesidad solamente con este número.

=========================================================
RESULTADO
=========================================================

Devuelve únicamente la información solicitada en el formato JSON
definido por el esquema de respuesta.

No agregues explicaciones fuera de ese formato.
`;

    /* =====================================================
       CUERPO DE PETICIÓN A GEMINI
    ===================================================== */

    const body = {
      contents: [
        {
          parts: [
            {
              text: prompt
            }
          ]
        }
      ],

      generationConfig: {
        responseMimeType: "application/json",
        responseJsonSchema: lunchSchema,

        // Mantiene las respuestas relativamente controladas.
        temperature: 0.7,

        // Evita generar respuestas excesivamente largas.
        maxOutputTokens: 3000
      }
    };

    console.log("🤖 Enviando solicitud a Gemini...");
    console.log("🧠 Modelo:", GEMINI_MODEL);

    /* =====================================================
       LLAMADA A GEMINI
    ===================================================== */

    const response = await fetch(
      `${GEMINI_URL}?key=${encodeURIComponent(API_KEY)}`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify(body)
      }
    );

    /* -----------------------------------------------------
       OBTENER RESPUESTA
    ----------------------------------------------------- */

    const responseText = await response.text();

    let json;

    try {
      json = JSON.parse(responseText);
    } catch (parseError) {
      console.error(
        "❌ Gemini respondió algo que no es JSON:"
      );

      console.error(responseText);

      return res.status(500).json({
        error:
          "Gemini devolvió una respuesta que el servidor no pudo interpretar."
      });
    }

    /* =====================================================
       MANEJO DE ERRORES DE LA API
    ===================================================== */

    if (!response.ok) {
      console.error("========================================");
      console.error("❌ ERROR DE GEMINI");
      console.error("========================================");

      console.error("Status:", response.status);
      console.error(
        "Respuesta:",
        JSON.stringify(json, null, 2)
      );

      const mensaje =
        json?.error?.message ||
        "Gemini rechazó la solicitud.";

      return res.status(response.status).json({
        error: mensaje
      });
    }

    /* =====================================================
       EXTRAER TEXTO
    ===================================================== */

    const candidates = json?.candidates || [];

    const content =
      candidates[0]?.content?.parts
        ?.map((part) => part.text || "")
        .join("")
        .trim();

    if (!content) {
      console.error("❌ Gemini no devolvió contenido.");

      console.error(
        JSON.stringify(json, null, 2)
      );

      return res.status(500).json({
        error:
          "Gemini no devolvió contenido en la respuesta."
      });
    }

    console.log("✅ Gemini respondió correctamente.");

    /* =====================================================
       PARSEAR JSON
    ===================================================== */

    let parsed;

    try {
      parsed = JSON.parse(content);
    } catch (error) {
      console.error(
        "❌ El contenido de Gemini no pudo convertirse en JSON."
      );

      console.error("Contenido recibido:");
      console.error(content);

      return res.status(500).json({
        error:
          "Gemini devolvió contenido que no pudo convertirse en JSON."
      });
    }

    /* =====================================================
       VALIDAR ESTRUCTURA
    ===================================================== */

    if (
      !parsed ||
      !Array.isArray(parsed.loncheras)
    ) {
      console.error(
        "❌ La respuesta no contiene un arreglo de loncheras."
      );

      console.error(
        JSON.stringify(parsed, null, 2)
      );

      return res.status(500).json({
        error:
          "La respuesta de Gemini no tiene la estructura esperada."
      });
    }

    /* =====================================================
       ASEGURAR EXACTAMENTE 5
    ===================================================== */

    const loncheras = parsed.loncheras.slice(0, 5);

    if (loncheras.length < 5) {
      console.error(
        "❌ Gemini devolvió menos de 5 loncheras."
      );

      return res.status(500).json({
        error:
          "Gemini no generó las 5 loncheras solicitadas."
      });
    }

    /* =====================================================
       RESPUESTA FINAL AL FRONTEND
    ===================================================== */

    console.log(
      `🥪 ${loncheras.length} loncheras generadas correctamente.`
    );

    console.log("========================================");

    return res.json({
      imc: imcData,
      loncheras: loncheras
    });

  } catch (err) {
    /* =====================================================
       ERROR GENERAL DEL SERVIDOR
    ===================================================== */

    console.error("========================================");
    console.error("❌ ERROR GENERAL DEL SERVIDOR");
    console.error("========================================");

    console.error(err);

    return res.status(500).json({
      error:
        err?.message ||
        "Ocurrió un error inesperado en el servidor."
    });
  }
});

/* =========================================================
   RUTA DE PRUEBA
========================================================= */

app.get("/api/status", (req, res) => {
  res.json({
    ok: true,
    server: "Lonchera Saludable",
    gemini: GEMINI_MODEL,
    message: "Servidor funcionando correctamente."
  });
});

/* =========================================================
   INICIAR SERVIDOR
========================================================= */

app.listen(PORT, () => {
  console.log("");
  console.log("========================================");
  console.log("🚀 SERVIDOR INICIADO");
  console.log("========================================");
  console.log(`📡 Puerto: ${PORT}`);
  console.log(`🧠 Gemini: ${GEMINI_MODEL}`);
  console.log("🔑 GEMINI_API_KEY: configurada");
  console.log("========================================");
  console.log("");
});