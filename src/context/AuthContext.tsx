import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import {
  User,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  Unsubscribe,
} from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, googleProvider, db, stripUndefined } from '../firebase';
import { UserProfile, MeResponse } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  isAdmin: boolean;
  adminSetupNeeded: boolean;
  roleDocPath: string;
  loading: boolean;
  token: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  refreshAdminStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminSetupNeeded, setAdminSetupNeeded] = useState(false);
  const [roleDocPath, setRoleDocPath] = useState('');
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  // Maintain reference to profile listener unsubscribe function
  const profileUnsubRef = useRef<Unsubscribe | null>(null);

  const cleanupListeners = () => {
    if (profileUnsubRef.current) {
      profileUnsubRef.current();
      profileUnsubRef.current = null;
    }
  };

  const verifyServerAdmin = async (authToken: string) => {
    try {
      const res = await fetch('/api/me', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (res.ok) {
        const data: MeResponse = await res.json();
        setIsAdmin(Boolean(data.isAdmin));
        setAdminSetupNeeded(Boolean(data.adminSetupNeeded));
        setRoleDocPath(data.roleDocPath || '');
      } else {
        setIsAdmin(false);
        setAdminSetupNeeded(false);
      }
    } catch (err) {
      console.error('Failed to verify admin status with server:', err);
      setIsAdmin(false);
      setAdminSetupNeeded(false);
    }
  };

  const refreshAdminStatus = async () => {
    if (token) {
      await verifyServerAdmin(token);
    }
  };

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (currentUser) => {
      cleanupListeners();

      if (currentUser) {
        setUser(currentUser);
        try {
          const idToken = await currentUser.getIdToken();
          setToken(idToken);
          await verifyServerAdmin(idToken);

          // Subscribe to UserProfile in Firestore
          const profileDocRef = doc(db, 'users', currentUser.uid);
          profileUnsubRef.current = onSnapshot(
            profileDocRef,
            (snapshot) => {
              if (snapshot.exists()) {
                setProfile(snapshot.data() as UserProfile);
              } else {
                setProfile(null);
              }
              setLoading(false);
            },
            (err) => {
              console.error('Profile snapshot error (logged per Directive 8):', err);
              setLoading(false);
            }
          );
        } catch (e) {
          console.error('Error during auth setup:', e);
          setLoading(false);
        }
      } else {
        setUser(null);
        setProfile(null);
        setIsAdmin(false);
        setAdminSetupNeeded(false);
        setToken(null);
        setLoading(false);
      }
    });

    return () => {
      cleanupListeners();
      unsubAuth();
    };
  }, []);

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error('Sign-in failed:', err);
      throw err;
    }
  };

  const signOut = async () => {
    cleanupListeners();
    await fbSignOut(auth);
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!user || !token) throw new Error('Not authenticated');

    const res = await fetch('/api/profile', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to update profile');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isAdmin,
        adminSetupNeeded,
        roleDocPath,
        loading,
        token,
        signInWithGoogle,
        signOut,
        updateProfile,
        refreshAdminStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
