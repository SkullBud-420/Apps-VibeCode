// ============================================================
// aiService.ts — powered by Anthropic Claude (no API key needed)
// ============================================================

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";

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

async function callClaude(messages: any[], systemPrompt: string): Promise<string> {
  const response = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1000,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const text = data.content
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("");

  return text;
}

function parseJSON<T>(raw: string, fallback: T): T {
  try {
    const clean = raw.replace(/```json|```/g, "").trim();
    return JSON.parse(clean) as T;
  } catch {
    return fallback;
  }
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
    const system = `Você é um especialista em cultivo de cannabis. 
Responda APENAS com JSON válido, sem markdown, sem texto extra.
Formato obrigatório: {"tip":"...","priority":"Low|Medium|High","actionable":"..."}`;

    const userContent = `Gere uma recomendação diária de cultivo para esta planta.
Informações do Cultivo: ${JSON.stringify(growInfo)}
Últimos 3 Registros: ${JSON.stringify(lastEntries.slice(0, 3))}
Data Atual: ${new Date().toISOString()}

Fertilizantes disponíveis: ${
      growInfo.availableFertilizers
        ?.map((f: any) => `${f.name}${f.npk ? ` (NPK: ${f.npk})` : ""}`)
        .join(", ") || "Nenhum"
    }

Forneça: uma dica diária concisa, nível de prioridade (Low/Medium/High) e uma tarefa específica para hoje.
Responda em Português.`;

    const raw = await callClaude(
      [{ role: "user", content: userContent }],
      system
    );

    return parseJSON<DailyRecommendation>(raw, fallback);
  } catch (e) {
    console.error("AI Recommendation failed:", e);
    return fallback;
  }
}

// ─── Grow Entry Analysis (with optional photos) ──────────────

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
    const system = `Você é um especialista em cultivo de cannabis com experiência em análise visual de plantas.
Responda APENAS com JSON válido, sem markdown, sem texto extra.
Formato obrigatório:
{
  "detectedStage": "Seedling|Vegetative|Flowering|Harvested|Curing",
  "suggestions": "sugestões em português",
  "alerts": ["alerta1","alerta2"],
  "idealPH": "faixa ideal de pH",
  "idealEC": "faixa ideal de EC",
  "fertCombination": "combinação recomendada de fertilizantes"
}`;

    const textPart = {
      type: "text",
      text: `Analise este registro de cultivo de cannabis.
Notas do Cultivador: ${notes || "Nenhuma nota fornecida."}
Informações do Cultivo: ${JSON.stringify(growInfo)}
Tipo de Semente: ${growInfo.seedType}
Estágio Atual: ${growInfo.stage}
Fertilizantes Disponíveis: ${
        growInfo.availableFertilizers
          ?.map((f: any) => `${f.name}${f.npk ? ` (NPK: ${f.npk})` : ""}`)
          .join(", ") || "Nenhum especificado"
      }

Com base nas fotos e informações:
1. Identifique o estágio de crescimento atual.
2. Forneça sugestões específicas de cultivo em português.
3. Sugira a MELHOR combinação usando APENAS os fertilizantes disponíveis listados.
4. "Chorume" é um fertilizante orgânico válido.
5. Forneça os níveis IDEAIS de pH e EC para este estágio e tipo de semente.
6. Liste quaisquer problemas detectados (folhas amareladas, pragas, etc.) em "alerts".`,
    };

    const content: any[] = [textPart];

    for (const photo of photos) {
      if (photo.startsWith("data:image")) {
        try {
          const mimeType = photo.split(";")[0].split(":")[1];
          const base64Data = photo.split(",")[1];
          content.push({
            type: "image",
            source: {
              type: "base64",
              media_type: mimeType,
              data: base64Data,
            },
          });
        } catch (e) {
          console.error("Error processing photo for AI:", e);
        }
      }
    }

    const raw = await callClaude([{ role: "user", content }], system);
    const parsed = parseJSON<AnalysisResult>(raw, fallback);

    if (!Array.isArray(parsed.alerts)) parsed.alerts = [];

    return parsed;
  } catch (e: any) {
    console.error("AI Analysis failed:", e);
    return fallback;
  }
}
