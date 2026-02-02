import { GoogleGenAI, Type } from "@google/genai";
import { Field, CropRecommendation } from "../types";

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
      process.env.API_KEY,
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
      this.instances.set(key, new GoogleGenAI({ apiKey: key }));
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
      // Using gemini-1.5-flash for speed and reliability
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
 * EXTENDED LOGIC: Harvest Compatibility Index
 * Analyzes sensor trends to predict the ideal harvest window.
 */
export const getHarvestIndex = async (sensorData: any, fieldName: string): Promise<HarvestIndex> => {
  const prompt = `
    Analyze current field conditions for "${fieldName}" in Bangladesh:
    ${JSON.stringify(sensorData)}
    
    Calculate a "Harvest Compatibility Index" (0-100).
    Context: 
    - Low soil moisture (15-30%) combined with stable NPK usually indicates optimal ripeness for delta crops like Potatoes or Rice.
    - High moisture (>60%) suggests the crop is still in growth phase (Early).
    - Extreme heat (>35°C) with low moisture might trigger a "Warning" for heat stress rather than harvest.

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

/**
 * ORIGINAL LOGIC: Crop Suitability Analysis
 */
export const getCropAnalysis = async (sensorData: any): Promise<CropRecommendation[]> => {
  const prompt = `Based on these sensor readings: ${JSON.stringify(sensorData)}, recommend 3 suitable crops for Bangladesh. Consider soil pH, moisture, and NPK levels. Return JSON array of {crop, suitability, reasoning, tips[]}.`;
  try {
    const result = await aiProvider.generate({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
    return JSON.parse(result.response.text());
  } catch (e) {
    return [];
  }
};

/**
 * ORIGINAL LOGIC: Soil Health Summary
 */
export const getSoilHealthSummary = async (sensorData: any): Promise<SoilInsight> => {
  const prompt = `Analyze soil health for: ${JSON.stringify(sensorData)}. Identify nutrient deficiencies or pH imbalances. Return JSON {summary, health_score, warnings[]}.`;
  try {
    const result = await aiProvider.generate({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
    return JSON.parse(result.response.text());
  } catch (e) {
    return { summary: "Analysis unavailable", health_score: 0, warnings: [] };
  }
};

/**
 * ORIGINAL LOGIC: Management Plan
 */
export const getDetailedManagementPlan = async (sensorData: any): Promise<any[]> => {
  const prompt = `Create a 3-task prioritized management plan for: ${JSON.stringify(sensorData)}. Return JSON array of {priority (HIGH/MEDIUM/LOW), title, description, icon (font-awesome class)}.`;
  try {
    const result = await aiProvider.generate({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
    return JSON.parse(result.response.text());
  } catch (e) {
    return getFallbackPlan(sensorData);
  }
};

/**
 * ORIGINAL LOGIC: Management Prescriptions
 */
export const getManagementPrescriptions = async (sensorData: any): Promise<ManagementPrescription> => {
  const prompt = `Provide precise irrigation and nutrient prescriptions for: ${JSON.stringify(sensorData)}. Return JSON {irrigation: {needed, volume, schedule}, nutrient: {needed, fertilizers[], advice}}.`;
  try {
    const result = await aiProvider.generate({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
    return JSON.parse(result.response.text());
  } catch (e) {
    return getFallbackPrescription(sensorData);
  }
};

/**
 * FALLBACK UTILITIES
 * Preserved from your original file to ensure functionality during API downtime.
 */
const getFallbackPlan = (data: any) => {
  const roadmap = [];
  if (data.moisture !== undefined && data.moisture < 20) {
    roadmap.push({ priority: "HIGH", title: "Moisture Balance", description: "Soil moisture is critically low. Immediate irrigation required.", icon: "fa-droplet" });
  }
  if (data.ph !== undefined && (data.ph < 5.5 || data.ph > 7.5)) {
    roadmap.push({ priority: "MEDIUM", title: "pH Correction", description: "Soil acidity/alkalinity is outside optimal range.", icon: "fa-scale-balanced" });
  }
  if (roadmap.length === 0) {
    roadmap.push({ priority: "LOW", title: "Routine Monitoring", description: "Conditions stable. Continue regular sensor checks.", icon: "fa-check-circle" });
  }
  return roadmap;
};

const getFallbackPrescription = (data: any): ManagementPrescription => {
  const isDry = data.moisture !== undefined && data.moisture < 20;
  return {
    irrigation: { needed: isDry, volume: isDry ? "12,000L/ha" : "Monitoring", schedule: "Pre-dawn" },
    nutrient: { needed: false, fertilizers: [], advice: "NPK levels stable or sensor missing." }
  };
};
