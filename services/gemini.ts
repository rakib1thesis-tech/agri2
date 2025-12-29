
import { GoogleGenAI, Type } from "@google/genai";
import { Field, SensorData } from "../types";

export const getCropAnalysis = async (field: Field, latestData: SensorData) => {
  // Always use a new instance with the exact property name as per SDK guidelines
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `
        Analyze this agricultural field data and provide the top 3 recommended crops.
        Field: ${field.field_name}, Location: ${field.location}, Soil: ${field.soil_type}.
        Latest Soil Data: 
        - Temperature: ${latestData.temperature}°C
        - Moisture: ${latestData.moisture}%
        - pH Level: ${latestData.ph_level}
        - NPK Profile: Nitrogen ${latestData.npk_n}, Phosphorus ${latestData.npk_p}, Potassium ${latestData.npk_k}
        
        Focus only on these four markers (Temp, Moisture, pH, NPK) to determine growth suitability.
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
    
    return JSON.parse(response.text || '[]');
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return [];
  }
};

export const getSoilHealthSummary = async (field: Field, latestData: SensorData) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `
        Act as an expert agricultural scientist. Provide a 3-4 sentence "Soil Health Summary" for this field in Bangladesh.
        Field: ${field.field_name}, Location: ${field.location}, Soil: ${field.soil_type}.
        Latest Markers:
        - Temperature: ${latestData.temperature.toFixed(1)}°C
        - Moisture: ${latestData.moisture.toFixed(1)}%
        - pH: ${latestData.ph_level.toFixed(1)}
        - NPK: N=${latestData.npk_n}, P=${latestData.npk_p}, K=${latestData.npk_k}
        
        Rules:
        1. Only discuss these 4 markers.
        2. Be specific about the current status (e.g. "Moisture is high", "pH is slightly acidic").
        3. Suggest ONE immediate action for the farmer.
        4. Do not use Markdown headings.
      `
    });
    
    return response.text || "Analysis complete. Soil conditions are being monitored.";
  } catch (error) {
    console.error("Gemini Summary Error:", error);
    return "Unable to generate AI soil insight at this moment.";
  }
};

export const getDetailedManagementPlan = async (field: Field, latestData: SensorData) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `
        Create a detailed farm management plan based on these soil conditions in Bangladesh:
        Field: ${field.field_name}, Location: ${field.location}
        Soil: ${field.soil_type}
        Temp: ${latestData.temperature}°C, Moisture: ${latestData.moisture}%, pH: ${latestData.ph_level}
        NPK: N=${latestData.npk_n}, P=${latestData.npk_p}, K=${latestData.npk_k}
        
        Generate exactly 4 prioritized tasks.
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
    
    return JSON.parse(response.text || '[]');
  } catch (error) {
    console.error("Gemini Plan Error:", error);
    return [];
  }
};
