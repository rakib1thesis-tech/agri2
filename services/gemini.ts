import { GoogleGenAI } from "@google/genai";
import { CropRecommendation } from "../types";

/**
 * Multi-Key Rotation System
 * Cycles through up to 3 keys from environment variables to manage rate limits.
 */
class RotatingAIProvider {
  private keys: string[];
  private currentIndex: number = 0;
  private instances: Map<string, any> = new Map();

  constructor() {
    this.keys = [
      (process as any).env.API_KEY || (process as any).env.VITE_GEMINI_API_KEY,
      (process as any).env.API_KEY_2,
      (process as any).env.API_KEY_3
    ].filter(k => k && k.length > 5) as string[];
  }

  private getClient() {
    if (this.keys.length === 0) {
      throw new Error("No API keys configured. Ensure process.env.API_KEY is defined.");
    }
    const key = this.keys[this.currentIndex];
    if (!this.instances.has(key)) {
      this.instances.set(key, new GoogleGenAI(key));
    }
    return this.instances.get(key);
  }

  private rotate() {
    if (this.keys.length > 1) {
      this.currentIndex = (this.currentIndex + 1) % this.keys.length;
    }
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
      console.error(`AI Provider Error (Key ${this.currentIndex}):`, error.message);
      this.rotate();
      if (retries > 0) return this.generate(params, retries - 1);
      throw error;
    }
  }
}

const aiProvider = new RotatingAIProvider();

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

/**
 * RENAMED TO MATCH Sensors.tsx EXPECTATIONS
 */
export const getHarvestCompatibility = async (sensorData: any, fieldName: string): Promise<HarvestIndex> => {
  const prompt = `
    Analyze current field conditions for "${fieldName}" in Bangladesh:
    ${JSON.stringify(sensorData)}
    
    Calculate a "Harvest Compatibility Index" (0-100).
    Return ONLY valid JSON:
    {
      "score": number,
      "status": "Early" | "Optimal" | "Late" | "Warning",
      "recommendation": "string"
    }
  `;

  try {
    const result = await aiProvider.generate({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
    return JSON.parse(result.response.text());
  } catch (e) {
    return { score: 0, status: 'Early', recommendation: "Insufficient sensor data for harvest prediction." };
  }
};

// Also export as getHarvestIndex just in case UserFields.tsx needs that name
export const getHarvestIndex = getHarvestCompatibility;

export const getCropAnalysis = async (sensorData: any): Promise<CropRecommendation[]> => {
  const prompt = `Based on these sensor readings: ${JSON.stringify(sensorData)}, recommend 3 suitable crops for Bangladesh. Return JSON array of {crop, suitability, reasoning, tips[]}.`;
  try {
    const result = await aiProvider.generate({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
    return JSON.parse(result.response.text());
  } catch (e) {
    return [];
  }
};

export const getSoilHealthSummary = async (sensorData: any): Promise<SoilInsight> => {
  const prompt = `Analyze soil health for: ${JSON.stringify(sensorData)}. Return JSON {summary, health_score, warnings[]}.`;
  try {
    const result = await aiProvider.generate({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
    return JSON.parse(result.response.text());
  } catch (e) {
    return { summary: "Analysis unavailable", health_score: 0, warnings: [] };
  }
};

export const getDetailedManagementPlan = async (sensorData: any): Promise<any[]> => {
  const prompt = `Create a 3-task prioritized management plan for: ${JSON.stringify(sensorData)}. Return JSON array of {priority, title, description, icon}.`;
  try {
    const result = await aiProvider.generate({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
    return JSON.parse(result.response.text());
  } catch (e) {
    return [];
  }
};

export const getManagementPrescriptions = async (sensorData: any): Promise<ManagementPrescription> => {
  const prompt = `Provide irrigation/nutrient prescriptions for: ${JSON.stringify(sensorData)}. Return JSON {irrigation, nutrient}.`;
  try {
    const result = await aiProvider.generate({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
    return JSON.parse(result.response.text());
  } catch (e) {
    return {
      irrigation: { needed: false, volume: "0", schedule: "N/A" },
      nutrient: { needed: false, fertilizers: [], advice: "N/A" }
    };
  }
};
