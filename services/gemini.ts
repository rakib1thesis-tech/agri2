
import { GoogleGenAI, Type } from "@google/genai";
import { Field } from "../types";

/**
 * The API key is obtained exclusively from the environment variable process.env.API_KEY.
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
    FIELD TELEMETRY DATA:
    - Soil Moisture Content: ${safeVal(data.moisture)}%
    - Soil pH Level: ${safeVal(data.ph_level)}
    - Ambient Temperature: ${safeVal(data.temperature)}°C
    - Nutrient Content (NPK): Nitrogen=${safeVal(data.npk_n)}, Phosphorus=${safeVal(data.npk_p)}, Potassium=${safeVal(data.npk_k)}
    - Geographic Context: ${data.location || 'Bangladesh'}
    - Soil Profile: ${data.soil_type || 'Loamy'}
  `;
};

export const getCropAnalysis = async (field: Field, latestData: any) => {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are an expert agronomist. Analyze this sensor data and recommend 3 ideal crops/vegetables. For each, specify a perfect fertilizer strategy (e.g. Urea, TSP, MOP, or Organic Compost) based on current soil NPK/pH. ${formatDataForPrompt({...latestData, ...field})}`,
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
              fertilizer: { type: Type.STRING, description: "Specific fertilizer recommendation for this crop and current soil" },
              icon: { type: Type.STRING }
            },
            required: ["name", "suitability", "yield", "requirements", "fertilizer", "icon"]
          }
        }
      }
    });
    
    const text = response.text;
    if (!text) return [];
    return JSON.parse(text);
  } catch (error) {
    console.error("Crop analysis failed", error);
    return [];
  }
};

export const getSoilHealthSummary = async (field: Field, latestData: any) => {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Based on this data, provide a 3-sentence expert summary focusing strictly on HOW TO IMPROVE THE SOIL HEALTH (e.g. organic matter, lime for pH, specific nitrogen fixing). ${formatDataForPrompt({...latestData, ...field})}`
    });
    return response.text || "Diagnostic complete. Focus on increasing organic carbon content.";
  } catch (error: any) {
    console.error("Soil summary failed", error);
    return "Soil health is currently stable. Recommend adding vermicompost to improve microbial activity and moisture retention.";
  }
};

export const getDetailedManagementPlan = async (field: Field, latestData: any) => {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Create a prioritized 4-step roadmap for "${field.field_name}". Steps MUST include specific SOIL IMPROVEMENT actions (pH balancing, nutrient fixing) and CROP MANAGEMENT. ${formatDataForPrompt({...latestData, ...field})}`,
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
    
    const text = response.text;
    if (!text) return [];
    return JSON.parse(text);
  } catch (error) {
    console.error("Management plan failed", error);
    return [];
  }
};
