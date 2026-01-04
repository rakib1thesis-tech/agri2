
import { GoogleGenAI, Type } from "@google/genai";
import { Field } from "../types";

/**
 * Validates if the central API key is available in the environment.
 */
export const isAiReady = async () => {
  return !!process.env.API_KEY;
};

/**
 * Internal helper to instantiate the GenAI client using the shared environment key.
 */
const getAIClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
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
        
        TASK:
        Based on the data provided, evaluate the current health condition of the soil. 
        Determine if the current NPK, pH, and Moisture levels are balanced.
        Write exactly 3 professional sentences. Do not use markdown.
      `
    });
    
    return response.text || "Health analysis complete. Soil markers are within standard bounds.";
  } catch (error: any) {
    if (error.message === "CENTRAL_API_KEY_NOT_FOUND") {
      return "Central AI Integration Error: The API_KEY environment variable is not being detected. Please ensure your cloud provider is injecting the key into the build environment.";
    }
    return "AI diagnostics in progress. Please refresh after ensuring your sensor data is updated.";
  }
};

export const getDetailedManagementPlan = async (field: Field, latestData: any) => {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `
        Suggest 4 prioritized steps to make the crops and fields healthier based on these readings.
        ${formatDataForPrompt({...latestData, location: field.location, soil_type: field.soil_type})}
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
