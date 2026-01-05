
import React, { useState, useEffect } from 'react';
import { User, Field, CropRecommendation } from '../../types';
import { 
  getCropAnalysis, 
  getSoilHealthSummary, 
  getDetailedManagementPlan, 
  isAiReady,
  SoilInsight
} from '../../services/gemini';
import { syncFields, syncSensorsFromDb, addFieldToDb } from '../../services/db';

interface ManagementTask {
  priority: string;
  title: string;
  description: string;
  icon: string;
}

const UserFields: React.FC<{ user: User }> = ({ user }) => {
  const [fields, setFields] = useState<Field[]>([]);
  const [selectedField, setSelectedField] = useState<Field | null>(null);
  const [recommendations, setRecommendations] = useState<CropRecommendation[] | null>(null);
  const [soilInsight, setSoilInsight] = useState<SoilInsight | null>(null);
  const [managementPlan, setManagementPlan] = useState<ManagementTask[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiConnected, setAiConnected] = useState(false);
  const [currentDataState, setCurrentDataState] = useState<any>(null);
  const [showAddFieldModal, setShowAddFieldModal] = useState(false);
  const [newFieldData, setNewFieldData] = useState({ name: '', location: '', size: '', soilType: 'Loamy' });

  useEffect(() => {
    const init = async () => {
      const ready = await isAiReady();
      setAiConnected(ready);
      const userFields = await syncFields(user.id);
      setFields(userFields);
      if (userFields.length > 0) {
        handleFieldSelect(userFields[0]);
      }
    };
    init();
  }, [user.id]);

  const handleFieldSelect = async (field: Field) => {
    setSelectedField(field);
    setLoading(true);
    
    try {
      const fieldSensors = await syncSensorsFromDb([field]);
      const stats: any = { 
        temperature: 25.0,
        moisture: 45.0, 
        ph_level: 6.5, 
        npk_n: 50, 
        npk_p: 40, 
        npk_k: 60 
      };
      
      fieldSensors.forEach(s => {
        if (!s.last_reading) return;
        const t = s.sensor_type.toLowerCase();
        if (t.includes('moisture')) stats.moisture = s.last_reading.value;
        if (t.includes('temp')) stats.temperature = s.last_reading.value;
        if (t.includes('ph')) stats.ph_level = s.last_reading.value;
        if (t.includes('npk')) { 
          stats.npk_n = s.last_reading.n ?? stats.npk_n; 
          stats.npk_p = s.last_reading.p ?? stats.npk_p; 
          stats.npk_k = s.last_reading.k ?? stats.npk_k; 
        }
      });
      setCurrentDataState(stats);

      const ready = await isAiReady();
      setAiConnected(ready);

      // Fetch AI data
      const [analysis, insight, plan] = await Promise.all([
        getCropAnalysis(field, stats),
        getSoilHealthSummary(field, stats),
        getDetailedManagementPlan(field, stats)
      ]);
      
      setRecommendations(analysis);
      setSoilInsight(insight);
      setManagementPlan(plan);
    } catch (err) {
      console.error("Critical AI error", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddField = async (e: React.FormEvent) => {
    e.preventDefault();
    const f: Field = { 
      field_id: Date.now(), 
      user_id: user.id, 
      field_name: newFieldData.name, 
      location: newFieldData.location, 
      size: parseFloat(newFieldData.size) || 0, 
      soil_type: newFieldData.soilType 
    };
    await addFieldToDb(f);
    setFields([...fields, f]);
    setShowAddFieldModal(false);
    setNewFieldData({ name: '', location: '', size: '', soilType: 'Loamy' });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 min-h-screen">
      <div className="flex justify-between items-center mb-12">
        <div>
          <h1 className="text-3xl font-black text-slate-900">AI Agronomy Hub</h1>
          <p className="text-slate-500 text-sm mt-1">Real-time soil telemetry synthesized by shared Gemini AI nodes.</p>
        </div>
        <button 
          onClick={() => setShowAddFieldModal(true)} 
          className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-lg active:scale-95"
        >
          <i className="fas fa-plus"></i> Add New Field
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-4">
          <div className="flex justify-between items-center px-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Registered Plots</h3>
            <span className="text-xs font-bold text-slate-400">{fields.length}</span>
          </div>
          <div className="space-y-4 overflow-y-auto max-h-[70vh] pr-2 scrollbar-hide">
            {fields.map(f => (
              <button 
                key={f.field_id} 
                onClick={() => handleFieldSelect(f)} 
                className={`w-full text-left p-6 rounded-2xl border transition-all duration-300 transform ${
                  selectedField?.field_id === f.field_id 
                    ? 'border-emerald-500 bg-emerald-50 shadow-md scale-[1.02]' 
                    : 'bg-white border-slate-100 hover:border-emerald-200'
                }`}
              >
                <div className="font-bold text-slate-800 text-lg mb-1">{f.field_name}</div>
                <div className="text-sm text-slate-400 font-medium">{f.location}</div>
                <div className="mt-4 flex items-center gap-3">
                  <span className="text-[10px] font-black uppercase tracking-tighter bg-white px-2 py-1 rounded shadow-sm text-slate-500">{f.soil_type}</span>
                  <span className="text-[10px] font-bold text-slate-400">{f.size} ha</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-3">
          {!selectedField ? (
            <div className="bg-white rounded-[3rem] p-32 text-center border-dashed border-2 border-slate-200 flex flex-col items-center">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                <i className="fas fa-microscope text-4xl text-slate-200"></i>
              </div>
              <h3 className="text-slate-400 font-bold text-xl">Select a field to initiate shared AI diagnostics.</h3>
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-700">
              <div className="bg-slate-900 p-10 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 blur-[100px] rounded-full"></div>
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`flex items-center gap-2 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${aiConnected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-orange-500/20 text-orange-400'}`}>
                        <i className={`fas ${aiConnected ? 'fa-robot' : 'fa-wave-square'}`}></i>
                        {aiConnected ? 'Shared AI Node Active' : 'Offline Node Processing'}
                      </div>
                    </div>
                    <h2 className="text-5xl font-black tracking-tight">{selectedField.field_name}</h2>
                    <p className="text-slate-400 mt-2 text-lg font-medium">{selectedField.location} • {selectedField.size} Hectares</p>
                  </div>
                  
                  <div className="bg-white/5 backdrop-blur-xl p-6 rounded-[2.5rem] border border-white/10 flex flex-wrap gap-6 items-center">
                    <div className={`flex items-center gap-3 text-sm font-bold ${currentDataState?.moisture != null ? 'text-emerald-400' : 'text-slate-600'}`}>
                      <i className={`fas ${currentDataState?.moisture != null ? 'fa-check-circle' : 'fa-circle-xmark opacity-20'}`}></i>
                      <span>MOISTURE {currentDataState?.moisture != null ? `(${currentDataState.moisture.toFixed(1)}%)` : 'OFFLINE'}</span>
                    </div>
                    <div className="w-px h-6 bg-white/10 hidden md:block"></div>
                    <div className={`flex items-center gap-3 text-sm font-bold ${currentDataState?.ph_level != null ? 'text-emerald-400' : 'text-slate-600'}`}>
                      <i className={`fas ${currentDataState?.ph_level != null ? 'fa-check-circle' : 'fa-circle-xmark opacity-20'}`}></i>
                      <span>PH {currentDataState?.ph_level != null ? `(${currentDataState.ph_level.toFixed(1)})` : 'OFFLINE'}</span>
                    </div>
                    <div className="w-px h-6 bg-white/10 hidden md:block"></div>
                    <div className={`flex items-center gap-3 text-sm font-bold ${currentDataState?.npk_n != null ? 'text-emerald-400' : 'text-slate-600'}`}>
                      <i className={`fas ${currentDataState?.npk_n != null ? 'fa-check-circle' : 'fa-circle-xmark opacity-20'}`}></i>
                      <span>NPK SYNCED</span>
                    </div>
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="bg-white p-32 text-center rounded-[3rem] border border-slate-100 shadow-sm flex flex-col items-center">
                  <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-8"></div>
                  <h3 className="text-2xl font-black text-slate-800">Synthesizing Shared Data...</h3>
                  <p className="text-slate-400 mt-2">Connecting to shared Gemini AI processing node for optimization.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 space-y-8">
                    <div className="bg-white p-10 rounded-[3rem] border border-emerald-50 shadow-sm hover:shadow-xl transition-shadow relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-8 text-emerald-500/5 text-8xl transition-transform group-hover:scale-110">
                        <i className="fas fa-flask-vial"></i>
                      </div>
                      <h3 className="font-bold text-2xl text-slate-900 mb-6 flex items-center gap-3">
                        <i className="fas fa-vial-circle-check text-emerald-600"></i> AI Restoration Strategy
                      </h3>
                      
                      <div className="space-y-6">
                        <div className="p-8 rounded-[2rem] bg-emerald-50/50 text-slate-700 border border-emerald-50">
                          <p className="text-lg leading-relaxed font-medium italic">
                            "{soilInsight?.summary || "Analyzing telemetry for restoration steps..."}"
                          </p>
                        </div>
                        
                        <div className="bg-slate-900 text-white p-6 rounded-[2rem] flex items-center justify-between group-hover:bg-slate-800 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center">
                              <i className="fas fa-mortar-pestle text-white"></i>
                            </div>
                            <div>
                              <div className="text-[10px] font-black uppercase text-emerald-400 tracking-widest">Recommended Treatment</div>
                              <div className="font-bold text-lg">{soilInsight?.soil_fertilizer || "Determining ideal soil conditioner..."}</div>
                            </div>
                          </div>
                          <i className="fas fa-shield-virus text-emerald-400/20 text-3xl"></i>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="font-bold text-2xl text-slate-900 mb-8 flex items-center gap-3 px-4">
                        <i className="fas fa-chart-line text-emerald-600"></i> High-Yield Crop Index
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {recommendations && recommendations.length > 0 ? (
                          recommendations.map((r, i) => (
                            <div key={i} className="bg-white p-8 rounded-[3rem] border border-slate-100 hover:shadow-2xl transition-all hover:-translate-y-1">
                              <div className="flex justify-between items-start mb-8">
                                <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center shadow-inner">
                                  <i className={`fas ${r.icon || 'fa-seedling'} text-2xl`}></i>
                                </div>
                                <div className="text-right">
                                  <div className="text-[10px] font-black uppercase text-emerald-600 mb-1">Harvest Match</div>
                                  <div className="text-2xl font-black text-slate-900">{r.suitability}%</div>
                                </div>
                              </div>
                              <h4 className="font-black text-slate-900 text-xl mb-2">{r.name}</h4>
                              <div className="text-xs font-bold text-slate-400 mb-4 uppercase tracking-wider flex items-center gap-2">
                                <i className="fas fa-boxes-packing"></i> Potential: {r.yield}
                              </div>
                              
                              <div className="h-2 w-full bg-slate-100 rounded-full mb-6 overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${r.suitability}%` }}></div>
                              </div>
                              
                              <div className="space-y-4">
                                <div className="bg-emerald-600 p-5 rounded-[1.5rem] shadow-lg shadow-emerald-100">
                                  <div className="text-[10px] font-black text-emerald-200 uppercase mb-2 flex items-center gap-2">
                                    <i className="fas fa-flask"></i> Perfect Boost
                                  </div>
                                  <p className="text-xs font-bold text-white leading-relaxed">{r.fertilizer}</p>
                                </div>
                                <p className="text-[11px] text-slate-500 leading-tight italic border-t border-slate-50 pt-4">"{r.requirements}"</p>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="col-span-full py-20 bg-slate-50 rounded-[3rem] border border-dashed text-center text-slate-300">
                            <i className="fas fa-robot text-4xl mb-4 block opacity-20"></i>
                            <p className="font-bold">Syncing AI recommendations...</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm h-fit sticky top-24">
                    <h3 className="font-bold text-2xl text-slate-900 mb-10 flex items-center gap-3">
                      <i className="fas fa-list-check text-emerald-600"></i> AI Restoration Roadmap
                    </h3>
                    <div className="space-y-10">
                      {managementPlan && managementPlan.length > 0 ? (
                        managementPlan.map((p, i) => (
                          <div key={i} className="relative pl-8">
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 rounded-full"></div>
                            <div className={`text-[10px] font-black uppercase tracking-widest mb-2 ${
                              p.priority.toLowerCase() === 'high' ? 'text-red-500' : p.priority.toLowerCase() === 'medium' ? 'text-orange-500' : 'text-emerald-500'
                            }`}>
                              {p.priority} Priority
                            </div>
                            <h4 className="font-black text-slate-900 mb-2">{p.title}</h4>
                            <p className="text-xs text-slate-500 leading-relaxed">{p.description}</p>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-20 space-y-6">
                           <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto opacity-20">
                             <i className="fas fa-clipboard-list text-3xl"></i>
                           </div>
                           <p className="text-slate-400 font-medium text-sm px-6">Establishing your restoration roadmap...</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showAddFieldModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[3rem] w-full max-w-md p-10 shadow-2xl animate-in zoom-in duration-300">
            <h2 className="text-3xl font-black mb-8 text-slate-900">Deploy New Node</h2>
            <form onSubmit={handleAddField} className="space-y-6">
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase mb-2 ml-1">Field Descriptor</label>
                <input required type="text" value={newFieldData.name} onChange={e => setNewFieldData({...newFieldData, name: e.target.value})} className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-emerald-500 font-medium" placeholder="e.g. North Paddy A" />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase mb-2 ml-1">Geographic Location</label>
                <input required type="text" value={newFieldData.location} onChange={e => setNewFieldData({...newFieldData, location: e.target.value})} className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-emerald-500 font-medium" placeholder="e.g. Bogura, Bangladesh" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase mb-2 ml-1">Size (ha)</label>
                  <input required type="number" step="0.1" value={newFieldData.size} onChange={e => setNewFieldData({...newFieldData, size: e.target.value})} className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-emerald-500 font-medium" placeholder="1.2" />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase mb-2 ml-1">Soil Type</label>
                  <select value={newFieldData.soilType} onChange={e => setNewFieldData({...newFieldData, soilType: e.target.value})} className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-emerald-500 font-black">
                    <option value="Loamy">Loamy</option>
                    <option value="Clay">Clay</option>
                    <option value="Sandy">Sandy</option>
                    <option value="Alluvial">Alluvial</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-4 pt-6">
                <button type="button" onClick={() => setShowAddFieldModal(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-200 transition-colors">Cancel</button>
                <button type="submit" className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-emerald-200 hover:bg-emerald-700 transition-all">Deploy</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserFields;
