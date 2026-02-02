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
      if (userFields.length > 0) handleFieldSelect(userFields[0]);
    };
    init();
  }, [user.id]);

  const handleFieldSelect = async (field: Field) => {
    setSelectedField(field);
    setLoading(true);
    
    // FETCH DATA FROM SENSORS PAGE
    const allSensors = await syncSensorsFromDb([field]);
    const fieldSensors = allSensors.filter(s => s.field_id === field.field_id);
    
    const metrics: any = {};
    fieldSensors.forEach(s => {
      if (s.last_reading) {
        const type = s.sensor_type.toLowerCase();
        if (type.includes('moisture')) metrics.moisture = s.last_reading.value;
        if (type.includes('npk')) metrics.npk = s.last_reading.npk;
        if (type.includes('ph')) metrics.ph = s.last_reading.value;
      }
    });

    const [hi, crops, soil, plan] = await Promise.all([
      getHarvestIndex(metrics, field.field_name),
      getCropAnalysis(metrics),
      getSoilHealthSummary(metrics),
      getDetailedManagementPlan(metrics)
    ]);

    setHarvestIndex(hi);
    setRecommendations(crops);
    setSoilInsight(soil);
    setManagementPlan(plan);
    setLoading(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex flex-col lg:flex-row gap-10">
        {/* Sidebar Field List */}
        <div className="w-full lg:w-80 space-y-4">
          <button onClick={() => setShowAddFieldModal(true)} className="w-full p-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all">
            + Register New Plot
          </button>
          {fields.map(f => (
            <div key={f.field_id} onClick={() => handleFieldSelect(f)} className={`p-6 rounded-[2rem] cursor-pointer border-2 transition-all ${selectedField?.field_id === f.field_id ? 'border-emerald-500 bg-emerald-50' : 'border-slate-100 bg-white hover:border-emerald-200'}`}>
              <h3 className="font-black text-slate-900">{f.field_name}</h3>
              <p className="text-xs text-slate-400 font-bold uppercase">{f.location}</p>
            </div>
          ))}
        </div>

        <div className="flex-1">
          {loading ? (
            <div className="h-96 flex items-center justify-center bg-slate-50 rounded-[3rem] animate-pulse">
              <p className="font-bold text-slate-400">AI ANALYZING FIELD DATA...</p>
            </div>
          ) : selectedField && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
              {/* Harvest Compatibility Card */}
              <div className="bg-slate-900 rounded-[3.5rem] p-10 text-white shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full -translate-y-20 translate-x-20"></div>
                <p className="text-xs font-black text-emerald-400 uppercase tracking-widest mb-4">Harvest Compatibility Index</p>
                <div className="flex flex-col md:flex-row items-center gap-10">
                  <div className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-500">
                    {harvestIndex?.score || 0}%
                  </div>
                  <div>
                    <div className={`inline-block px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter mb-3 ${harvestIndex?.status === 'Optimal' ? 'bg-emerald-500' : 'bg-orange-500'}`}>
                      {harvestIndex?.status} Window
                    </div>
                    <p className="text-xl italic text-slate-300 font-medium">"{harvestIndex?.recommendation}"</p>
                  </div>
                </div>
              </div>

              {/* Management Tasks */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {managementPlan?.map((task, idx) => (
                  <div key={idx} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                    <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mb-6">
                      <i className={`fas ${task.icon} text-emerald-600`}></i>
                    </div>
                    <div className="text-[10px] font-black text-orange-500 uppercase mb-2">{task.priority} PRIORITY</div>
                    <h4 className="font-bold text-slate-900 mb-2">{task.title}</h4>
                    <p className="text-sm text-slate-500 leading-relaxed">{task.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserFields;
