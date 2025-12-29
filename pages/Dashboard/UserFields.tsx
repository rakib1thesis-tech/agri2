
import React, { useState, useEffect } from 'react';
import { User, Field, SensorData, CropRecommendation } from '../../types';
import { MOCK_FIELDS, generateMockSensorData } from '../../constants';
import { getCropAnalysis } from '../../services/gemini';

const UserFields: React.FC<{ user: User }> = ({ user }) => {
  const [fields, setFields] = useState<Field[]>(MOCK_FIELDS);
  const [selectedField, setSelectedField] = useState<Field | null>(null);
  const [recommendations, setRecommendations] = useState<CropRecommendation[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Manual Data Upload State
  const [formData, setFormData] = useState({
    temp: '',
    moisture: '',
    ph: '',
    npk_n: '',
    npk_p: '',
    npk_k: '',
  });

  const handleFieldSelect = async (field: Field) => {
    setSelectedField(field);
    setLoading(true);
    setRecommendations(null);
    
    // Simulate getting latest data and calling Gemini
    const latest = generateMockSensorData(field.field_id)[6];
    const analysis = await getCropAnalysis(field, latest);
    
    setRecommendations(analysis);
    setLoading(false);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert("Data uploaded successfully! Analysis will refresh in a few moments.");
    setShowForm(false);
  };

  const handleExportCSV = () => {
    if (!selectedField) return;

    // Generate historical data (last 7 days) for the selected field
    const historicalData = generateMockSensorData(selectedField.field_id);
    
    // CSV Header
    const headers = ['Timestamp', 'Temperature (°C)', 'Moisture (%)', 'pH Level', 'Conductivity (µs/cm)', 'Nitrogen (N)', 'Phosphorus (P)', 'Potassium (K)'];
    
    // Format rows
    const rows = historicalData.map(row => [
      row.timestamp,
      row.temperature.toFixed(2),
      row.moisture.toFixed(2),
      row.ph_level.toFixed(2),
      row.conductivity.toFixed(0),
      row.npk_n,
      row.npk_p,
      row.npk_k
    ]);

    // Construct CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(e => e.join(','))
    ].join('\n');

    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `agricare_export_${selectedField.field_name.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-slate-900">My Fields</h1>
        <div className="flex gap-4">
          {selectedField && (
            <button 
              onClick={handleExportCSV}
              className="bg-white text-emerald-600 border border-emerald-100 px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-emerald-50 transition-colors shadow-sm"
            >
              <i className="fas fa-file-csv"></i> Export Field Data
            </button>
          )}
          {user.subscriptionPlan === 'basic' && (
            <button 
              onClick={() => setShowForm(!showForm)}
              className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-emerald-700 transition-colors shadow-md"
            >
              <i className="fas fa-plus"></i> Manual Data Upload
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <div className="mb-8 bg-white p-6 rounded-2xl shadow-md border border-emerald-100 animate-in fade-in slide-in-from-top-4">
          <h3 className="font-bold text-lg mb-4">Manual Sensor Input</h3>
          <form onSubmit={handleFormSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Temperature (°C)</label>
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
              <label className="block text-sm font-medium text-slate-700 mb-1">Nitrogen (N)</label>
              <input type="number" required className="w-full px-4 py-2 border rounded-lg" value={formData.npk_n} onChange={e => setFormData({...formData, npk_n: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phosphorus (P)</label>
              <input type="number" required className="w-full px-4 py-2 border rounded-lg" value={formData.npk_p} onChange={e => setFormData({...formData, npk_p: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Potassium (K)</label>
              <input type="number" required className="w-full px-4 py-2 border rounded-lg" value={formData.npk_k} onChange={e => setFormData({...formData, npk_k: e.target.value})} />
            </div>
            <div className="md:col-span-3">
              <button type="submit" className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all">Submit Data for Analysis</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-4">
          {fields.map(f => (
            <button
              key={f.field_id}
              onClick={() => handleFieldSelect(f)}
              className={`w-full text-left p-6 rounded-2xl border transition-all ${
                selectedField?.field_id === f.field_id 
                  ? 'border-emerald-500 bg-emerald-50 shadow-md ring-1 ring-emerald-500' 
                  : 'border-slate-100 bg-white shadow-sm hover:border-emerald-300'
              }`}
            >
              <div className="font-bold text-slate-900">{f.field_name}</div>
              <div className="text-sm text-slate-500 mt-1">{f.location}</div>
              <div className="mt-4 flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded text-slate-600">{f.soil_type}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded text-slate-600">{f.size} acres</span>
              </div>
            </button>
          ))}
        </div>

        <div className="lg:col-span-3">
          {!selectedField ? (
            <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-20 text-center">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <i className="fas fa-map-marked-alt text-3xl text-slate-300"></i>
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">Select a field to view analysis</h2>
              <p className="text-slate-500">Choose one of your registered fields from the left to see sensor data and crop recommendations.</p>
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
              {/* Analysis Header */}
              <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-1">{selectedField.field_name} Analysis</h2>
                    <p className="text-slate-500 text-sm">Real-time Soil & Crop Assessment</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="p-2 text-slate-400 hover:text-emerald-500"><i className="fas fa-edit"></i></button>
                    <button className="p-2 text-slate-400 hover:text-red-500"><i className="fas fa-trash"></i></button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  {[
                    { label: 'Soil Type', value: selectedField.soil_type, icon: 'fa-layer-group' },
                    { label: 'Nutrient Status', value: 'Moderate', icon: 'fa-seedling' },
                    { label: 'Last Activity', value: '15m ago', icon: 'fa-clock' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400">
                        <i className={`fas ${item.icon}`}></i>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{item.label}</div>
                        <div className="text-sm font-bold text-slate-800">{item.value}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Crop Recommendations */}
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <i className="fas fa-robot text-emerald-500"></i>
                    AI-Powered Crop Recommendations
                  </h3>
                  {loading && <div className="text-sm text-emerald-600 flex items-center gap-2 font-medium">
                    <i className="fas fa-circle-notch fa-spin"></i> Analyzing with Gemini AI...
                  </div>}
                </div>

                {recommendations ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {recommendations.map((crop, i) => (
                      <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-4">
                          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                            <i className={`fas ${crop.icon} text-xl`}></i>
                          </div>
                          <div className="text-sm font-bold text-emerald-600">{crop.suitability}% Match</div>
                        </div>
                        <h4 className="text-lg font-bold text-slate-900 mb-1">{crop.name}</h4>
                        <div className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-4">Estimated Yield: {crop.yield}</div>
                        <p className="text-sm text-slate-600 leading-relaxed">{crop.requirements}</p>
                      </div>
                    ))}
                  </div>
                ) : !loading && (
                  <div className="p-12 text-center bg-slate-50 rounded-2xl border border-slate-200">
                    <p className="text-slate-400">Analysis results will appear here.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserFields;
