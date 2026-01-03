import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, Auth } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, query, where, deleteDoc, Firestore } from 'firebase/firestore';
import { User, Field, Sensor } from '../types';

// Real configuration for your project: agricare-4c725
const firebaseConfig = {
  apiKey: "AIzaSyCeyl_T15XCsu0-tbXoXaZ2t7C3oMLjyF8",
  authDomain: "agricare-4c725.firebaseapp.com",
  projectId: "agricare-4c725",
  storageBucket: "agricare-4c725.appspot.com",
  messagingSenderId: "629410782904",
  appId: "1:629410782904:web:4d8f43225d8a6b4ad15e4d"
};

// Initialize Firebase with singleton check
const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth: Auth = getAuth(app);
const db: Firestore = getFirestore(app);

export const isFirebaseEnabled = () => !!db;

export const loginUser = async (email: string, pass: string): Promise<User | null> => {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    const userDoc = await getDoc(doc(db, 'users', cred.user.uid));
    if (userDoc.exists()) {
      return userDoc.data() as User;
    }
    return null;
  } catch (e: any) {
    console.error("Login Error:", e.code, e.message);
    throw e;
  }
};

export const registerUser = async (user: User, pass: string): Promise<User> => {
  try {
    const cred = await createUserWithEmailAndPassword(auth, user.email, pass);
    const userData = { ...user, id: cred.user.uid };
    await setDoc(doc(db, 'users', cred.user.uid), userData);
    console.log("User registered in Firestore:", cred.user.uid);
    return userData;
  } catch (e: any) {
    console.error("Registration Error:", e.code, e.message);
    throw e;
  }
};

export const syncFields = async (userId: string): Promise<Field[]> => {
  if (!db) return [];
  try {
    const q = query(collection(db, 'fields'), where('user_id', '==', userId));
    const snap = await getDocs(q);
    const cloudFields = snap.docs.map(d => d.data() as Field);
    return cloudFields;
  } catch (e) {
    console.error("Sync Fields Error:", e);
    return [];
  }
};

export const addFieldToDb = async (field: Field): Promise<void> => {
  if (!db) throw new Error("Database not initialized");
  try {
    await setDoc(doc(db, 'fields', field.field_id.toString()), field);
    console.log("Field added to Firestore");
  } catch (e) {
    console.error("Add Field Error:", e);
    throw e;
  }
};

export const syncSensorsFromDb = async (userFields: Field[]): Promise<Sensor[]> => {
  if (!db || userFields.length === 0) return [];
  try {
    const userFieldIds = userFields.map(f => f.field_id);
    const q = query(collection(db, 'sensors'), where('field_id', 'in', userFieldIds));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Sensor);
  } catch (e) {
    return [];
  }
};

export const addOrUpdateSensorInDb = async (sensor: Sensor): Promise<void> => {
  if (!db) return;
  try {
    await setDoc(doc(db, 'sensors', sensor.sensor_id.toString()), sensor);
  } catch (e) {
    console.error(e);
  }
};

export const deleteSensorFromDb = async (id: number): Promise<void> => {
  if (!db) return;
  try {
    await deleteDoc(doc(db, 'sensors', id.toString()));
  } catch (e) {
    console.error(e);
  }
};