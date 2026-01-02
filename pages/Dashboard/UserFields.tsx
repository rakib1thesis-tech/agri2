
import React, { useState, useEffect, useRef } from 'react';
import { User, Field, SensorData, CropRecommendation } from '../../types';
import { MOCK_FIELDS, generateMockSensorData } from '../../constants';
import { getCropAnalysis, getSoilHealthSummary, getDetailedManagementPlan, startAIConversation } from '../../services/gemini';
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
  const [fields, setFields] = useState<Field[]>(() => {
    const saved = localStorage.getItem('agricare_fields');
    return saved ? JSON.parse(saved) : MOCK_FIELDS;
  });
  
  const [selectedField, setSelectedField] = useState<Field | null>(null);
  const [recommendations, setRecommendations] = useState<CropRecommendation[] | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [managementPlan, setManagementPlan] = useState<ManagementTask[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  
  // Modal states
  const [showAddFieldModal, setShowAddFieldModal] = useState(false);
  const [newFieldData, setNewFieldData] = useState({
    name: '',
    location: '',
    size: '',
    soilType: 'Loamy'
  });

  // AI Chat Advisor State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState("");
  const [isBotThinking, setIsBotThinking] = useState(false);
  const chatRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('agricare_fields', JSON.stringify(fields));
  }, [fields]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory, isBotThinking]);

  const handleFieldSelect = async (field: Field) => {
    setSelectedField(field);
    setLoading(true);
    setRecommendations(null);
    setAiSummary(null);
    setManagementPlan(null);
    setChatHistory([]);
    
    const latest = generateMockSensorData(field.field_id)[6];
    
    // Initialize Advisor Chat
    chatRef.current = startAIConversation(
      `You are the Agricare AI Advisor. Assist this farmer in ${field.location} with their ${field.field_name} (${field.soil_type} soil).
       Current Sensor Data: Temp ${latest.temperature.toFixed(1)}°C, Moisture ${latest.moisture.toFixed(1)}%, pH ${latest.ph_level.toFixed(1)}, NPK ${latest.npk_n}-${latest.npk_p}-${latest.npk_k}.
       Provide expert, localized agricultural advice for Bangladesh.`
    );
    
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
    setFields([...fields, newField]);
    setShowAddFieldModal(false);
    setNewFieldData({ name: '', location: '', size: '', soilType: 'Loamy' });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || !chatRef.current || isBotThinking) return;

    const userMsg = userInput;
    setUserInput("");
    setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsBotThinking(true);

    try {
      const response: GenerateContentResponse = await chatRef.current.sendMessage({ message: userMsg });
      const botText = response.text || "I'm having trouble analyzing the latest satellite telemetry. Please try again.";
      setChatHistory(prev => [...prev, { role: 'model', text: botText }]);
    } catch (error) {
      console.error("Advisor Error:", error);
      setChatHistory(prev => [...prev, { role: 'model', text: "Error connecting to AI system. Please verify network." }]);
    } finally {
      setIsBotThinking(false);
    }
  };

  const handleExportCSV = () => {
    if (!selectedField) return;
    const historicalData = generateMockSensorData(selectedField.field_id);
    const headers = ['Timestamp', 'Temperature (°C)', 'Moisture (%)', 'pH Level', 'Nitrogen (N)', 'Phosphorus (P)', 'Potassium (K)'];
    const rows = historicalData.map(row => [
      row.timestamp, row.temperature.toFixed(2), row.moisture.toFixed(2), row.ph_level.toFixed(2), row.npk_n, row.npk_p, row.npk_k
    ]);
    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `agricare_export_${selectedField.field_name.toLowerCase().replace(/\s+/g, '_')}.csv`);
    link.click();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative min-h-[80vh]">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Field Command Center</h1>
          <p className="text-slate-500 text-sm">Real-time IoT and AI Diagnostics Hub</p>
        </div>
        <div className="flex gap-4">
          {selectedField && (
            <button onClick={handleExportCSV} className="bg-white text-emerald-600 border border-emerald-100 px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-emerald-50 transition-colors shadow-sm">
              <i className="fas fa-file-csv"></i> Export Data
            </button>
          )}
          <button onClick={() => setShowAddFieldModal(true)} className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-md">
            <i className="fas fa-plus"></i> Add New Field
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Field Selection Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex justify-between items-center">
            <span>Your Fields</span>
            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{fields.length}</span>
          </div>
          <div className="max-h-[70vh] overflow-y-auto space-y-4 pr-1">
            {fields.map(f => (
              <button 
                key={f.field_id}
                onClick={() => handleFieldSelect(f)}
                className={`w-full text-left p-6 rounded-2xl border transition-all animate-in fade-in slide-in-from-left-4 ${
                  selectedField?.field_id === f.field_id 
                    ? 'border-emerald-500 bg-emerald-50 shadow-md ring-1 ring-emerald-500' 
                    : 'border-slate-100 bg-white shadow-sm hover:border-emerald-300'
                }`}
              >
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

        {/* Dashboard Area */}
        <div className="lg:col-span-3">
          {!selectedField ? (
            <div className="bg-white rounded-[3rem] border border-dashed border-slate-300 p-24 text-center">
              <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <i className="fas fa-satellite text-3xl"></i>
              </div>
              <h2 className="text-2xl font-bold text-slate-800">Field Diagnostics Ready</h2>
              <p className="text-slate-500 mt-2 max-w-sm mx-auto">Select a field from the left sidebar to initialize Gemini-driven analysis and localized management roadmaps.</p>
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
              {/* Field Header Card */}
              <div className="bg-slate-900 p-10 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500 opacity-5 rounded-full translate-x-20 -translate-y-20"></div>
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                        <i className="fas fa-robot text-sm"></i>
                      </div>
                      <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">AI Advisor Online</span>
                    </div>
                    <h2 className="text-4xl font-black">{selectedField.field_name}</h2>
                    <p className="text-slate-400 mt-1">{selectedField.location} • {selectedField.size} Hectares</p>
                  </div>
                  <button 
                    onClick={() => setIsChatOpen(true)}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-3 rounded-2xl font-bold flex items-center gap-3 transition-all shadow-xl shadow-emerald-950/40 transform hover:-translate-y-0.5"
                  >
                    <i className="fas fa-comment-medical text-lg"></i> Consult Advisor
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="bg-white p-24 text-center rounded-[3rem] border border-slate-100 shadow-sm">
                  <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-8"></div>
                  <h3 className="text-2xl font-bold text-slate-800">Synthesizing Sensor Tensors...</h3>
                  <p className="text-slate-500">Connecting Temperature, pH, and NPK data to Regional Crop Models.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-12">
                  <div className="lg:col-span-2 space-y-8">
                    <div className="bg-white p-8 rounded-[2rem] border border-emerald-100 shadow-sm relative group overflow-hidden">
                      <div className="absolute top-0 right-0 p-6">
                         <i className="fas fa-sparkles text-emerald-50 text-5xl group-hover:scale-110 transition-transform"></i>
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-3">
                        <i className="fas fa-dna text-emerald-600"></i> AI Soil Health Insight
                      </h3>
                      <p className="text-slate-600 leading-relaxed whitespace-pre-line text-lg font-medium min-h-[80px]">
                        {aiSummary || "Processing field conditions... recommendations will appear shortly."}
                      </p>
                    </div>

                    <div>
                      <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-3 px-2">
                        <i className="fas fa-seedling text-emerald-600"></i> Crop Suitability Index
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {recommendations && recommendations.length > 0 ? (
                          recommendations.map((crop, i) => (
                            <div key={i} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:border-emerald-200 transition-all group">
                              <div className="flex justify-between items-start mb-6">
                                <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-inner">
                                  <i className={`fas ${crop.icon} text-2xl`}></i>
                                </div>
                                <span className="bg-emerald-50 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full shadow-sm">{crop.suitability}% Match</span>
                              </div>
                              <h4 className="text-xl font-bold text-slate-900 mb-1">{crop.name}</h4>
                              <div className="inline-flex items-center gap-2 px-2 py-0.5 bg-slate-50 rounded text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-4">
                                <i className="fas fa-chart-line text-[8px]"></i> Forecast: {crop.yield}
                              </div>
                              <p className="text-sm text-slate-600 leading-relaxed border-t border-slate-50 pt-4">{crop.requirements}</p>
                            </div>
                          ))
                        ) : (
                          <div className="col-span-full bg-white p-12 rounded-[2rem] border border-dashed border-slate-200 text-center text-slate-400">
                             <i className="fas fa-robot mb-4 text-2xl animate-pulse"></i>
                             <p>Analyzing localized soil markers for crop compatibility...</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-1">
                    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm sticky top-24">
                      <h3 className="text-xl font-bold text-slate-900 mb-8 flex items-center gap-3">
                        <i className="fas fa-list-check text-emerald-600"></i> Management Roadmap
                      </h3>
                      
                      <div className="space-y-6">
                        {managementPlan && managementPlan.length > 0 ? (
                          managementPlan.map((task, i) => (
                            <div key={i} className="relative pl-6 group">
                              <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-100 group-hover:bg-emerald-200 rounded-full transition-colors"></div>
                              <div className="flex justify-between items-center mb-2">
                                <div className={`text-[10px] font-bold uppercase tracking-widest ${
                                  task.priority === 'High' ? 'text-red-600' : 'text-emerald-600'
                                }`}>
                                  {task.priority} Priority
                                </div>
                                <i className={`fas ${task.icon} text-slate-300`}></i>
                              </div>
                              <h4 className="font-bold text-slate-900 text-sm mb-1">{task.title}</h4>
                              <p className="text-xs text-slate-500 leading-relaxed">{task.description}</p>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-10">
                            <i className="fas fa-robot text-2xl text-slate-300 mb-4 animate-bounce"></i>
                            <p className="text-xs text-slate-400">Preparing actionable insights...</p>
                          </div>
                        )}
                      </div>
                      
                      <div className="mt-10 p-5 bg-slate-900 rounded-[1.5rem] text-white text-center shadow-xl shadow-slate-200">
                        <div className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1">Diagnostic Confidence</div>
                        <div className="text-3xl font-black text-emerald-400">94.2%</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add Field Modal */}
      {showAddFieldModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg p-8 shadow-2xl animate-in zoom-in duration-300">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-black text-slate-900">Add New Field</h2>
              <button onClick={() => setShowAddFieldModal(false)} className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors">
                <i className="fas fa-times text-slate-400"></i>
              </button>
            </div>
            
            <form onSubmit={handleAddField} className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Field Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Northern Paddy Field"
                  className="w-full px-5 py-3 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all"
                  value={newFieldData.name}
                  onChange={e => setNewFieldData({...newFieldData, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Location</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Gazipur, Bangladesh"
                  className="w-full px-5 py-3 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all"
                  value={newFieldData.location}
                  onChange={e => setNewFieldData({...newFieldData, location: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Size (Ha)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    placeholder="e.g. 5.5"
                    className="w-full px-5 py-3 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all"
                    value={newFieldData.size}
                    onChange={e => setNewFieldData({...newFieldData, size: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Soil Type</label>
                  <select
                    className="w-full px-5 py-3 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all bg-white"
                    value={newFieldData.soilType}
                    onChange={e => setNewFieldData({...newFieldData, soilType: e.target.value})}
                  >
                    <option value="Loamy">Loamy</option>
                    <option value="Clay">Clay</option>
                    <option value="Sandy">Sandy</option>
                    <option value="Alluvial">Alluvial</option>
                  </select>
                </div>
              </div>
              
              <div className="pt-4 flex gap-4">
                <button 
                  type="button"
                  onClick={() => setShowAddFieldModal(false)}
                  className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
                >
                  Create Field
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Chat Advisor Panel */}
      {isChatOpen && (
        <div className="fixed inset-0 z-[200] flex justify-end">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsChatOpen(false)}></div>
          <div className="relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="p-8 bg-emerald-600 text-white flex justify-between items-center shadow-lg">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                  <i className="fas fa-robot text-2xl"></i>
                </div>
                <div>
                  <h3 className="font-bold text-xl leading-none">AI Advisor</h3>
                  <p className="text-xs text-emerald-100 uppercase tracking-widest mt-2">Personal Field Consultant</p>
                </div>
              </div>
              <button onClick={() => setIsChatOpen(false)} className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors">
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>

            {/* Chat History */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-6 scroll-smooth">
              {chatHistory.length === 0 ? (
                <div className="text-center py-20 px-6">
                  <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <i className="fas fa-comment-dots text-3xl"></i>
                  </div>
                  <h4 className="font-bold text-slate-900 mb-2">How can I help you today?</h4>
                  <p className="text-sm text-slate-500 leading-relaxed italic">"What's the best time to apply Urea given current moisture levels?" or "How does the predicted monsoon affect my potato yield?"</p>
                </div>
              ) : (
                chatHistory.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[90%] p-5 rounded-3xl text-sm leading-relaxed ${
                      msg.role === 'user' 
                        ? 'bg-emerald-600 text-white rounded-br-none shadow-lg' 
                        : 'bg-slate-100 text-slate-800 rounded-bl-none border border-slate-200 shadow-sm'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                ))
              )}
              {isBotThinking && (
                <div className="flex justify-start">
                  <div className="bg-slate-50 border border-slate-200 p-5 rounded-3xl rounded-bl-none shadow-sm">
                    <div className="flex gap-2">
                      <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce delay-150"></div>
                      <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce delay-300"></div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input Bar */}
            <div className="p-8 border-t border-slate-100 bg-slate-50">
              <form onSubmit={handleSendMessage} className="flex gap-3">
                <input 
                  type="text" 
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  placeholder="Ask advisor..."
                  className="flex-1 bg-white border border-slate-200 rounded-[1.5rem] px-6 py-4 text-sm focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 shadow-inner"
                />
                <button 
                  type="submit"
                  disabled={isBotThinking || !userInput.trim()}
                  className="w-14 h-14 bg-emerald-600 text-white rounded-[1.5rem] flex items-center justify-center hover:bg-emerald-700 transition-all disabled:opacity-50 shadow-lg shadow-emerald-200 active:scale-95"
                >
                  <i className="fas fa-paper-plane text-lg"></i>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserFields;
