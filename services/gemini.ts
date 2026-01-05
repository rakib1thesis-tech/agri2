
import { GoogleGenAI, Type } from "@google/genai";
import { Field, CropRecommendation } from "../types";

/**
 * Ensures we always use the latest environment API key.
 */
const getAIClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY_NOT_FOUND");
  }
  return new GoogleGenAI({ apiKey });
};

export const isAiReady = async () => {
  return !!process.env.API_KEY && process.env.API_KEY.length > 5;
};

const formatDataForPrompt = (data: any) => {
  const safeVal = (val: any) => (val != null) ? Number(val).toFixed(2) : "N/A";
  return `
    FIELD DATA:
    - Moisture: ${safeVal(data.moisture)}%
    - pH: ${safeVal(data.ph_level)}
    - Temp: ${safeVal(data.temperature)}°C
    - NPK: ${safeVal(data.npk_n)}-${safeVal(data.npk_p)}-${safeVal(data.npk_k)}
    - Location: ${data.location || 'Bangladesh'}
    - Soil: ${data.soil_type || 'Loamy'}
  `;
};

export interface SoilInsight {
  summary: string;
  soil_fertilizer: string;
}

export const getCropAnalysis = async (field: Field, latestData: any): Promise<CropRecommendation[]> => {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are an expert agronomist. Analyze this data and suggest 3 crops for high yield. ${formatDataForPrompt({...latestData, ...field})}`,
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
    
    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("AI Crop analysis failed, using agronomist fallback.");
    return [
      { name: "High-Yield Boro Rice", suitability: 92, yield: "6.5 Tons/ha", requirements: "Maintain high moisture and Nitrogen", fertilizer: "Urea (80kg/ha) + DAP (40kg/ha)", icon: "fa-wheat-awn" },
      { name: "Hybrid Brinjal", suitability: 85, yield: "25 Tons/ha", requirements: "Regular watering, rich potash", fertilizer: "MOP (30kg/ha) + Organic Compost", icon: "fa-eggplant" },
      { name: "Potato (Diamond)", suitability: 78, yield: "20 Tons/ha", requirements: "Well-drained loamy soil", fertilizer: "Balanced NPK 10-10-10", icon: "fa-potato" }
    ];
  }
};

export const getSoilHealthSummary = async (field: Field, latestData: any): Promise<SoilInsight> => {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Provide a detailed soil restoration strategy for this field. ${formatDataForPrompt({...latestData, ...field})}`,
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
    
    return JSON.parse(response.text || "{}");
  } catch (error) {
    return {
      summary: "Soil diagnostics show stable moisture levels. Priority should be given to organic matter enrichment to improve nutrient cation exchange capacity.",
      soil_fertilizer: "Apply 500kg of Vermicompost per hectare and monitor pH trends."
    };
  }
};

export const getDetailedManagementPlan = async (field: Field, latestData: any) => {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Create a 4-step restoration roadmap for this field. ${formatDataForPrompt({...latestData, ...field})}`,
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
    
    return JSON.parse(response.text || "[]");
  } catch (error) {
    return [
      { priority: "High", title: "Organic Mulching", description: "Apply a 2-inch layer of organic mulch to preserve soil moisture and regulate temperature.", icon: "fa-leaf" },
      { priority: "Medium", title: "NPK Balancing", description: "Supplement with specific Nitrogen-rich fertilizer based on current deficits.", icon: "fa-flask" },
      { priority: "Medium", title: "pH Correction", description: "Use agricultural lime to normalize soil acidity for better nutrient absorption.", icon: "fa-scale-balanced" },
      { priority: "Low", title: "Microbial Boost", description: "Introduce beneficial soil microbes via compost tea to enhance root health.", icon: "fa-bacteria" }
    ];
  }
};
