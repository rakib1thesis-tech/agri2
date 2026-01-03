
import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, Auth } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, query, where, deleteDoc, Firestore } from 'firebase/firestore';
import { User, Field, Sensor } from '../types';

// Configuration for project: agricare-4c725
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

/**
 * Handles Firestore specific errors to provide better user feedback
 */
const handleFirestoreError = (e: any) => {
  if (e.code === 'permission-denied') {
    throw new Error("Database Access Denied: Please check your Firestore Security Rules in the Firebase Console. Ensure you have published rules that allow 'read' access for authenticated users.");
  }
  throw e;
};

export const loginUser = async (email: string, pass: string): Promise<User | null> => {
  try {
    // 1. Authenticate with Firebase Auth
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    
    // 2. Fetch User Profile from Firestore
    try {
      const userDocRef = doc(db, 'users', cred.user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        return userDoc.data() as User;
      } else {
        // Create profile if it doesn't exist but user is authenticated
        const fallbackUser: User = {
          id: cred.user.uid,
          name: email.split('@')[0],
          email: email,
          subscriptionPlan: 'basic',
          subscriptionEnd: new Date(Date.now() + 31536000000).toISOString()
        };
        await setDoc(userDocRef, fallbackUser);
        return fallbackUser;
      }
    } catch (dbError: any) {
      return handleFirestoreError(dbError);
    }
  } catch (authError: any) {
    console.error("Auth Error:", authError);
    throw authError;
  }
};

export const registerUser = async (user: User, pass: string): Promise<User> => {
  try {
    const cred = await createUserWithEmailAndPassword(auth, user.email, pass);
    const userData = { ...user, id: cred.user.uid };
    await setDoc(doc(db, 'users', cred.user.uid), userData);
    return userData;
  } catch (e: any) {
    return handleFirestoreError(e);
  }
};

export const syncFields = async (userId: string): Promise<Field[]> => {
  if (!db) return [];
  try {
    const q = query(collection(db, 'fields'), where('user_id', '==', userId));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Field);
  } catch (e) {
    console.error("Sync Fields Error:", e);
    return [];
  }
};

export const addFieldToDb = async (field: Field): Promise<void> => {
  if (!db) throw new Error("Database not initialized");
  try {
    await setDoc(doc(db, 'fields', field.field_id.toString()), field);
  } catch (e) {
    return handleFirestoreError(e);
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
}
