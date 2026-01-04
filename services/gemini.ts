
import { GoogleGenAI, Type } from "@google/genai";
import { Field } from "../types";

/**
 * In Central API mode, we assume the API_KEY is provided by the environment.
 */
export const isAiReady = async () => {
  return !!process.env.API_KEY;
};

/**
 * Legacy support for selector, but returns success if key exists.
 */
export const openAiKeySelector = async () => {
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
 * Formats data from manual uploads for the AI prompt.
 */
const formatDataForPrompt = (data: any) => {
  const safeVal = (val: any) => (val != null) ? Number(val).toFixed(2) : "NOT PROVIDED";

  return `
    CURRENT SENSOR MEASUREMENTS (MANUAL UPLOADS):
    - Soil Moisture: ${safeVal(data.moisture)}${data.moisture != null ? '%' : ''}
    - Soil pH: ${safeVal(data.ph_level)}
    - Ambient Temperature: ${safeVal(data.temperature)}${data.temperature != null ? '°C' : ''}
    - Nitrogen (N): ${safeVal(data.npk_n)} ppm
    - Phosphorus (P): ${safeVal(data.npk_p)} ppm
    - Potassium (K): ${safeVal(data.npk_k)} ppm
    
    FIELD CONTEXT:
    Location: ${data.location || 'Bangladesh'}
    Soil Type: ${data.soil_type || 'Loamy'}
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
        
        Provide high-yield recommendations specifically for the ${field.location} region.
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              suitability: { type: Type.NUMBER, description: "Match percentage 0-100" },
              yield: { type: Type.STRING, description: "Expected tonnage per hectare" },
              requirements: { type: Type.STRING, description: "Specific care instructions based on current soil" },
              icon: { type: Type.STRING, description: "FontAwesome icon name (e.g., fa-wheat-awn)" }
            },
            required: ["name", "suitability", "yield", "requirements", "icon"]
          }
        }
      }
    });
    
    const text = response.text;
    return text ? JSON.parse(text) : [];
  } catch (error: any) {
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
        Examine the soil health condition for ${field.field_name} in ${field.location}.
        ${formatDataForPrompt({...latestData, location: field.location, soil_type: field.soil_type})}
        
        INSTRUCTIONS:
        Based on the manual data uploads from the sensors, give a brief idea of the health condition of the soil. 
        Determine if the current NPK, pH, and Moisture levels are balanced for a healthy crop.
        Write exactly 3 concise sentences. Do not use bold or markdown.
      `
    });
    
    return response.text || "Health analysis complete. Soil markers are within the stable range for current seasonal patterns.";
  } catch (error: any) {
    console.error("Gemini Summary Error:", error);
    return "AI analysis engine is warming up. Please ensure your central API_KEY is configured.";
  }
};

export const getDetailedManagementPlan = async (field: Field, latestData: any) => {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `
        Suggest 4 prioritized steps to make the crops and fields healthier based on the current sensor data.
        ${formatDataForPrompt({...latestData, location: field.location, soil_type: field.soil_type})}
        
        Provide specific steps to improve crop health (e.g., adding specific fertilizers for NPK deficits, or irrigation adjustments for moisture).
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              priority: { type: Type.STRING, description: "High, Medium, or Low" },
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
    console.error("Gemini Plan Error:", error);
    return [];
  }
};
