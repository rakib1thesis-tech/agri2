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
    if (this.keys.length === 0) throw new Error("No API keys found.");
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

export interface HarvestIndex { score: number; status: 'Early' | 'Optimal' | 'Late' | 'Warning'; recommendation: string; }
export interface SoilInsight { summary: string; health_score: number; warnings: string[]; }

export const getHarvestCompatibility = async (sensorData: any, fieldName: string): Promise<HarvestIndex> => {
  const prompt = `Analyze harvest for ${fieldName} in Bangladesh. Sensors: ${JSON.stringify(sensorData)}. Return JSON {score, status, recommendation}`;
  try {
    const result = await aiProvider.generate({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
    return JSON.parse(result.response.text());
  } catch (e) { return { score: 0, status: 'Early', recommendation: "Awaiting sensor data." }; }
};

export const getHarvestIndex = getHarvestCompatibility;

export const getCropAnalysis = async (sensorData: any): Promise<CropRecommendation[]> => {
  const prompt = `Based on N: ${sensorData.n}, P: ${sensorData.p}, K: ${sensorData.k} and Moisture: ${sensorData.moisture}%, recommend 3 crops for Bangladesh. Return JSON array [{crop, suitability, reasoning, tips[]}]`;
  try {
    const result = await aiProvider.generate({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
    return JSON.parse(result.response.text());
  } catch (e) { return []; }
};

export const getSoilHealthSummary = async (sensorData: any): Promise<SoilInsight> => {
  const prompt = `Analyze soil health for NPK (${sensorData.n}, ${sensorData.p}, ${sensorData.k}). Return JSON {summary, health_score, warnings[]}`;
  try {
    const result = await aiProvider.generate({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
    return JSON.parse(result.response.text());
  } catch (e) { return { summary: "N/A", health_score: 0, warnings: [] }; }
};

export const getDetailedManagementPlan = async (sensorData: any): Promise<any[]> => {
  const prompt = `3 tasks for sensor state: ${JSON.stringify(sensorData)}. Return JSON array [{priority, title, description, icon}]`;
  try {
    const result = await aiProvider.generate({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
    return JSON.parse(result.response.text());
  } catch (e) { return []; }
};
