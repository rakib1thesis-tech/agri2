
import React, { useState, useEffect, useRef } from 'react';
import { User, Field, SensorData, CropRecommendation, Sensor } from '../../types';
import { generateMockSensorData } from '../../constants';
import { getCropAnalysis, getSoilHealthSummary, getDetailedManagementPlan, startAIConversation, checkAIConnection } from '../../services/gemini';
import { GenerateContentResponse } from "@google/genai";

interface ManagementTask {
  priority: string;
  title: string;
  description: string;
  icon: string;
}

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

const UserFields: React.FC<{ user: User }> = ({ user }) => {
  const [fields, setFields] = useState<Field[]>([]);
  const [selectedField, setSelectedField] = useState<Field | null>(null);
  const [recommendations, setRecommendations] = useState<CropRecommendation[] | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [managementPlan, setManagementPlan] = useState<ManagementTask[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiConnected, setAiConnected] = useState(true);
  
  const [showAddFieldModal, setShowAddFieldModal] = useState(false);
  const [newFieldData, setNewFieldData] = useState({
    name: '',
    location: '',
    size: '',
    soilType: 'Loamy'
  });

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState("");
  const [isBotThinking, setIsBotThinking] = useState(false);
  const [showManualConsole, setShowManualConsole] = useState(false);
  const [manualKey, setManualKey] = useState("");
  
  const chatRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const verifyAI = async () => {
      const aistudio = (window as any).aistudio;
      let hasKey = false;
      if (aistudio) {
        hasKey = await aistudio.hasSelectedApiKey();
      }
      setAiConnected(hasKey || checkAIConnection());
    };
    verifyAI();

    const saved = localStorage.getItem('agricare_fields');
    if (saved) {
      const allFields: Field[] = JSON.parse(saved);
      const userFields = allFields.filter(f => f.user_id === user.id);
      setFields(userFields);
    }
  }, [user.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory, isBotThinking]);

  // Helper to aggregate the best possible data for a field
  const getFieldCurrentStats = (field: Field): SensorData => {
    const savedSensors = localStorage.getItem('agricare_sensors');
    const sensors: Sensor[] = savedSensors ? JSON.parse(savedSensors) : [];
    const fieldSensors = sensors.filter(s => s.field_id === field.field_id);
    
    const savedManual = localStorage.getItem('agricare_manual_diagnostics');
    const manualDiags = savedManual ? JSON.parse(savedManual) : {};
    const fieldManual = manualDiags[field.field_id];

    // Default/Fallback values (Mock 7th day)
    const mock = generateMockSensorData(field.field_id)[6];
    
    const stats: SensorData = { ...mock };

    if (fieldSensors.length > 0) {
      // Use assigned sensor readings where available
      fieldSensors.forEach(s => {
        if (!s.last_reading) return;
        if (s.sensor_type === 'Moisture') stats.moisture = s.last_reading.value || stats.moisture;
        if (s.sensor_type === 'Temperature') stats.temperature = s.last_reading.value || stats.temperature;
        if (s.sensor_type === 'PH Probe') stats.ph_level = s.last_reading.value || stats.ph_level;
        if (s.sensor_type === 'NPK Analyzer') {
          stats.npk_n = s.last_reading.n ?? stats.npk_n;
          stats.npk_p = s.last_reading.p ?? stats.npk_p;
          stats.npk_k = s.last_reading.k ?? stats.npk_k;
        }
      });
    } else if (fieldManual) {
      // If no sensors, use the manual diagnostics from Sensors page
      stats.moisture = fieldManual.moisture ?? stats.moisture;
      stats.temperature = fieldManual.temp ?? stats.temperature;
      stats.ph_level = fieldManual.ph ?? stats.ph_level;
      stats.npk_n = fieldManual.n ?? stats.npk_n;
      stats.npk_p = fieldManual.p ?? stats.npk_p;
      stats.npk_k = fieldManual.k ?? stats.npk_k;
    }

    return stats;
  };

  const initChat = (field: Field) => {
    const latest = getFieldCurrentStats(field);
    chatRef.current = startAIConversation(
      `You are the Agricare AI Advisor. Assist this farmer in ${field.location} with their ${field.field_name} (${field.soil_type} soil).
       Current Sensor Data: Temp ${latest.temperature.toFixed(1)}°C, Moisture ${latest.moisture.toFixed(1)}%, pH ${latest.ph_level.toFixed(1)}, NPK ${latest.npk_n}-${latest.npk_p}-${latest.npk_k}.
       Provide expert, localized agricultural advice for Bangladesh.`
    );
  };

  const handleFieldSelect = async (field: Field) => {
    setSelectedField(field);
    setLoading(true);
    setRecommendations(null);
    setAiSummary(null);
    setManagementPlan(null);
    setChatHistory([]);
    
    initChat(field);
    
    const latest = getFieldCurrentStats(field);
    
    try {
      const [analysis, summary, plan] = await Promise.all([
        getCropAnalysis(field, latest),
        getSoilHealthSummary(field, latest),
        getDetailedManagementPlan(field, latest)
      ]);
      
      setRecommendations(analysis);
      setAiSummary(summary);
      setManagementPlan(plan);
    } catch (err) {
      console.error("Field analysis failed", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddField = (e: React.FormEvent) => {
    e.preventDefault();
    const newField: Field = {
      field_id: Math.floor(Math.random() * 100000),
      user_id: user.id,
      field_name: newFieldData.name,
      location: newFieldData.location,
      size: parseFloat(newFieldData.size) || 0,
      soil_type: newFieldData.soilType
    };
    const saved = localStorage.getItem('agricare_fields');
    const allFields: Field[] = saved ? JSON.parse(saved) : [];
    localStorage.setItem('agricare_fields', JSON.stringify([...allFields, newField]));
    setFields([...fields, newField]);
    setShowAddFieldModal(false);
    setNewFieldData({ name: '', location: '', size: '', soilType: 'Loamy' });
  };

  const handleManualKeySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualKey.trim()) return;
    localStorage.setItem('agricare_user_api_key', manualKey.trim());
    setAiConnected(true);
    setShowManualConsole(false);
    if (selectedField) {
      initChat(selectedField);
      handleFieldSelect(selectedField);
    }
  };

  const handleConnectAI = async () => {
    const aistudio = (window as any).aistudio;
    if (aistudio) {
      try {
        await aistudio.openSelectKey();
        const hasKey = await aistudio.hasSelectedApiKey();
        if (hasKey) {
          setAiConnected(true);
          if (selectedField) {
            initChat(selectedField);
            handleFieldSelect(selectedField);
          }
        } else {
          setShowManualConsole(true);
        }
      } catch (e) {
        setShowManualConsole(true);
      }
    } else {
      setShowManualConsole(true);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || isBotThinking) return;
    if (!chatRef.current && selectedField) {
      initChat(selectedField);
    }
    const userMsg = userInput;
    setUserInput("");
    setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
    if (!chatRef.current) {
      setChatHistory(prev => [...prev, { role: 'model', text: "Connection error. Recheck API key." }]);
      return;
    }
    setIsBotThinking(true);
    try {
      const response: GenerateContentResponse = await chatRef.current.sendMessage({ message: userMsg });
      setChatHistory(prev => [...prev, { role: 'model', text: response.text || "No response." }]);
    } catch (error) {
      setChatHistory(prev => [...prev, { role: 'model', text: "API Error." }]);
    } finally {
      setIsBotThinking(false);
    }
  };

  const handleExportCSV = () => {
    if (!selectedField) return;
    const historicalData = generateMockSensorData(selectedField.field_id);
    const headers = ['Timestamp', 'Temp (°C)', 'Moisture (%)', 'pH', 'N', 'P', 'K'];
    const rows = historicalData.map(row => [
      row.timestamp, row.temperature.toFixed(2), row.moisture.toFixed(2), row.ph_level.toFixed(2), row.npk_n, row.npk_p, row.npk_k
    ]);
    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `agricare_${selectedField.field_name}.csv`);
    link.click();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative min-h-[80vh]">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Field Command Center</h1>
          <p className="text-slate-500 text-sm">Real-time IoT and Manual Diagnostics Hub</p>
        </div>
        <div className="flex gap-4">
          {selectedField && (
            <button onClick={handleExportCSV} className="bg-white text-emerald-600 border border-emerald-100 px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-emerald-50 shadow-sm">
              <i className="fas fa-file-csv"></i> Export Data
            </button>
          )}
          <button onClick={() => setShowAddFieldModal(true)} className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-emerald-700 shadow-md">
            <i className="fas fa-plus"></i> Add New Field
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-4">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex justify-between items-center">
            <span>Your Fields</span>
            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{fields.length}</span>
          </div>
          <div className="max-h-[70vh] overflow-y-auto space-y-4 pr-1">
            {fields.map(f => (
              <button key={f.field_id} onClick={() => handleFieldSelect(f)} className={`w-full text-left p-6 rounded-2xl border transition-all ${selectedField?.field_id === f.field_id ? 'border-emerald-500 bg-emerald-50 shadow-md ring-1 ring-emerald-500' : 'border-slate-100 bg-white shadow-sm hover:border-emerald-300'}`}>
                <div className="font-bold text-slate-900 truncate">{f.field_name}</div>
                <div className="text-sm text-slate-500 mt-1 truncate">{f.location}</div>
                <div className="mt-4 flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded text-slate-600">{f.soil_type}</span>
                  <span className="text-[10px] font-bold text-slate-400">{f.size} ha</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-3">
          {!selectedField ? (
            <div className="bg-white rounded-[3rem] border border-dashed border-slate-300 p-24 text-center">
              <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <i className="fas fa-satellite text-3xl"></i>
              </div>
              <h2 className="text-2xl font-bold text-slate-800">Field Diagnostics Ready</h2>
              <p className="text-slate-500 mt-2 max-w-sm mx-auto">Select a field to initialize Gemini-driven analysis based on your sensor or manual data.</p>
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
              <div className="bg-slate-900 p-10 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500 opacity-5 rounded-full translate-x-20 -translate-y-20"></div>
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-8 h-8 ${aiConnected ? 'bg-emerald-500' : 'bg-slate-700'} rounded-lg flex items-center justify-center transition-colors`}><i className="fas fa-robot text-sm"></i></div>
                      <span className={`text-xs font-bold uppercase tracking-widest ${aiConnected ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {aiConnected ? 'AI Advisor Online' : 'AI Advisor Offline'}
                      </span>
                    </div>
                    <h2 className="text-4xl font-black">{selectedField.field_name}</h2>
                    <p className="text-slate-400 mt-1">{selectedField.location} • {selectedField.size} Hectares</p>
                  </div>
                  <button onClick={() => setIsChatOpen(true)} className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-3 rounded-2xl font-bold flex items-center gap-3 transition-all transform hover:-translate-y-0.5">
                    <i className="fas fa-comment-medical text-lg"></i> Consult Advisor
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="bg-white p-24 text-center rounded-[3rem] border border-slate-100 shadow-sm">
                  <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-8"></div>
                  <h3 className="text-2xl font-bold text-slate-800">Processing Diagnostic Stream...</h3>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-12">
                  <div className="lg:col-span-2 space-y-8">
                    <div className="bg-white p-8 rounded-[2rem] border border-emerald-100 shadow-sm relative group overflow-hidden">
                      <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-3"><i className="fas fa-dna text-emerald-600"></i> AI Soil Health Insight</h3>
                      <p className="text-slate-600 leading-relaxed whitespace-pre-line text-lg font-medium">{aiSummary || "Analysing..."}</p>
                    </div>

                    <div>
                      <h3 className="text-xl font-bold text-slate-900 mb-6 px-2"><i className="fas fa-seedling text-emerald-600 mr-2"></i> Crop Suitability Index</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {recommendations?.map((crop, i) => (
                          <div key={i} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all">
                            <div className="flex justify-between items-start mb-6">
                              <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center"><i className={`fas ${crop.icon} text-2xl`}></i></div>
                              <span className="bg-emerald-50 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full">{crop.suitability}% Match</span>
                            </div>
                            <h4 className="text-xl font-bold text-slate-900 mb-1">{crop.name}</h4>
                            <div className="text-[10px] font-bold text-slate-500 uppercase mb-4">Forecast: {crop.yield}</div>
                            <p className="text-sm text-slate-600 border-t pt-4">{crop.requirements}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-1">
                    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                      <h3 className="text-xl font-bold text-slate-900 mb-8 flex items-center gap-3"><i className="fas fa-list-check text-emerald-600"></i> Roadmap</h3>
                      <div className="space-y-6">
                        {managementPlan?.map((task, i) => (
                          <div key={i} className="relative pl-6">
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-100 rounded-full"></div>
                            <div className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${task.priority === 'High' ? 'text-red-600' : 'text-emerald-600'}`}>{task.priority} Priority</div>
                            <h4 className="font-bold text-slate-900 text-sm mb-1">{task.title}</h4>
                            <p className="text-xs text-slate-500">{task.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Manual AI Console in Chat Panel */}
      {isChatOpen && (
        <div className="fixed inset-0 z-[400] flex justify-end">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsChatOpen(false)}></div>
          <div className="relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-8 bg-emerald-600 text-white flex justify-between items-center shadow-lg">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center"><i className="fas fa-robot text-2xl"></i></div>
                <h3 className="font-bold text-xl">AI Advisor</h3>
              </div>
              <button onClick={() => setIsChatOpen(false)} className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"><i className="fas fa-times text-xl"></i></button>
            </div>
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-6 scroll-smooth">
              {!aiConnected ? (
                <div className="text-center py-20 px-8 flex flex-col items-center">
                  <i className="fas fa-plug text-amber-500 text-3xl mb-6"></i>
                  <h4 className="font-bold text-slate-900 mb-2">Advisor Offline</h4>
                  {showManualConsole ? (
                    <form onSubmit={handleManualKeySubmit} className="w-full space-y-4">
                      <textarea rows={3} value={manualKey} onChange={(e) => setManualKey(e.target.value)} placeholder="Paste API code..." className="w-full px-4 py-3 rounded-xl border outline-none text-sm font-mono" />
                      <div className="flex gap-2">
                        <button type="submit" className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-bold text-sm">Submit Code</button>
                        <button type="button" onClick={() => setShowManualConsole(false)} className="px-4 py-3 bg-slate-100 text-slate-500 rounded-xl font-bold text-sm">Back</button>
                      </div>
                    </form>
                  ) : (
                    <button onClick={handleConnectAI} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-800">
                      <i className="fas fa-key"></i> Connect Gemini AI
                    </button>
                  )}
                </div>
              ) : (
                chatHistory.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[90%] p-5 rounded-3xl text-sm leading-relaxed ${msg.role === 'user' ? 'bg-emerald-600 text-white rounded-br-none shadow-lg' : 'bg-slate-100 text-slate-800 rounded-bl-none border border-slate-200'}`}>{msg.text}</div>
                  </div>
                ))
              )}
            </div>
            <div className={`p-8 border-t bg-slate-50 ${!aiConnected ? 'opacity-40 pointer-events-none' : ''}`}>
              <form onSubmit={handleSendMessage} className="flex gap-3">
                <input type="text" value={userInput} onChange={(e) => setUserInput(e.target.value)} placeholder="Ask advisor..." className="flex-1 bg-white border rounded-[1.5rem] px-6 py-4 text-sm outline-none" disabled={!aiConnected} />
                <button type="submit" disabled={isBotThinking || !userInput.trim() || !aiConnected} className="w-14 h-14 bg-emerald-600 text-white rounded-[1.5rem] flex items-center justify-center hover:bg-emerald-700 disabled:opacity-50 shadow-lg"><i className="fas fa-paper-plane"></i></button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserFields;
