import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  deleteDoc,
  doc, 
  onSnapshot, 
  serverTimestamp, 
  query,
} from 'firebase/firestore';
import { 
  Search, 
  X, 
  Image as ImageIcon, 
  Loader2, 
  Trash2, 
  LogOut, 
  Download, 
  ShieldCheck, 
  Palette, 
  AlertCircle, 
  CheckCircle2, 
  Link2, 
  Plus, 
  CloudUpload, 
  FileText, 
  Tag,
  Unlock,
  Lock
} from 'lucide-react';

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyDakYvo1uIfyWyl_incZvu3Dn4Ho11eWQg",
  authDomain: "jerseyhub-419ea.firebaseapp.com",
  projectId: "jerseyhub-419ea",
  storageBucket: "jerseyhub-419ea.firebasestorage.app",
  messagingSenderId: "973074107883",
  appId: "1:973074107883:web:08db5e64dd7b438c0e9dae",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Image Compression Helper ---
const compressImage = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800; 
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.7)); 
      };
    };
  });
};

// --- Skeleton Loader Component ---
const SkeletonCard = () => (
  <div className="break-inside-avoid bg-white rounded-[2rem] border border-slate-100 overflow-hidden mb-6">
    <div className="w-full h-64 bg-slate-200 animate-pulse" />
    <div className="p-5 flex justify-between items-center">
      <div className="h-4 w-24 bg-slate-200 animate-pulse rounded" />
      <div className="h-8 w-8 bg-slate-200 animate-pulse rounded-full" />
    </div>
  </div>
);

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passError, setPassError] = useState(false);
  
  const [user, setUser] = useState(null);
  const [designs, setDesigns] = useState([]);
  const [deleteRequests, setDeleteRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('All');
  
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [showRequestsModal, setShowRequestsModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  
  // Upload State
  const [newDesignTitle, setNewDesignTitle] = useState('');
  const [newDesignTag, setNewDesignTag] = useState('Sublimation');
  const [sourceLink, setSourceLink] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);
  const [fileToUpload, setFileToUpload] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const SITE_PASSWORD = '866535';

  useEffect(() => {
    const login = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) { console.error(err); }
    };
    login();
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user) return;
    const qDesigns = query(collection(db, 'designs'));
    const unsubDesigns = onSnapshot(qDesigns, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setDesigns(items);
      setLoading(false);
    }, (error) => {
      console.error("Firestore error:", error);
      setLoading(false);
    });

    const qRequests = query(collection(db, 'deleteRequests'));
    const unsubRequests = onSnapshot(qRequests, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDeleteRequests(items);
    });

    return () => { unsubDesigns(); unsubRequests(); };
  }, [user]);

  // Handlers
  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (passwordInput === SITE_PASSWORD) {
      setIsAuthenticated(true);
      setPassError(false);
      setShowLoginModal(false);
      setPasswordInput('');
    } else {
      setPassError(true);
    }
  };

  const handleLogout = () => setIsAuthenticated(false);

  const downloadImageOnly = (e, base64Data, title) => {
    e.stopPropagation();
    try {
      const link = document.createElement('a');
      link.href = base64Data;
      link.download = `${title.replace(/\s+/g, '_')}_jersey_hub.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Download failed", err);
    }
  };

  const requestDelete = async (e, design) => {
    e.stopPropagation();
    const reason = window.prompt("কেন ডিলিট করতে চান?");
    if (!reason) return;
    try {
      await addDoc(collection(db, 'deleteRequests'), {
        designId: design.id,
        designTitle: design.title,
        requestedBy: user.uid,
        reason: reason,
        createdAt: serverTimestamp()
      });
      alert("ডিলিট রিকোয়েস্ট পাঠানো হয়েছে।");
    } catch (err) { alert("ব্যর্থ হয়েছে।"); }
  };

  const approveDelete = async (requestId, designId) => {
    try {
      await deleteDoc(doc(db, 'designs', designId));
      await deleteDoc(doc(db, 'deleteRequests', requestId));
      if (selectedImage?.id === designId) setSelectedImage(null);
    } catch (err) { console.error(err); }
  };

  const rejectDeleteRequest = async (requestId) => {
    await deleteDoc(doc(db, 'deleteRequests', requestId));
  };

  // Upload Logic
  const handleFile = (file) => {
    if (file && file.type.startsWith('image/')) {
      setFileToUpload(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!fileToUpload || !newDesignTitle || !sourceLink) return;
    setUploading(true);
    try {
      const compressedBase64 = await compressImage(fileToUpload);
      await addDoc(collection(db, 'designs'), {
        title: newDesignTitle,
        tag: newDesignTag,
        imageData: compressedBase64,
        sourceLink: sourceLink,
        createdAt: serverTimestamp(),
      });
      setFileToUpload(null);
      setPreviewUrl(null);
      setNewDesignTitle('');
      setSourceLink('');
      setIsUploadModalOpen(false);
    } catch (err) {
      alert("সিস্টেম এরর!");
    } finally {
      setUploading(false);
    }
  };

  const filteredDesigns = useMemo(() => {
    return designs.filter(d => {
      const matchesSearch = d.title.toLowerCase().includes(searchQuery.toLowerCase()) || d.tag.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTab = activeTab === 'All' || d.tag === activeTab;
      return matchesSearch && matchesTab;
    });
  }, [designs, searchQuery, activeTab]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-900">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm px-4 h-20 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('All')}>
          <div className="w-10 h-10 bg-teal-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-teal-100">
            <Palette size={22} strokeWidth={2.5} />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-xl font-black tracking-tight">JERSEY HUB</h1>
            <p className="text-[10px] font-bold text-teal-600 tracking-[0.2em] uppercase text-center md:text-left">Design Studio</p>
          </div>
        </div>

        <div className="flex-1 max-w-md mx-4 relative hidden md:block">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search designs..." 
            className="w-full pl-12 pr-4 py-2.5 bg-slate-100 border-none rounded-2xl focus:ring-2 focus:ring-teal-500/20 focus:bg-white transition-all outline-none text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <>
              <button onClick={() => setShowRequestsModal(true)} className="relative p-2.5 hover:bg-slate-100 rounded-xl transition-all">
                <AlertCircle size={22} className="text-slate-600" />
                {deleteRequests.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold ring-4 ring-white">
                    {deleteRequests.length}
                  </span>
                )}
              </button>
              <button 
                onClick={() => setIsUploadModalOpen(true)}
                className="bg-slate-900 text-white px-5 py-2.5 rounded-2xl text-sm font-bold flex items-center gap-2 hover:bg-slate-800 transition-all active:scale-95 shadow-xl shadow-slate-200"
              >
                <Plus size={18} /> Upload
              </button>
              <button onClick={handleLogout} className="p-2.5 text-red-500 hover:bg-red-50 rounded-xl transition-all"><LogOut size={22} /></button>
            </>
          ) : (
            <button onClick={() => setShowLoginModal(true)} className="flex items-center gap-2 px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-all">
              <ShieldCheck size={18} /> Admin
            </button>
          )}
        </div>
      </nav>

      {/* Hero / Tabs */}
      <div className="max-w-7xl mx-auto px-4 pt-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <h2 className="text-3xl font-black text-slate-800">Gallery</h2>
            <p className="text-slate-400 font-medium">Explore premium jersey design templates.</p>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {['All', 'Sublimation', 'Full Sleeve', 'Half Sleeve', 'Collar'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-2 rounded-2xl text-sm font-bold transition-all border shrink-0 ${
                  activeTab === tab ? 'bg-teal-600 text-white border-teal-600 shadow-lg shadow-teal-100' : 'bg-white text-slate-500 border-slate-200 hover:border-teal-300'
                }`}
              >
                {tab === 'All' ? 'Everything' : tab}
              </button>
            ))}
          </div>
        </div>

        {/* Gallery Content */}
        {loading ? (
          <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-6 space-y-6">
            {[1,2,3,4,5,6,7,8].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : (
          <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-6 space-y-6">
            {filteredDesigns.map((design) => (
              <div 
                key={design.id} 
                className="break-inside-avoid bg-white rounded-[2rem] border border-slate-200 overflow-hidden group hover:shadow-2xl hover:shadow-slate-200 transition-all cursor-zoom-in"
                onClick={() => setSelectedImage(design)}
              >
                <div className="relative overflow-hidden bg-slate-50 min-h-[200px]">
                  <img 
                    src={design.imageData} 
                    alt={design.title} 
                    loading="lazy"
                    className="w-full h-auto block transform group-hover:scale-105 transition-transform duration-700 ease-out" 
                  />
                  <div className="absolute top-4 left-4">
                    <span className="bg-white/90 backdrop-blur-md text-slate-900 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-slate-200/50 shadow-sm">
                      {design.tag}
                    </span>
                  </div>
                </div>
                <div className="p-5 flex items-center justify-between gap-4">
                  <h3 className="font-bold text-slate-800 truncate text-sm">{design.title}</h3>
                  <div className="flex gap-1">
                     {/* --- ডিলিট বাটন এখন শুধুমাত্র অ্যাডমিনদের জন্য --- */}
                     {isAuthenticated && (
                        <button onClick={(e) => { e.stopPropagation(); requestDelete(e, design); }} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                           <Trash2 size={16} />
                        </button>
                     )}
                     <button onClick={(e) => downloadImageOnly(e, design.imageData, design.title)} className="p-2 text-teal-600 hover:bg-teal-50 rounded-xl transition-all">
                        <Download size={18} />
                     </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- UPLOAD MODAL --- */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xl" onClick={() => !uploading && setIsUploadModalOpen(false)} />
          <div className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col md:flex-row h-full max-h-[85vh] animate-in zoom-in-95 duration-300">
            <button onClick={() => setIsUploadModalOpen(false)} className="absolute top-6 right-6 z-10 p-2 bg-slate-100 hover:bg-red-50 hover:text-red-500 rounded-full transition-all">
              <X size={20} />
            </button>
            <div className="w-full md:w-1/2 bg-slate-50 p-8 flex flex-col">
              <div className="mb-6">
                <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                  <CloudUpload className="text-teal-600" /> New Design
                </h2>
                <p className="text-slate-400 text-sm font-medium">Upload high-quality jersey previews.</p>
              </div>
              <div 
                className={`flex-1 border-4 border-dashed rounded-[2rem] transition-all flex flex-col items-center justify-center text-center p-6 cursor-pointer relative overflow-hidden group ${dragActive ? 'border-teal-500 bg-teal-50/50' : 'border-slate-200 hover:border-teal-400 bg-white'}`}
                onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()}
              >
                {previewUrl ? (
                  <>
                    <img src={previewUrl} className="absolute inset-0 w-full h-full object-cover opacity-20" alt="bg" />
                    <div className="relative z-10 flex flex-col items-center">
                      <div className="w-48 h-64 rounded-2xl overflow-hidden shadow-2xl border-4 border-white mb-4 transform group-hover:scale-105 transition-transform">
                        <img src={previewUrl} className="w-full h-full object-cover" alt="Preview" />
                      </div>
                      <p className="text-teal-600 font-bold text-sm bg-white px-4 py-2 rounded-full shadow-sm">Click to change</p>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center">
                    <div className="w-20 h-20 bg-teal-50 text-teal-600 rounded-3xl flex items-center justify-center mb-6 shadow-lg shadow-teal-100 group-hover:scale-110 transition-transform">
                      <ImageIcon size={32} />
                    </div>
                    <p className="text-slate-800 font-bold text-lg">Drop image here</p>
                    <div className="mt-6 px-6 py-2 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest">Select File</div>
                  </div>
                )}
                <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => handleFile(e.target.files[0])} />
              </div>
            </div>
            <div className="w-full md:w-1/2 p-8 md:p-12 flex flex-col bg-white">
              <div className="space-y-6 flex-1">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2"><FileText size={14} /> Design Title</label>
                  <input type="text" placeholder="Enter name..." className="w-full text-xl font-bold p-0 border-none focus:ring-0 placeholder:text-slate-200" value={newDesignTitle} onChange={(e) => setNewDesignTitle(e.target.value)} />
                  <div className="h-0.5 w-full bg-slate-100 rounded-full overflow-hidden"><div className={`h-full bg-teal-500 transition-all duration-500 ${newDesignTitle ? 'w-full' : 'w-0'}`} /></div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2"><Link2 size={14} /> Source Link</label>
                  <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 focus-within:border-teal-500 focus-within:bg-white transition-all">
                    <Link2 size={18} className="text-slate-400" />
                    <input type="text" placeholder="Drive link" className="bg-transparent border-none p-0 flex-1 focus:ring-0 text-sm font-medium" value={sourceLink} onChange={(e) => setSourceLink(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2"><Tag size={14} /> Category</label>
                  <div className="flex flex-wrap gap-2">
                    {['Sublimation', 'Full Sleeve', 'Half Sleeve', 'Collar'].map(tag => (
                      <button key={tag} onClick={() => setNewDesignTag(tag)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${newDesignTag === tag ? 'bg-teal-600 text-white border-teal-600 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:border-teal-300'}`}>{tag}</button>
                    ))}
                  </div>
                </div>
              </div>
              <button onClick={handleUpload} disabled={uploading || !fileToUpload || !newDesignTitle || !sourceLink} className={`mt-8 w-full py-4 rounded-[1.5rem] font-black uppercase tracking-widest text-sm flex items-center justify-center gap-3 transition-all shadow-xl active:scale-95 ${uploading || !fileToUpload || !newDesignTitle || !sourceLink ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-slate-800 shadow-slate-200'}`}>
                {uploading ? <><Loader2 className="animate-spin" size={20} /> Uploading...</> : <><CloudUpload size={20} /> Publish Design</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Requests Modal */}
      {showRequestsModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" onClick={() => setShowRequestsModal(false)} />
           <div className="relative bg-white rounded-[2rem] w-full max-w-lg p-8 shadow-2xl overflow-hidden max-h-[80vh] flex flex-col animate-in zoom-in-95">
              <div className="flex justify-between items-center mb-6">
                 <h2 className="text-xl font-black text-slate-800 flex items-center gap-2"><AlertCircle className="text-red-500" /> Requests</h2>
                 <button onClick={() => setShowRequestsModal(false)} className="p-2 hover:bg-slate-100 rounded-full"><X size={20} /></button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                 {deleteRequests.length === 0 ? (
                    <div className="text-center py-12">
                       <CheckCircle2 size={48} className="mx-auto text-teal-100 mb-4" />
                       <p className="text-slate-400 font-bold">No requests</p>
                    </div>
                 ) : (
                    deleteRequests.map(req => (
                       <div key={req.id} className="p-5 bg-slate-50 border border-slate-100 rounded-2xl">
                          <p className="font-black text-slate-800">{req.designTitle}</p>
                          <p className="text-sm text-slate-500 mt-2 italic">"{req.reason}"</p>
                          <div className="flex gap-2 mt-5">
                             <button onClick={() => approveDelete(req.id, req.designId)} className="flex-1 py-3 bg-red-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-red-100">Approve</button>
                             <button onClick={() => rejectDeleteRequest(req.id)} className="flex-1 py-3 bg-white text-slate-600 border border-slate-200 rounded-xl text-xs font-black uppercase tracking-wider">Reject</button>
                          </div>
                       </div>
                    ))
                 )}
              </div>
           </div>
        </div>
      )}

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setShowLoginModal(false)} />
          <div className="relative bg-white rounded-[2.5rem] p-10 w-full max-w-sm text-center shadow-2xl animate-in zoom-in-95">
            <div className="w-16 h-16 bg-teal-50 text-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-6"><ShieldCheck size={32} /></div>
            <h2 className="text-2xl font-black text-slate-800 mb-2">Admin Access</h2>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <input type="password" placeholder="••••••" autoFocus className={`w-full py-4 text-center text-3xl font-black tracking-[0.3em] border-2 rounded-2xl focus:outline-none transition-all ${passError ? 'border-red-500 bg-red-50 text-red-600' : 'border-slate-100 bg-slate-50 focus:border-teal-500'}`} value={passwordInput} onChange={e => setPasswordInput(e.target.value)} />
              <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl active:scale-95">Verify</button>
            </form>
          </div>
        </div>
      )}

      {/* Selected Image View */}
      {selectedImage && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl animate-in fade-in" onClick={() => setSelectedImage(null)} />
           <button onClick={() => setSelectedImage(null)} className="absolute top-6 right-6 text-white/50 hover:text-white transition-all"><X size={32} /></button>
           <div className="relative w-full max-w-6xl h-full flex flex-col items-center justify-center gap-8 pointer-events-none">
              <img src={selectedImage.imageData} className="max-w-full max-h-[75vh] object-contain rounded-3xl shadow-2xl pointer-events-auto ring-1 ring-white/10 animate-in zoom-in-90" alt="Preview" />
              <div className="bg-white rounded-[2rem] p-6 w-full max-w-md pointer-events-auto flex items-center justify-between shadow-2xl animate-in slide-in-from-bottom-10">
                 <div>
                    <h2 className="text-xl font-black text-slate-800 leading-tight">{selectedImage.title}</h2>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">{selectedImage.tag}</p>
                 </div>
                 <div className="flex gap-3">
                    <button onClick={(e) => downloadImageOnly(e, selectedImage.imageData, selectedImage.title)} className="p-3 bg-slate-100 hover:bg-slate-200 rounded-2xl text-slate-700 transition-all"><Download size={20} /></button>
                    <button onClick={() => { if(isAuthenticated) window.open(selectedImage.sourceLink, '_blank'); else setShowLoginModal(true); }} className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-slate-800 transition-all">
                       {isAuthenticated ? <Unlock size={16} /> : <Lock size={16} />} Source
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}