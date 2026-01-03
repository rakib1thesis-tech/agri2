
import React, { useState, useEffect } from 'react';
import { User, Field, Sensor } from '../../types';

const Sensors: React.FC<{ user: User }> = ({ user }) => {
  const [userFields, setUserFields] = useState<Field[]>([]);
  
  // Local sensor state filtered for this user
  const [sensors, setSensors] = useState<Sensor[]>([]);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSensorForm, setNewSensorForm] = useState({
    type: 'Moisture',
    fieldId: ''
  });

  useEffect(() => {
    // 1. Load User Fields
    const savedFields = localStorage.getItem('agricare_fields');
    if (savedFields) {
      const allFields: Field[] = JSON.parse(savedFields);
      const filteredFields = allFields.filter(f => f.user_id === user.id);
      setUserFields(filteredFields);
      if (filteredFields.length > 0) {
        setNewSensorForm(prev => ({ ...prev, fieldId: filteredFields[0].field_id.toString() }));
      }
    }

    // 2. Load and Filter Sensors
    const savedSensors = localStorage.getItem('agricare_sensors');
    if (savedSensors) {
      const allSensors: Sensor[] = JSON.parse(savedSensors);
      const userFieldIds = new Set(
        savedFields 
          ? JSON.parse(savedFields).filter((f: Field) => f.user_id === user.id).map((f: Field) => f.field_id) 
          : []
      );
      // Filter sensors that belong to the user's fields
      const filteredSensors = allSensors.filter(s => userFieldIds.has(s.field_id));
      setSensors(filteredSensors);
    }
  }, [user.id]);

  const toggleSensor = (id: number) => {
    const saved = localStorage.getItem('agricare_sensors');
    const allSensors: Sensor[] = saved ? JSON.parse(saved) : [];
    
    const updatedGlobalSensors = allSensors.map(s => {
      if (s.sensor_id === id) {
        return { ...s, status: s.status === 'active' ? 'inactive' : 'active' };
      }
      return s;
    });

    localStorage.setItem('agricare_sensors', JSON.stringify(updatedGlobalSensors));
    setSensors(prev => prev.map(s => {
      if (s.sensor_id === id) {
        return { ...s, status: s.status === 'active' ? 'inactive' : 'active' };
      }
      return s;
    }));
  };

  const handleDeleteSensor = (id: number) => {
    if (window.confirm("Remove this sensor from your network?")) {
      const saved = localStorage.getItem('agricare_sensors');
      const allSensors: Sensor[] = saved ? JSON.parse(saved) : [];
      const updatedGlobalSensors = allSensors.filter(s => s.sensor_id !== id);
      localStorage.setItem('agricare_sensors', JSON.stringify(updatedGlobalSensors));
      setSensors(prev => prev.filter(s => s.sensor_id !== id));
    }
  };

  const handleAddSensor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSensorForm.fieldId) {
      alert("Please select a field first.");
      return;
    }

    const newSensor: Sensor = {
      sensor_id: Math.floor(1000 + Math.random() * 9000),
      field_id: parseInt(newSensorForm.fieldId),
      sensor_type: newSensorForm.type,
      battery_level: 100,
      status: 'active',
      last_active: new Date().toISOString()
    };
    
    // Save to Global Storage
    const saved = localStorage.getItem('agricare_sensors');
    const allSensors: Sensor[] = saved ? JSON.parse(saved) : [];
    localStorage.setItem('agricare_sensors', JSON.stringify([...allSensors, newSensor]));

    // Update local state
    setSensors([newSensor, ...sensors]);
    setShowAddModal(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Hardware & Sensors</h1>
          <p className="text-slate-500 text-sm">Real-time status of your IoT infrastructure.</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-slate-900 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
        >
          <i className="fas fa-plus"></i> Add New Sensor
        </button>
      </div>

      {sensors.length === 0 ? (
        <div className="bg-white rounded-[3rem] border border-dashed border-slate-300 p-24 text-center">
          <div className="w-20 h-20 bg-emerald-50 text-emerald-300 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <i className="fas fa-microchip text-3xl"></i>
          </div>
          <h2 className="text-2xl font-bold text-slate-800">No Sensors Connected</h2>
          <p className="text-slate-500 mt-2 max-w-sm mx-auto mb-8">
            Your sensor network is currently offline. Pair your first industrial-grade sensor to start receiving real-time soil data.
          </p>
          <button 
            onClick={() => setShowAddModal(true)}
            className="bg-emerald-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100"
          >
            Pair First Device
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sensors.map(sensor => {
            const field = userFields.find(f => f.field_id === sensor.field_id);
            return (
              <div key={sensor.sensor_id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm relative group overflow-hidden">
                <div className="flex justify-between items-start mb-6">
                  <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-500 transition-colors">
                    <i className="fas fa-microchip text-xl"></i>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${sensor.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${sensor.status === 'active' ? 'text-emerald-700' : 'text-slate-400'}`}>
                      {sensor.status}
                    </span>
                  </div>
                </div>
                
                <div className="mb-4">
                  <h3 className="font-bold text-slate-900">{sensor.sensor_type}</h3>
                  <div className="text-xs text-slate-500">ID: AGR-{sensor.sensor_id} • {field?.field_name || 'Unassigned'}</div>
                </div>

                <div className="space-y-4 mb-6">
                  <div>
                    <div className="flex justify-between items-center text-xs mb-1">
                      <span className="text-slate-500">Battery Level</span>
                      <span className={`font-bold ${sensor.battery_level < 20 ? 'text-red-500' : 'text-slate-900'}`}>{sensor.battery_level}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-1000 ${sensor.battery_level < 20 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${sensor.battery_level}%` }}></div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={() => toggleSensor(sensor.sensor_id)}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                      sensor.status === 'active' 
                        ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' 
                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                    }`}
                  >
                    {sensor.status === 'active' ? 'Pause' : 'Resume'}
                  </button>
                  <button 
                    onClick={() => handleDeleteSensor(sensor.sensor_id)}
                    className="w-10 h-10 rounded-lg bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 flex items-center justify-center transition-all"
                  >
                    <i className="fas fa-trash-alt text-xs"></i>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl animate-in zoom-in duration-200">
            <h2 className="text-2xl font-bold mb-6">Pair New Sensor</h2>
            <form onSubmit={handleAddSensor} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Sensor Type</label>
                <select 
                  className="w-full px-4 py-3 rounded-xl border border-slate-200" 
                  value={newSensorForm.type} 
                  onChange={e => setNewSensorForm({...newSensorForm, type: e.target.value})}
                >
                  <option value="Moisture">Moisture</option>
                  <option value="Temperature">Temperature</option>
                  <option value="NPK Analyzer">NPK Analyzer</option>
                  <option value="PH Probe">PH Probe</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Assign to Field</label>
                <select 
                  className="w-full px-4 py-3 rounded-xl border border-slate-200" 
                  value={newSensorForm.fieldId} 
                  onChange={e => setNewSensorForm({...newSensorForm, fieldId: e.target.value})}
                >
                  {userFields.map(f => (
                    <option key={f.field_id} value={f.field_id}>{f.field_name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-3 rounded-xl font-bold text-slate-500 bg-slate-100">Cancel</button>
                <button type="submit" className="flex-1 py-3 rounded-xl font-bold text-white bg-emerald-600">Pair Device</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sensors;
