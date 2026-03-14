/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import QuickPinchZoom, { make3dTransformValue } from 'react-quick-pinch-zoom';
import { 
  Plus, 
  Camera, 
  Leaf, 
  Sprout,
  Flower2,
  CheckCircle2,
  Calendar, 
  Settings, 
  ChevronRight, 
  ChevronLeft, 
  X, 
  Save, 
  Trash2, 
  LogOut, 
  Sun, 
  Maximize2, 
  Droplet,
  Info,
  ArrowLeft,
  ZoomIn,
  Search,
  AlertTriangle,
  FlaskConical,
  Download,
  Upload,
  Database
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Grow, DiaryEntry, Fertilizer } from './types';
import { analyzeGrowEntry, getDailyRecommendation, DailyRecommendation } from './services/geminiService';
import ReactMarkdown from 'react-markdown';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { storage } from './services/storageService';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

// --- Error Handling ---

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, errorInfo: string | null }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, errorInfo: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, errorInfo: error.message };
  }

  render() {
    if (this.state.hasError) {
      let displayMessage = "Ocorreu um erro inesperado.";
      try {
        const parsed = JSON.parse(this.state.errorInfo || "");
        if (parsed.error && parsed.error.includes("permission-denied")) {
          displayMessage = "Você não tem permissão para realizar esta ação ou acessar estes dados.";
        }
      } catch (e) {
        // Not JSON
      }
      return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
          <X size={48} className="text-rose-500 mb-4" />
          <h2 className="text-xl font-bold mb-2">Ops! Algo deu errado</h2>
          <p className="text-zinc-400 mb-6">{displayMessage}</p>
          <Button onClick={() => window.location.reload()}>Recarregar App</Button>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- Components ---

const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false }: any) => {
  const base = "px-4 py-2 rounded-xl font-medium transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50";
  const variants: any = {
    primary: "bg-emerald-600 text-white hover:bg-emerald-700",
    secondary: "bg-zinc-800 text-zinc-100 hover:bg-zinc-700",
    danger: "bg-rose-600 text-white hover:bg-rose-700",
    ghost: "bg-transparent text-zinc-400 hover:text-zinc-100"
  };
  return (
    <button onClick={onClick} className={`${base} ${variants[variant]} ${className}`} disabled={disabled}>
      {children}
    </button>
  );
};

const Input = ({ label, value, onChange, type = "text", placeholder = "", multiline = false }: any) => (
  <div className="flex flex-col gap-1.5 w-full scroll-mt-24">
    {label && <label className="micro-label">{label}</label>}
    {multiline ? (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-zinc-900 border border-white/5 rounded-2xl px-4 py-4 text-zinc-100 focus:outline-none focus:border-emerald-500 min-h-[120px] resize-none text-sm leading-relaxed"
      />
    ) : (
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-zinc-900 border border-white/5 rounded-2xl px-4 py-4 text-zinc-100 focus:outline-none focus:border-emerald-500 text-sm"
      />
    )}
  </div>
);

const PhotoViewer = ({ photos, initialIndex, onClose }: { photos: string[], initialIndex: number, onClose: () => void }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const imgRef = useRef<HTMLImageElement>(null);

  const onUpdate = useCallback(({ x, y, scale }: any) => {
    if (imgRef.current) {
      const value = make3dTransformValue({ x, y, scale });
      imgRef.current.style.setProperty('transform', value);
    }
  }, []);

  const next = () => setCurrentIndex((prev) => (prev + 1) % photos.length);
  const prev = () => setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center"
    >
      <div className="absolute top-4 right-4 z-50 flex gap-2">
        <button onClick={onClose} className="p-2 bg-white/10 rounded-full text-white backdrop-blur-md">
          <X size={24} />
        </button>
      </div>

      <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
        <QuickPinchZoom onUpdate={onUpdate} containerProps={{ className: 'w-full h-full' }}>
          <img
            ref={imgRef}
            src={photos[currentIndex]}
            className="max-w-full max-h-full object-contain"
            referrerPolicy="no-referrer"
            alt={`Photo ${currentIndex + 1}`}
          />
        </QuickPinchZoom>

        {photos.length > 1 && (
          <>
            <button onClick={prev} className="absolute left-4 p-4 text-white/30 hover:text-white transition-colors z-10">
              <ChevronLeft size={48} />
            </button>
            <button onClick={next} className="absolute right-4 p-4 text-white/30 hover:text-white transition-colors z-10">
              <ChevronRight size={48} />
            </button>
          </>
        )}
      </div>

      <div className="absolute bottom-8 flex gap-2 z-10">
        {photos.map((_, i) => (
          <div key={`pv-dot-${i}`} className={`w-2 h-2 rounded-full transition-all ${i === currentIndex ? 'bg-emerald-500 w-4' : 'bg-white/20'}`} />
        ))}
      </div>
    </motion.div>
  );
};

const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel, variant = 'danger' }: any) => (
  <AnimatePresence>
    {isOpen && (
      <motion.div 
        key="confirm-modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
      >
        <motion.div 
          key="confirm-modal-content"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-zinc-900 border border-white/10 p-6 rounded-[32px] max-w-sm w-full shadow-2xl"
        >
          <h3 className="text-xl font-bold mb-2">{title}</h3>
          <p className="text-zinc-400 text-sm mb-6 leading-relaxed">{message}</p>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1 py-3" onClick={onCancel}>Cancelar</Button>
            <Button variant={variant} className="flex-1 py-3" onClick={onConfirm}>Confirmar</Button>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

const getDaysBetween = (start: string, end: string = new Date().toISOString()) => {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

const StageIcon = ({ stage, size = 24, className = "" }: { stage: string, size?: number, className?: string }) => {
  switch (stage) {
    case 'Seedling':
      return <Sprout size={size} className={className} />;
    case 'Vegetative':
      return <Leaf size={size} className={className} />;
    case 'Flowering':
      return <Flower2 size={size} className={className} />;
    case 'Harvested':
      return <CheckCircle2 size={size} className={className} />;
    case 'Curing':
      return <FlaskConical size={size} className={className} />;
    default:
      return <Leaf size={size} className={className} />;
  }
};

const calculateVPD = (temp: number, humidity: number) => {
  // SVP = 0.61078 * exp((17.27 * T) / (T + 237.3))
  const svp = 0.61078 * Math.exp((17.27 * temp) / (temp + 237.3));
  // AVPD = SVP * (1 - (RH / 100))
  const vpd = svp * (1 - (humidity / 100));
  return vpd;
};

const getVPDStatus = (vpd: number, stage: string) => {
  // Simplified VPD ranges for cannabis
  // Seedling: 0.4 - 0.8
  // Veg: 0.8 - 1.2
  // Flower: 1.2 - 1.6
  
  let ideal = [0.8, 1.2];
  if (stage === 'Seedling') ideal = [0.4, 0.8];
  if (stage === 'Flowering') ideal = [1.2, 1.6];
  
  if (vpd < ideal[0]) return { label: 'Muito Úmido', color: 'text-blue-400' };
  if (vpd > ideal[1]) return { label: 'Muito Seco', color: 'text-orange-400' };
  return { label: 'Ideal', color: 'text-emerald-400' };
};

const Timeline = ({ currentStage, createdAt, estimatedDays }: { currentStage: string, createdAt: string, estimatedDays?: number }) => {
  const stages = [
    { id: 'Seedling', label: 'Semente' },
    { id: 'Vegetative', label: 'Vegetativo' },
    { id: 'Flowering', label: 'Floração' },
    { id: 'Harvested', label: 'Colheita' },
    { id: 'Curing', label: 'Cura' }
  ];
  
  const days = getDaysBetween(createdAt);
  const currentIndex = stages.findIndex(s => s.id === currentStage);
  const progress = estimatedDays ? Math.min((days / estimatedDays) * 100, 100) : ((currentIndex) / (stages.length - 1)) * 100;

  return (
    <div className="bg-zinc-900/40 border border-white/5 rounded-[32px] p-6 mb-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex flex-col">
          <h3 className="text-sm font-bold text-zinc-100">Progresso do Cultivo</h3>
          <p className="text-[10px] text-zinc-500 font-bold">
            dia {days} / {estimatedDays ? `${estimatedDays} dias até a colheita` : 'ciclo em andamento'}
          </p>
        </div>
        <div className="px-3 py-1 bg-emerald-500/10 rounded-full flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
          <span className="text-[10px] font-black text-emerald-500 uppercase tracking-wider">Ativo</span>
        </div>
      </div>

      <div className="relative h-1.5 bg-zinc-800 rounded-full mb-8 mx-2">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          className="absolute top-0 left-0 h-full bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]"
        />
        <div className="absolute top-1/2 -translate-y-1/2 w-full flex justify-between px-0">
          {stages.map((stage, i) => (
            <div key={stage.id} className="relative flex flex-col items-center">
              <div className={`w-3 h-3 rounded-full border-2 transition-all duration-500 ${
                i <= currentIndex ? 'bg-emerald-500 border-emerald-500 scale-110' : 'bg-zinc-900 border-zinc-700'
              }`} />
              <span className={`absolute top-6 text-[10px] font-bold whitespace-nowrap transition-colors duration-500 ${
                i === currentIndex ? 'text-emerald-500' : 'text-zinc-500'
              }`}>
                {stage.label}
              </span>
            </div>
          ))}
        </div>
      </div>
      
      <div className="flex justify-between items-center mt-4">
        <p className="text-[11px] text-zinc-500 font-medium">
          Fase: <span className="text-emerald-500 font-bold">{stages[currentIndex]?.label}</span>
        </p>
        {estimatedDays && (
          <p className="text-[11px] text-zinc-500 font-medium">
            Faltam: <span className="text-zinc-100 font-bold">{Math.max(estimatedDays - days, 0)} dias</span>
          </p>
        )}
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [loading, setLoading] = useState(true);
  const [grows, setGrows] = useState<Grow[]>([]);
  const [selectedGrow, setSelectedGrow] = useState<Grow | null>(null);
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [isAddingGrow, setIsAddingGrow] = useState(false);
  const [isEditingGrow, setIsEditingGrow] = useState(false);
  const [isAddingEntry, setIsAddingEntry] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DiaryEntry | null>(null);
  const [viewingPhotos, setViewingPhotos] = useState<{ photos: string[], index: number } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'grow' | 'entry', id?: string } | null>(null);
  const [showBackupModal, setShowBackupModal] = useState(false);

  // Form States
  const [newGrow, setNewGrow] = useState({ 
    name: '', 
    strain: '', 
    seedType: 'Photoperiod' as 'Automatic' | 'Photoperiod',
    stage: 'Seedling' as any, 
    environment: 'Indoor' as any, 
    space: '', 
    lighting: '',
    substrate: '',
    potSize: '',
    estimatedDays: '',
    availableFertilizers: [] as { name: string; npk?: string }[]
  });
  const [newEntry, setNewEntry] = useState({ 
    notes: '', 
    photos: [] as string[], 
    fertilizers: [] as Fertilizer[],
    temperature: '',
    humidity: '',
    ph: '',
    ec: '',
    height: ''
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [tempFertName, setTempFertName] = useState('');
  const [tempFertNPK, setTempFertNPK] = useState('');
  const [isAddingFert, setIsAddingFert] = useState(false);
  const [activeTab, setActiveTab] = useState<'diary' | 'analytics' | 'evolution'>('diary');
  const [dailyRecommendation, setDailyRecommendation] = useState<DailyRecommendation | null>(null);
  const [isFetchingRecommendation, setIsFetchingRecommendation] = useState(false);

  // Load data from IndexedDB on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const savedGrows = await storage.getAllGrows();
        setGrows(savedGrows);
      } catch (e) {
        console.error("Error loading data from IndexedDB", e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Save data to IndexedDB whenever grows change
  useEffect(() => {
    if (!loading) {
      storage.saveAllGrows(grows).catch(e => console.error("Error saving to IndexedDB", e));
    }
  }, [grows, loading]);

  useEffect(() => {
    if (!selectedGrow) {
      setEntries([]);
      return;
    }
    // In local mode, entries are part of the grow object
    setEntries(selectedGrow.entries || []);
  }, [selectedGrow]);

  useEffect(() => {
    if (!selectedGrow) {
      setDailyRecommendation(null);
      return;
    }

    const fetchRecommendation = async () => {
      setIsFetchingRecommendation(true);
      try {
        const rec = await getDailyRecommendation(selectedGrow, entries);
        setDailyRecommendation(rec);
      } catch (error) {
        console.error("Error fetching daily recommendation:", error);
      } finally {
        setIsFetchingRecommendation(false);
      }
    };

    fetchRecommendation();
  }, [selectedGrow?.id]);



  const handleCreateGrow = () => {
    const now = new Date().toISOString();
    const newGrowObj: Grow = {
      ...newGrow,
      id: Math.random().toString(36).substr(2, 9),
      estimatedDays: newGrow.estimatedDays ? parseInt(newGrow.estimatedDays) : null,
      createdAt: now,
      stageStartDate: now,
      entries: []
    } as any;
    
    setGrows(prev => [newGrowObj, ...prev]);
    setIsAddingGrow(false);
    setNewGrow({ 
      name: '', 
      strain: '', 
      seedType: 'Photoperiod', 
      stage: 'Seedling', 
      environment: 'Indoor', 
      space: '', 
      lighting: '',
      substrate: '',
      potSize: '',
      estimatedDays: '',
      availableFertilizers: []
    });
  };

  const handleUpdateGrow = () => {
    if (!selectedGrow?.id) return;
    
    const updateData: any = { 
      ...newGrow,
      estimatedDays: newGrow.estimatedDays ? parseInt(newGrow.estimatedDays) : null
    };
    
    if (newGrow.stage !== selectedGrow.stage) {
      updateData.stageStartDate = new Date().toISOString();
    }
    
    const updatedGrows = grows.map(g => g.id === selectedGrow.id ? { ...g, ...updateData } : g);
    setGrows(updatedGrows);
    setSelectedGrow(prev => prev ? { ...prev, ...updateData } : null);
    setIsEditingGrow(false);
  };

  const handleDeleteGrow = () => {
    if (!selectedGrow?.id) return;
    setGrows(prev => prev.filter(g => g.id !== selectedGrow.id));
    setSelectedGrow(null);
    setConfirmDelete(null);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewEntry(prev => ({ ...prev, photos: [...prev.photos, reader.result as string] }));
      };
      reader.readAsDataURL(file);
    });
  };

  const handleAddFertilizer = () => {
    setNewEntry(prev => ({
      ...prev,
      fertilizers: [...prev.fertilizers, { name: '', npk: '', amount: '' }]
    }));
  };

  const handleRetryAnalysis = async (entry: DiaryEntry) => {
    if (!selectedGrow?.id) return;
    setIsAnalyzing(true);
    
    try {
      const analysis = await analyzeGrowEntry(entry.photos, entry.notes, selectedGrow);
      
      const updatedEntry: DiaryEntry = {
        ...entry,
        aiSuggestions: analysis.suggestions,
        detectedStage: analysis.detectedStage as any,
        aiAlerts: analysis.alerts,
        idealPH: analysis.idealPH,
        idealEC: analysis.idealEC,
        fertCombination: analysis.fertCombination,
      };

      const updatedGrows = grows.map(g => {
        if (g.id === selectedGrow.id) {
          const updatedEntries = (g.entries || []).map(e => e.id === entry.id ? updatedEntry : e);
          return { ...g, entries: updatedEntries };
        }
        return g;
      });

      setGrows(updatedGrows);
      const updatedSelected = updatedGrows.find(g => g.id === selectedGrow.id);
      if (updatedSelected) setSelectedGrow(updatedSelected);
    } catch (error) {
      console.error("Error retrying analysis:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveEntry = async () => {
    if (!selectedGrow?.id) return;
    setIsAnalyzing(true);
    
    try {
      let analysis = { 
        suggestions: editingEntry?.aiSuggestions || '', 
        detectedStage: editingEntry?.detectedStage || selectedGrow.stage,
        alerts: editingEntry?.aiAlerts || [],
        idealPH: editingEntry?.idealPH || '',
        idealEC: editingEntry?.idealEC || '',
        fertCombination: editingEntry?.fertCombination || ''
      };
      
      if (!editingEntry || newEntry.photos.length !== editingEntry.photos.length || newEntry.notes !== editingEntry.notes) {
        analysis = await analyzeGrowEntry(newEntry.photos, newEntry.notes, selectedGrow);
      }
      
      const entryData: DiaryEntry = {
        id: editingEntry?.id || Math.random().toString(36).substr(2, 9),
        growId: selectedGrow.id,
        date: editingEntry ? editingEntry.date : new Date().toISOString(),
        notes: newEntry.notes,
        photos: newEntry.photos,
        fertilizers: newEntry.fertilizers,
        aiSuggestions: analysis.suggestions,
        detectedStage: analysis.detectedStage as any,
        aiAlerts: analysis.alerts,
        idealPH: analysis.idealPH,
        idealEC: analysis.idealEC,
        fertCombination: analysis.fertCombination,
        temperature: newEntry.temperature,
        humidity: newEntry.humidity,
        ph: newEntry.ph,
        ec: newEntry.ec,
        height: newEntry.height
      };

      const updatedGrows = grows.map(g => {
        if (g.id === selectedGrow.id) {
          let updatedEntries = [...(g.entries || [])];
          if (editingEntry?.id) {
            updatedEntries = updatedEntries.map(e => e.id === editingEntry.id ? entryData : e);
          } else {
            updatedEntries = [entryData, ...updatedEntries];
          }

          const growUpdate: any = {
            entries: updatedEntries
          };

          if (analysis.detectedStage && analysis.detectedStage !== g.stage) {
            growUpdate.stage = analysis.detectedStage;
            growUpdate.stageStartDate = new Date().toISOString();
          }

          return { ...g, ...growUpdate };
        }
        return g;
      });

      setGrows(updatedGrows);
      const updatedSelected = updatedGrows.find(g => g.id === selectedGrow.id);
      if (updatedSelected) setSelectedGrow(updatedSelected);

      setIsAddingEntry(false);
      setEditingEntry(null);
      setNewEntry({ 
        notes: '', 
        photos: [], 
        fertilizers: [],
        temperature: '',
        humidity: '',
        ph: '',
        ec: '',
        height: ''
      });
    } catch (error) {
      console.error("Error saving entry:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleExportData = () => {
    const dataStr = JSON.stringify(grows, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `growmaster_backup_${format(new Date(), 'yyyy-MM-dd')}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target?.result as string);
        if (Array.isArray(importedData)) {
          if (window.confirm("Isso irá substituir seus dados atuais. Deseja continuar?")) {
            setGrows(importedData);
            alert("Dados importados com sucesso!");
          }
        } else {
          alert("Arquivo de backup inválido.");
        }
      } catch (err) {
        alert("Erro ao ler o arquivo de backup.");
      }
    };
    reader.readAsText(file);
  };

  const handleDeleteEntry = (entryId: string) => {
    if (!selectedGrow?.id) return;
    const updatedGrows = grows.map(g => {
      if (g.id === selectedGrow.id) {
        return {
          ...g,
          entries: (g.entries || []).filter(e => e.id !== entryId)
        };
      }
      return g;
    });
    setGrows(updatedGrows);
    const updatedSelected = updatedGrows.find(g => g.id === selectedGrow.id);
    if (updatedSelected) setSelectedGrow(updatedSelected);
    setConfirmDelete(null);
  };

  const openEditGrow = () => {
    if (!selectedGrow) return;
    setNewGrow({
      name: selectedGrow.name,
      strain: selectedGrow.strain,
      seedType: selectedGrow.seedType || 'Photoperiod',
      stage: selectedGrow.stage,
      environment: selectedGrow.environment,
      space: selectedGrow.space,
      lighting: selectedGrow.lighting,
      substrate: selectedGrow.substrate || '',
      potSize: selectedGrow.potSize || '',
      estimatedDays: selectedGrow.estimatedDays?.toString() || '',
      availableFertilizers: selectedGrow.availableFertilizers || []
    });
    setIsEditingGrow(true);
  };

  const openEditEntry = (entry: DiaryEntry) => {
    setEditingEntry(entry);
    setNewEntry({
      notes: entry.notes,
      photos: entry.photos,
      fertilizers: entry.fertilizers,
      temperature: entry.temperature || '',
      humidity: entry.humidity || '',
      ph: entry.ph || '',
      ec: entry.ec || '',
      height: entry.height || ''
    });
    setIsAddingEntry(true);
  };

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <motion.div 
        animate={{ rotate: 360 }} 
        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
      >
        <Leaf className="text-emerald-500" size={48} />
      </motion.div>
    </div>
  );

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-black text-zinc-100 font-sans pb-24 selection:bg-emerald-500/30">
      {/* Header */}
      <header className="p-6 flex items-center justify-between sticky top-0 bg-black/80 backdrop-blur-xl border-b border-white/5 z-30">
        <div className="flex items-center gap-3">
          {selectedGrow ? (
            <button onClick={() => setSelectedGrow(null)} className="p-2 -ml-2 hover:bg-zinc-800 rounded-full transition-colors">
              <ArrowLeft size={24} />
            </button>
          ) : (
            <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
              <Leaf className="text-emerald-500" size={24} />
            </div>
          )}
          <div>
            <h1 className="font-bold text-lg leading-tight truncate max-w-[180px]">
              {selectedGrow ? selectedGrow.name : "Meus Cultivos"}
            </h1>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black">
              {selectedGrow ? selectedGrow.strain : "GrowMaster BAN"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selectedGrow && (
            <button onClick={openEditGrow} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400">
              <Settings size={20} />
            </button>
          )}
          <button 
            onClick={() => setShowBackupModal(true)}
            className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400"
            title="Backup"
          >
            <Database size={20} />
          </button>
        </div>
      </header>

      <main className="p-6 max-w-2xl mx-auto">
        {!selectedGrow ? (
          <div className="grid gap-4">
            {grows.map((grow, index) => (
              <motion.div
                key={`grow-${grow.id}-${index}`}
                layoutId={`grow-${grow.id}-${index}`}
                onClick={() => setSelectedGrow(grow)}
                className="bg-zinc-900/50 p-5 rounded-3xl border border-white/5 flex items-center justify-between active:scale-[0.98] transition-all hover:bg-zinc-900"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20">
                    <StageIcon stage={grow.stage} size={28} className="text-emerald-500" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{grow.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-zinc-500">
                      <span className="px-2 py-0.5 bg-emerald-500/10 rounded-md text-[10px] uppercase font-black text-emerald-500">
                        {grow.stage}
                      </span>
                      <span>•</span>
                      <span className="text-[10px] font-bold text-zinc-400">DIA {getDaysBetween(grow.createdAt)}</span>
                      <span>•</span>
                      <span className="truncate max-w-[80px]">{grow.strain}</span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="text-zinc-700" size={20} />
              </motion.div>
            ))}

            {grows.length === 0 && (
              <div className="text-center py-24 opacity-30">
                <Search size={64} className="mx-auto mb-6" />
                <p className="text-lg font-medium">Nenhum cultivo encontrado.</p>
                <p className="text-sm">Toque no + para começar.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center">
            {/* Plant Header */}
            <div className="flex flex-col items-center mb-8">
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-24 h-24 bg-emerald-500/10 rounded-[40px] flex items-center justify-center mb-4 border border-emerald-500/20 shadow-2xl shadow-emerald-500/5"
              >
                <StageIcon stage={selectedGrow.stage} size={48} className="text-emerald-500" />
              </motion.div>
              <h2 className="text-4xl font-black text-white tracking-tight mb-1">{selectedGrow.name}</h2>
              <p className="text-zinc-500 font-medium uppercase tracking-[0.2em] text-xs">{selectedGrow.strain || "Kush"}</p>
              
              <div className="mt-4 px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">
                  {selectedGrow.stage === 'Seedling' ? 'Semente' : 
                   selectedGrow.stage === 'Vegetative' ? 'Vegetativo' : 
                   selectedGrow.stage === 'Flowering' ? 'Floração' : 
                   selectedGrow.stage === 'Harvested' ? 'Colheita' : 'Cura'}
                </span>
              </div>
            </div>

            <div className="w-full max-w-md">
              <Timeline currentStage={selectedGrow.stage} createdAt={selectedGrow.createdAt} estimatedDays={selectedGrow.estimatedDays} />

              <div className="grid grid-cols-5 gap-2 mb-8">
                <div className="bg-zinc-900/40 p-3 rounded-[24px] border border-white/5 flex flex-col items-center justify-center text-center group hover:bg-zinc-900/60 transition-colors">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-2 text-emerald-500 group-hover:scale-110 transition-transform">
                    <Calendar size={16} />
                  </div>
                  <p className="text-emerald-500 font-black text-sm leading-none mb-1">{getDaysBetween(selectedGrow.createdAt)}d</p>
                  <p className="text-[8px] text-zinc-500 uppercase font-bold tracking-widest">Dias</p>
                </div>

                <div className="bg-zinc-900/40 p-3 rounded-[24px] border border-white/5 flex flex-col items-center justify-center text-center group hover:bg-zinc-900/60 transition-colors">
                  <div className="w-8 h-8 rounded-xl bg-orange-500/10 flex items-center justify-center mb-2 text-orange-500 group-hover:scale-110 transition-transform">
                    <Droplet size={16} />
                  </div>
                  <p className="text-zinc-100 font-black text-[10px] leading-none mb-1">{selectedGrow.seedType === 'Automatic' ? 'Auto' : 'Foto'}</p>
                  <p className="text-[8px] text-zinc-500 uppercase font-bold tracking-widest">Tipo</p>
                </div>

                <div className="bg-zinc-900/40 p-3 rounded-[24px] border border-white/5 flex flex-col items-center justify-center text-center group hover:bg-zinc-900/60 transition-colors">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center mb-2 text-blue-500 group-hover:scale-110 transition-transform">
                    <Sun size={16} />
                  </div>
                  <p className="text-zinc-100 font-black text-[10px] leading-none mb-1">{selectedGrow.environment}</p>
                  <p className="text-[8px] text-zinc-500 uppercase font-bold tracking-widest">Amb</p>
                </div>

                <div className="bg-zinc-900/40 p-3 rounded-[24px] border border-white/5 flex flex-col items-center justify-center text-center group hover:bg-zinc-900/60 transition-colors">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center mb-2 text-amber-500 group-hover:scale-110 transition-transform">
                    <Leaf size={16} />
                  </div>
                  <p className="text-zinc-100 font-black text-[10px] leading-none mb-1 truncate w-full">{selectedGrow.substrate || "Terra"}</p>
                  <p className="text-[8px] text-zinc-500 uppercase font-bold tracking-widest">Subst</p>
                </div>

                <div className="bg-zinc-900/40 p-3 rounded-[24px] border border-white/5 flex flex-col items-center justify-center text-center group hover:bg-zinc-900/60 transition-colors">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center mb-2 text-purple-500 group-hover:scale-110 transition-transform">
                    <Maximize2 size={16} />
                  </div>
                  <p className="text-zinc-100 font-black text-[10px] leading-none mb-1">{selectedGrow.potSize || "10L"}</p>
                  <p className="text-[8px] text-zinc-500 uppercase font-bold tracking-widest">Vaso</p>
                </div>
              </div>

              <div className="flex bg-zinc-900/60 p-1 rounded-[28px] border border-white/5 mb-8">
                {(['diary', 'analytics', 'evolution'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-3 rounded-[24px] text-[10px] font-black uppercase tracking-widest transition-all ${
                      activeTab === tab 
                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {tab === 'diary' ? 'Diário' : tab === 'analytics' ? 'Análise' : 'Evolução'}
                  </button>
                ))}
              </div>

              {activeTab === 'diary' && (
                <>
                  {/* Daily Recommendation */}
              <AnimatePresence mode="wait">
                {(isFetchingRecommendation || dailyRecommendation) && (
                  <motion.div 
                    key="daily-recommendation"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="mb-8 bg-zinc-900/60 rounded-[32px] border border-emerald-500/20 overflow-hidden shadow-2xl shadow-emerald-500/5"
                  >
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
                            <Info size={20} className="text-emerald-500" />
                          </div>
                          <div>
                            <h3 className="text-sm font-black text-white uppercase tracking-wider">Recomendação Diária</h3>
                            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Gerado por IA</p>
                          </div>
                        </div>
                        {dailyRecommendation && (
                          <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${
                            dailyRecommendation.priority === 'High' ? 'bg-rose-500/20 text-rose-500' :
                            dailyRecommendation.priority === 'Medium' ? 'bg-amber-500/20 text-amber-500' :
                            'bg-blue-500/20 text-blue-500'
                          }`}>
                            Prioridade {dailyRecommendation.priority === 'High' ? 'Alta' : dailyRecommendation.priority === 'Medium' ? 'Média' : 'Baixa'}
                          </div>
                        )}
                      </div>

                      {isFetchingRecommendation ? (
                        <div className="flex flex-col gap-3">
                          <div className="h-4 w-full bg-white/5 rounded-full animate-pulse" />
                          <div className="h-4 w-2/3 bg-white/5 rounded-full animate-pulse" />
                        </div>
                      ) : dailyRecommendation && (
                        <div className="space-y-4">
                          <p className="text-sm text-zinc-300 leading-relaxed italic">
                            "{dailyRecommendation.tip}"
                          </p>
                          <div className="bg-emerald-500/10 p-4 rounded-2xl border border-emerald-500/10">
                            <div className="flex items-center gap-2 mb-1">
                              <CheckCircle2 size={14} className="text-emerald-500" />
                              <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Tarefa de Hoje</span>
                            </div>
                            <p className="text-xs text-emerald-500/90 font-medium">
                              {dailyRecommendation.actionable}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

                  <Button variant="primary" className="w-full py-5 rounded-[24px] shadow-2xl shadow-emerald-600/20 text-lg mb-12" onClick={() => {
                    setNewEntry({ 
                      notes: '', 
                      photos: [], 
                      fertilizers: [],
                      temperature: '',
                      humidity: '',
                      ph: '',
                      ec: '',
                      height: ''
                    });
                    setEditingEntry(null);
                    setIsAddingEntry(true);
                  }}>
                    <Plus size={24} /> Novo Registro
                  </Button>

                  {/* Timeline */}
                  <div className="grid gap-6">
                    <h2 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] px-2">Histórico Cronológico</h2>
                    {entries.map((entry, index) => (
                      <div key={`entry-${entry.id}-${index}`} className="bg-zinc-900/40 rounded-3xl border border-white/5 overflow-hidden group">
                        <div className="p-5 border-b border-white/5 flex justify-between items-center bg-zinc-900/20">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                              <Calendar size={14} className="text-emerald-500" />
                            </div>
                            <span className="text-sm font-bold">{format(new Date(entry.date), "dd 'de' MMMM", { locale: ptBR })}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {entry.detectedStage && (
                              <div className="flex flex-col items-end">
                                <span className="micro-label !text-[8px] opacity-50">Estágio Detectado</span>
                                <span className="text-[10px] text-emerald-500 font-black uppercase tracking-wider">
                                  {entry.detectedStage}
                                </span>
                              </div>
                            )}
                            <button onClick={() => openEditEntry(entry)} className="p-2 text-zinc-600 hover:text-zinc-300 transition-colors">
                              <Settings size={16} />
                            </button>
                          </div>
                        </div>
                        
                        {entry.photos.length > 0 && (
                          <div className="flex gap-3 p-5 overflow-x-auto no-scrollbar">
                            {entry.photos.map((photo, i) => (
                              <motion.div 
                                key={`entry-photo-${entry.id}-${i}`}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className="relative flex-shrink-0"
                              >
                                <img 
                                  src={photo} 
                                  onClick={() => setViewingPhotos({ photos: entry.photos, index: i })}
                                  className="w-32 h-32 rounded-2xl object-cover border border-white/10 shadow-lg cursor-zoom-in" 
                                  referrerPolicy="no-referrer"
                                />
                                <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded-md text-[8px] font-black text-white/80 uppercase tracking-tighter">
                                  IMG_{i+1}
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        )}

                        <div className="p-5 pt-0 space-y-6">
                          {/* Metrics Display */}
                          {(entry.temperature || entry.humidity || entry.ph || entry.ec || entry.height) && (
                            <div className="grid grid-cols-5 gap-2 pb-2">
                              {entry.temperature && (
                                <div className="bg-emerald-500/10 px-2 py-2 rounded-xl border border-emerald-500/10 flex flex-col items-center">
                                  <span className="text-[7px] text-emerald-500/60 uppercase font-black">Temp</span>
                                  <span className="text-[10px] font-bold text-emerald-500">{entry.temperature}°</span>
                                </div>
                              )}
                              {entry.humidity && (
                                <div className="bg-blue-400/10 px-2 py-2 rounded-xl border border-blue-400/10 flex flex-col items-center">
                                  <span className="text-[7px] text-blue-400/60 uppercase font-black">Umid</span>
                                  <span className="text-[10px] font-bold text-blue-400">{entry.humidity}%</span>
                                </div>
                              )}
                              {entry.ph && (
                                <div className="bg-amber-500/10 px-2 py-2 rounded-xl border border-amber-500/10 flex flex-col items-center">
                                  <span className="text-[7px] text-amber-500/60 uppercase font-black">pH</span>
                                  <span className="text-[10px] font-bold text-amber-500">{entry.ph}</span>
                                </div>
                              )}
                              {entry.ec && (
                                <div className="bg-purple-400/10 px-2 py-2 rounded-xl border border-purple-400/10 flex flex-col items-center">
                                  <span className="text-[7px] text-purple-400/60 uppercase font-black">EC</span>
                                  <span className="text-[10px] font-bold text-purple-400">{entry.ec}</span>
                                </div>
                              )}
                              {entry.height && (
                                <div className="bg-zinc-100/10 px-2 py-2 rounded-xl border border-zinc-100/10 flex flex-col items-center">
                                  <span className="text-[7px] text-zinc-100/60 uppercase font-black">Alt</span>
                                  <span className="text-[10px] font-bold text-zinc-100">{entry.height}</span>
                                </div>
                              )}
                            </div>
                          )}

                          {entry.notes && (
                            <div className="relative">
                              <div className="absolute -left-5 top-0 w-1 h-full bg-emerald-500/10 rounded-full" />
                              <p className="text-sm text-zinc-400 leading-relaxed">{entry.notes}</p>
                            </div>
                          )}
                          
                          {entry.fertilizers.length > 0 && (
                            <div className="bg-black/20 rounded-2xl p-4 border border-white/5">
                              <p className="micro-label mb-3">Protocolo de Nutrição</p>
                              <div className="grid gap-2">
                                {entry.fertilizers.map((f, i) => (
                                  <div key={`fert-${entry.id}-${i}`} className="flex items-center justify-between text-[11px] py-2 border-b border-white/5 last:border-0">
                                    <div className="flex items-center gap-2">
                                      <Droplet size={12} className="text-blue-400" />
                                      <span className="font-bold text-zinc-200">{f.name}</span>
                                      <span className="text-zinc-500 font-mono bg-zinc-800/50 px-1.5 py-0.5 rounded uppercase">{f.npk}</span>
                                    </div>
                                    <span className="text-emerald-500 font-black bg-emerald-500/10 px-2 py-0.5 rounded-md">{f.amount}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {entry.aiSuggestions && (
                            <div className="bg-emerald-500/[0.03] border border-emerald-500/10 p-5 rounded-2xl relative overflow-hidden space-y-4">
                              <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500/20" />
                              
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Info size={14} className="text-emerald-500" />
                                  <p className="micro-label !text-emerald-500">Análise GrowMaster AI</p>
                                </div>
                                <div className="flex items-center gap-3">
                                  <button 
                                    onClick={() => handleRetryAnalysis(entry)}
                                    disabled={isAnalyzing}
                                    className="text-[9px] font-black text-emerald-500/60 hover:text-emerald-500 uppercase tracking-widest flex items-center gap-1 transition-colors disabled:opacity-30"
                                  >
                                    <Maximize2 size={10} /> Refazer Análise
                                  </button>
                                  <div className="flex gap-2">
                                  {entry.idealPH && (
                                    <div className="px-2 py-1 bg-blue-500/10 rounded-lg border border-blue-500/20 flex flex-col items-center">
                                      <span className="text-[6px] font-black text-blue-400 uppercase">pH Ideal</span>
                                      <span className="text-[9px] font-bold text-blue-400">{entry.idealPH}</span>
                                    </div>
                                  )}
                                  {entry.idealEC && (
                                    <div className="px-2 py-1 bg-purple-500/10 rounded-lg border border-purple-500/20 flex flex-col items-center">
                                      <span className="text-[6px] font-black text-purple-400 uppercase">EC Ideal</span>
                                      <span className="text-[9px] font-bold text-purple-400">{entry.idealEC}</span>
                                    </div>
                                  )}
                                  </div>
                                </div>
                              </div>

                              {entry.aiAlerts && entry.aiAlerts.length > 0 && (
                                <div className="bg-rose-500/5 border border-rose-500/10 p-3 rounded-xl space-y-2">
                                  <div className="flex items-center gap-2 text-rose-500">
                                    <AlertTriangle size={12} />
                                    <span className="text-[10px] font-black uppercase tracking-wider">Alertas Detectados</span>
                                  </div>
                                  <ul className="list-disc list-inside text-[11px] text-rose-400/80 space-y-1">
                                    {entry.aiAlerts.map((alert, i) => (
                                      <li key={`alert-${entry.id}-${i}`}>{alert}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              <div className="text-xs text-zinc-400 prose prose-invert max-w-none leading-relaxed font-medium">
                                <ReactMarkdown>{entry.aiSuggestions}</ReactMarkdown>
                              </div>

                              {entry.fertCombination && (
                                <div className="bg-emerald-500/5 border border-emerald-500/10 p-3 rounded-xl">
                                  <div className="flex items-center gap-2 text-emerald-500 mb-2">
                                    <FlaskConical size={12} />
                                    <span className="text-[10px] font-black uppercase tracking-wider">Mix Recomendado</span>
                                  </div>
                                  <p className="text-[11px] text-zinc-300 leading-relaxed italic">
                                    {entry.fertCombination}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {activeTab === 'analytics' && (
                <div className="space-y-6">
                  {/* VPD Card */}
                  {entries.length > 0 && entries[0].temperature && entries[0].humidity && (
                    <div className="bg-zinc-900/40 rounded-[32px] border border-white/5 p-6">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                            <Droplet size={20} className="text-blue-400" />
                          </div>
                          <div>
                            <h3 className="text-sm font-black text-white uppercase tracking-wider">VPD Atual</h3>
                            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Déficit de Pressão de Vapor</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-xl font-black ${getVPDStatus(calculateVPD(Number(entries[0].temperature), Number(entries[0].humidity)), selectedGrow.stage).color}`}>
                            {calculateVPD(Number(entries[0].temperature), Number(entries[0].humidity)).toFixed(2)} kPa
                          </p>
                          <p className={`text-[10px] font-black uppercase tracking-widest ${getVPDStatus(calculateVPD(Number(entries[0].temperature), Number(entries[0].humidity)), selectedGrow.stage).color}`}>
                            {getVPDStatus(calculateVPD(Number(entries[0].temperature), Number(entries[0].humidity)), selectedGrow.stage).label}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-zinc-400 leading-relaxed">
                        O VPD ideal para o estágio de <span className="text-emerald-500 font-bold">{selectedGrow.stage}</span> ajuda a planta a transpirar corretamente e absorver nutrientes de forma eficiente.
                      </p>
                    </div>
                  )}

                  {/* Charts */}
                  <div className="space-y-8">
                    {/* Temp & Humidity Chart */}
                    <div className="bg-zinc-900/40 rounded-[32px] border border-white/5 p-6">
                      <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-6">Ambiente (°C / %)</h3>
                      <div className="h-48 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={[...entries].reverse()}>
                            <defs>
                              <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                              </linearGradient>
                              <linearGradient id="colorHum" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#60a5fa" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                            <XAxis 
                              dataKey="date" 
                              hide 
                            />
                            <YAxis hide domain={['auto', 'auto']} />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#18181b', border: '1px solid #ffffff10', borderRadius: '16px' }}
                              itemStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}
                            />
                            <Area type="monotone" dataKey="temperature" stroke="#10b981" fillOpacity={1} fill="url(#colorTemp)" strokeWidth={3} name="Temp" />
                            <Area type="monotone" dataKey="humidity" stroke="#60a5fa" fillOpacity={1} fill="url(#colorHum)" strokeWidth={3} name="Umid" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* pH & EC Chart */}
                    <div className="bg-zinc-900/40 rounded-[32px] border border-white/5 p-6">
                      <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-6">Nutrição (pH / EC)</h3>
                      <div className="h-48 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={[...entries].reverse()}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                            <XAxis dataKey="date" hide />
                            <YAxis hide domain={['auto', 'auto']} />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#18181b', border: '1px solid #ffffff10', borderRadius: '16px' }}
                              itemStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}
                            />
                            <Line type="monotone" dataKey="ph" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, fill: '#f59e0b' }} name="pH" />
                            <Line type="monotone" dataKey="ec" stroke="#c084fc" strokeWidth={3} dot={{ r: 4, fill: '#c084fc' }} name="EC" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'evolution' && (
                <div className="space-y-6">
                  <div className="grid gap-8 relative">
                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-zinc-800/50 rounded-full" />
                    
                    {entries.filter(e => e.photos.length > 0).map((entry, idx) => (
                      <div key={`evo-${entry.id}-${idx}`} className="relative pl-12">
                        <div className="absolute left-3 top-2 w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] z-10" />
                        <div className="mb-2">
                          <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                            {format(new Date(entry.date), "dd 'de' MMMM", { locale: ptBR })}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          {entry.photos.map((photo, pIdx) => (
                            <motion.div 
                              key={`evo-photo-${entry.id}-${pIdx}`}
                              whileHover={{ scale: 1.02 }}
                              className="aspect-square rounded-2xl overflow-hidden border border-white/5 bg-zinc-900"
                            >
                              <img 
                                src={photo} 
                                onClick={() => setViewingPhotos({ photos: entry.photos, index: pIdx })}
                                className="w-full h-full object-cover cursor-zoom-in" 
                                referrerPolicy="no-referrer"
                              />
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    ))}

                    {entries.filter(e => e.photos.length > 0).length === 0 && (
                      <div className="text-center py-24 opacity-30">
                        <Camera size={64} className="mx-auto mb-6" />
                        <p className="text-lg font-medium">Nenhuma foto registrada.</p>
                        <p className="text-sm">Adicione fotos nos seus registros diários.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Floating Action Button */}
      {!selectedGrow && (
        <motion.button 
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => {
            setNewGrow({ 
              name: '', 
              strain: '', 
              seedType: 'Photoperiod', 
              stage: 'Seedling', 
              environment: 'Indoor', 
              space: '', 
              lighting: '',
              substrate: '',
              potSize: '',
              estimatedDays: '',
              availableFertilizers: []
            });
            setIsAddingGrow(true);
          }}
          className="fixed bottom-8 right-8 w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-emerald-600/40 active:scale-90 transition-all z-40"
        >
          <Plus size={32} className="text-white" />
        </motion.button>
      )}

      {/* Modals */}
      <AnimatePresence>
        {(isAddingGrow || isEditingGrow) && (
          <motion.div 
            key="grow-modal"
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed inset-0 z-50 bg-black flex flex-col"
          >
            <div className="p-6 flex items-center justify-between border-b border-white/5">
              <h2 className="text-xl font-bold">{isEditingGrow ? "Editar Cultivo" : "Novo Cultivo"}</h2>
              <button onClick={() => { setIsAddingGrow(false); setIsEditingGrow(false); }} className="p-2 bg-zinc-900 rounded-full">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 flex-1 overflow-y-auto space-y-6 pb-40">
              <Input label="Nome do Cultivo" value={newGrow.name} onChange={(v: any) => setNewGrow(p => ({ ...p, name: v }))} placeholder="Ex: Meu Jardim" />
              <Input label="Strain / Genética" value={newGrow.strain} onChange={(v: any) => setNewGrow(p => ({ ...p, strain: v }))} placeholder="Ex: OG Kush" />
              
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="micro-label">Tipo de Semente</label>
                  <select 
                    value={newGrow.seedType} 
                    onChange={(e) => setNewGrow(p => ({ ...p, seedType: e.target.value as any }))}
                    className="bg-zinc-900 border border-white/5 rounded-2xl px-4 py-4 text-zinc-100 focus:outline-none focus:border-emerald-500 appearance-none text-sm"
                  >
                    <option value="Photoperiod">Fotoperíodo</option>
                    <option value="Automatic">Automática</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="micro-label">Ambiente</label>
                  <select 
                    value={newGrow.environment} 
                    onChange={(e) => setNewGrow(p => ({ ...p, environment: e.target.value as any }))}
                    className="bg-zinc-900 border border-white/5 rounded-2xl px-4 py-4 text-zinc-100 focus:outline-none focus:border-emerald-500 appearance-none text-sm"
                  >
                    <option value="Indoor">Indoor</option>
                    <option value="Outdoor">Outdoor</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="micro-label">Estágio Atual</label>
                <select 
                  value={newGrow.stage} 
                  onChange={(e) => setNewGrow(p => ({ ...p, stage: e.target.value as any }))}
                  className="bg-zinc-900 border border-white/5 rounded-2xl px-4 py-4 text-zinc-100 focus:outline-none focus:border-emerald-500 appearance-none text-sm"
                >
                  <option value="Seedling">Seedling</option>
                  <option value="Vegetative">Vegetativo</option>
                  <option value="Flowering">Floração</option>
                  <option value="Harvested">Colhido</option>
                  <option value="Curing">Cura</option>
                </select>
              </div>

              <Input label="Espaço (cm/m)" value={newGrow.space} onChange={(v: any) => setNewGrow(p => ({ ...p, space: v }))} placeholder="Ex: 60x60x140" />
              <Input label="Iluminação" value={newGrow.lighting} onChange={(v: any) => setNewGrow(p => ({ ...p, lighting: v }))} placeholder="Ex: LED 240W Quantum Board" />
              
              <div className="grid grid-cols-2 gap-4">
                <Input label="Substrato" value={newGrow.substrate} onChange={(v: any) => setNewGrow(p => ({ ...p, substrate: v }))} placeholder="Ex: Terra Orgânica" />
                <Input label="Vaso (L)" value={newGrow.potSize} onChange={(v: any) => setNewGrow(p => ({ ...p, potSize: v }))} placeholder="Ex: 10L" />
              </div>

              <Input label="Duração Estimada (Dias)" type="number" value={newGrow.estimatedDays} onChange={(v: any) => setNewGrow(p => ({ ...p, estimatedDays: v }))} placeholder="Ex: 90" />
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="micro-label">Inventário de Fertilizantes</label>
                  {!isAddingFert && (
                    <button 
                      onClick={() => setIsAddingFert(true)}
                      className="text-[10px] font-black text-emerald-500 uppercase bg-emerald-500/10 px-3 py-1.5 rounded-lg"
                    >
                      + Adicionar
                    </button>
                  )}
                </div>

                {isAddingFert && (
                  <div className="flex flex-col gap-2 bg-zinc-900/50 p-3 rounded-2xl border border-white/5">
                    <div className="flex gap-2">
                      <input 
                        autoFocus
                        type="text"
                        value={tempFertName}
                        onChange={(e) => setTempFertName(e.target.value)}
                        placeholder="Nome do fert..."
                        className="flex-1 bg-zinc-900 border border-emerald-500/30 rounded-xl px-4 py-2 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500"
                      />
                      <button 
                        onClick={() => {
                          setIsAddingFert(false);
                          setTempFertName('');
                          setTempFertNPK('');
                        }}
                        className="p-2 bg-zinc-800 rounded-xl text-zinc-400"
                      >
                        <X size={18} />
                      </button>
                    </div>
                    
                    {tempFertName.trim().toLowerCase() !== 'chorume' && tempFertName.trim() !== '' && (
                      <div className="flex gap-2 animate-in fade-in slide-in-from-top-1">
                        <input 
                          type="text"
                          value={tempFertNPK}
                          onChange={(e) => setTempFertNPK(e.target.value)}
                          placeholder="NPK (ex: 10-10-10)"
                          className="flex-1 bg-zinc-900 border border-purple-500/30 rounded-xl px-4 py-2 text-sm text-zinc-100 focus:outline-none focus:border-purple-500"
                        />
                      </div>
                    )}

                    <button 
                      onClick={() => {
                        if (tempFertName.trim()) {
                          const isChorume = tempFertName.trim().toLowerCase() === 'chorume';
                          setNewGrow(p => ({ 
                            ...p, 
                            availableFertilizers: [
                              ...(p.availableFertilizers || []), 
                              { name: tempFertName.trim(), npk: isChorume ? undefined : tempFertNPK.trim() }
                            ] 
                          }));
                          setTempFertName('');
                          setTempFertNPK('');
                          setIsAddingFert(false);
                        }
                      }}
                      className="w-full py-2 bg-emerald-500 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2"
                    >
                      <Plus size={16} /> Confirmar Adição
                    </button>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {newGrow.availableFertilizers?.map((fert, i) => (
                    <div key={`avail-fert-${i}`} className="bg-zinc-900 border border-white/5 px-3 py-2 rounded-xl flex items-center gap-2 group">
                      <FlaskConical size={12} className="text-purple-400" />
                      <div className="flex flex-col">
                        <span className="text-xs text-zinc-300 font-bold">{fert.name}</span>
                        {fert.npk && <span className="text-[8px] text-purple-400 font-mono uppercase">{fert.npk}</span>}
                      </div>
                      <button 
                        onClick={() => setNewGrow(p => ({ ...p, availableFertilizers: p.availableFertilizers?.filter((_, idx) => idx !== i) }))}
                        className="text-zinc-600 hover:text-rose-500 ml-1"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  {(!newGrow.availableFertilizers || newGrow.availableFertilizers.length === 0) && (
                    <p className="text-[10px] text-zinc-600 italic">Nenhum fertilizante no inventário.</p>
                  )}
                </div>
              </div>

              {isEditingGrow && (
                <button 
                  onClick={() => setConfirmDelete({ type: 'grow' })}
                  className="w-full py-4 text-rose-500 font-bold text-sm flex items-center justify-center gap-2 bg-rose-500/5 rounded-2xl border border-rose-500/10 mt-8"
                >
                  <Trash2 size={18} /> Apagar Cultivo Permanentemente
                </button>
              )}
            </div>
            <div className="p-6 border-t border-white/5 bg-zinc-950">
              <Button onClick={isEditingGrow ? handleUpdateGrow : handleCreateGrow} className="w-full py-5 text-lg rounded-2xl" disabled={!newGrow.name}>
                {isEditingGrow ? "Salvar Alterações" : "Criar Cultivo"}
              </Button>
            </div>
          </motion.div>
        )}

        {isAddingEntry && (
          <motion.div 
            key="entry-modal"
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed inset-0 z-50 bg-black flex flex-col"
          >
            <div className="p-6 flex items-center justify-between border-b border-white/5">
              <h2 className="text-xl font-bold">{editingEntry ? "Editar Registro" : "Novo Registro"}</h2>
              <button onClick={() => { setIsAddingEntry(false); setEditingEntry(null); }} className="p-2 bg-zinc-900 rounded-full">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 flex-1 overflow-y-auto space-y-8 pb-40">
              {/* Photos */}
              <div className="flex flex-col gap-3">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Galeria do Registro</label>
                <div className="flex gap-4 overflow-x-auto no-scrollbar py-2">
                  <label className="w-28 h-28 bg-zinc-900 border-2 border-dashed border-white/10 rounded-3xl flex flex-col items-center justify-center gap-2 cursor-pointer flex-shrink-0 active:bg-zinc-800 transition-colors">
                    <Camera className="text-zinc-500" size={28} />
                    <span className="text-[9px] font-black text-zinc-500 uppercase">Adicionar</span>
                    <input type="file" multiple accept="image/*" capture="environment" className="hidden" onChange={handlePhotoUpload} />
                  </label>
                  {newEntry.photos.map((photo, i) => (
                    <div key={`new-photo-${i}`} className="relative flex-shrink-0">
                      <img src={photo} className="w-28 h-28 rounded-3xl object-cover border border-white/10 shadow-xl" referrerPolicy="no-referrer" />
                      <button 
                        onClick={() => setNewEntry(p => ({ ...p, photos: p.photos.filter((_, idx) => idx !== i) }))}
                        className="absolute -top-2 -right-2 bg-rose-600 text-white p-1.5 rounded-full shadow-2xl border-2 border-black"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <Input label="Notas e Observações" value={newEntry.notes} onChange={(v: any) => setNewEntry(p => ({ ...p, notes: v }))} multiline placeholder="Como está a planta hoje? Rega, PH, temperatura, pragas..." />

              {/* Metrics Input Cards */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Métricas do Dia</label>
                <div className="grid grid-cols-5 gap-2 pb-2">
                  <div className="bg-emerald-500/5 p-2 rounded-2xl border border-emerald-500/10 flex flex-col items-center gap-1">
                    <span className="text-[8px] font-black text-emerald-500/50 uppercase">Temp</span>
                    <input 
                      type="text" 
                      value={newEntry.temperature} 
                      onChange={(e) => setNewEntry(p => ({ ...p, temperature: e.target.value }))}
                      placeholder="25"
                      className="bg-transparent text-center w-full font-bold text-emerald-500 focus:outline-none text-xs"
                    />
                  </div>
                  <div className="bg-blue-400/5 p-2 rounded-2xl border border-blue-400/10 flex flex-col items-center gap-1">
                    <span className="text-[8px] font-black text-blue-400/50 uppercase">Umid</span>
                    <input 
                      type="text" 
                      value={newEntry.humidity} 
                      onChange={(e) => setNewEntry(p => ({ ...p, humidity: e.target.value }))}
                      placeholder="60"
                      className="bg-transparent text-center w-full font-bold text-blue-400 focus:outline-none text-xs"
                    />
                  </div>
                  <div className="bg-amber-500/5 p-2 rounded-2xl border border-amber-500/10 flex flex-col items-center gap-1">
                    <span className="text-[8px] font-black text-amber-500/50 uppercase">pH</span>
                    <input 
                      type="text" 
                      value={newEntry.ph} 
                      onChange={(e) => setNewEntry(p => ({ ...p, ph: e.target.value }))}
                      placeholder="6.2"
                      className="bg-transparent text-center w-full font-bold text-amber-500 focus:outline-none text-xs"
                    />
                  </div>
                  <div className="bg-purple-400/5 p-2 rounded-2xl border border-purple-400/10 flex flex-col items-center gap-1">
                    <span className="text-[8px] font-black text-purple-400/50 uppercase">EC</span>
                    <input 
                      type="text" 
                      value={newEntry.ec} 
                      onChange={(e) => setNewEntry(p => ({ ...p, ec: e.target.value }))}
                      placeholder="1.2"
                      className="bg-transparent text-center w-full font-bold text-purple-400 focus:outline-none text-xs"
                    />
                  </div>
                  <div className="bg-zinc-100/5 p-2 rounded-2xl border border-zinc-100/10 flex flex-col items-center gap-1">
                    <span className="text-[8px] font-black text-zinc-100/50 uppercase">Alt</span>
                    <input 
                      type="text" 
                      value={newEntry.height} 
                      onChange={(e) => setNewEntry(p => ({ ...p, height: e.target.value }))}
                      placeholder="45"
                      className="bg-transparent text-center w-full font-bold text-zinc-100 focus:outline-none text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Fertilizers */}
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Fertilizantes & NPK</label>
                  <button onClick={handleAddFertilizer} className="text-xs text-emerald-500 font-black flex items-center gap-1 bg-emerald-500/10 px-3 py-1.5 rounded-lg">
                    <Plus size={14} /> Adicionar
                  </button>
                </div>
                {newEntry.fertilizers.map((fert, i) => (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    key={`new-fert-${i}`} 
                    className="bg-zinc-900/50 p-5 rounded-3xl border border-white/5 space-y-4 relative"
                  >
                    <button 
                      onClick={() => setNewEntry(p => ({ ...p, fertilizers: p.fertilizers.filter((_, idx) => idx !== i) }))}
                      className="absolute top-5 right-5 text-zinc-600 hover:text-rose-500 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <input 
                          placeholder="Nome do Fertilizante" 
                          value={fert.name}
                          onChange={(e) => {
                            const f = [...newEntry.fertilizers];
                            f[i].name = e.target.value;
                            setNewEntry(p => ({ ...p, fertilizers: f }));
                          }}
                          className="bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-sm w-full focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <input 
                        placeholder="NPK (ex: 10-5-5)" 
                        value={fert.npk}
                        onChange={(e) => {
                          const f = [...newEntry.fertilizers];
                          f[i].npk = e.target.value;
                          setNewEntry(p => ({ ...p, fertilizers: f }));
                        }}
                        className="bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500"
                      />
                      <input 
                        placeholder="Qtd (ex: 2ml/L)" 
                        value={fert.amount}
                        onChange={(e) => {
                          const f = [...newEntry.fertilizers];
                          f[i].amount = e.target.value;
                          setNewEntry(p => ({ ...p, fertilizers: f }));
                        }}
                        className="bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </motion.div>
                ))}
              </div>

              {editingEntry && (
                <button 
                  onClick={() => setConfirmDelete({ type: 'entry', id: editingEntry.id })}
                  className="w-full py-4 text-rose-500 font-bold text-sm flex items-center justify-center gap-2 bg-rose-500/5 rounded-2xl border border-rose-500/10 mt-4"
                >
                  <Trash2 size={18} /> Apagar Registro
                </button>
              )}
            </div>
            <div className="p-6 border-t border-white/5 bg-zinc-950">
              <Button onClick={handleSaveEntry} className="w-full py-5 text-lg rounded-2xl" disabled={isAnalyzing}>
                {isAnalyzing ? (
                  <>
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                      <Leaf size={20} />
                    </motion.div>
                    Analisando com IA...
                  </>
                ) : (
                  <>
                    <Save size={20} /> {editingEntry ? "Salvar Alterações" : "Salvar Registro"}
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        )}

        {viewingPhotos && (
          <PhotoViewer 
            photos={viewingPhotos.photos} 
            initialIndex={viewingPhotos.index} 
            onClose={() => setViewingPhotos(null)} 
          />
        )}

        <ConfirmModal 
          isOpen={!!confirmDelete}
          title={confirmDelete?.type === 'grow' ? "Apagar Cultivo?" : "Apagar Registro?"}
          message={confirmDelete?.type === 'grow' 
            ? "Isso apagará permanentemente este cultivo e todos os seus registros de diário. Esta ação não pode ser desfeita."
            : "Tem certeza que deseja apagar este registro do diário?"}
          onConfirm={() => {
            if (confirmDelete?.type === 'grow') handleDeleteGrow();
            else if (confirmDelete?.type === 'entry' && confirmDelete.id) {
              handleDeleteEntry(confirmDelete.id);
              setIsAddingEntry(false);
              setEditingEntry(null);
            }
          }}
          onCancel={() => setConfirmDelete(null)}
        />

        {/* Backup Modal */}
        <AnimatePresence>
          {showBackupModal && (
            <div key="backup-modal-container" className="fixed inset-0 z-50 flex items-center justify-center p-6">
              <motion.div 
                key="backup-modal-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowBackupModal(false)}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              />
              <motion.div 
                key="backup-modal-content"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-zinc-900 border border-white/10 rounded-3xl p-6 w-full max-w-sm relative z-10"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold">Backup de Dados</h3>
                  <button onClick={() => setShowBackupModal(false)} className="text-zinc-500">
                    <X size={24} />
                  </button>
                </div>
                
                <p className="text-sm text-zinc-400 mb-6">
                  Como o app não usa login, seus dados ficam salvos apenas neste aparelho. Use as opções abaixo para garantir que não perderá nada.
                </p>

                <div className="space-y-3">
                  <button 
                    onClick={handleExportData}
                    className="w-full py-4 bg-emerald-500 text-black rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-emerald-400 transition-all"
                  >
                    <Download size={20} />
                    Exportar Backup (.json)
                  </button>
                  
                  <label className="w-full py-4 bg-zinc-800 text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-zinc-700 transition-all border border-white/5 cursor-pointer">
                    <Upload size={20} />
                    Importar Backup
                    <input type="file" accept=".json" onChange={handleImportData} className="hidden" />
                  </label>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </AnimatePresence>

      {/* API Key Debug Modal */}
      <div className="h-20" />
    </div>
    </ErrorBoundary>
  );
}
