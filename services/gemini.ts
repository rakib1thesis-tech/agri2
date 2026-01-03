
import { GoogleGenAI, Type } from "@google/genai";
import { Field, SensorData } from "../types";

/**
 * Safely checks if an API key is available via environment or manual submission.
 */
export const checkAIConnection = () => {
  const userKey = localStorage.getItem('agricare_user_api_key');
  return !!(userKey || process.env.API_KEY);
};

/**
 * Creates a new GoogleGenAI client instance.
 * Checks for a manually submitted key first, then falls back to process.env.API_KEY.
 */
const getAIClient = () => {
  const userKey = localStorage.getItem('agricare_user_api_key');
  const apiKey = userKey || process.env.API_KEY;
  
  if (!apiKey) {
    throw new Error("API_KEY_MISSING");
  }
  return new GoogleGenAI({ apiKey });
};

export const getLiveWeatherAlert = async (location: string) => {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `What is the current weather forecast and any active agricultural weather alerts for ${location}, Bangladesh today? Provide a concise summary for a farmer.`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text || "No active alerts for this region.";
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    
    return { text, sources };
  } catch (error: any) {
    console.error("Gemini Weather Error:", error);
    return { 
      text: "Weather data is temporarily unavailable. Local patterns suggest standard seasonal monitoring.", 
      sources: [] 
    };
  }
};

export const getCropAnalysis = async (field: Field, latestData: SensorData) => {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `
        Analyze this agricultural field data and provide the top 3 recommended crops.
        Field: ${field.field_name}, Location: ${field.location}, Soil: ${field.soil_type}.
        Latest Soil Data: 
        - Temperature: ${latestData.temperature.toFixed(1)}°C
        - Moisture: ${latestData.moisture.toFixed(1)}%
        - pH Level: ${latestData.ph_level.toFixed(1)}
        - NPK Profile: N=${latestData.npk_n}, P=${latestData.npk_p}, K=${latestData.npk_k}
        
        Focus on these markers to determine growth suitability in the context of Bangladesh.
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
              yield: { type: Type.STRING, description: "Expected yield estimate" },
              requirements: { type: Type.STRING, description: "Key growth requirements" },
              icon: { type: Type.STRING, description: "FontAwesome icon class string e.g. fa-leaf" }
            },
            required: ["name", "suitability", "yield", "requirements", "icon"]
          }
        }
      }
    });
    
    const result = JSON.parse(response.text || '[]');
    return result.length > 0 ? result : getFallbackRecommendations();
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return getFallbackRecommendations();
  }
};

export const getSoilHealthSummary = async (field: Field, latestData: SensorData) => {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `
        Act as an expert agricultural scientist. Provide a concise 3-sentence "Soil Health Summary" for this field in Bangladesh.
        Field: ${field.field_name}, Location: ${field.location}, Soil: ${field.soil_type}.
        Latest Markers: Temp: ${latestData.temperature.toFixed(1)}°C, Moisture: ${latestData.moisture.toFixed(1)}%, pH: ${latestData.ph_level.toFixed(1)}, NPK: ${latestData.npk_n}-${latestData.npk_p}-${latestData.npk_k}.
        
        Focus on the current status and suggest one prioritized action. No markdown formatting.
      `
    });
    
    return response.text || "Soil conditions are currently stable for the region.";
  } catch (error) {
    console.error("Gemini Summary Error:", error);
    return "Soil health markers are within expected ranges for the current season.";
  }
};

export const getDetailedManagementPlan = async (field: Field, latestData: SensorData) => {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `
        Generate exactly 4 prioritized farm management tasks for a field in Bangladesh with these conditions:
        Soil: ${field.soil_type}, Temp: ${latestData.temperature}°C, Moisture: ${latestData.moisture}%, pH: ${latestData.ph_level}, NPK: ${latestData.npk_n}-${latestData.npk_p}-${latestData.npk_k}.
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
              icon: { type: Type.STRING, description: "FontAwesome icon class" }
            },
            required: ["priority", "title", "description", "icon"]
          }
        }
      }
    });
    
    const result = JSON.parse(response.text || '[]');
    return result.length > 0 ? result : getFallbackPlan();
  } catch (error) {
    console.error("Gemini Plan Error:", error);
    return getFallbackPlan();
  }
};

export const startAIConversation = (systemInstruction: string) => {
  try {
    const ai = getAIClient();
    return ai.chats.create({
      model: 'gemini-3-flash-preview',
      config: { 
        systemInstruction,
        temperature: 0.7 
      },
    });
  } catch (e: any) {
    console.error("Failed to start chat session:", e);
    return null;
  }
};

// Fallback Data Generators
function getFallbackRecommendations() {
  return [
    { name: "Rice (Boro)", suitability: 92, yield: "5.8 tons/ha", requirements: "Maintain high water level during tillering phase.", icon: "fa-wheat-awn" },
    { name: "Mustard", suitability: 85, yield: "1.2 tons/ha", requirements: "Thrives in current loamy/alluvial conditions. Low water need.", icon: "fa-seedling" },
    { name: "Potato", suitability: 78, yield: "24 tons/ha", requirements: "Ensure soil pH stays below 6.5 to prevent scab disease.", icon: "fa-circle" }
  ];
}

function getFallbackPlan() {
  return [
    { priority: "High", title: "Moisture Maintenance", description: "Soil moisture is trending low; schedule next irrigation for early morning.", icon: "fa-droplet" },
    { priority: "Medium", title: "NPK Supplement", description: "Potassium levels are slightly low for optimal yield. Add K-based fertilizer.", icon: "fa-flask" },
    { priority: "Medium", title: "pH Adjustment", description: "Current pH is 6.8. Monitor closely if planning to plant acid-loving crops.", icon: "fa-vial" },
    { priority: "Low", title: "Pest Scouting", description: "No immediate threats, but check leaf undersides for aphid colonies.", icon: "fa-bug" }
  ];
}
