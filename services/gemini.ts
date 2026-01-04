
import { GoogleGenAI, Type } from "@google/genai";
import { Field } from "../types";

/**
 * Validates if the central API key is available in the environment.
 */
export const isAiReady = async () => {
  return !!process.env.API_KEY && process.env.API_KEY !== "undefined";
};

/**
 * Internal helper to instantiate the GenAI client.
 */
const getAIClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === "undefined") {
    throw new Error("CENTRAL_API_KEY_NOT_FOUND");
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * Formats data from manual sensor uploads for the AI prompt.
 */
const formatDataForPrompt = (data: any) => {
  const safeVal = (val: any) => (val != null) ? Number(val).toFixed(2) : "N/A";

  return `
    FIELD DATA (MANUAL SENSOR UPLOADS):
    - Soil Moisture: ${safeVal(data.moisture)}${data.moisture != null ? '%' : ''}
    - Soil pH: ${safeVal(data.ph_level)}
    - Ambient Temperature: ${safeVal(data.temperature)}${data.temperature != null ? '°C' : ''}
    - Nitrogen (N): ${safeVal(data.npk_n)} ppm
    - Phosphorus (P): ${safeVal(data.npk_p)} ppm
    - Potassium (K): ${safeVal(data.npk_k)} ppm
    
    FIELD SPECIFICATIONS:
    Location: ${data.location || 'Bangladesh'}
    Soil Profile: ${data.soil_type || 'Loamy'}
  `;
};

export const getCropAnalysis = async (field: Field, latestData: any) => {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `
        Analyze this agricultural field and recommend the top 3 best-fitting crops.
        Field: ${field.field_name}, Location: ${field.location}, Soil Type: ${field.soil_type}.
        ${formatDataForPrompt({...latestData, location: field.location, soil_type: field.soil_type})}
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
    
    const text = response.text;
    return text ? JSON.parse(text) : [];
  } catch (error: any) {
    return [];
  }
};

export const getSoilHealthSummary = async (field: Field, latestData: any) => {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `
        Examine the soil health condition for ${field.field_name} in ${field.location}.
        ${formatDataForPrompt({...latestData, location: field.location, soil_type: field.soil_type})}
        
        Write exactly 3 sentences evaluating the current health condition.
      `
    });
    
    return response.text || "Health analysis complete.";
  } catch (error: any) {
    if (error.message === "CENTRAL_API_KEY_NOT_FOUND") {
      return `[SETUP REQUIRED] Step 1: Add "API_KEY" to Cloudflare Environment Variables. \nStep 2: Change Build Command to "API_KEY=$API_KEY npm run build". \nStep 3: Redeploy the project.`;
    }
    return "The AI engine is waiting for sensor data sync. Please ensure you have updated values in the Sensors tab.";
  }
};

export const getDetailedManagementPlan = async (field: Field, latestData: any) => {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `
        Suggest 4 prioritized steps for health improvement for ${field.field_name}.
        ${formatDataForPrompt({...latestData, location: field.location, soil_type: field.soil_type})}
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
    
    const text = response.text;
    return text ? JSON.parse(text) : [];
  } catch (error: any) {
    return [];
  }
};
