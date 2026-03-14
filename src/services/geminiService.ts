import { GoogleGenAI, Type } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;

function getAI() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined. Please configure it in the Secrets panel.");
    }
    aiInstance = new GoogleGenAI({ apiKey });
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

export async function getDailyRecommendation(
  growInfo: any,
  lastEntries: any[]
): Promise<DailyRecommendation> {
  const model = "gemini-3-flash-preview";
  
  try {
    const response = await getAI().models.generateContent({
      model,
      contents: [{
        parts: [{
          text: `Generate a daily cultivation recommendation for this cannabis plant.
          Grow Info: ${JSON.stringify(growInfo)}
          Last 3 Diary Entries: ${JSON.stringify(lastEntries.slice(0, 3))}
          Current Date: ${new Date().toISOString()}
          
          Consider:
          1. The current stage of the plant.
          2. Any issues or metrics reported in recent entries.
          3. The environment (Indoor/Outdoor).
          4. Available fertilizers: ${growInfo.availableFertilizers?.map((f: any) => `${f.name}${f.npk ? ` (NPK: ${f.npk})` : ''}`).join(', ') || 'None'}
          
          Provide:
          - A concise daily tip.
          - A priority level (Low, Medium, High).
          - A specific actionable task for today.
          
          Respond in Portuguese.`
        }]
      }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            tip: { type: Type.STRING, description: "Daily cultivation tip" },
            priority: { type: Type.STRING, enum: ["Low", "Medium", "High"], description: "Priority level" },
            actionable: { type: Type.STRING, description: "Specific task for today" }
          },
          required: ["tip", "priority", "actionable"]
        }
      }
    });

    return JSON.parse(response.text || '{}') as DailyRecommendation;
  } catch (e) {
    console.error("AI Recommendation failed:", e);
    return {
      tip: "Continue monitorando suas plantas e mantendo o ambiente estável.",
      priority: "Low",
      actionable: "Verifique a umidade do solo."
    };
  }
}

export async function analyzeGrowEntry(
  photos: string[],
  notes: string,
  growInfo: any
): Promise<AnalysisResult> {
  const model = "gemini-3-flash-preview";
  
  try {
    const parts: any[] = [
      { text: `Analise este registro de cultivo de cannabis. 
      Notas do Cultivador: ${notes || "Nenhuma nota fornecida."}
      Informações do Cultivo: ${JSON.stringify(growInfo)}
      Tipo de Semente: ${growInfo.seedType}
      Estágio Atual: ${growInfo.stage}
      Fertilizantes Disponíveis (Inventário): ${growInfo.availableFertilizers?.map((f: any) => `${f.name}${f.npk ? ` (NPK: ${f.npk})` : ''}`).join(', ') || 'Nenhum especificado'}
      
      Com base nas fotos e informações fornecidas:
      1. Identifique o estágio de crescimento atual (Seedling, Vegetative, Flowering, Harvested, Curing).
      2. Forneça sugestões específicas de cultivo em português.
      3. IMPORTANTE: Sugira a MELHOR combinação de fertilizantes usando APENAS os "Fertilizantes Disponíveis" listados acima. 
      4. NOTA: "Chorume" é um fertilizante orgânico válido, trate-o como tal.
      5. Forneça os níveis IDEAIS de pH e EC para este estágio específico e tipo de semente.
      6. Se detectar qualquer problema (folhas amareladas, pragas, etc.), liste-os em "alerts".
      
      Responda estritamente em formato JSON.` }
    ];

    for (const photo of photos) {
      if (photo.startsWith('data:image')) {
        try {
          const base64Data = photo.split(',')[1];
          const mimeType = photo.split(';')[0].split(':')[1];
          parts.push({
            inlineData: {
              data: base64Data,
              mimeType: mimeType
            }
          });
        } catch (e) {
          console.error("Error processing photo for AI:", e);
        }
      }
    }

    const response = await getAI().models.generateContent({
      model,
      contents: [{ parts }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            detectedStage: { type: Type.STRING, description: "One of: Seedling, Vegetative, Flowering, Harvested, Curing" },
            suggestions: { type: Type.STRING, description: "Cultivation suggestions in Portuguese" },
            alerts: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of alerts or issues found" },
            idealPH: { type: Type.STRING, description: "Ideal pH range" },
            idealEC: { type: Type.STRING, description: "Ideal EC range" },
            fertCombination: { type: Type.STRING, description: "Best combination of available fertilizers" }
          },
          required: ["detectedStage", "suggestions", "alerts", "idealPH", "idealEC", "fertCombination"]
        }
      }
    });

    if (!response.text) {
      throw new Error("Empty response from AI");
    }

    return JSON.parse(response.text) as AnalysisResult;
  } catch (e: any) {
    console.error("AI Analysis failed:", e);
    
    let suggestions = "Análise indisponível no momento. Suas notas foram salvas.";
    const errorMessage = e.message || "";
    
    if (errorMessage.includes("API_KEY")) {
      suggestions = "Chave de API do Gemini não configurada. Verifique as configurações.";
    } else if (errorMessage.includes("quota")) {
      suggestions = "Limite de uso da IA atingido. Tente novamente mais tarde.";
    }

    return {
      detectedStage: growInfo.stage,
      suggestions,
      alerts: [],
      idealPH: "N/A",
      idealEC: "N/A",
      fertCombination: "N/A"
    };
  }
}
