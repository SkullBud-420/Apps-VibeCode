import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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
  
  const response = await ai.models.generateContent({
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

  try {
    return JSON.parse(response.text || '{}') as DailyRecommendation;
  } catch (e) {
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
  
  const parts = [
    { text: `Analyze this cannabis grow entry. 
    Notes: ${notes}
    Grow Info: ${JSON.stringify(growInfo)}
    Seed Type: ${growInfo.seedType}
    Current Stage: ${growInfo.stage}
    Available Fertilizers (Inventory): ${growInfo.availableFertilizers?.map((f: any) => `${f.name}${f.npk ? ` (NPK: ${f.npk})` : ''}`).join(', ') || 'None specified'}
    
    Based on the photos and info:
    1. Identify the current growth stage.
    2. Provide specific cultivation suggestions.
    3. IMPORTANT: Suggest the BEST combination of fertilizers using ONLY the "Available Fertilizers" listed above. 
    4. NOTE: "Chorume" (leachate) is a valid organic fertilizer, treat it as such.
    5. Provide the IDEAL pH and EC levels for this specific stage and seed type.
    6. If you detect any issues (yellowing, pests, etc.), list them as "alerts".
    
    Respond in Portuguese.` }
  ];

  for (const photo of photos) {
    if (photo.startsWith('data:image')) {
      const base64Data = photo.split(',')[1];
      const mimeType = photo.split(';')[0].split(':')[1];
      parts.push({
        inlineData: {
          data: base64Data,
          mimeType: mimeType
        }
      } as any);
    }
  }

  const response = await ai.models.generateContent({
    model,
    contents: [{ parts }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          detectedStage: { type: Type.STRING, description: "One of: Seedling, Vegetative, Flowering, Harvested" },
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

  try {
    return JSON.parse(response.text || '{}') as AnalysisResult;
  } catch (e) {
    console.error("Failed to parse AI response", e);
    return {
      detectedStage: growInfo.stage,
      suggestions: "Não foi possível gerar sugestões no momento.",
      alerts: [],
      idealPH: "N/A",
      idealEC: "N/A",
      fertCombination: "N/A"
    };
  }
}
