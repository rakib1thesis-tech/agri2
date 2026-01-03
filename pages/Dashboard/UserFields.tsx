
import React, { useState, useEffect } from 'react';
import { User, Field, SensorData, CropRecommendation, Sensor } from '../../types';
import { generateMockSensorData } from '../../constants';
import { getCropAnalysis, getSoilHealthSummary, getDetailedManagementPlan, checkAIConnection } from '../../services/gemini';
import { syncFields, syncSensorsFromDb } from '../../services/db';

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
  const [aiConnected, setAiConnected] = useState(true);
  
  const [showAddFieldModal, setShowAddFieldModal] = useState(false);
  const [newFieldData, setNewFieldData] = useState({
    name: '',
    location: '',
    size: '',
    soilType: 'Loamy'
  });

  useEffect(() => {
    setAiConnected(checkAIConnection());
    const loadData = async () => {
      const dbFields = await syncFields(user.id);
      setFields(dbFields);
    };
    loadData();
  }, [user.id]);

  /**
   * Aggregates the most accurate data for a field by merging:
   * 1. Manual Diagnostic Overrides (Local Storage)
   * 2. Live Sensor Data (Firestore)
   * 3. Mock Data (Fallback)
   */
  const getFieldCurrentStats = async (field: Field): Promise<SensorData> => {
    // 1. Get Live Sensors from DB
    const fieldSensors = await syncSensorsFromDb([field]);
    
    // 2. Get Manual Diagnostics
    const savedManual = localStorage.getItem('agricare_manual_diagnostics');
    const manualDiags = savedManual ? JSON.parse(savedManual) : {};
    const fieldManual = manualDiags[field.field_id];

    // 3. Start with Mock Base
    const mock = generateMockSensorData(field.field_id)[6];
    const stats: SensorData = { ...mock };

    // 4. Layer Sensor Data (Priority 2)
    if (fieldSensors.length > 0) {
      fieldSensors.forEach(s => {
        if (!s.last_reading) return;
        if (s.sensor_type === 'Moisture') stats.moisture = s.last_reading.value ?? stats.moisture;
        if (s.sensor_type === 'Temperature') stats.temperature = s.last_reading.value ?? stats.temperature;
        if (s.sensor_type === 'PH Probe') stats.ph_level = s.last_reading.value ?? stats.ph_level;
        if (s.sensor_type === 'NPK Analyzer') {
          stats.npk_n = s.last_reading.n ?? stats.npk_n;
          stats.npk_p = s.last_reading.p ?? stats.npk_p;
          stats.npk_k = s.last_reading.k ?? stats.npk_k;
        }
      });
    }

    // 5. Layer Manual Data (Priority 1 - Highest Override)
    if (fieldManual) {
      if (fieldManual.moisture !== undefined) stats.moisture = fieldManual.moisture;
      if (fieldManual.temp !== undefined) stats.temperature = fieldManual.temp;
      if (fieldManual.ph !== undefined) stats.ph_level = fieldManual.ph;
      if (fieldManual.n !== undefined) stats.npk_n = fieldManual.n;
      if (fieldManual.p !== undefined) stats.npk_p = fieldManual.p;
      if (fieldManual.k !== undefined) stats.npk_k = fieldManual.k;
    }

    return stats;
  };

  const handleFieldSelect = async (field: Field) => {
    setSelectedField(field);
    setLoading(true);
    setRecommendations(null);
    setAiSummary(null);
    setManagementPlan(null);
    
    const latest = await getFieldCurrentStats(field);
    
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
    // In a real scenario, this would call addFieldToDb
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

  const handleExportCSV = async () => {
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
                        {aiConnected ? 'AI Analysis Active' : 'AI Analysis Offline'}
                      </span>
                    </div>
                    <h2 className="text-4xl font-black">{selectedField.field_name}</h2>
                    <p className="text-slate-400 mt-1">{selectedField.location} • {selectedField.size} Hectares</p>
                  </div>
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
                      <p className="text-slate-600 leading-relaxed whitespace-pre-line text-lg font-medium">{aiSummary || "Analysing soil markers..."}</p>
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
                      <h3 className="text-xl font-bold text-slate-900 mb-8 flex items-center gap-3"><i className="fas fa-list-check text-emerald-600"></i> Localized Roadmap</h3>
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

      {/* Add Field Modal */}
      {showAddFieldModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl animate-in zoom-in duration-200">
            <h2 className="text-2xl font-bold mb-6">Register New Field</h2>
            <form onSubmit={handleAddField} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1">Field Name</label>
                <input required type="text" value={newFieldData.name} onChange={e => setNewFieldData({...newFieldData, name: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500" placeholder="e.g. South Paddy Field" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1">District / Location</label>
                <input required type="text" value={newFieldData.location} onChange={e => setNewFieldData({...newFieldData, location: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500" placeholder="e.g. Bogura, Bangladesh" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1">Size (ha)</label>
                  <input required type="number" step="0.1" value={newFieldData.size} onChange={e => setNewFieldData({...newFieldData, size: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500" placeholder="5.2" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1">Soil Type</label>
                  <select value={newFieldData.soilType} onChange={e => setNewFieldData({...newFieldData, soilType: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500">
                    <option value="Loamy">Loamy</option>
                    <option value="Clay">Clay</option>
                    <option value="Sandy">Sandy</option>
                    <option value="Alluvial">Alluvial</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAddFieldModal(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-xl font-bold transition-colors">Cancel</button>
                <button type="submit" className="flex-1 py-4 bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-200 transition-all hover:bg-emerald-700">Create Field</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserFields;
