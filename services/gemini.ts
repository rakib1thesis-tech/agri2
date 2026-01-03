
import { GoogleGenAI, Type } from "@google/genai";
import { Field, SensorData } from "../types";

export const checkAIConnection = () => {
  return !!process.env.API_KEY;
};

const getAIClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY_MISSING");
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * Format sensor values for the AI prompt, clearly marking missing data.
 */
const formatDataForPrompt = (data: any) => {
  return `
    - Temperature: ${data.temperature !== null ? `${data.temperature.toFixed(1)}°C` : 'NOT PROVIDED'}
    - Moisture: ${data.moisture !== null ? `${data.moisture.toFixed(1)}%` : 'NOT PROVIDED'}
    - pH Level: ${data.ph_level !== null ? `${data.ph_level.toFixed(1)}` : 'NOT PROVIDED'}
    - NPK Profile: ${data.npk_n !== null ? `N=${data.npk_n}, P=${data.npk_p}, K=${data.npk_k}` : 'NOT PROVIDED (Nutrient data missing)'}
  `;
};

export const getCropAnalysis = async (field: Field, latestData: any) => {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `
        Analyze this agricultural field data and provide the top 3 recommended crops.
        Field: ${field.field_name}, Location: ${field.location}, Soil: ${field.soil_type}.
        Available Soil Data: ${formatDataForPrompt(latestData)}
        
        CRITICAL INSTRUCTION: If certain data points (like NPK or pH) are marked as 'NOT PROVIDED', do not assume values. Base your recommendations ONLY on available data and state if missing data makes recommendations less certain.
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              suitability: { type: Type.NUMBER, description: "Percentage 0-100" },
              yield: { type: Type.STRING },
              requirements: { type: Type.STRING },
              icon: { type: Type.STRING }
            },
            required: ["name", "suitability", "yield", "requirements", "icon"]
          }
        }
      }
    });
    
    return JSON.parse(response.text || '[]');
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return [];
  }
};

export const getSoilHealthSummary = async (field: Field, latestData: any) => {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `
        Act as an expert agricultural scientist. Provide a concise 3-sentence "Soil Health Summary".
        Field: ${field.field_name}, Location: ${field.location}, Soil: ${field.soil_type}.
        Current Data: ${formatDataForPrompt(latestData)}
        
        IMPORTANT: Only mention parameters provided in the data. If NPK or pH is missing, explicitly state that these parameters need to be measured for a complete health assessment. No markdown.
      `
    });
    
    return response.text || "Soil state undetermined due to missing data.";
  } catch (error) {
    console.error("Gemini Summary Error:", error);
    return "Unable to generate summary at this time.";
  }
};

export const getDetailedManagementPlan = async (field: Field, latestData: any) => {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `
        Generate exactly 4 prioritized farm management tasks.
        Data: ${formatDataForPrompt(latestData)}
        
        INSTRUCTION: If data is missing (e.g., NPK not provided), one of your High priority tasks MUST be 'Measure Soil Nutrients'. Do not make up fertilizer recommendations if nutrient data is missing.
      `,
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
    
    return JSON.parse(response.text || '[]');
  } catch (error) {
    console.error("Gemini Plan Error:", error);
    return [];
  }
};

export const startAIConversation = (systemInstruction: string) => {
  try {
    const ai = getAIClient();
    return ai.chats.create({
      model: 'gemini-3-flash-preview',
      config: { systemInstruction, temperature: 0.7 },
    });
  } catch (e: any) {
    return null;
  }
};
