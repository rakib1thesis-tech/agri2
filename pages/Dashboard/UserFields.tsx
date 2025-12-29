
import React, { useState, useEffect } from 'react';
import { User, Field, SensorData, CropRecommendation } from '../../types';
import { MOCK_FIELDS, generateMockSensorData } from '../../constants';
import { getCropAnalysis, getSoilHealthSummary } from '../../services/gemini';

const UserFields: React.FC<{ user: User }> = ({ user }) => {
  const [fields, setFields] = useState<Field[]>(() => {
    const saved = localStorage.getItem('agricare_fields');
    return saved ? JSON.parse(saved) : MOCK_FIELDS;
  });
  
  const [selectedField, setSelectedField] = useState<Field | null>(null);
  const [recommendations, setRecommendations] = useState<CropRecommendation[] | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  
  const [formData, setFormData] = useState({ temp: '', moisture: '', ph: '', npk_n: '', npk_p: '', npk_k: '' });
  const [editFormData, setEditFormData] = useState<Field | null>(null);

  useEffect(() => {
    localStorage.setItem('agricare_fields', JSON.stringify(fields));
  }, [fields]);

  const handleFieldSelect = async (field: Field) => {
    setSelectedField(field);
    setLoading(true);
    setRecommendations(null);
    setAiSummary(null);
    
    const latest = generateMockSensorData(field.field_id)[6];
    
    // Parallel fetch for speed
    const [analysis, summary] = await Promise.all([
      getCropAnalysis(field, latest),
      getSoilHealthSummary(field, latest)
    ]);
    
    setRecommendations(analysis);
    setAiSummary(summary);
    setLoading(false);
  };

  const handleDeleteField = (id: number) => {
    if (window.confirm("Are you sure you want to delete this field?")) {
      const updated = fields.filter(f => f.field_id !== id);
      setFields(updated);
      if (selectedField?.field_id === id) setSelectedField(null);
    }
  };

  const handleEditClick = (field: Field) => {
    setEditFormData({ ...field });
    setShowEditModal(true);
  };

  const handleUpdateField = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFormData) return;
    const updated = fields.map(f => f.field_id === editFormData.field_id ? editFormData : f);
    setFields(updated);
    if (selectedField?.field_id === editFormData.field_id) setSelectedField(editFormData);
    setShowEditModal(false);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert("Data uploaded successfully! Only Temperature, pH, Moisture, and NPK markers are processed.");
    setShowForm(false);
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Fields</h1>
          <p className="text-slate-500 text-sm">Select a field to get AI-driven insights.</p>
        </div>
        <div className="flex gap-4">
          {selectedField && (
            <button onClick={handleExportCSV} className="bg-white text-emerald-600 border border-emerald-100 px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-emerald-50 transition-colors shadow-sm">
              <i className="fas fa-file-csv"></i> Export Data
            </button>
          )}
          <button onClick={() => setShowForm(!showForm)} className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-emerald-700 transition-colors shadow-md">
            <i className="fas fa-plus"></i> Manual Data Upload
          </button>
        </div>
      </div>

      {showForm && (
        <div className="mb-8 bg-white p-6 rounded-2xl shadow-md border border-emerald-100 animate-in fade-in slide-in-from-top-4">
          <h3 className="font-bold text-lg mb-4">Manual Sensor Input (4 Core Markers)</h3>
          <form onSubmit={handleFormSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Temp (°C)</label>
              <input type="number" step="0.1" required className="w-full px-4 py-2 border rounded-lg" value={formData.temp} onChange={e => setFormData({...formData, temp: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Moisture (%)</label>
              <input type="number" step="0.1" required className="w-full px-4 py-2 border rounded-lg" value={formData.moisture} onChange={e => setFormData({...formData, moisture: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">pH Level</label>
              <input type="number" step="0.1" required className="w-full px-4 py-2 border rounded-lg" value={formData.ph} onChange={e => setFormData({...formData, ph: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">NPK - Nitrogen (ppm)</label>
              <input type="number" required className="w-full px-4 py-2 border rounded-lg" value={formData.npk_n} onChange={e => setFormData({...formData, npk_n: e.target.value})} />
            </div>
            <div className="md:col-span-4">
              <button type="submit" className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all">Submit Analysis Data</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-4">
          {fields.map(f => (
            <div 
              key={f.field_id}
              onClick={() => handleFieldSelect(f)}
              className={`relative cursor-pointer w-full text-left p-6 rounded-2xl border transition-all ${
                selectedField?.field_id === f.field_id 
                  ? 'border-emerald-500 bg-emerald-50 shadow-md ring-1 ring-emerald-500' 
                  : 'border-slate-100 bg-white shadow-sm hover:border-emerald-300'
              }`}
            >
              <div className="font-bold text-slate-900 pr-12">{f.field_name}</div>
              <div className="text-sm text-slate-500 mt-1">{f.location}</div>
              <div className="mt-4 flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded text-slate-600">{f.soil_type}</span>
              </div>
              <div className="absolute top-4 right-4 flex flex-col gap-2">
                <button onClick={(e) => { e.stopPropagation(); handleEditClick(f); }} className="w-8 h-8 rounded-lg bg-slate-100 text-slate-400 hover:bg-emerald-100 hover:text-emerald-600 flex items-center justify-center transition-colors"><i className="fas fa-edit text-xs"></i></button>
              </div>
            </div>
          ))}
        </div>

        <div className="lg:col-span-3">
          {!selectedField ? (
            <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-20 text-center">
              <i className="fas fa-robot text-3xl text-slate-300 mb-6"></i>
              <h2 className="text-xl font-bold text-slate-800">Select a field to initiate AI Farm Advisor</h2>
              <p className="text-slate-500 mt-2">Get personalized soil health analysis and crop recommendations.</p>
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
              {/* Header Card */}
              <div className="bg-gradient-to-br from-slate-900 to-emerald-950 p-8 rounded-[2rem] text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500 opacity-5 rounded-full translate-x-20 -translate-y-20"></div>
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                      <i className="fas fa-robot text-sm"></i>
                    </div>
                    <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">AI Farm Advisor Active</span>
                  </div>
                  <h2 className="text-3xl font-black">{selectedField.field_name}</h2>
                  <p className="text-slate-400 mt-1">{selectedField.location} • Monitoring 4 Core Markers</p>
                </div>
              </div>

              {loading ? (
                <div className="p-20 text-center">
                  <div className="inline-block w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-6"></div>
                  <h3 className="text-xl font-bold text-slate-700">Analyzing Field Dynamics...</h3>
                  <p className="text-slate-500">Correlating Temperature, pH, Moisture, and NPK data.</p>
                </div>
              ) : (
                <>
                  {/* AI Summary Section */}
                  {aiSummary && (
                    <div className="bg-white p-8 rounded-3xl border border-emerald-100 shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4">
                         <i className="fas fa-sparkles text-emerald-200 text-4xl"></i>
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <i className="fas fa-comment-dots text-emerald-600"></i> AI Soil Health Insight
                      </h3>
                      <div className="prose prose-emerald max-w-none text-slate-600 leading-relaxed whitespace-pre-line">
                        {aiSummary}
                      </div>
                    </div>
                  )}

                  {/* Recommendations Grid */}
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2 px-2">
                      <i className="fas fa-seedling text-emerald-600"></i> AI-Recommended Crops
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {recommendations?.map((crop, i) => (
                        <div key={i} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-shadow group">
                          <div className="flex justify-between items-start mb-4">
                            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all">
                              <i className={`fas ${crop.icon} text-xl`}></i>
                            </div>
                            <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-1 rounded-full">{crop.suitability}% Match</span>
                          </div>
                          <h4 className="text-lg font-bold text-slate-900">{crop.name}</h4>
                          <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-50 rounded text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            <i className="fas fa-chart-line text-[8px]"></i> Yield: {crop.yield}
                          </div>
                          <p className="text-sm text-slate-600 mt-4 leading-relaxed">{crop.requirements}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {showEditModal && editFormData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg p-8 shadow-2xl animate-in zoom-in duration-200">
            <h2 className="text-2xl font-bold mb-6">Edit Field Details</h2>
            <form onSubmit={handleUpdateField} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Field Name</label>
                <input type="text" required className="w-full px-4 py-2 border rounded-xl" value={editFormData.field_name} onChange={e => setEditFormData({...editFormData, field_name: e.target.value})} />
              </div>
              <div className="flex gap-3 pt-6">
                <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 py-3 rounded-xl font-bold text-slate-500 bg-slate-100">Cancel</button>
                <button type="submit" className="flex-1 py-3 rounded-xl font-bold text-white bg-emerald-600">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserFields;
