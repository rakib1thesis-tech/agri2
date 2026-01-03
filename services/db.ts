
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, Firestore, doc, getDoc, setDoc, collection, getDocs, query, where, deleteDoc } from 'firebase/firestore';
import { User, Field, Sensor } from '../types';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

const loadConfig = () => {
  const savedConfig = localStorage.getItem('agricare_firebase_config');
  if (savedConfig) {
    try {
      const config = JSON.parse(savedConfig);
      app = initializeApp(config);
      auth = getAuth(app);
      db = getFirestore(app);
      return true;
    } catch (e) {
      console.error("Firebase Init Error", e);
    }
  }
  return false;
};

loadConfig();

export const isFirebaseEnabled = () => !!app && !!auth && !!db;

export const saveFirebaseConfig = (config: any) => {
  localStorage.setItem('agricare_firebase_config', JSON.stringify(config));
  window.location.reload();
};

export const loginUser = async (email: string, pass: string): Promise<User | null> => {
  if (isFirebaseEnabled() && auth && db) {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      const userDoc = await getDoc(doc(db, 'users', cred.user.uid));
      return userDoc.exists() ? (userDoc.data() as User) : null;
    } catch (e) {
      console.error("Firebase Login Failed", e);
      throw e;
    }
  }
  const users = JSON.parse(localStorage.getItem('agricare_registered_users') || '[]');
  return users.find((u: User) => u.email.toLowerCase() === email.toLowerCase()) || null;
};

export const registerUser = async (user: User, pass: string): Promise<User> => {
  if (isFirebaseEnabled() && auth && db) {
    try {
      const cred = await createUserWithEmailAndPassword(auth, user.email, pass);
      const userData = { ...user, id: cred.user.uid };
      await setDoc(doc(db, 'users', cred.user.uid), userData);
      return userData;
    } catch (e) {
      console.error("Firebase Registration Failed", e);
      throw e;
    }
  } else {
    const users = JSON.parse(localStorage.getItem('agricare_registered_users') || '[]');
    localStorage.setItem('agricare_registered_users', JSON.stringify([...users, user]));
    return user;
  }
};

export const syncFields = async (userId: string): Promise<Field[]> => {
  if (isFirebaseEnabled() && db) {
    const q = query(collection(db, 'fields'), where('user_id', '==', userId));
    const snap = await getDocs(q);
    const cloudFields = snap.docs.map(d => d.data() as Field);
    localStorage.setItem('agricare_fields', JSON.stringify(cloudFields));
    return cloudFields;
  }
  const saved = localStorage.getItem('agricare_fields');
  return saved ? JSON.parse(saved).filter((f: Field) => f.user_id === userId) : [];
};

export const addFieldToDb = async (field: Field): Promise<void> => {
  if (isFirebaseEnabled() && db) {
    await setDoc(doc(db, 'fields', field.field_id.toString()), field);
  } else {
    const saved = JSON.parse(localStorage.getItem('agricare_fields') || '[]');
    localStorage.setItem('agricare_fields', JSON.stringify([...saved, field]));
  }
};

export const syncSensorsFromDb = async (userFields: Field[]): Promise<Sensor[]> => {
  if (isFirebaseEnabled() && db) {
    const userFieldIds = userFields.map(f => f.field_id);
    if (userFieldIds.length === 0) return [];
    
    const q = query(collection(db, 'sensors'), where('field_id', 'in', userFieldIds));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Sensor);
  }
  const saved = localStorage.getItem('agricare_sensors');
  return saved ? JSON.parse(saved) : [];
};

export const addOrUpdateSensorInDb = async (sensor: Sensor): Promise<void> => {
  if (isFirebaseEnabled() && db) {
    await setDoc(doc(db, 'sensors', sensor.sensor_id.toString()), sensor);
  } else {
    const saved = JSON.parse(localStorage.getItem('agricare_sensors') || '[]');
    const idx = saved.findIndex((s: any) => s.sensor_id === sensor.sensor_id);
    if (idx > -1) saved[idx] = sensor; else saved.push(sensor);
    localStorage.setItem('agricare_sensors', JSON.stringify(saved));
  }
};

export const deleteSensorFromDb = async (id: number): Promise<void> => {
  if (isFirebaseEnabled() && db) {
    await deleteDoc(doc(db, 'sensors', id.toString()));
  } else {
    const saved = JSON.parse(localStorage.getItem('agricare_sensors') || '[]');
    localStorage.setItem('agricare_sensors', JSON.stringify(saved.filter((s: any) => s.sensor_id !== id)));
  }
};
