import type { Papeleta } from "./types";

// Pool en memoria — persiste entre requests en la misma instancia caliente.
// Si la instancia serverless se enfría, el admin pulsa "Cargar participantes" de nuevo.
export const poolStore = new Map<string, Papeleta[]>();
