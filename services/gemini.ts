
import { GoogleGenAI, Type } from "@google/genai";
import { Field } from "../types";

/**
 * Safely retrieves the API key from the environment.
 * In a production build, the build tool replaces 'process.env.VITE_API_KEY' 
 * with the actual string value of your key.
 */
const getSafeApiKey = () => {
  try {
    // 1. Check for standard Vite/React-Scripts build injection
    if (typeof process !== 'undefined' && process.env) {
      if (process.env.VITE_API_KEY) return process.env.VITE_API_KEY;
      if (process.env.API_KEY) return process.env.API_KEY;
    }
    
    // 2. Fallback for environments where process.env is mapped to window
    const win = window as any;
    if (win.VITE_API_KEY) return win.VITE_API_KEY;
    if (win.API_KEY) return win.API_KEY;

    // 3. Last resort: check if the build tool performed a direct string replacement
    // Note: Some build tools replace "process.env.VAR" with the literal string.
    const injectedKey = "process.env.VITE_API_KEY";
    if (injectedKey !== "process.env.VITE_API_KEY" && injectedKey !== "") {
      return injectedKey;
    }

    return null;
  } catch (e) {
    return null;
  }
};

export const isAiReady = async () => {
  const key = getSafeApiKey();
  return !!key && key !== "undefined" && key !== "null";
};

const getAIClient = () => {
  const apiKey = getSafeApiKey();
  if (!apiKey || apiKey === "undefined") {
    throw new Error("API_KEY_NOT_FOUND");
  }
  return new GoogleGenAI({ apiKey });
};

const formatDataForPrompt = (data: any) => {
  const safeVal = (val: any) => (val != null) ? Number(val).toFixed(2) : "N/A";
  return `
    FIELD DATA:
    - Moisture: ${safeVal(data.moisture)}%
    - pH: ${safeVal(data.ph_level)}
    - Temp: ${safeVal(data.temperature)}°C
    - NPK: ${safeVal(data.npk_n)}-${safeVal(data.npk_p)}-${safeVal(data.npk_k)}
    Location: ${data.location || 'Bangladesh'}
    Soil: ${data.soil_type || 'Loamy'}
  `;
};

export const getCropAnalysis = async (field: Field, latestData: any) => {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Recommend 3 crops for ${field.field_name}. ${formatDataForPrompt({...latestData, ...field})}`,
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
              icon: { type: Type.STRING }
            },
            required: ["name", "suitability", "yield", "requirements", "icon"]
          }
        }
      }
    });
    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("AI Crop Analysis failed:", error);
    return [];
  }
};

export const getSoilHealthSummary = async (field: Field, latestData: any) => {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Evaluate soil health for ${field.field_name}. ${formatDataForPrompt({...latestData, ...field})}. Write 3 sentences.`
    });
    return response.text || "Analysis complete.";
  } catch (error: any) {
    if (error.message === "API_KEY_NOT_FOUND") {
      return "AI OFFLINE: Key not detected in build. Ensure Cloudflare Settings > Variables contains VITE_API_KEY and Build Command uses VITE_API_KEY=$VITE_API_KEY.";
    }
    return "Analysis engine is warming up. Please refresh in a moment.";
  }
};

export const getDetailedManagementPlan = async (field: Field, latestData: any) => {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Provide 4 improvement steps for ${field.field_name}. ${formatDataForPrompt({...latestData, ...field})}`,
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
    console.error("AI Management Plan failed:", error);
    return [];
  }
};
