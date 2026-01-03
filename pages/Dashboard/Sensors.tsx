
import React, { useState, useEffect } from 'react';
import { User, Field, Sensor, SensorReading } from '../../types';

const Sensors: React.FC<{ user: User }> = ({ user }) => {
  const [userFields, setUserFields] = useState<Field[]>([]);
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState<Sensor | null>(null);
  
  // Manual Diagnostic State for fields without sensors
  const [manualDiagnostics, setManualDiagnostics] = useState<Record<number, any>>({});
  
  const [newSensorForm, setNewSensorForm] = useState({
    type: 'Moisture',
    fieldId: ''
  });

  const [readingInput, setReadingInput] = useState<any>({});

  useEffect(() => {
    const savedFields = localStorage.getItem('agricare_fields');
    if (savedFields) {
      const allFields: Field[] = JSON.parse(savedFields);
      const filteredFields = allFields.filter(f => f.user_id === user.id);
      setUserFields(filteredFields);
      if (filteredFields.length > 0) {
        setNewSensorForm(prev => ({ ...prev, fieldId: filteredFields[0].field_id.toString() }));
      }
    }

    const savedSensors = localStorage.getItem('agricare_sensors');
    if (savedSensors) {
      const allSensors: Sensor[] = JSON.parse(savedSensors);
      const userFieldIds = new Set(
        savedFields 
          ? JSON.parse(savedFields).filter((f: Field) => f.user_id === user.id).map((f: Field) => f.field_id) 
          : []
      );
      setSensors(allSensors.filter(s => userFieldIds.has(s.field_id)));
    }

    const savedManual = localStorage.getItem('agricare_manual_diagnostics');
    if (savedManual) {
      setManualDiagnostics(JSON.parse(savedManual));
    }
  }, [user.id]);

  const saveSensors = (updatedSensors: Sensor[]) => {
    // We need to merge with existing global sensors to avoid deleting other users' sensors
    const saved = localStorage.getItem('agricare_sensors');
    const allSensors: Sensor[] = saved ? JSON.parse(saved) : [];
    
    const userFieldIds = new Set(userFields.map(f => f.field_id));
    const otherSensors = allSensors.filter(s => !userFieldIds.has(s.field_id));
    
    const final = [...otherSensors, ...updatedSensors];
    localStorage.setItem('agricare_sensors', JSON.stringify(final));
    setSensors(updatedSensors);
  };

  const handleUpdateReading = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showUpdateModal) return;

    const updated = sensors.map(s => {
      if (s.sensor_id === showUpdateModal.sensor_id) {
        return {
          ...s,
          last_reading: readingInput,
          last_active: new Date().toISOString()
        };
      }
      return s;
    });

    saveSensors(updated);
    setShowUpdateModal(null);
    setReadingInput({});
  };

  const handleManualDiagnosticUpdate = (fieldId: number, data: any) => {
    const updated = { ...manualDiagnostics, [fieldId]: data };
    setManualDiagnostics(updated);
    localStorage.setItem('agricare_manual_diagnostics', JSON.stringify(updated));
  };

  const handleDeleteSensor = (id: number) => {
    if (window.confirm("Remove this sensor?")) {
      saveSensors(sensors.filter(s => s.sensor_id !== id));
    }
  };

  const handleAddSensor = (e: React.FormEvent) => {
    e.preventDefault();
    const newSensor: Sensor = {
      sensor_id: Math.floor(1000 + Math.random() * 9000),
      field_id: parseInt(newSensorForm.fieldId),
      sensor_type: newSensorForm.type,
      battery_level: 100,
      status: 'active',
      last_active: new Date().toISOString()
    };
    saveSensors([newSensor, ...sensors]);
    setShowAddModal(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">IoT & Manual Data Control</h1>
          <p className="text-slate-500 text-sm">Update sensor readings or manual field diagnostics.</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="bg-slate-900 text-white px-4 py-2 rounded-lg font-bold hover:bg-slate-800">
          <i className="fas fa-plus mr-2"></i> Pair New Sensor
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <i className="fas fa-microchip text-emerald-600"></i> Active Sensor Network
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sensors.map(sensor => {
              const field = userFields.find(f => f.field_id === sensor.field_id);
              return (
                <div key={sensor.sensor_id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                  <div className="flex justify-between items-start mb-4">
                    <div className="bg-slate-50 p-3 rounded-xl">
                      <i className={`fas ${sensor.sensor_type === 'Moisture' ? 'fa-droplet text-blue-500' : sensor.sensor_type === 'Temperature' ? 'fa-temperature-high text-orange-500' : sensor.sensor_type === 'NPK Analyzer' ? 'fa-vial text-emerald-500' : 'fa-flask text-purple-500'} text-xl`}></i>
                    </div>
                    <button onClick={() => handleDeleteSensor(sensor.sensor_id)} className="text-slate-300 hover:text-red-500"><i className="fas fa-trash"></i></button>
                  </div>
                  <h3 className="font-bold text-slate-900">{sensor.sensor_type}</h3>
                  <p className="text-xs text-slate-400 mb-4">{field?.field_name || 'Unknown Field'}</p>
                  
                  <div className="bg-slate-50 p-3 rounded-xl mb-4">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Latest Reading</div>
                    <div className="text-sm font-bold text-slate-700">
                      {sensor.last_reading ? (
                        sensor.sensor_type === 'NPK Analyzer' 
                          ? `N:${sensor.last_reading.n} P:${sensor.last_reading.p} K:${sensor.last_reading.k} ppm`
                          : `${sensor.last_reading.value}${sensor.sensor_type === 'Moisture' ? '%' : sensor.sensor_type === 'Temperature' ? '°C' : ''}`
                      ) : 'No data received'}
                    </div>
                  </div>

                  <button 
                    onClick={() => {
                      setShowUpdateModal(sensor);
                      setReadingInput(sensor.last_reading || {});
                    }}
                    className="w-full py-2 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-colors"
                  >
                    Update Reading Manually
                  </button>
                </div>
              );
            })}
            {sensors.length === 0 && (
              <div className="col-span-full py-12 text-center bg-white border border-dashed rounded-3xl text-slate-400 italic">
                No sensors found. Use Manual Diagnostics below.
              </div>
            )}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <i className="fas fa-edit text-blue-600"></i> Manual Diagnostic Center
          </h2>
          <p className="text-xs text-slate-500 mb-4">Provide values for fields without hardware sensors to get AI analysis.</p>
          <div className="space-y-4">
            {userFields.map(field => {
              const fieldSensors = sensors.filter(s => s.field_id === field.field_id);
              if (fieldSensors.length > 0) return null; // Only show fields without sensors

              const data = manualDiagnostics[field.field_id] || { moisture: 0, temp: 0, ph: 7, n: 0, p: 0, k: 0 };

              return (
                <div key={field.field_id} className="bg-white p-6 rounded-2xl border border-blue-100 shadow-sm">
                  <h3 className="font-bold text-slate-900 mb-4 border-b pb-2">{field.field_name}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Moisture (%)</label>
                      <input type="number" value={data.moisture} onChange={e => handleManualDiagnosticUpdate(field.field_id, {...data, moisture: Number(e.target.value)})} className="w-full text-sm border-b focus:border-blue-500 outline-none" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Temp (°C)</label>
                      <input type="number" value={data.temp} onChange={e => handleManualDiagnosticUpdate(field.field_id, {...data, temp: Number(e.target.value)})} className="w-full text-sm border-b focus:border-blue-500 outline-none" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase">pH</label>
                      <input type="number" step="0.1" value={data.ph} onChange={e => handleManualDiagnosticUpdate(field.field_id, {...data, ph: Number(e.target.value)})} className="w-full text-sm border-b focus:border-blue-500 outline-none" />
                    </div>
                    <div className="col-span-2 mt-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">NPK (ppm)</label>
                      <div className="flex gap-2">
                        <input placeholder="N" type="number" value={data.n} onChange={e => handleManualDiagnosticUpdate(field.field_id, {...data, n: Number(e.target.value)})} className="w-full text-sm border-b outline-none text-center" />
                        <input placeholder="P" type="number" value={data.p} onChange={e => handleManualDiagnosticUpdate(field.field_id, {...data, p: Number(e.target.value)})} className="w-full text-sm border-b outline-none text-center" />
                        <input placeholder="K" type="number" value={data.k} onChange={e => handleManualDiagnosticUpdate(field.field_id, {...data, k: Number(e.target.value)})} className="w-full text-sm border-b outline-none text-center" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {userFields.filter(f => !sensors.some(s => s.field_id === f.field_id)).length === 0 && (
              <div className="p-6 bg-slate-50 text-slate-400 text-sm text-center rounded-2xl border border-dashed">
                All fields are currently linked to active hardware sensors.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Sensor Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl animate-in zoom-in duration-200">
            <h2 className="text-2xl font-bold mb-6">Pair New Sensor</h2>
            <form onSubmit={handleAddSensor} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Sensor Type</label>
                <select className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white" value={newSensorForm.type} onChange={e => setNewSensorForm({...newSensorForm, type: e.target.value})}>
                  <option value="Moisture">Moisture</option>
                  <option value="Temperature">Temperature</option>
                  <option value="NPK Analyzer">NPK Analyzer</option>
                  <option value="PH Probe">PH Probe</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Assign to Field</label>
                <select className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white" value={newSensorForm.fieldId} onChange={e => setNewSensorForm({...newSensorForm, fieldId: e.target.value})}>
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

      {/* Update Reading Modal */}
      {showUpdateModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl">
            <h2 className="text-xl font-bold mb-6">Update {showUpdateModal.sensor_type} Reading</h2>
            <form onSubmit={handleUpdateReading} className="space-y-6">
              {showUpdateModal.sensor_type === 'NPK Analyzer' ? (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold mb-1">N (ppm)</label>
                    <input type="number" className="w-full p-3 border rounded-xl" value={readingInput.n || 0} onChange={e => setReadingInput({...readingInput, n: Number(e.target.value)})} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">P (ppm)</label>
                    <input type="number" className="w-full p-3 border rounded-xl" value={readingInput.p || 0} onChange={e => setReadingInput({...readingInput, p: Number(e.target.value)})} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">K (ppm)</label>
                    <input type="number" className="w-full p-3 border rounded-xl" value={readingInput.k || 0} onChange={e => setReadingInput({...readingInput, k: Number(e.target.value)})} />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-bold mb-2">
                    Reading {showUpdateModal.sensor_type === 'Moisture' ? '(%)' : showUpdateModal.sensor_type === 'Temperature' ? '(°C)' : '(pH)'}
                  </label>
                  <input type="number" step="0.1" className="w-full p-4 border rounded-xl" value={readingInput.value || 0} onChange={e => setReadingInput({...readingInput, value: Number(e.target.value)})} />
                </div>
              )}
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowUpdateModal(null)} className="flex-1 py-3 rounded-xl font-bold bg-slate-100">Cancel</button>
                <button type="submit" className="flex-1 py-3 rounded-xl font-bold text-white bg-emerald-600">Save Data</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sensors;
