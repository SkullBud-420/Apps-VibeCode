// ============================================================
// geminiService.ts
// Chama /api/ai (servidor Vite/Node) que tem acesso ao process.env
// O browser nunca toca a chave API — zero configuração pelo usuário
// ============================================================

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

async function callAI(prompt: string, schema: any, parts?: any[]): Promise<any> {
  const textPart = { text: prompt };
  const contentParts = parts ? [textPart, ...parts] : [textPart];

  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gemini-2.0-flash',
      contents: [{ parts: contentParts }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: schema,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Erro ${res.status}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Resposta vazia da IA.');
  return JSON.parse(text);
}

// ─── Daily Recommendation ────────────────────────────────────

export async function getDailyRecommendation(
  growInfo: any,
  lastEntries: any[]
): Promise<DailyRecommendation> {
  const fallback: DailyRecommendation = {
    tip: 'Continue monitorando suas plantas e mantendo o ambiente estável.',
    priority: 'Low',
    actionable: 'Verifique a umidade do solo.',
  };

  try {
    const prompt = `Gere uma recomendação diária de cultivo de cannabis em Português.
Cultivo: ${JSON.stringify(growInfo)}
Últimos 3 registros: ${JSON.stringify(lastEntries.slice(0, 3))}
Data: ${new Date().toISOString()}
Fertilizantes disponíveis: ${growInfo.availableFertilizers?.map((f: any) => `${f.name}${f.npk ? ` (NPK:${f.npk})` : ''}`).join(', ') || 'Nenhum'}`;

    const schema = {
      type: 'object',
      properties: {
        tip: { type: 'string' },
        priority: { type: 'string', enum: ['Low', 'Medium', 'High'] },
        actionable: { type: 'string' },
      },
      required: ['tip', 'priority', 'actionable'],
    };

    return await callAI(prompt, schema);
  } catch (e) {
    console.error('getDailyRecommendation failed:', e);
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
    suggestions: 'Análise indisponível no momento. Suas notas foram salvas.',
    alerts: [],
    idealPH: 'N/A',
    idealEC: 'N/A',
    fertCombination: 'N/A',
  };

  try {
    const prompt = `Analise este registro de cultivo de cannabis.
Notas: ${notes || 'Nenhuma nota fornecida.'}
Cultivo: ${JSON.stringify(growInfo)}
Semente: ${growInfo.seedType} | Estágio: ${growInfo.stage}
Fertilizantes disponíveis: ${growInfo.availableFertilizers?.map((f: any) => `${f.name}${f.npk ? ` (NPK:${f.npk})` : ''}`).join(', ') || 'Nenhum'}

Analise as fotos e forneça:
1. Estágio detectado (Seedling/Vegetative/Flowering/Harvested/Curing)
2. Sugestões específicas em português
3. Melhor combinação dos fertilizantes DISPONÍVEIS listados acima
4. "Chorume" é fertilizante orgânico válido
5. pH e EC ideais para este estágio
6. Lista de problemas detectados (folhas amareladas, pragas, etc.)`;

    const schema = {
      type: 'object',
      properties: {
        detectedStage: { type: 'string' },
        suggestions: { type: 'string' },
        alerts: { type: 'array', items: { type: 'string' } },
        idealPH: { type: 'string' },
        idealEC: { type: 'string' },
        fertCombination: { type: 'string' },
      },
      required: ['detectedStage', 'suggestions', 'alerts', 'idealPH', 'idealEC', 'fertCombination'],
    };

    // Converte fotos base64 para partes inline
    const imageParts = photos
      .filter(p => p.startsWith('data:image'))
      .map(p => ({
        inlineData: {
          mimeType: p.split(';')[0].split(':')[1],
          data: p.split(',')[1],
        },
      }));

    const result = await callAI(prompt, schema, imageParts);
    if (!Array.isArray(result.alerts)) result.alerts = [];
    return result;

  } catch (e: any) {
    console.error('analyzeGrowEntry failed:', e);
    const msg: string = e?.message || '';
    if (msg.includes('GEMINI_API_KEY')) {
      fallback.suggestions = 'Chave API não configurada no servidor. Verifique os Secrets do AI Studio.';
    } else {
      fallback.suggestions = `Erro na análise: ${msg}. Suas notas foram salvas.`;
    }
    return fallback;
  }
}
