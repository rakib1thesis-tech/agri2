import React, { useState, useEffect } from 'react';
import { User, Field, Sensor } from '../../types';
import { syncFields, syncSensorsFromDb, addOrUpdateSensorInDb, deleteSensorFromDb } from '../../services/db';
import { getHarvestCompatibility, HarvestIndex } from '../../services/gemini';

const Sensors: React.FC<{ user: User }> = ({ user }) => {
  const [userFields, setUserFields] = useState<Field[]>([]);
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState<Sensor | null>(null);
  const [loading, setLoading] = useState(true);
  
  // New States for Harvest Compatibility Index
  const [harvestIndex, setHarvestIndex] = useState<HarvestIndex | null>(null);
  const [isCalculatingAI, setIsCalculatingAI] = useState(false);
  
  const [newSensorForm, setNewSensorForm] = useState({
    type: 'Moisture',
    fieldId: ''
  });

  const [readingInput, setReadingInput] = useState<any>({});

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const dbFields = await syncFields(user.id);
      setUserFields(dbFields);
      
      if (dbFields.length > 0) {
        setNewSensorForm(prev => ({ ...prev, fieldId: dbFields[0].field_id.toString() }));
        const dbSensors = await syncSensorsFromDb(dbFields);
        setSensors(dbSensors);
      }
      setLoading(false);
    };
    loadData();
  }, [user.id]);

  const handleUpdateReading = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showUpdateModal) return;

    const updatedSensor: Sensor = {
      ...showUpdateModal,
      last_reading: {
        value: readingInput.value || 0,
        npk: readingInput.n ? { n: readingInput.n, p: readingInput.p, k: readingInput.k } : undefined,
        timestamp: new Date().toISOString()
      }
    };

    try {
      // 1. Persist the sensor data to DB/LocalStorage
      await addOrUpdateSensorInDb(updatedSensor);
      
      // 2. Trigger AI Harvest Index calculation after update
      setIsCalculatingAI(true);
      const field = userFields.find(f => f.field_id === updatedSensor.field_id);
      const result = await getHarvestCompatibility(updatedSensor.last_reading, field?.field_name || "General Crop");
      setHarvestIndex(result);
      setIsCalculatingAI(false);

      // Update local state
      setSensors(sensors.map(s => s.sensor_id === updatedSensor.sensor_id ? updatedSensor : s));
      setShowUpdateModal(null);
      setReadingInput({});
    } catch (error) {
      console.error("Failed to update sensor:", error);
      setIsCalculatingAI(false);
    }
  };

  const handleAddSensor = async (e: React.FormEvent) => {
    e.preventDefault();
    const newSensor: Sensor = {
      sensor_id: Date.now(),
      field_id: parseInt(newSensorForm.fieldId),
      sensor_type: newSensorForm.type,
      status: 'Active'
    };
    await addOrUpdateSensorInDb(newSensor);
    setSensors([...sensors, newSensor]);
    setShowAddModal(false);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Remove this sensor from your network?')) {
      await deleteSensorFromDb(id);
      setSensors(sensors.filter(s => s.sensor_id !== id));
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex justify-between items-end mb-12">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Sensor Network</h1>
          <p className="text-slate-500 font-medium">Manage your IoT hardware and field synchronization.</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-xl active:scale-95"
        >
          <i className="fas fa-plus mr-2"></i> Register Node
        </button>
      </div>

      {/* Harvest Compatibility Index Response Section */}
      {(isCalculatingAI || harvestIndex) && (
        <div className={`mb-12 p-8 rounded-[2.5rem] transition-all duration-500 shadow-2xl ${isCalculatingAI ? 'bg-slate-100 animate-pulse' : 'bg-emerald-900 text-white'}`}>
          {isCalculatingAI ? (
            <div className="flex items-center gap-4 text-slate-500">
              <i className="fas fa-robot animate-bounce"></i>
              <span className="font-bold tracking-widest uppercase text-xs">Gemini AI is calculating Harvest Compatibility...</span>
            </div>
          ) : (
            <div className="flex flex-col md:flex-row justify-between items-center gap-8">
              <div className="text-center md:text-left">
                <p className="text-xs font-bold text-emerald-400 uppercase tracking-[0.2em] mb-2">Harvest Compatibility Index</p>
                <div className="flex items-baseline gap-2">
                  <h2 className="text-7xl font-black">{harvestIndex?.score}%</h2>
                  <span className="text-emerald-400 font-bold uppercase text-sm px-3 py-1 bg-white/10 rounded-full">{harvestIndex?.status}</span>
                </div>
              </div>
              <div className="flex-1 max-w-md">
                <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
                  <p className="text-lg font-medium leading-relaxed italic text-emerald-50">
                    "{harvestIndex?.recommendation}"
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sensors.map(sensor => {
          const field = userFields.find(f => f.field_id === sensor.field_id);
          return (
            <div key={sensor.sensor_id} className="bg-white border border-slate-100 rounded-[2rem] p-8 shadow-sm hover:shadow-xl transition-all group">
              <div className="flex justify-between items-start mb-6">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl shadow-inner ${
                  sensor.sensor_type === 'Moisture' ? 'bg-blue-50 text-blue-500' :
                  sensor.sensor_type === 'Temperature' ? 'bg-orange-50 text-orange-500' :
                  'bg-purple-50 text-purple-500'
                }`}>
                  <i className={`fas ${
                    sensor.sensor_type === 'Moisture' ? 'fa-droplet' :
                    sensor.sensor_type === 'Temperature' ? 'fa-temperature-half' :
                    'fa-flask'
                  }`}></i>
                </div>
                <button onClick={() => handleDelete(sensor.sensor_id)} className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                  <i className="fas fa-trash-can"></i>
                </button>
              </div>
              
              <h3 className="text-xl font-bold text-slate-900 mb-1">{sensor.sensor_type} Node</h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">
                <i className="fas fa-location-dot mr-1"></i> {field?.field_name || 'Unassigned'}
              </p>

              <div className="bg-slate-50 rounded-2xl p-4 mb-6">
                {sensor.last_reading ? (
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-slate-800">
                      {sensor.sensor_type === 'NPK' 
                        ? `${sensor.last_reading.npk?.n}-${sensor.last_reading.npk?.p}-${sensor.last_reading.npk?.k}`
                        : sensor.last_reading.value}
                    </span>
                    <span className="text-sm font-bold text-slate-400">
                      {sensor.sensor_type === 'Moisture' ? '%' : sensor.sensor_type === 'Temperature' ? '°C' : sensor.sensor_type === 'pH' ? 'pH' : 'PPM'}
                    </span>
                  </div>
                ) : (
                  <span className="text-sm font-bold text-slate-400 italic">No data synced</span>
                )}
              </div>

              <button 
                onClick={() => {
                  setShowUpdateModal(sensor);
                  setReadingInput(sensor.last_reading?.npk ? 
                    { n: sensor.last_reading.npk.n, p: sensor.last_reading.npk.p, k: sensor.last_reading.npk.k } : 
                    { value: sensor.last_reading?.value || 0 }
                  );
                }}
                className="w-full py-4 bg-slate-50 text-slate-600 rounded-xl font-bold hover:bg-emerald-50 hover:text-emerald-600 transition-all"
              >
                Sync Reading
              </button>
            </div>
          );
        })}
      </div>

      {/* Update Modal */}
      {showUpdateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] p-10 max-w-md w-full shadow-2xl animate-in zoom-in-95">
            <h2 className="text-2xl font-black text-slate-900 mb-2">Manual Field Sync</h2>
            <p className="text-slate-500 text-sm mb-8 font-medium">Updating node data for {showUpdateModal.sensor_type} analysis.</p>
            
            <form onSubmit={handleUpdateReading} className="space-y-6">
              {showUpdateModal.sensor_type === 'NPK' ? (
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-widest">Nitrogen</label>
                    <input type="number" className="w-full p-4 bg-slate-50 border-none rounded-2xl text-center font-bold" value={readingInput.n || 0} onChange={e => setReadingInput({...readingInput, n: Number(e.target.value)})} />
                  </div>
                  <div className="text-center">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-widest">Phosphorus</label>
                    <input type="number" className="w-full p-4 bg-slate-50 border-none rounded-2xl text-center font-bold" value={readingInput.p || 0} onChange={e => setReadingInput({...readingInput, p: Number(e.target.value)})} />
                  </div>
                  <div className="text-center">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-widest">Potassium</label>
                    <input type="number" className="w-full p-4 bg-slate-50 border-none rounded-2xl text-center font-bold" value={readingInput.k || 0} onChange={e => setReadingInput({...readingInput, k: Number(e.target.value)})} />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-3">
                    Input Reading {showUpdateModal.sensor_type.toLowerCase().includes('moisture') ? '(%)' : showUpdateModal.sensor_type.toLowerCase().includes('temperature') ? '(°C)' : '(pH Scale)'}
                  </label>
                  <input type="number" step="0.1" className="w-full p-5 bg-slate-50 border-none rounded-2xl text-xl font-black text-center" value={readingInput.value || 0} onChange={e => setReadingInput({...readingInput, value: Number(e.target.value)})} />
                </div>
              )}
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowUpdateModal(null)} className="flex-1 py-4 rounded-2xl font-bold bg-slate-100 text-slate-500 hover:bg-slate-200 transition-all">Cancel</button>
                <button type="submit" className="flex-1 py-4 rounded-2xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100">Sync to Field</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] p-10 max-w-md w-full shadow-2xl">
            <h2 className="text-2xl font-black text-slate-900 mb-6">Register New Node</h2>
            <form onSubmit={handleAddSensor} className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2 ml-1">Hardware Type</label>
                <select 
                  className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold"
                  value={newSensorForm.type}
                  onChange={e => setNewSensorForm({...newSensorForm, type: e.target.value})}
                >
                  <option value="Moisture">Moisture Sensor (FDR)</option>
                  <option value="Temperature">Temperature Probe</option>
                  <option value="pH">pH Level Analyzer</option>
                  <option value="NPK">NPK Stoichiometric Sensor</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2 ml-1">Assign to Plot</label>
                <select 
                  className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold"
                  value={newSensorForm.fieldId}
                  onChange={e => setNewSensorForm({...newSensorForm, fieldId: e.target.value})}
                >
                  {userFields.map(f => (
                    <option key={f.field_id} value={f.field_id}>{f.field_name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-4 rounded-2xl font-bold text-slate-400 uppercase tracking-widest text-xs">Cancel</button>
                <button type="submit" className="flex-1 py-4 rounded-2xl font-bold text-white bg-slate-900 shadow-xl">Deploy Node</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sensors;
