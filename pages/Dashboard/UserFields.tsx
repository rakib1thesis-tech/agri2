
import React, { useState, useEffect } from 'react';
import { User, Field, SensorData, CropRecommendation, Sensor } from '../../types';
import { 
  getCropAnalysis, 
  getSoilHealthSummary, 
  getDetailedManagementPlan, 
  isAiReady
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
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [managementPlan, setManagementPlan] = useState<ManagementTask[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiConnected, setAiConnected] = useState(false);
  
  const [currentDataState, setCurrentDataState] = useState<any>(null);

  const [showAddFieldModal, setShowAddFieldModal] = useState(false);
  const [newFieldData, setNewFieldData] = useState({
    name: '',
    location: '',
    size: '',
    soilType: 'Loamy'
  });

  useEffect(() => {
    const checkAiStatus = async () => {
      const ready = await isAiReady();
      setAiConnected(ready);
    };
    const loadFields = async () => {
      const dbFields = await syncFields(user.id);
      setFields(dbFields);
    };
    checkAiStatus();
    loadFields();
  }, [user.id]);

  const getFieldCurrentStats = async (field: Field): Promise<any> => {
    try {
      const fieldSensors = await syncSensorsFromDb([field]);
      const stats: any = {
        temperature: null,
        moisture: null,
        ph_level: null,
        npk_n: null,
        npk_p: null,
        npk_k: null
      };

      fieldSensors.forEach(s => {
        if (!s.last_reading) return;
        const type = s.sensor_type.toLowerCase();
        if (type.includes('moisture')) stats.moisture = s.last_reading.value ?? null;
        if (type.includes('temperature')) stats.temperature = s.last_reading.value ?? null;
        if (type.includes('ph') || type.includes('probe')) stats.ph_level = s.last_reading.value ?? null;
        if (type.includes('npk')) {
          stats.npk_n = s.last_reading.n ?? null;
          stats.npk_p = s.last_reading.p ?? null;
          stats.npk_k = s.last_reading.k ?? null;
        }
      });
      return stats;
    } catch (e) {
      console.error("Error fetching field stats:", e);
      return {};
    }
  };

  const handleFieldSelect = async (field: Field) => {
    setSelectedField(field);
    setLoading(true);
    setRecommendations(null);
    setAiSummary(null);
    setManagementPlan(null);
    setCurrentDataState(null);
    
    try {
      const latest = await getFieldCurrentStats(field);
      setCurrentDataState(latest);

      const [analysis, summary, plan] = await Promise.all([
        getCropAnalysis(field, latest),
        getSoilHealthSummary(field, latest),
        getDetailedManagementPlan(field, latest)
      ]);
      
      setRecommendations(analysis);
      setAiSummary(summary);
      setManagementPlan(plan);
      
      const ready = await isAiReady();
      setAiConnected(ready);
    } catch (err: any) {
      console.error("AI Analysis failed", err);
      setAiSummary("Internal telemetry error. Ensure API_KEY is correctly mapped in the cloud build environment.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddField = async (e: React.FormEvent) => {
    e.preventDefault();
    const newField: Field = {
      field_id: Math.floor(Math.random() * 100000),
      user_id: user.id,
      field_name: newFieldData.name,
      location: newFieldData.location,
      size: parseFloat(newFieldData.size) || 0,
      soil_type: newFieldData.soilType
    };
    
    await addFieldToDb(newField);
    setFields([...fields, newField]);
    setShowAddFieldModal(false);
    setNewFieldData({ name: '', location: '', size: '', soilType: 'Loamy' });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative min-h-[80vh]">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Field Command Center</h1>
          <p className="text-slate-500 text-sm">Automated AI health diagnostics powered by central API telemetry.</p>
        </div>
        <button onClick={() => setShowAddFieldModal(true)} className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-emerald-700 shadow-md transition-all active:scale-95">
          <i className="fas fa-plus"></i> Add New Field
        </button>
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
              <h2 className="text-2xl font-bold text-slate-800">Select a Plot</h2>
              <p className="text-slate-500 mt-2 max-w-sm mx-auto">Select a field to run diagnostics.</p>
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
              <div className="bg-slate-900 p-10 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500 opacity-5 rounded-full translate-x-20 -translate-y-20"></div>
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-8 h-8 ${aiConnected ? 'bg-emerald-500' : 'bg-red-500'} rounded-lg flex items-center justify-center transition-colors shadow-lg`}>
                        <i className="fas fa-robot text-sm"></i>
                      </div>
                      <span className={`text-xs font-bold uppercase tracking-widest ${aiConnected ? 'text-emerald-400' : 'text-red-400'}`}>
                        {aiConnected ? 'AI Central Node Active' : 'AI Offline (Setup Missing)'}
                      </span>
                    </div>
                    <h2 className="text-4xl font-black">{selectedField.field_name}</h2>
                    <p className="text-slate-400 mt-1">{selectedField.location} • {selectedField.size} Hectares</p>
                  </div>
                  
                  <div className="bg-white/10 backdrop-blur-md p-6 rounded-3xl flex flex-wrap gap-6 text-[11px] font-bold uppercase tracking-wider border border-white/5">
                    <div className={`flex items-center gap-2 ${(currentDataState?.moisture != null) ? 'text-emerald-400' : 'text-slate-500 opacity-50'}`}>
                      <i className={`fas ${(currentDataState?.moisture != null) ? 'fa-check-circle' : 'fa-circle-xmark'}`}></i>
                      <span>Moisture {(currentDataState?.moisture != null) ? `(${currentDataState.moisture}%)` : 'Missing'}</span>
                    </div>
                    <div className={`flex items-center gap-2 ${(currentDataState?.ph_level != null) ? 'text-emerald-400' : 'text-slate-500 opacity-50'}`}>
                      <i className={`fas ${(currentDataState?.ph_level != null) ? 'fa-check-circle' : 'fa-circle-xmark'}`}></i>
                      <span>pH {(currentDataState?.ph_level != null) ? `(${currentDataState.ph_level})` : 'Missing'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="bg-white p-24 text-center rounded-[3rem] border border-slate-100 shadow-sm">
                  <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-8"></div>
                  <h3 className="text-2xl font-bold text-slate-800">Connecting to Cloud AI...</h3>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-12">
                  <div className="lg:col-span-2 space-y-8">
                    <div className="bg-white p-10 rounded-[2.5rem] border border-emerald-100 shadow-sm relative overflow-hidden min-h-[200px]">
                      <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-3"><i className="fas fa-stethoscope text-emerald-600"></i> AI Soil Health Condition</h3>
                      <div className={`p-6 rounded-2xl ${aiSummary?.includes('[SETUP REQUIRED]') ? 'bg-red-50 text-red-700 border border-red-100' : 'text-slate-600'}`}>
                        <p className="leading-relaxed whitespace-pre-line text-lg font-medium">
                          {aiSummary}
                        </p>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-xl font-bold text-slate-900 mb-6 px-2 flex items-center gap-3">
                        <i className="fas fa-seedling text-emerald-600"></i> Optimized Crop Recommendations
                      </h3>
                      {recommendations && recommendations.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {recommendations.map((crop, i) => (
                            <div key={i} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all">
                              <h4 className="text-xl font-bold text-slate-900 mb-1">{crop.name}</h4>
                              <p className="text-sm text-slate-600 border-t pt-4">{crop.requirements}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="bg-slate-50 p-12 rounded-[2.5rem] border border-dashed text-center text-slate-400 font-bold">
                          Awaiting Cloud AI Activation
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="lg:col-span-1">
                    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm h-full">
                      <h3 className="text-xl font-bold text-slate-900 mb-8 flex items-center gap-3"><i className="fas fa-road text-emerald-600"></i> Health Roadmap</h3>
                      <div className="space-y-8">
                        {managementPlan && managementPlan.length > 0 ? (
                          managementPlan.map((task, i) => (
                            <div key={i} className="relative pl-8 group">
                              <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-100 rounded-full group-hover:bg-emerald-200"></div>
                              <h4 className="font-bold text-slate-900 text-base mb-2">{task.title}</h4>
                              <p className="text-sm text-slate-500 leading-relaxed">{task.description}</p>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-12 text-slate-300 font-bold">
                            Setup Required
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserFields;
