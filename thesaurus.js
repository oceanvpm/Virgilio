// Self-contained backend. On Vercel this runs as a serverless function at
// /api/thesaurus. The local dev server (server.js) imports `getThesaurus` from
// here too, so this file is the single source of truth — no other folders needed.
import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.VIRGILIO_MODEL || "claude-opus-4-8";

// Lazy singleton: importing this file never throws when the key is absent
// (the missing-key case is reported as a clean error at request time instead).
let _client;
function client() {
  if (!_client) _client = new Anthropic();
  return _client;
}

const SYSTEM_PROMPT = `Eres Virgilio, un tesauro contextual del español culto: una guía que ayuda a un
hablante nativo a afinar y ampliar su dominio del idioma.

Dada una PALABRA y, opcionalmente, una ORACIÓN donde aparece, devuelves un mapa de
sinónimos ajustados al sentido EXACTO que la palabra tiene en ese contexto. Si no hay
contexto, eliges el sentido más frecuente y lo declaras.

Principios:
- Precisión sobre cantidad: entre 3 y 6 grupos, de 2 a 5 sinónimos por grupo.
- Agrupa por matiz y registro, no por mero parecido. Cada grupo reúne sinónimos que
  comparten un mismo tono o efecto.
- Atiende la variación regional cuando sea relevante (general, España, Cono Sur/Chile,
  Río de la Plata, México). Marca el sinónimo que sea regional.
- Cada sinónimo trae el matiz que lo distingue de la palabra original (qué cambia: la
  intensidad, la connotación, el registro) y un EJEMPLO que reescribe la oración dada
  —o una equivalente natural— usándolo.
- En "advertencias" señala falsos sinónimos, usos que cambian el sentido, o palabras que
  parecen equivalentes pero no lo son en este contexto.
- Escribe en español de calidad, el de los buenos escritores: claro, exacto, sin relleno.`;

const SCHEMA = {
  type: "object",
  properties: {
    palabra: { type: "string", description: "La palabra consultada." },
    categoria: { type: "string", description: "Categoría gramatical en este sentido." },
    sentido: {
      type: "string",
      description: "Una frase breve que fija el sentido de la palabra en el contexto dado.",
    },
    grupos: {
      type: "array",
      description: "Grupos de sinónimos, cada uno con un matiz/registro común.",
      items: {
        type: "object",
        properties: {
          etiqueta: { type: "string", description: "Nombre breve del matiz del grupo." },
          registro: {
            type: "string",
            enum: ["formal", "neutral", "coloquial", "literario", "técnico", "vulgar", "arcaico"],
          },
          region: {
            type: "string",
            description: "Ámbito de uso: 'general' o una región específica.",
          },
          sinonimos: {
            type: "array",
            items: {
              type: "object",
              properties: {
                palabra: { type: "string" },
                matiz: { type: "string", description: "Qué lo distingue de la palabra original." },
                ejemplo: { type: "string", description: "La oración reescrita con este sinónimo." },
              },
              required: ["palabra", "matiz", "ejemplo"],
              additionalProperties: false,
            },
          },
        },
        required: ["etiqueta", "registro", "region", "sinonimos"],
        additionalProperties: false,
      },
    },
    advertencias: {
      type: "array",
      description: "Falsos sinónimos o cautelas. Puede ir vacío.",
      items: {
        type: "object",
        properties: {
          palabra: { type: "string" },
          nota: { type: "string" },
        },
        required: ["palabra", "nota"],
        additionalProperties: false,
      },
    },
  },
  required: ["palabra", "categoria", "sentido", "grupos", "advertencias"],
  additionalProperties: false,
};

function fail(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/** Core lookup. Returns the parsed thesaurus object, or throws an Error with `.status`. */
export async function getThesaurus({ palabra, contexto } = {}) {
  palabra = (palabra || "").toString().trim();
  contexto = (contexto || "").toString().trim();

  if (!palabra) throw fail("Falta la palabra a consultar.", 400);
  if (!process.env.ANTHROPIC_API_KEY) {
    throw fail(
      "No hay clave de API. Configura la variable ANTHROPIC_API_KEY en el panel de Vercel (o en .env para uso local).",
      500
    );
  }

  const userMessage = contexto
    ? `Palabra: «${palabra}»\nOración de contexto: «${contexto}»`
    : `Palabra: «${palabra}»\n(Sin contexto: usa el sentido más frecuente y decláralo.)`;

  const response = await client().messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    messages: [{ role: "user", content: userMessage }],
  });

  if (response.stop_reason === "refusal") {
    throw fail("La consulta fue rechazada por seguridad.", 422);
  }

  const text = response.content.find((b) => b.type === "text")?.text;
  if (!text) throw fail("Respuesta vacía del modelo.", 502);

  return JSON.parse(text);
}

// Vercel serverless entrypoint. Allow up to 60s (an Opus lookup can take a few
// seconds); the Hobby plan permits this.
export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido." });
  }
  try {
    const data = await getThesaurus(req.body || {});
    return res.status(200).json(data);
  } catch (err) {
    const status =
      err?.status && err.status >= 400 && err.status < 600 ? err.status : 502;
    if (status >= 500) console.error("Error en /api/thesaurus:", err?.message || err);
    return res.status(status).json({ error: err?.message || "Error al consultar el modelo." });
  }
}
