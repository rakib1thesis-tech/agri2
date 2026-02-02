import { GoogleGenAI } from "@google/genai";
import { CropRecommendation } from "../types";

/**
 * Multi-Key Rotation System
 */
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
    if (this.keys.length === 0) throw new Error("No API keys found in Environment Variables.");
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
      console.error(`AI Key ${this.currentIndex} failed, rotating...`);
      this.currentIndex = (this.currentIndex + 1) % this.keys.length;
      if (retries > 0) return this.generate(params, retries - 1);
      throw error;
    }
  }
}

const aiProvider = new RotatingAIProvider();

export interface HarvestIndex { score: number; status: 'Early' | 'Optimal' | 'Late' | 'Warning'; recommendation: string; }
export interface SoilInsight { summary: string; health_score: number; warnings: string[]; }

/**
 * CORE: Harvest Compatibility (Satisfies both Sensors.tsx and UserFields.tsx)
 */
export const getHarvestCompatibility = async (sensorData: any, fieldName: string): Promise<HarvestIndex> => {
  const prompt = `
    Analyze harvest for "${fieldName}" in Bangladesh. 
    Sensor Data: ${JSON.stringify(sensorData)}.
    Even if data is partial, estimate the harvest score (0-100).
    Return ONLY JSON: { "score": number, "status": "Early"|"Optimal"|"Late"|"Warning", "recommendation": "string" }
  `;
  try {
    const result = await aiProvider.generate({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
    return JSON.parse(result.response.text());
  } catch (e) {
    return { score: 0, status: 'Warning', recommendation: "Update sensors to calculate index." };
  }
};
export const getHarvestIndex = getHarvestCompatibility;

/**
 * CORE: Crop Recommendations (Forces output even with 1 sensor)
 */
export const getCropAnalysis = async (sensorData: any): Promise<CropRecommendation[]> => {
  const prompt = `
    Act as a Bangladesh Agronomist. 
    Available Data: ${JSON.stringify(sensorData)}.
    Requirement: Even if only ONE sensor (like moisture) is provided and others are null, 
    recommend 3 crops suitable for that specific value.
    Return ONLY JSON array: [{ "crop": "string", "suitability": number, "reasoning": "string", "tips": ["string"] }]
  `;
  try {
    const result = await aiProvider.generate({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
    return JSON.parse(result.response.text());
  } catch (e) {
    return [];
  }
};

/**
 * CORE: Soil Health
 */
export const getSoilHealthSummary = async (sensorData: any): Promise<SoilInsight> => {
  const prompt = `Analyze soil health for: ${JSON.stringify(sensorData)}. Return JSON { "summary": "string", "health_score": number, "warnings": ["string"] }`;
  try {
    const result = await aiProvider.generate({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
    return JSON.parse(result.response.text());
  } catch (e) {
    return { summary: "System analyzing...", health_score: 50, warnings: ["Awaiting more sensor data"] };
  }
};

/**
 * CORE: Roadmap
 */
export const getDetailedManagementPlan = async (sensorData: any): Promise<any[]> => {
  const prompt = `Prioritized tasks for: ${JSON.stringify(sensorData)}. Return JSON array [{ "priority": "HIGH"|"MEDIUM"|"LOW", "title": "string", "description": "string", "icon": "fa-seedling" }]`;
  try {
    const result = await aiProvider.generate({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
    return JSON.parse(result.response.text());
  } catch (e) {
    return [];
  }
};
