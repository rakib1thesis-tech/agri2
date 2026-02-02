import React, { useState, useEffect } from 'react';
import { User, Field, CropRecommendation } from '../../types';
import { 
  getCropAnalysis, 
  getSoilHealthSummary, 
  getDetailedManagementPlan, 
  getHarvestIndex,
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
      // Fetch latest sensors (synced from the Sensors page)
      const allSensors = await syncSensorsFromDb([field]);
      const fieldSensors = allSensors.filter(s => s.field_id === field.field_id);
      
      // Aggregate data for the AI
      const sensorMetrics: any = {};
      fieldSensors.forEach(s => {
        if (s.last_reading) {
          const type = s.sensor_type.toLowerCase();
          if (type.includes('moisture')) sensorMetrics.moisture = s.last_reading.value;
          if (type.includes('temp')) sensorMetrics.temperature = s.last_reading.value;
          if (type.includes('ph')) sensorMetrics.ph = s.last_reading.value;
          if (type.includes('npk')) sensorMetrics.npk = s.last_reading.npk;
        }
      });

      // Execute all AI analysis in parallel
      const [hi, crops, soil, plan] = await Promise.all([
        getHarvestIndex(sensorMetrics, field.field_name),
        getCropAnalysis(sensorMetrics),
        getSoilHealthSummary(sensorMetrics),
        getDetailedManagementPlan(sensorMetrics)
      ]);

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
    handleFieldSelect(f);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex flex-col lg:flex-row gap-10">
        
        {/* SIDEBAR: Field Selection */}
        <div className="w-full lg:w-80 flex-shrink-0">
          <div className="sticky top-24 space-y-4">
            <button 
              onClick={() => setShowAddFieldModal(true)}
              className="w-full p-5 bg-slate-900 text-white rounded-[2rem] font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl mb-6"
            >
              + Register New Plot
            </button>
            
            <div className="space-y-3">
              {fields.map(f => (
                <div 
                  key={f.field_id}
                  onClick={() => handleFieldSelect(f)}
                  className={`group p-6 rounded-[2rem] cursor-pointer transition-all border-2 ${
                    selectedField?.field_id === f.field_id 
                    ? 'bg-emerald-50 border-emerald-500 shadow-lg' 
                    : 'bg-white border-slate-100 hover:border-slate-300'
                  }`}
                >
                  <h3 className={`font-black text-lg ${selectedField?.field_id === f.field_id ? 'text-emerald-900' : 'text-slate-900'}`}>
                    {f.field_name}
                  </h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                    <i className="fas fa-location-dot mr-1"></i> {f.location}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* MAIN CONTENT AREA */}
        <div className="flex-1 space-y-8">
          {selectedField ? (
            <>
              {/* 1. PRIMARY FEATURE: Harvest Compatibility Index */}
              <div className="bg-slate-900 rounded-[3.5rem] p-10 lg:p-14 text-white shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-12 opacity-10">
                  <i className="fas fa-wheat-awn text-9xl text-emerald-500"></i>
                </div>
                
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-6">
                    <span className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></span>
                    <p className="text-xs font-black text-emerald-400 uppercase tracking-[0.3em]">AI Harvest Intelligence</p>
                  </div>

                  {loading ? (
                    <div className="flex items-center gap-6 animate-pulse">
                      <div className="h-24 w-40 bg-white/5 rounded-3xl"></div>
                      <div className="space-y-3">
                        <div className="h-4 w-64 bg-white/5 rounded-full"></div>
                        <div className="h-4 w-48 bg-white/5 rounded-full"></div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col md:flex-row items-center gap-12">
                      <div className="text-center md:text-left">
                        <div className="flex items-baseline gap-2">
                          <h2 className="text-9xl font-black">{harvestIndex?.score || 0}</h2>
                          <span className="text-4xl font-bold text-emerald-500">%</span>
                        </div>
                        <div className={`mt-4 px-6 py-2 rounded-full inline-block text-xs font-black uppercase tracking-widest ${
                          harvestIndex?.status === 'Optimal' ? 'bg-emerald-500 text-white' : 'bg-white/10 text-emerald-400'
                        }`}>
                          {harvestIndex?.status || 'Awaiting Data'}
                        </div>
                      </div>
                      
                      <div className="flex-1 bg-white/5 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/10">
                        <p className="text-xl font-medium leading-relaxed italic text-slate-200">
                          "{harvestIndex?.recommendation || "Go to the 'Sensors' tab to sync your field data for a harvest prediction."}"
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Soil Insights Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                  <i className="fas fa-vial text-emerald-500 mb-4 text-xl"></i>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Soil Type</p>
                  <p className="text-2xl font-black text-slate-900">{selectedField.soil_type}</p>
                </div>
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                  <i className="fas fa-maximize text-emerald-500 mb-4 text-xl"></i>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Land Size</p>
                  <p className="text-2xl font-black text-slate-900">{selectedField.size} ha</p>
                </div>
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                  <i className="fas fa-clock text-emerald-500 mb-4 text-xl"></i>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Last Analysis</p>
                  <p className="text-lg font-black text-slate-900">{new Date().toLocaleDateString()}</p>
                </div>
              </div>

              {/* 3. Crop Recommendations (Original Logic) */}
              {recommendations && (
                <div className="space-y-6">
                  <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                    <i className="fas fa-leaf text-emerald-500"></i> Optimized Crop Choices
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {recommendations.map((crop, idx) => (
                      <div key={idx} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all">
                        <div className="flex justify-between items-start mb-6">
                          <h4 className="text-xl font-black text-slate-900">{crop.crop}</h4>
                          <span className="px-4 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black uppercase">
                            {crop.suitability}% Match
                          </span>
                        </div>
                        <p className="text-slate-500 text-sm leading-relaxed mb-6">{crop.reasoning}</p>
                        <div className="flex flex-wrap gap-2">
                          {crop.tips.map((tip, i) => (
                            <span key={i} className="px-3 py-1 bg-slate-50 text-slate-500 rounded-lg text-[10px] font-bold">
                              # {tip}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 4. Management Tasks (Original Logic) */}
              {managementPlan && (
                <div className="space-y-6">
                  <h3 className="text-2xl font-black text-slate-900">Priority Actions</h3>
                  <div className="space-y-4">
                    {managementPlan.map((task, idx) => (
                      <div key={idx} className="flex gap-6 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm items-center">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl ${
                          task.priority === 'HIGH' ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-500'
                        }`}>
                          <i className={`fas ${task.icon}`}></i>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded ${
                               task.priority === 'HIGH' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                            }`}>{task.priority}</span>
                            <h5 className="font-bold text-slate-900">{task.title}</h5>
                          </div>
                          <p className="text-sm text-slate-500">{task.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="h-96 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                <i className="fas fa-map-location-dot text-slate-300 text-3xl"></i>
              </div>
              <h2 className="text-2xl font-black text-slate-900 mb-2">No Plot Selected</h2>
              <p className="text-slate-400 max-w-xs">Choose a field from the sidebar or register a new one to begin AI analysis.</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Field Modal */}
      {showAddFieldModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] p-12 max-w-md w-full shadow-2xl animate-in zoom-in-95">
            <h2 className="text-3xl font-black text-slate-900 mb-8">Plot Registration</h2>
            <form onSubmit={handleAddField} className="space-y-6">
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Field Name</label>
                <input required type="text" value={newFieldData.name} onChange={e => setNewFieldData({...newFieldData, name: e.target.value})} className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-emerald-500 font-bold" placeholder="e.g. North Paddy Block" />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Location</label>
                <input required type="text" value={newFieldData.location} onChange={e => setNewFieldData({...newFieldData, location: e.target.value})} className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-emerald-500 font-bold" placeholder="e.g. Bogura, Bangladesh" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Size (ha)</label>
                  <input required type="number" step="0.1" value={newFieldData.size} onChange={e => setNewFieldData({...newFieldData, size: e.target.value})} className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-emerald-500 font-bold" />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Soil Type</label>
                  <select value={newFieldData.soilType} onChange={e => setNewFieldData({...newFieldData, soilType: e.target.value})} className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-emerald-500 font-bold">
                    <option value="Loamy">Loamy</option>
                    <option value="Clay">Clay</option>
                    <option value="Sandy">Sandy</option>
                    <option value="Alluvial">Alluvial</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="w-full py-5 bg-emerald-600 text-white rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all mt-4">Register Plot</button>
              <button type="button" onClick={() => setShowAddFieldModal(false)} className="w-full py-2 text-slate-400 font-bold text-xs uppercase hover:text-slate-600 transition-colors">Cancel</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserFields;import React, { useState, useEffect } from 'react';
import { User, Field, CropRecommendation } from '../../types';
import { 
  getCropAnalysis, 
  getSoilHealthSummary, 
  getDetailedManagementPlan, 
  getHarvestIndex,
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
      // Fetch latest sensors (synced from the Sensors page)
      const allSensors = await syncSensorsFromDb([field]);
      const fieldSensors = allSensors.filter(s => s.field_id === field.field_id);
      
      // Aggregate data for the AI
      const sensorMetrics: any = {};
      fieldSensors.forEach(s => {
        if (s.last_reading) {
          const type = s.sensor_type.toLowerCase();
          if (type.includes('moisture')) sensorMetrics.moisture = s.last_reading.value;
          if (type.includes('temp')) sensorMetrics.temperature = s.last_reading.value;
          if (type.includes('ph')) sensorMetrics.ph = s.last_reading.value;
          if (type.includes('npk')) sensorMetrics.npk = s.last_reading.npk;
        }
      });

      // Execute all AI analysis in parallel
      const [hi, crops, soil, plan] = await Promise.all([
        getHarvestIndex(sensorMetrics, field.field_name),
        getCropAnalysis(sensorMetrics),
        getSoilHealthSummary(sensorMetrics),
        getDetailedManagementPlan(sensorMetrics)
      ]);

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
    handleFieldSelect(f);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex flex-col lg:flex-row gap-10">
        
        {/* SIDEBAR: Field Selection */}
        <div className="w-full lg:w-80 flex-shrink-0">
          <div className="sticky top-24 space-y-4">
            <button 
              onClick={() => setShowAddFieldModal(true)}
              className="w-full p-5 bg-slate-900 text-white rounded-[2rem] font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl mb-6"
            >
              + Register New Plot
            </button>
            
            <div className="space-y-3">
              {fields.map(f => (
                <div 
                  key={f.field_id}
                  onClick={() => handleFieldSelect(f)}
                  className={`group p-6 rounded-[2rem] cursor-pointer transition-all border-2 ${
                    selectedField?.field_id === f.field_id 
                    ? 'bg-emerald-50 border-emerald-500 shadow-lg' 
                    : 'bg-white border-slate-100 hover:border-slate-300'
                  }`}
                >
                  <h3 className={`font-black text-lg ${selectedField?.field_id === f.field_id ? 'text-emerald-900' : 'text-slate-900'}`}>
                    {f.field_name}
                  </h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                    <i className="fas fa-location-dot mr-1"></i> {f.location}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* MAIN CONTENT AREA */}
        <div className="flex-1 space-y-8">
          {selectedField ? (
            <>
              {/* 1. PRIMARY FEATURE: Harvest Compatibility Index */}
              <div className="bg-slate-900 rounded-[3.5rem] p-10 lg:p-14 text-white shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-12 opacity-10">
                  <i className="fas fa-wheat-awn text-9xl text-emerald-500"></i>
                </div>
                
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-6">
                    <span className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></span>
                    <p className="text-xs font-black text-emerald-400 uppercase tracking-[0.3em]">AI Harvest Intelligence</p>
                  </div>

                  {loading ? (
                    <div className="flex items-center gap-6 animate-pulse">
                      <div className="h-24 w-40 bg-white/5 rounded-3xl"></div>
                      <div className="space-y-3">
                        <div className="h-4 w-64 bg-white/5 rounded-full"></div>
                        <div className="h-4 w-48 bg-white/5 rounded-full"></div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col md:flex-row items-center gap-12">
                      <div className="text-center md:text-left">
                        <div className="flex items-baseline gap-2">
                          <h2 className="text-9xl font-black">{harvestIndex?.score || 0}</h2>
                          <span className="text-4xl font-bold text-emerald-500">%</span>
                        </div>
                        <div className={`mt-4 px-6 py-2 rounded-full inline-block text-xs font-black uppercase tracking-widest ${
                          harvestIndex?.status === 'Optimal' ? 'bg-emerald-500 text-white' : 'bg-white/10 text-emerald-400'
                        }`}>
                          {harvestIndex?.status || 'Awaiting Data'}
                        </div>
                      </div>
                      
                      <div className="flex-1 bg-white/5 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/10">
                        <p className="text-xl font-medium leading-relaxed italic text-slate-200">
                          "{harvestIndex?.recommendation || "Go to the 'Sensors' tab to sync your field data for a harvest prediction."}"
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Soil Insights Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                  <i className="fas fa-vial text-emerald-500 mb-4 text-xl"></i>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Soil Type</p>
                  <p className="text-2xl font-black text-slate-900">{selectedField.soil_type}</p>
                </div>
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                  <i className="fas fa-maximize text-emerald-500 mb-4 text-xl"></i>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Land Size</p>
                  <p className="text-2xl font-black text-slate-900">{selectedField.size} ha</p>
                </div>
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                  <i className="fas fa-clock text-emerald-500 mb-4 text-xl"></i>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Last Analysis</p>
                  <p className="text-lg font-black text-slate-900">{new Date().toLocaleDateString()}</p>
                </div>
              </div>

              {/* 3. Crop Recommendations (Original Logic) */}
              {recommendations && (
                <div className="space-y-6">
                  <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                    <i className="fas fa-leaf text-emerald-500"></i> Optimized Crop Choices
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {recommendations.map((crop, idx) => (
                      <div key={idx} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all">
                        <div className="flex justify-between items-start mb-6">
                          <h4 className="text-xl font-black text-slate-900">{crop.crop}</h4>
                          <span className="px-4 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black uppercase">
                            {crop.suitability}% Match
                          </span>
                        </div>
                        <p className="text-slate-500 text-sm leading-relaxed mb-6">{crop.reasoning}</p>
                        <div className="flex flex-wrap gap-2">
                          {crop.tips.map((tip, i) => (
                            <span key={i} className="px-3 py-1 bg-slate-50 text-slate-500 rounded-lg text-[10px] font-bold">
                              # {tip}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 4. Management Tasks (Original Logic) */}
              {managementPlan && (
                <div className="space-y-6">
                  <h3 className="text-2xl font-black text-slate-900">Priority Actions</h3>
                  <div className="space-y-4">
                    {managementPlan.map((task, idx) => (
                      <div key={idx} className="flex gap-6 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm items-center">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl ${
                          task.priority === 'HIGH' ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-500'
                        }`}>
                          <i className={`fas ${task.icon}`}></i>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded ${
                               task.priority === 'HIGH' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                            }`}>{task.priority}</span>
                            <h5 className="font-bold text-slate-900">{task.title}</h5>
                          </div>
                          <p className="text-sm text-slate-500">{task.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="h-96 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                <i className="fas fa-map-location-dot text-slate-300 text-3xl"></i>
              </div>
              <h2 className="text-2xl font-black text-slate-900 mb-2">No Plot Selected</h2>
              <p className="text-slate-400 max-w-xs">Choose a field from the sidebar or register a new one to begin AI analysis.</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Field Modal */}
      {showAddFieldModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] p-12 max-w-md w-full shadow-2xl animate-in zoom-in-95">
            <h2 className="text-3xl font-black text-slate-900 mb-8">Plot Registration</h2>
            <form onSubmit={handleAddField} className="space-y-6">
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Field Name</label>
                <input required type="text" value={newFieldData.name} onChange={e => setNewFieldData({...newFieldData, name: e.target.value})} className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-emerald-500 font-bold" placeholder="e.g. North Paddy Block" />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Location</label>
                <input required type="text" value={newFieldData.location} onChange={e => setNewFieldData({...newFieldData, location: e.target.value})} className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-emerald-500 font-bold" placeholder="e.g. Bogura, Bangladesh" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Size (ha)</label>
                  <input required type="number" step="0.1" value={newFieldData.size} onChange={e => setNewFieldData({...newFieldData, size: e.target.value})} className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-emerald-500 font-bold" />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Soil Type</label>
                  <select value={newFieldData.soilType} onChange={e => setNewFieldData({...newFieldData, soilType: e.target.value})} className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-emerald-500 font-bold">
                    <option value="Loamy">Loamy</option>
                    <option value="Clay">Clay</option>
                    <option value="Sandy">Sandy</option>
                    <option value="Alluvial">Alluvial</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="w-full py-5 bg-emerald-600 text-white rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all mt-4">Register Plot</button>
              <button type="button" onClick={() => setShowAddFieldModal(false)} className="w-full py-2 text-slate-400 font-bold text-xs uppercase hover:text-slate-600 transition-colors">Cancel</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserFields;
