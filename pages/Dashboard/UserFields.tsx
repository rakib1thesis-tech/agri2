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
import { syncFields, syncSensorsFromDb } from '../../services/db';

const UserFields: React.FC<{ user: User }> = ({ user }) => {
  const [fields, setFields] = useState<Field[]>([]);
  const [selectedField, setSelectedField] = useState<Field | null>(null);
  const [harvestIndex, setHarvestIndex] = useState<HarvestIndex | null>(null);
  const [recommendations, setRecommendations] = useState<CropRecommendation[] | null>(null);
  const [soilInsight, setSoilInsight] = useState<SoilInsight | null>(null);
  const [managementPlan, setManagementPlan] = useState<any[] | null>(null);
  const [sensorValues, setSensorValues] = useState<any>({ moisture: null, ph: null, temp: null, n: null, p: null, k: null });
  const [loading, setLoading] = useState(false);

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
        const allSensors = await syncSensorsFromDb([field]);
        const fieldSensors = allSensors.filter(s => s.field_id === field.field_id);
        
        // FUZZY MATCHING: Finds sensor regardless of exact name (e.g., "pH Level" or "Soil pH")
        const findS = (key: string) => fieldSensors.find(s => s.sensor_type.toLowerCase().includes(key));

        const npkSensor = findS('npk');
        const metrics = {
            moisture: findS('moisture')?.last_reading?.value || null,
            ph: findS('ph')?.last_reading?.value || null,
            temp: (findS('temp') || findS('temperature'))?.last_reading?.value || null,
            n: npkSensor?.last_reading?.npk?.n || null,
            p: npkSensor?.last_reading?.npk?.p || null,
            k: npkSensor?.last_reading?.npk?.k || null
        };

        setSensorValues(metrics);

        const [hi, crops, soil, plan] = await Promise.all([
            getHarvestCompatibility(metrics, field.field_name),
            getCropAnalysis(metrics),
            getSoilHealthSummary(metrics),
            getDetailedManagementPlan(metrics)
        ]);

        setHarvestIndex(hi);
        setRecommendations(crops);
        setSoilInsight(soil);
        setManagementPlan(plan);
    } catch (err) {
        console.error("Selection Error:", err);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex flex-col lg:flex-row gap-10">
        
        {/* Sidebar */}
        <div className="w-full lg:w-80 space-y-4">
          {fields.map(f => (
            <div 
              key={f.field_id} 
              onClick={() => handleFieldSelect(f)} 
              className={`p-6 rounded-[2rem] cursor-pointer border-2 transition-all ${
                selectedField?.field_id === f.field_id ? 'border-emerald-500 bg-emerald-50' : 'bg-white border-slate-100'
              }`}
            >
              <h3 className="font-black text-slate-900">{f.field_name}</h3>
              <p className="text-xs font-bold text-slate-400 uppercase">{f.location}</p>
            </div>
          ))}
        </div>

        {/* Main Content */}
        <div className="flex-1 space-y-12">
          {selectedField && (
            <>
              {/* SENSOR HEADER: Restored to original NPK/PH/Temp view */}
              <div className="bg-slate-900 rounded-[3.5rem] p-10 text-white shadow-2xl relative overflow-hidden">
                <div className="flex justify-between items-center mb-10">
                    <div>
                        <h2 className="text-6xl font-black">{selectedField.field_name}</h2>
                        <p className="text-slate-400 font-bold">{selectedField.location} • {selectedField.size} ha</p>
                    </div>
                    <div className="bg-emerald-500/10 text-emerald-400 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-500/20">
                        ⚡ Live AI Stream
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Moisture', val: sensorValues.moisture ? `${sensorValues.moisture}%` : 'Sensor Required', icon: 'fa-droplet' },
                    { label: 'pH Level', val: sensorValues.ph || 'Sensor Required', icon: 'fa-scale-balanced' },
                    { label: 'Temperature', val: sensorValues.temp ? `${sensorValues.temp}°C` : 'Sensor Required', icon: 'fa-temperature-high' },
                    { label: 'NPK Balance', val: sensorValues.n !== null ? `N:${sensorValues.n} P:${sensorValues.p} K:${sensorValues.k}` : 'Sensor Required', icon: 'fa-flask' }
                  ].map((s, i) => (
                    <div key={i} className="bg-white/5 border border-white/10 p-6 rounded-[2rem]">
                      <div className="flex items-center gap-3 mb-2 opacity-40">
                        <i className={`fas ${s.icon} text-xs text-emerald-400`}></i>
                        <span className="text-[10px] font-black uppercase tracking-widest">{s.label}</span>
                      </div>
                      <p className="text-sm font-black text-emerald-400">{s.val}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dynamic Crop Cards */}
              <div className="space-y-8">
                <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                    <i className="fas fa-leaf text-emerald-500"></i> Harvest Compatibility Index
                </h3>
                
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
                        {[1,2,3].map(i => <div key={i} className="h-64 bg-slate-100 rounded-[3rem]"></div>)}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {recommendations?.map((crop, idx) => (
                            <div key={idx} className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all">
                                <div className="flex justify-between items-start mb-6">
                                    <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center">
                                        <i className="fas fa-seedling text-emerald-600"></i>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-slate-400 uppercase">Match</p>
                                        <p className="text-3xl font-black text-slate-900">{crop.suitability}%</p>
                                    </div>
                                </div>
                                <h4 className="text-2xl font-black text-slate-900 mb-4">{crop.crop}</h4>
                                <div className="bg-emerald-600 text-white p-4 rounded-2xl flex items-center gap-3 mb-6">
                                    <i className="fas fa-flask-vial text-sm"></i>
                                    <div>
                                        <p className="text-[8px] font-black uppercase opacity-70 tracking-widest">Supplement</p>
                                        <p className="text-xs font-bold uppercase">{crop.tips[0] || 'NPK Sync'}</p>
                                    </div>
                                </div>
                                <p className="text-xs italic text-slate-400 leading-relaxed font-medium">"{crop.reasoning}"</p>
                            </div>
                        ))}
                    </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserFields;
