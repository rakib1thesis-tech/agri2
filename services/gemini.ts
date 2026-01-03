
import { GoogleGenAI, Type } from "@google/genai";
import { Field, SensorData } from "../types";

export const checkAIConnection = () => {
  return true;
};

const getAIClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY_MISSING");
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * Format sensor values for the AI prompt.
 * Clearly identifies what we HAVE and what we are MISSING.
 */
const formatDataForPrompt = (data: any) => {
  const safeVal = (val: any) => (val != null) ? Number(val).toFixed(1) : null;

  const m = safeVal(data.moisture);
  const t = safeVal(data.temperature);
  const ph = safeVal(data.ph_level);
  const n = safeVal(data.npk_n);
  const p = safeVal(data.npk_p);
  const k = safeVal(data.npk_k);

  return `
    CURRENT SENSOR READINGS:
    - Soil Moisture: ${m != null ? `${m}%` : 'Not Measured'}
    - Soil pH: ${ph != null ? ph : 'Not Measured'}
    - Temperature: ${t != null ? `${t}°C` : 'Not Measured'}
    - Nitrogen (N): ${n != null ? `${n} ppm` : 'Not Measured'}
    - Phosphorus (P): ${p != null ? `${p} ppm` : 'Not Measured'}
    - Potassium (K): ${k != null ? `${k} ppm` : 'Not Measured'}
    
    NOTE: If a value is "Not Measured", use your expert knowledge of the region (${data.location || 'Bangladesh'}) and soil type (${data.soil_type || 'Loamy'}) to provide the best possible advice.
  `;
};

export const getCropAnalysis = async (field: Field, latestData: any) => {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `
        Analyze this field for crop suitability. 
        Field: ${field.field_name}, Location: ${field.location}, Soil: ${field.soil_type}.
        ${formatDataForPrompt({...latestData, location: field.location, soil_type: field.soil_type})}
        
        GOAL: Provide the top 3 recommended crops based ON THE PROVIDED DATA. 
        If some data is missing (like NPK), recommend crops that generally thrive in ${field.soil_type} soil in the ${field.location} region, adjusted for the available measurements.
      `,
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
        As an agricultural expert, summarize the soil health for ${field.field_name}.
        Location: ${field.location}, Soil: ${field.soil_type}.
        ${formatDataForPrompt({...latestData, location: field.location, soil_type: field.soil_type})}
        
        Provide a 3-sentence summary based on available markers. No markdown.
      `
    });
    
    return response.text || "Analysis complete based on available telemetry.";
  } catch (error) {
    console.error("Gemini Summary Error:", error);
    return "AI analysis is currently unavailable.";
  }
};

export const getDetailedManagementPlan = async (field: Field, latestData: any) => {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `
        Generate exactly 4 prioritized farm management tasks.
        Field: ${field.field_name}, Location: ${field.location}, Soil: ${field.soil_type}.
        ${formatDataForPrompt({...latestData, location: field.location, soil_type: field.soil_type})}
        
        Prioritize tasks based on current Moisture and pH readings. If NPK is missing, suggest a soil test.
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
