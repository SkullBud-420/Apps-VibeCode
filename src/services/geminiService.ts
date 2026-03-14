import { GoogleGenAI, Type } from "@google/genai";

// AI Studio injeta a chave automaticamente via process.env em build time (Vite define)
// Fallback para import.meta.env para compatibilidade
function getApiKey(): string {
  return (
    (typeof process !== "undefined" && process.env?.GEMINI_API_KEY) ||
    (import.meta as any).env?.VITE_GEMINI_API_KEY ||
    ""
  );
}

let aiInstance: GoogleGenAI | null = null;
let lastKey = "";

function getAI(): GoogleGenAI {
  const key = getApiKey();
  if (!key) throw new Error("GEMINI_API_KEY não encontrada.");
  if (!aiInstance || lastKey !== key) {
    aiInstance = new GoogleGenAI({ apiKey: key });
    lastKey = key;
  }
  return aiInstance;
}

export interface AnalysisResult {
  detectedStage: string;
  suggestions: string;
  alerts: string[];
  idealPH: string;
  idealEC: string;
  fertCombination: string;
}

export interface DailyRecommendation {
  tip: string;
  priority: 'Low' | 'Medium' | 'High';
  actionable: string;
}

// ─── Daily Recommendation ────────────────────────────────────

export async function getDailyRecommendation(
  growInfo: any,
  lastEntries: any[]
): Promise<DailyRecommendation> {
  const fallback: DailyRecommendation = {
    tip: "Continue monitorando suas plantas e mantendo o ambiente estável.",
    priority: "Low",
    actionable: "Verifique a umidade do solo.",
  };

  try {
    const response = await getAI().models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{
        parts: [{
          text: `Gere uma recomendação diária de cultivo de cannabis.
Cultivo: ${JSON.stringify(growInfo)}
Últimos 3 registros: ${JSON.stringify(lastEntries.slice(0, 3))}
Data: ${new Date().toISOString()}
Fertilizantes: ${growInfo.availableFertilizers?.map((f: any) => `${f.name}${f.npk ? ` (NPK:${f.npk})` : ""}`).join(", ") || "Nenhum"}

Forneça: dica diária concisa, prioridade (Low/Medium/High) e tarefa específica para hoje. Responda em Português.`
        }]
      }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            tip: { type: Type.STRING },
            priority: { type: Type.STRING, enum: ["Low", "Medium", "High"] },
            actionable: { type: Type.STRING },
          },
          required: ["tip", "priority", "actionable"]
        }
      }
    });
    return JSON.parse(response.text || "{}") as DailyRecommendation;
  } catch (e) {
    console.error("getDailyRecommendation failed:", e);
    return fallback;
  }
}

// ─── Grow Entry Analysis ──────────────────────────────────────

export async function analyzeGrowEntry(
  photos: string[],
  notes: string,
  growInfo: any
): Promise<AnalysisResult> {
  const fallback: AnalysisResult = {
    detectedStage: growInfo.stage,
    suggestions: "Análise indisponível no momento. Suas notas foram salvas.",
    alerts: [],
    idealPH: "N/A",
    idealEC: "N/A",
    fertCombination: "N/A",
  };

  try {
    const parts: any[] = [{
      text: `Analise este registro de cultivo de cannabis.
Notas: ${notes || "Nenhuma nota fornecida."}
Cultivo: ${JSON.stringify(growInfo)}
Semente: ${growInfo.seedType} | Estágio: ${growInfo.stage}
Fertilizantes disponíveis: ${growInfo.availableFertilizers?.map((f: any) => `${f.name}${f.npk ? ` (NPK:${f.npk})` : ""}`).join(", ") || "Nenhum"}

Com base nas fotos e informações:
1. Identifique o estágio atual (Seedling/Vegetative/Flowering/Harvested/Curing).
2. Sugestões específicas em português.
3. Melhor combinação dos fertilizantes DISPONÍVEIS listados acima.
4. "Chorume" é fertilizante orgânico válido.
5. pH e EC ideais para este estágio.
6. Liste problemas detectados em "alerts" (folhas amareladas, pragas, etc).`
    }];

    for (const photo of photos) {
      if (photo.startsWith("data:image")) {
        try {
          const mimeType = photo.split(";")[0].split(":")[1];
          const base64Data = photo.split(",")[1];
          if (base64Data && mimeType) {
            parts.push({ inlineData: { data: base64Data, mimeType } });
          }
        } catch (e) {
          console.error("Erro ao processar foto:", e);
        }
      }
    }

    const response = await getAI().models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ parts }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            detectedStage: { type: Type.STRING, description: "Seedling|Vegetative|Flowering|Harvested|Curing" },
            suggestions: { type: Type.STRING, description: "Sugestões em português" },
            alerts: { type: Type.ARRAY, items: { type: Type.STRING } },
            idealPH: { type: Type.STRING },
            idealEC: { type: Type.STRING },
            fertCombination: { type: Type.STRING },
          },
          required: ["detectedStage", "suggestions", "alerts", "idealPH", "idealEC", "fertCombination"]
        }
      }
    });

    if (!response.text) throw new Error("Resposta vazia da IA.");
    const parsed = JSON.parse(response.text) as AnalysisResult;
    if (!Array.isArray(parsed.alerts)) parsed.alerts = [];
    return parsed;

  } catch (e: any) {
    console.error("analyzeGrowEntry failed:", e);
    const msg = e?.message || "";
    if (msg.includes("API_KEY") || msg.includes("API key")) {
      fallback.suggestions = "Chave de API Gemini não encontrada. Verifique as configurações do AI Studio.";
    } else if (msg.includes("quota") || msg.includes("429")) {
      fallback.suggestions = "Limite de uso da IA atingido. Tente novamente mais tarde.";
    } else {
      fallback.suggestions = `Erro na análise: ${msg || "desconhecido"}. Suas notas foram salvas.`;
    }
    return fallback;
  }
}
