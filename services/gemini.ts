
import { GoogleGenAI, Type } from "@google/genai";
import { Field } from "../types";

/**
 * Robust JSON extraction helper.
 * Strips Markdown code blocks and whitespace often returned by Gemini.
 */
const extractJson = (text: string) => {
  try {
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanText);
  } catch (e) {
    console.error("Failed to parse AI JSON response:", text);
    return null;
  }
};

/**
 * The API key is obtained from process.env.API_KEY.
 */
const getAIClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === "undefined") {
    throw new Error("API_KEY_NOT_FOUND");
  }
  return new GoogleGenAI({ apiKey });
};

export const isAiReady = async () => {
  const key = process.env.API_KEY;
  return !!key && key !== "undefined" && key.length > 10;
};

const formatDataForPrompt = (data: any) => {
  const safeVal = (val: any) => (val != null) ? Number(val).toFixed(2) : "N/A";
  return `
    FIELD TELEMETRY:
    - Soil Moisture: ${safeVal(data.moisture)}%
    - pH Balance: ${safeVal(data.ph_level)}
    - Ambient Temp: ${safeVal(data.temperature)}°C
    - NPK Profile: N:${safeVal(data.npk_n)} P:${safeVal(data.npk_p)} K:${safeVal(data.npk_k)}
    Location: ${data.location || 'Bangladesh'}
    Soil Type: ${data.soil_type || 'Loamy'}
  `;
};

export const getCropAnalysis = async (field: Field, latestData: any) => {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Based on this real-time data, recommend 3 specific crops. Return ONLY a JSON array. ${formatDataForPrompt({...latestData, ...field})}`,
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
    return extractJson(response.text || "[]") || [];
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
      contents: `Evaluate soil health in 3 concise sentences for ${field.field_name}. Use this data: ${formatDataForPrompt({...latestData, ...field})}`
    });
    return response.text || "Analysis complete.";
  } catch (error: any) {
    if (error.message === "API_KEY_NOT_FOUND") {
      return "AI Connection Error: API_KEY is missing from environment. Ensure you have added it to Cloudflare Variables and updated your build command.";
    }
    return "The AI node is currently busy. Please refresh the diagnostic link in a few seconds.";
  }
};

export const getDetailedManagementPlan = async (field: Field, latestData: any) => {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Provide 4 prioritized management tasks based on this sensor data. Return ONLY JSON. ${formatDataForPrompt({...latestData, ...field})}`,
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
    return extractJson(response.text || "[]") || [];
  } catch (error) {
    return [];
  }
};
