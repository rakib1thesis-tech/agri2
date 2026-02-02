import React, { useState, useEffect } from 'react';
import { User, Field, CropRecommendation } from '../../types';
import { 
  getHarvestCompatibility, 
  getCropAnalysis, 
  getSoilHealthSummary, 
  getDetailedManagementPlan, 
  SoilInsight,
  HarvestIndex
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
  const [harvestIndex, setHarvestIndex] = useState<HarvestIndex | null>(null);
  const [recommendations, setRecommendations] = useState<CropRecommendation[] | null>(null);
  const [soilInsight, setSoilInsight] = useState<SoilInsight | null>(null);
  const [managementPlan, setManagementPlan] = useState<ManagementTask[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAddFieldModal, setShowAddFieldModal] = useState(false);
  const [newFieldData, setNewFieldData] = useState({ name: '', location: '', size: '', soilType: 'Loamy' });

  useEffect(() => {
    const init = async () => {
      const userFields = await syncFields(user.id);
      setFields(userFields);
      if (userFields.length > 0) handleFieldSelect(userFields[0]);
    };
    init();
  }, [user.id]);

  const handleFieldSelect = async (field: Field) => {
    setSelectedField(field);
    setLoading(true);
    
    try {
      // 1. Fetch real-time sensor data synced from the Sensors page
      const allSensors = await syncSensorsFromDb([field]);
      const fieldSensors = allSensors.filter(s => s.field_id === field.field_id);
      
      const metrics: any = {
        moisture: fieldSensors.find(s => s.sensor_type.toLowerCase().includes('moisture'))?.last_reading?.value,
        ph: fieldSensors.find(s => s.sensor_type.toLowerCase().includes('ph'))?.last_reading?.value,
        temperature: fieldSensors.find(s => s.sensor_type.toLowerCase().includes('temp'))?.last_reading?.value,
        npk: fieldSensors.find(s => s.sensor_type.toLowerCase().includes('npk'))?.last_reading?.npk
      };

      // 2. Run AI Analysis in parallel using real metrics
      const [hi, crops, soil, plan] = await Promise.all([
        getHarvestCompatibility(metrics, field.field_name),
        getCropAnalysis(metrics),
        getSoilHealthSummary(metrics),
        getDetailedManagementPlan(metrics)
      ]);

      // 3. Update state to trigger re-render of the cards
      setHarvestIndex(hi);
      setRecommendations(crops);
      setSoilInsight(soil);
      setManagementPlan(plan);
    } catch (error) {
      console.error("AI Analysis failed:", error);
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
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex flex-col lg:flex-row gap-10">
        
        {/* SIDEBAR: Field Selection */}
        <div className="w-full lg:w-80 flex-shrink-0">
          <div className="sticky top-24 space-y-4">
            <button 
              onClick={() => setShowAddFieldModal(true)}
              className="w-full p-5 bg-emerald-600 text-white rounded-[2rem] font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-xl mb-6"
            >
              + Add New Plot
            </button>
            
            <div className="space-y-3">
              {fields.map(f => (
                <div 
                  key={f.field_id}
                  onClick={() => handleFieldSelect(f)}
                  className={`group p-6 rounded-[2rem] cursor-pointer transition-all border-2 ${
                    selectedField?.field_id === f.field_id 
                    ? 'bg-emerald-50 border-emerald-500' 
                    : 'bg-white border-slate-100'
                  }`}
                >
                  <h3 className="font-black text-lg text-slate-900">{f.field_name}</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase">{f.location}</p>
                  <span className="inline-block mt-2 px-3 py-1 bg-slate-100 rounded-full text-[10px] font-black text-slate-500 uppercase">
                    {f.soil_type}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* MAIN CONTENT AREA */}
        <div className="flex-1 space-y-12">
          {selectedField ? (
            <>
              {/* 1. Header & Quick Metrics */}
              <div className="bg-slate-900 rounded-[3.5rem] p-10 text-white relative overflow-hidden">
                 <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <h2 className="text-5xl font-black mb-2">{selectedField.field_name}</h2>
                        <p className="text-slate-400 font-bold">{selectedField.location} • {selectedField.size} ha</p>
                    </div>
                    <div className="flex gap-4">
                        <div className="bg-white/5 p-4 rounded-3xl border border-white/10">
                            <p className="text-[10px] font-black text-emerald-400 uppercase">Status</p>
                            <p className="text-sm font-bold">Live AI Stream</p>
                        </div>
                    </div>
                 </div>
              </div>

              {/* 2. Soil Restoration Strategy (Dynamic) */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-emerald-50/50 border border-emerald-100 rounded-[3rem] p-10">
                    <h3 className="flex items-center gap-3 text-xl font-black text-slate-900 mb-6">
                        <i className="fas fa-seedling text-emerald-500"></i> Soil Restoration Strategy
                    </h3>
                    <div className="bg-white p-8 rounded-[2rem] shadow-sm mb-6 border border-emerald-100">
                        <p className="text-xl italic font-medium text-slate-700 leading-relaxed">
                            "{soilInsight?.summary || "Analyzing soil metrics for primary diagnostic profiling..."}"
                        </p>
                    </div>
                    {soilInsight?.warnings.map((w, i) => (
                         <div key={i} className="bg-slate-900 text-white p-5 rounded-[2rem] flex items-center gap-4">
                            <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center">
                                <i className="fas fa-user-md text-sm"></i>
                            </div>
                            <p className="text-sm font-bold uppercase tracking-tight">Recommended: {w}</p>
                         </div>
                    ))}
                </div>

                <div className="bg-white border border-slate-100 rounded-[3rem] p-10 shadow-sm">
                    <h3 className="flex items-center gap-3 text-xl font-black text-slate-900 mb-6">
                        <i className="fas fa-route text-emerald-500"></i> Operational Roadmap
                    </h3>
                    <div className="space-y-6">
                        {managementPlan?.map((task, i) => (
                            <div key={i} className="flex gap-4">
                                <div className="w-1 h-16 bg-emerald-500 rounded-full"></div>
                                <div>
                                    <p className="text-[10px] font-black text-emerald-600 uppercase mb-1">{task.priority} Priority</p>
                                    <h4 className="font-bold text-slate-900">{task.title}</h4>
                                    <p className="text-xs text-slate-500 leading-tight">{task.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
              </div>

              {/* 3. Harvest Compatibility Index (DYNAMIC AI CARDS) */}
              <div className="space-y-8">
                <h3 className="flex items-center gap-3 text-xl font-black text-slate-900">
                    <i className="fas fa-chart-line text-emerald-500"></i> Harvest Compatibility Index
                </h3>
                
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
                        {[1,2,3].map(i => <div key={i} className="h-64 bg-slate-100 rounded-[2.5rem]"></div>)}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {recommendations?.map((crop, idx) => (
                        <div key={idx} className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group">
                            <div className="flex justify-between items-start mb-6">
                                <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center group-hover:bg-emerald-500 transition-colors">
                                    <i className="fas fa-leaf text-emerald-600 group-hover:text-white"></i>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-slate-400 uppercase">Match</p>
                                    <p className="text-3xl font-black text-slate-900">{crop.suitability}%</p>
                                </div>
                            </div>
                            <h4 className="text-2xl font-black text-slate-900 mb-6">{crop.crop}</h4>
                            <div className="bg-emerald-600 text-white p-4 rounded-2xl flex items-center gap-3 mb-6">
                                <i className="fas fa-flask-vial text-sm"></i>
                                <div>
                                    <p className="text-[8px] font-black uppercase opacity-80">Optimal Supplement</p>
                                    <p className="text-xs font-bold uppercase">{crop.tips[0] || 'NPK Sync Required'}</p>
                                </div>
                            </div>
                            <p className="text-xs italic text-slate-400 leading-relaxed font-medium">
                                "{crop.reasoning}"
                            </p>
                        </div>
                    ))}
                    </div>
                )}
              </div>
            </>
          ) : (
            <div className="h-96 flex flex-col items-center justify-center text-center">
              <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                <i className="fas fa-map-marked-alt text-slate-200 text-4xl"></i>
              </div>
              <h2 className="text-2xl font-black text-slate-900">Select a Plot</h2>
              <p className="text-slate-400">Choose a plot from the sidebar to view AI diagnostics.</p>
            </div>
          )}
        </div>
      </div>

      {/* MODAL: Add New Plot */}
      {showAddFieldModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] p-10 max-w-md w-full shadow-2xl">
            <h2 className="text-3xl font-black text-slate-900 mb-8">Register New Plot</h2>
            <form onSubmit={handleAddField} className="space-y-6">
              <input required type="text" placeholder="Plot Name" className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none font-bold" value={newFieldData.name} onChange={e => setNewFieldData({...newFieldData, name: e.target.value})} />
              <input required type="text" placeholder="Location" className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none font-bold" value={newFieldData.location} onChange={e => setNewFieldData({...newFieldData, location: e.target.value})} />
              <div className="grid grid-cols-2 gap-4">
                  <input required type="number" placeholder="Size (ha)" className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none font-bold" value={newFieldData.size} onChange={e => setNewFieldData({...newFieldData, size: e.target.value})} />
                  <select className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold" value={newFieldData.soilType} onChange={e => setNewFieldData({...newFieldData, soilType: e.target.value})}>
                      <option value="Loamy">Loamy</option>
                      <option value="Sandy">Sandy</option>
                      <option value="Clay">Clay</option>
                  </select>
              </div>
              <button type="submit" className="w-full py-5 bg-emerald-600 text-white rounded-[2rem] font-black uppercase tracking-widest shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all">Register Plot</button>
              <button type="button" onClick={() => setShowAddFieldModal(false)} className="w-full py-2 text-slate-400 font-bold text-xs uppercase hover:text-slate-600 transition-colors">Cancel</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserFields;
