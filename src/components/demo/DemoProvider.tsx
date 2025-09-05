import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { JournalEntryData } from "@/components/journal/JournalEntry";
import { sampleEntries } from "@/demo/sampleEntries";

interface DemoContextType {
  entries: JournalEntryData[];
  saveEntry: (entry: JournalEntryData) => void;
  deleteEntry: (id: string) => void;
  isDemo: true;
}

const DemoContext = createContext<DemoContextType | null>(null);

export function useDemo() {
  const context = useContext(DemoContext);
  if (!context) {
    throw new Error("useDemo must be used within a DemoProvider");
  }
  return context;
}

interface DemoProviderProps {
  children: ReactNode;
}

export function DemoProvider({ children }: DemoProviderProps) {
  const [entries, setEntries] = useState<JournalEntryData[]>(sampleEntries);

  const saveEntry = useCallback((entry: JournalEntryData) => {
    setEntries(prev => {
      const existingIndex = prev.findIndex(e => e.id === entry.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = entry;
        return updated;
      }
      return [entry, ...prev];
    });
  }, []);

  const deleteEntry = useCallback((id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
  }, []);

  const value: DemoContextType = {
    entries,
    saveEntry,
    deleteEntry,
    isDemo: true
  };

  return (
    <DemoContext.Provider value={value}>
      {children}
    </DemoContext.Provider>
  );
}
