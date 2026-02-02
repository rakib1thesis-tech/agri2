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
      (process as any).env.VITE_GEMINI_API_KEY || (process as any).env.API_KEY,
      (process as any).env.API_KEY_2,
      (process as any).env.API_KEY_3
    ].filter(k => k && k.length > 5) as string[];
  }

  private getClient() {
    if (this.keys.length === 0) {
      throw new Error("No API keys configured. Ensure environment variables are set.");
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

// --- Data Interfaces ---
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
 * Harvest Analysis Logic
 * Satisfies both getHarvestCompatibility (Sensors.tsx) and getHarvestIndex (UserFields.tsx)
 */
export const getHarvestCompatibility = async (sensorData: any, fieldName: string): Promise<HarvestIndex> => {
  const prompt = `
    Analyze current field conditions for "${fieldName}" in Bangladesh:
    ${JSON.stringify(sensorData)}
    
    Calculate a "Harvest Compatibility Index" (0-100).
    Context: Low moisture (15-30%) and stable NPK often indicate optimal ripeness for local crops.
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
    return { score: 0, status: 'Early', recommendation: "Awaiting sufficient sensor data for harvest profiling." };
  }
};

// Alias for compatibility across different components
export const getHarvestIndex = getHarvestCompatibility;

/**
 * Crop Suitability Analysis
 * Generates the dynamic crop cards for the Harvest Compatibility Index section.
 */
export const getCropAnalysis = async (sensorData: any): Promise<CropRecommendation[]> => {
  const prompt = `
    Act as an agronomist. Based on these Bangladesh sensor readings: ${JSON.stringify(sensorData)}, 
    recommend 3 suitable crops. 
    Return JSON array of: 
    { "crop": "string", "suitability": number, "reasoning": "short string", "tips": ["string"] }
  `;
  try {
    const result = await aiProvider.generate({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
    return JSON.parse(result.response.text());
  } catch (e) {
    return [];
  }
};

/**
 * Soil Health Diagnostic
 */
export const getSoilHealthSummary = async (sensorData: any): Promise<SoilInsight> => {
  const prompt = `Analyze soil health for: ${JSON.stringify(sensorData)}. Return JSON: { "summary": "string", "health_score": number, "warnings": ["string"] }`;
  try {
    const result = await aiProvider.generate({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
    return JSON.parse(result.response.text());
  } catch (e) {
    return { summary: "Diagnostic unavailable", health_score: 0, warnings: [] };
  }
};

/**
 * Operational Roadmap Generation
 */
export const getDetailedManagementPlan = async (sensorData: any): Promise<any[]> => {
  const prompt = `Create a 3-task prioritized management plan for: ${JSON.stringify(sensorData)}. Return JSON array: { "priority": "HIGH"|"MEDIUM"|"LOW", "title": "string", "description": "string", "icon": "fa-icon-class" }`;
  try {
    const result = await aiProvider.generate({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
    return JSON.parse(result.response.text());
  } catch (e) {
    return [];
  }
};

/**
 * Precision Management Prescriptions
 */
export const getManagementPrescriptions = async (sensorData: any): Promise<ManagementPrescription> => {
  const prompt = `Provide irrigation/nutrient prescriptions for: ${JSON.stringify(sensorData)}. Return JSON: { "irrigation": { "needed": boolean, "volume": "string", "schedule": "string" }, "nutrient": { "needed": boolean, "fertilizers": ["string"], "advice": "string" } }`;
  try {
    const result = await aiProvider.generate({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
    return JSON.parse(result.response.text());
  } catch (e) {
    return {
      irrigation: { needed: false, volume: "N/A", schedule: "N/A" },
      nutrient: { needed: false, fertilizers: [], advice: "N/A" }
    };
  }
};
