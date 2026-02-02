import { GoogleGenAI } from "@google/genai";
import { CropRecommendation } from "../types";

class RotatingAIProvider {
  private keys: string[];
  private currentIndex: number = 0;
  private instances: Map<string, any> = new Map();

  constructor() {
    this.keys = [
      (process as any).env.VITE_GEMINI_API_KEY || (process as any).env.API_KEY,
      (process as any).env.API_KEY_2,
      (process as any).env.API_KEY_3
    ].filter(k => k && k.length > 5) as string[];
  }

  private getClient() {
    if (this.keys.length === 0) throw new Error("API Keys missing.");
    const key = this.keys[this.currentIndex];
    if (!this.instances.has(key)) this.instances.set(key, new GoogleGenAI(key));
    return this.instances.get(key);
  }

  async generate(params: any, retries = 2): Promise<any> {
    try {
      const ai = this.getClient();
      const model = ai.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        generationConfig: { responseMimeType: "application/json" }
      });
      return await model.generateContent(params);
    } catch (error: any) {
      this.currentIndex = (this.currentIndex + 1) % this.keys.length;
      if (retries > 0) return this.generate(params, retries - 1);
      throw error;
    }
  }
}

const aiProvider = new RotatingAIProvider();

// --- Interfaces ---
export interface HarvestIndex { 
  score: number; 
  status: 'Early' | 'Optimal' | 'Late' | 'Warning'; 
  recommendation: string; 
}

export interface SoilInsight { 
  summary: string; 
  health_score: number; 
  warnings: string[]; 
}

export interface ManagementPrescription {
  irrigation: { needed: boolean; volume: string; schedule: string };
  nutrient: { needed: boolean; fertilizers: string[]; advice: string };
}

// --- Functions ---

export const getHarvestCompatibility = async (sensorData: any, fieldName: string): Promise<HarvestIndex> => {
  const prompt = `Analyze harvest for ${fieldName} in Bangladesh. Data: ${JSON.stringify(sensorData)}. Return JSON {score, status, recommendation}`;
  try {
    const result = await aiProvider.generate({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
    return JSON.parse(result.response.text());
  } catch (e) { return { score: 0, status: 'Warning', recommendation: "Awaiting sensor data." }; }
};

export const getHarvestIndex = getHarvestCompatibility;

export const getCropAnalysis = async (sensorData: any): Promise<CropRecommendation[]> => {
  const prompt = `Based on N:${sensorData.n}, P:${sensorData.p}, K:${sensorData.k}, Moisture:${sensorData.moisture}%, pH:${sensorData.ph}, Temp:${sensorData.temp}, recommend 3 crops for Bangladesh. Even if some data is null, provide recommendations. Return JSON array [{crop, suitability, reasoning, tips[]}]`;
  try {
    const result = await aiProvider.generate({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
    return JSON.parse(result.response.text());
  } catch (e) { return []; }
};

export const getSoilHealthSummary = async (sensorData: any): Promise<SoilInsight> => {
  const prompt = `Analyze soil health for sensors: ${JSON.stringify(sensorData)}. Return JSON {summary, health_score, warnings[]}`;
  try {
    const result = await aiProvider.generate({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
    return JSON.parse(result.response.text());
  } catch (e) { return { summary: "N/A", health_score: 0, warnings: [] }; }
};

export const getDetailedManagementPlan = async (sensorData: any): Promise<any[]> => {
  const prompt = `Create 3 prioritized tasks for sensor state: ${JSON.stringify(sensorData)}. Return JSON array [{priority, title, description, icon}]`;
  try {
    const result = await aiProvider.generate({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
    return JSON.parse(result.response.text());
  } catch (e) { return []; }
};

// ADDED THIS BACK TO FIX THE BUILD ERROR
export const getManagementPrescriptions = async (sensorData: any): Promise<ManagementPrescription> => {
  const prompt = `Provide irrigation/nutrient prescriptions for: ${JSON.stringify(sensorData)}. Return JSON {irrigation, nutrient}`;
  try {
    const result = await aiProvider.generate({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
    return JSON.parse(result.response.text());
  } catch (e) {
    return {
      irrigation: { needed: false, volume: "N/A", schedule: "N/A" },
      nutrient: { needed: false, fertilizers: [], advice: "Awaiting data" }
    };
  }
};
