// Local development server. On Vercel this file is unused — the frontend is
// served as static files and /api/thesaurus runs as a serverless function.
// Run locally with: npm start
import "dotenv/config";
import express from "express";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { getThesaurus, MODEL } from "./lib/thesaurus.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json());
app.use(express.static(__dirname)); // serves index.html, app.js, styles.css

app.post("/api/thesaurus", async (req, res) => {
  try {
    const data = await getThesaurus(req.body || {});
    res.json(data);
  } catch (err) {
    const status =
      err?.status && err.status >= 400 && err.status < 600 ? err.status : 502;
    if (status >= 500) console.error("Error en /api/thesaurus:", err?.message || err);
    res.status(status).json({ error: err?.message || "Error al consultar el modelo." });
  }
});

app.listen(PORT, () => {
  console.log(`\n  Virgilio (local) → http://localhost:${PORT}`);
  console.log(`  Modelo: ${MODEL}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log("  ⚠  Falta ANTHROPIC_API_KEY — copia .env.example a .env y pon tu clave.\n");
  } else {
    console.log("");
  }
});
