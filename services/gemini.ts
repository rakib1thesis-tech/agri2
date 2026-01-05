
import { GoogleGenAI, Type } from "@google/genai";
import { Field, CropRecommendation } from "../types";

/**
 * Multi-Key Rotation System
 * Cycles through up to 3 keys from environment variables.
 * Handles rate limits (429) by automatically switching to the next available key.
 */
class RotatingAIProvider {
  private keys: string[];
  private currentIndex: number = 0;
  private instances: Map<string, any> = new Map();

  constructor() {
    // Collect keys from environment variables as requested
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
      console.warn(`Gemini API: Rotating to key index ${this.currentIndex} due to rate limiting.`);
    }
  }

  /**
   * Executes AI generation with automatic retry and key rotation logic.
   */
  async generate(params: any, retries = 2): Promise<any> {
    try {
      const ai = this.getClient();
      return await ai.models.generateContent(params);
    } catch (error: any) {
      const errorMsg = error.message?.toLowerCase() || "";
      const isRetryable = errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("rate limit");
      
      if (isRetryable && retries > 0) {
        this.rotate();
        // Brief delay before retry to ensure the new key's context is ready
        await new Promise(resolve => setTimeout(resolve, 300));
        return this.generate(params, retries - 1);
      }
      throw error;
    }
  }
}

const aiProvider = new RotatingAIProvider();

export const isAiReady = async () => {
  return !!process.env.API_KEY;
};

/**
 * Robust JSON extraction to handle markdown blocks or non-standard formatting from the model.
 */
const cleanAndParseJSON = (text: string | undefined) => {
  if (!text) return null;
  try {
    const cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleanText);
  } catch (e) {
    console.error("Critical: AI returned malformed JSON", text);
    return null;
  }
};

/**
 * Strict Telemetry Grounding
 * Forces the AI to use the provided sensor numbers for its reasoning.
 */
const formatDataForPrompt = (data: any) => {
  const safeVal = (val: any) => (val != null && !isNaN(Number(val))) ? Number(val).toFixed(2) : "N/A";
  
  return `
    [MANDATORY TELEMETRY CONTEXT]
    - Soil Moisture: ${safeVal(data.moisture)}% (Status: ${data.moisture < 20 ? 'CRITICAL DRY' : data.moisture > 75 ? 'SATURATED' : 'Optimal'})
    - Soil pH: ${safeVal(data.ph_level)} (Status: ${data.ph_level < 5.5 ? 'ACIDIC' : data.ph_level > 8 ? 'ALKALINE' : 'Neutral'})
    - NPK (ppm): N=${safeVal(data.npk_n)}, P=${safeVal(data.npk_p)}, K=${safeVal(data.npk_k)}
    - Air Temp: ${safeVal(data.temperature)}°C
    - Soil Profile: ${data.soil_type || 'Loamy'}

    [STRICT INSTRUCTION]
    You are a precision agricultural expert. You MUST prioritize these NUMBERS. 
    If moisture is ${safeVal(data.moisture)}%, provide advice specifically for that level. 
    Do not give generic summaries. If moisture is below 20%, you MUST suggest emergency irrigation.
    If pH is below 5.5, you MUST suggest acidity correction.
  `;
};

// Use Gemini 2 Flash as requested
const MODEL_NAME = 'gemini-2.5-flash-preview-09-2025';

export interface SoilInsight {
  summary: string;
  soil_fertilizer: string;
}

export interface ManagementPrescription {
  irrigation: {
    needed: boolean;
    volume: string;
    schedule: string;
  };
  nutrient: {
    needed: boolean;
    fertilizers: { type: string; amount: string }[];
    advice: string;
  };
}

export const getCropAnalysis = async (field: Field, latestData: any): Promise<CropRecommendation[]> => {
  try {
    const response = await aiProvider.generate({
      model: MODEL_NAME,
      contents: `Generate 3 crop recommendations based on: ${formatDataForPrompt({...latestData, ...field})}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              suitability: { type: Type.NUMBER },
              yield: { type: Type.STRING },
              requirements: { type: Type.STRING },
              fertilizer: { type: Type.STRING },
              icon: { type: Type.STRING }
            },
            required: ["name", "suitability", "yield", "requirements", "fertilizer", "icon"]
          }
        }
      }
    });
    return cleanAndParseJSON(response.text) || getFallbackCrops(latestData);
  } catch (error) {
    return getFallbackCrops(latestData);
  }
};

export const getSoilHealthSummary = async (field: Field, latestData: any): Promise<SoilInsight> => {
  try {
    const response = await aiProvider.generate({
      model: MODEL_NAME,
      contents: `Provide soil health diagnostic and strategy for: ${formatDataForPrompt({...latestData, ...field})}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            soil_fertilizer: { type: Type.STRING }
          },
          required: ["summary", "soil_fertilizer"]
        }
      }
    });
    return cleanAndParseJSON(response.text) || getFallbackSoilInsight(latestData);
  } catch (error) {
    return getFallbackSoilInsight(latestData);
  }
};

export const getManagementPrescriptions = async (field: Field, latestData: any): Promise<ManagementPrescription> => {
  try {
    const response = await aiProvider.generate({
      model: MODEL_NAME,
      contents: `Create management prescriptions for: ${formatDataForPrompt({...latestData, ...field})}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            irrigation: {
              type: Type.OBJECT,
              properties: {
                needed: { type: Type.BOOLEAN },
                volume: { type: Type.STRING },
                schedule: { type: Type.STRING }
              },
              required: ["needed", "volume", "schedule"]
            },
            nutrient: {
              type: Type.OBJECT,
              properties: {
                needed: { type: Type.BOOLEAN },
                fertilizers: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      type: { type: Type.STRING },
                      amount: { type: Type.STRING }
                    },
                    required: ["type", "amount"]
                  }
                },
                advice: { type: Type.STRING }
              },
              required: ["needed", "fertilizers", "advice"]
            }
          },
          required: ["irrigation", "nutrient"]
        }
      }
    });
    return cleanAndParseJSON(response.text) || getFallbackPrescription(latestData);
  } catch (error) {
    return getFallbackPrescription(latestData);
  }
};

export const getDetailedManagementPlan = async (field: Field, latestData: any) => {
  try {
    const response = await aiProvider.generate({
      model: MODEL_NAME,
      contents: `Build a 4-step action plan using: ${formatDataForPrompt({...latestData, ...field})}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              priority: { type: Type.STRING },
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              icon: { type: Type.STRING }
            },
            required: ["priority", "title", "description", "icon"]
          }
        }
      }
    });
    return cleanAndParseJSON(response.text) || getFallbackPlan(latestData);
  } catch (error) {
    return getFallbackPlan(latestData);
  }
};

// --- DYNAMIC DATA-AWARE FALLBACKS ---
// These are safety checks if the AI is unreachable, but they still respect user telemetry.

const getFallbackCrops = (data: any): CropRecommendation[] => {
  const isDry = (data.moisture || 45) < 20;
  return [
    { name: isDry ? "Millets" : "Hybrid Rice", suitability: 90, yield: isDry ? "2.0t/ha" : "7.5t/ha", requirements: "Low water needed.", fertilizer: "Urea", icon: "fa-wheat-awn" },
    { name: "Potato", suitability: 82, yield: "22t/ha", requirements: "Balanced NPK.", fertilizer: "MOP", icon: "fa-potato" },
    { name: "Eggplant", suitability: 75, yield: "18t/ha", requirements: "Pest control.", fertilizer: "Organic", icon: "fa-seedling" }
  ];
};

const getFallbackSoilInsight = (data: any): SoilInsight => {
  const isDry = (data.moisture || 45) < 20;
  return {
    summary: `Sensors detected ${isDry ? 'CRITICAL drought' : 'adequate moisture'}. Restore balance now.`,
    soil_fertilizer: isDry ? "Immediate deep irrigation required." : "Apply 100kg organic compost."
  };
};

const getFallbackPrescription = (data: any): ManagementPrescription => {
  const isDry = (data.moisture || 45) < 20;
  return {
    irrigation: { needed: isDry, volume: isDry ? "15,000L" : "None", schedule: "Next 24h" },
    nutrient: { needed: true, fertilizers: [{ type: "Balanced NPK", amount: "50kg" }], advice: "Standard supplement." }
  };
};

const getFallbackPlan = (data: any) => {
  const isDry = (data.moisture || 45) < 20;
  return [
    { priority: isDry ? "CRITICAL" : "HIGH", title: isDry ? "Emergency Rehydration" : "Soil Health Check", description: "Sensor readings indicate attention is needed.", icon: "fa-droplet" },
    { priority: "MEDIUM", title: "Nutrient Sync", description: "Verify NPK balance.", icon: "fa-flask" }
  ];
};
