export interface Fertilizer {
  name: string;
  npk: string;
  amount: string;
}

export interface DiaryEntry {
  id?: string;
  growId: string;
  date: string;
  notes: string;
  photos: string[];
  fertilizers: Fertilizer[];
  aiSuggestions?: string;
  detectedStage?: string;
  temperature?: string;
  humidity?: string;
  ph?: string;
  ec?: string;
  height?: string;
  aiAlerts?: string[];
  idealPH?: string;
  idealEC?: string;
  fertCombination?: string;
}

export interface Grow {
  id?: string;
  name: string;
  strain: string;
  seedType: 'Automatic' | 'Photoperiod';
  stage: 'Seedling' | 'Vegetative' | 'Flowering' | 'Harvested' | 'Curing';
  stageStartDate: string;
  environment: 'Indoor' | 'Outdoor';
  space: string;
  lighting: string;
  substrate?: string;
  potSize?: string;
  estimatedDays?: number;
  createdAt: string;
  userId: string;
  availableFertilizers?: { name: string; npk?: string }[];
  entries?: DiaryEntry[];
}
