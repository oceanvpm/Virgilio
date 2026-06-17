import { getThesaurus } from "../lib/thesaurus.js";

// Vercel serverless function. Allow up to 60s (an Opus lookup can take several
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
