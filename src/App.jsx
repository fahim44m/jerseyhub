import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  signOut
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  deleteDoc,
  doc, 
  onSnapshot, 
  serverTimestamp, 
  query
} from 'firebase/firestore';
import { 
  Upload, 
  Search, 
  X, 
  Image as ImageIcon, 
  Loader2, 
  Maximize2,
  Lock,
  Unlock,
  Trash2,
  LogIn,
  LogOut,
  Download,
  ShieldCheck,
  Palette
} from 'lucide-react';

// --- Firebase Configuration ---
// Note: In a production app, use environment variables for these values.
const firebaseConfig = {
  apiKey: "AIzaSyDakYvo1uIfyWyl_incZvu3Dn4Ho11eWQg",
  authDomain: "jerseyhub-419ea.firebaseapp.com",
  projectId: "jerseyhub-419ea",
  storageBucket: "jerseyhub-419ea.firebasestorage.app",
  messagingSenderId: "973074107883",
  appId: "1:973074107883:web:08db5e64dd7b438c0e9dae",
};

// Initialize Firebase
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
        const MAX_WIDTH = 1000; // Increased slightly for better quality on larger screens
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
    };
  });
};

export default function App() {
  // --- State Management ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passError, setPassError] = useState(false);
  
  const [user, setUser] = useState(null);
  const [designs, setDesigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('All'); // For simple filtering
  
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  
  const [newDesignTitle, setNewDesignTitle] = useState('');
  const [newDesignTag, setNewDesignTag] = useState('Sublimation');
  const [sourceLink, setSourceLink] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);
  const [fileToUpload, setFileToUpload] = useState(null);

  const SITE_PASSWORD = '866535';

  // --- Effects ---
  useEffect(() => {
    const login = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error("Auth Error:", err);
      }
    };
    login();
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'designs'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort internally by timestamp
      items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setDesigns(items);
      setLoading(false);
    }, (err) => {
      console.error("Firestore Error:", err);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  // --- Handlers ---
  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (passwordInput === SITE_PASSWORD) {
      setIsAuthenticated(true);
      setPassError(false);
      setShowLoginModal(false);
      setPasswordInput('');
    } else {
      setPassError(true);
      setPasswordInput('');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    // Optional: signOut(auth) if you want to completely kill the session
  };

  const handleDelete = async (e, designId) => {
    e.stopPropagation();
    if (!isAuthenticated) return;
    
    if (window.confirm("আপনি কি নিশ্চিত যে এই ডিজাইনটি ডিলিট করতে চান?")) {
      try {
        await deleteDoc(doc(db, 'designs', designId));
        if (selectedImage?.id === designId) setSelectedImage(null);
      } catch (err) {
        console.error("Delete Error:", err);
        alert("ডিলিট করা সম্ভব হয়নি।");
      }
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      setFileToUpload(file);
      setPreviewUrl(URL.createObjectURL(file));
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
        uploaderId: user.uid,
        createdAt: serverTimestamp(),
      });
      // Reset Form
      setFileToUpload(null);
      setPreviewUrl(null);
      setNewDesignTitle('');
      setSourceLink('');
      setIsUploadModalOpen(false);
    } catch (err) {
      alert("সিস্টেম এরর: আপলোড সফল হয়নি।");
    } finally {
      setUploading(false);
    }
  };

  const openSourceLink = (link) => {
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }
    const url = link.startsWith('http') ? link : `https://${link}`;
    window.open(url, '_blank');
  };

  const downloadImageOnly = (e, imageData, title) => {
    e.stopPropagation();
    const link = document.createElement('a');
    link.href = imageData;
    link.download = `${title || 'jersey-design'}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- Filtering ---
  const filteredDesigns = useMemo(() => {
    return designs.filter(d => {
      const matchesSearch = d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            d.tag.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTab = activeTab === 'All' || d.tag === activeTab;
      return matchesSearch && matchesTab;
    });
  }, [designs, searchQuery, activeTab]);

  // --- Render Loading ---
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50 text-slate-400">
        <Loader2 className="w-12 h-12 animate-spin text-teal-600 mb-4" />
        <p className="font-medium animate-pulse">ডিজাইন গ্যালারি লোড হচ্ছে...</p>
      </div>
    );
  }

  // --- Main UI ---
  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-teal-100 selection:text-teal-900">
      
      {/* --- Navbar --- */}
      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-sm transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20 gap-4">
            
            {/* Logo */}
            <div className="flex-shrink-0 flex items-center gap-3 cursor-pointer" onClick={() => {setSearchQuery(''); setActiveTab('All');}}>
              <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl flex items-center justify-center text-white shadow-teal-200 shadow-lg">
                <Palette size={20} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800 tracking-tight leading-none">জার্সি হাব</h1>
                <span className="text-[10px] text-slate-400 font-medium tracking-wider uppercase">ডিজাইন কালেকশন</span>
              </div>
            </div>

            {/* Search Bar (Desktop) */}
            <div className="hidden md:flex flex-1 max-w-lg relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-slate-400 group-focus-within:text-teal-500 transition-colors" />
              </div>
              <input
                type="text"
                className="block w-full pl-11 pr-4 py-2.5 bg-slate-100 border-transparent rounded-full text-sm focus:bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all duration-300"
                placeholder="জার্সির নাম বা ধরণ খুঁজুন..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              {isAuthenticated ? (
                <>
                  <button 
                    onClick={() => setIsUploadModalOpen(true)}
                    className="hidden sm:flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-full font-medium text-sm transition-all shadow-lg shadow-slate-200 hover:shadow-xl active:scale-95"
                  >
                    <Upload size={16} /> আপলোড
                  </button>
                  <button onClick={handleLogout} className="p-2.5 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-full transition-all" title="লগ আউট">
                    <LogOut size={22} />
                  </button>
                </>
              ) : (
                <button 
                  onClick={() => setShowLoginModal(true)}
                  className="flex items-center gap-2 text-slate-600 hover:text-teal-700 font-medium px-4 py-2 rounded-full hover:bg-teal-50 transition-all"
                >
                  <ShieldCheck size={18} /> <span className="hidden sm:inline">অ্যাডমিন</span>
                </button>
              )}
            </div>
          </div>
        </div>
        
        {/* Mobile Search & Tags */}
        <div className="md:hidden px-4 pb-4 border-b border-slate-100 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              className="w-full pl-9 pr-4 py-2 bg-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="ডিজাইন খুঁজুন..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </nav>

      {/* --- Filter Tabs --- */}
      <div className="max-w-7xl mx-auto px-4 pt-6 pb-2">
         <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
            {['All', 'Sublimation', 'Full Sleeve', 'Half Sleeve', 'Collar'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 border ${
                  activeTab === tab 
                    ? 'bg-teal-600 text-white border-teal-600 shadow-md shadow-teal-200' 
                    : 'bg-white text-slate-600 border-slate-200 hover:border-teal-300 hover:text-teal-600'
                }`}
              >
                {tab === 'All' ? 'সব দেখুন' : tab}
              </button>
            ))}
         </div>
      </div>

      {/* --- Main Content (Masonry Layout) --- */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {filteredDesigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6">
              <Search className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-xl font-bold text-slate-700">কোনো ডিজাইন পাওয়া যায়নি</h3>
            <p className="text-slate-500 mt-2 max-w-xs mx-auto">আপনার সার্চ বা ফিল্টার পরিবর্তন করে আবার চেষ্টা করুন।</p>
            <button onClick={() => {setSearchQuery(''); setActiveTab('All');}} className="mt-6 text-teal-600 font-medium hover:underline">সব ডিজাইন দেখুন</button>
          </div>
        ) : (
          /* Masonry Layout Implementation using CSS Columns */
          <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-6 space-y-6">
            {filteredDesigns.map((design) => (
              <div 
                key={design.id} 
                className="break-inside-avoid bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden group hover:shadow-xl hover:shadow-slate-200/50 hover:-translate-y-1 transition-all duration-300 cursor-zoom-in"
                onClick={() => setSelectedImage(design)}
              >
                {/* Image Container - NO FIXED HEIGHT/ASPECT */}
                <div className="relative w-full">
                  <img 
                    src={design.imageData} 
                    alt={design.title} 
                    className="w-full h-auto block" // h-auto ensures full height is shown
                    loading="lazy"
                  />
                  
                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                     <div className="flex justify-between items-end">
                        <div className="text-white">
                           <p className="font-bold text-lg leading-tight mb-1">{design.title}</p>
                           <span className="inline-block px-2 py-0.5 bg-white/20 backdrop-blur-md rounded text-[10px] uppercase tracking-wider font-semibold border border-white/10">
                              {design.tag}
                           </span>
                        </div>
                        <button className="bg-white text-slate-900 p-2 rounded-full hover:scale-110 transition-transform shadow-lg">
                           <Maximize2 size={16} />
                        </button>
                     </div>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="p-3 bg-white flex items-center gap-2 border-t border-slate-50">
                    <button 
                      onClick={(e) => downloadImageOnly(e, design.imageData, design.title)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors"
                    >
                      <Download size={14} /> ছবি
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); openSourceLink(design.sourceLink); }}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-colors text-white
                        ${isAuthenticated 
                          ? 'bg-teal-600 hover:bg-teal-700 shadow-md shadow-teal-200' 
                          : 'bg-slate-800 hover:bg-slate-900'}
                      `}
                    >
                      {isAuthenticated ? <Unlock size={14} /> : <Lock size={14} />}
                      {isAuthenticated ? 'AI ফাইল' : 'সোর্স'}
                    </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* --- LOGIN MODAL --- */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowLoginModal(false)} />
          <div className="relative bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm text-center animate-in zoom-in-95 duration-200">
            <button onClick={() => setShowLoginModal(false)} className="absolute top-4 right-4 text-slate-300 hover:text-slate-500 transition-colors">
              <X size={24} />
            </button>
            
            <div className="w-16 h-16 bg-teal-50 rounded-2xl flex items-center justify-center mx-auto mb-6 transform rotate-3">
              <ShieldCheck className="text-teal-600" size={32} />
            </div>
            
            <h2 className="text-2xl font-bold text-slate-800 mb-2">অ্যাডমিন ভেরিফিকেশন</h2>
            <p className="text-slate-500 text-sm mb-8">এডিটিং এবং ডাউনলোডের জন্য পাসওয়ার্ড দিন।</p>
            
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="relative">
                <input 
                  type="password"
                  autoFocus
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="******"
                  className={`w-full py-4 text-center text-2xl tracking-[0.5em] font-bold border-2 rounded-2xl focus:outline-none transition-all placeholder:text-slate-200 ${
                    passError 
                      ? 'border-red-100 bg-red-50 text-red-600 focus:border-red-500' 
                      : 'border-slate-100 bg-slate-50 text-slate-800 focus:border-teal-500 focus:bg-white'
                  }`}
                />
              </div>
              {passError && <p className="text-red-500 text-xs font-bold animate-pulse">ভুল পাসওয়ার্ড! আবার চেষ্টা করুন।</p>}
              
              <button 
                type="submit"
                className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
              >
                 <LogIn size={20} /> অ্যাক্সেস নিন
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- UPLOAD MODAL --- */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsUploadModalOpen(false)} />
          <div className="relative bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col md:flex-row max-h-[90vh]">
            
            {/* Left/Top: Image Preview */}
            <div className={`bg-slate-100 p-6 flex items-center justify-center md:w-5/12 border-b md:border-b-0 md:border-r border-slate-200 ${!previewUrl ? 'bg-slate-50' : ''}`}>
              {previewUrl ? (
                <img src={previewUrl} className="max-h-64 md:max-h-full max-w-full rounded-lg shadow-md object-contain" alt="Preview" />
              ) : (
                <div className="text-center text-slate-400">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                    <ImageIcon size={32} className="text-slate-300" />
                  </div>
                  <p className="text-sm font-medium">প্রথমে ছবি সিলেক্ট করুন</p>
                </div>
              )}
            </div>

            {/* Right/Bottom: Form */}
            <div className="p-6 md:p-8 flex-1 flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-slate-800">নতুন ডিজাইন</h2>
                <button onClick={() => setIsUploadModalOpen(false)} className="text-slate-400 hover:text-red-500 transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-4 flex-1 overflow-y-auto">
                {/* File Input */}
                <div className="relative">
                   <label className="block text-xs font-bold text-slate-500 uppercase mb-1">ডিজাইন ফাইল</label>
                   <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleFileSelect}
                      className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 cursor-pointer" 
                   />
                </div>

                {/* Inputs */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">জার্সির নাম</label>
                  <input 
                    type="text" 
                    placeholder="উদাহরণ: আর্জেন্টিনা হোম জার্সি ২০২৪..." 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:bg-white focus:border-transparent outline-none transition-all font-medium"
                    value={newDesignTitle} onChange={e => setNewDesignTitle(e.target.value)}
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">ড্রাইভ/বক্স লিঙ্ক</label>
                  <input 
                    type="text" 
                    placeholder="https://drive.google.com/..." 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:bg-white focus:border-transparent outline-none transition-all font-medium text-sm"
                    value={sourceLink} onChange={e => setSourceLink(e.target.value)}
                  />
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">ক্যাটাগরি</label>
                  <div className="flex flex-wrap gap-2">
                    {['Sublimation', 'Full Sleeve', 'Collar', 'Half Sleeve'].map(t => (
                      <button 
                        key={t} 
                        onClick={() => setNewDesignTag(t)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                          newDesignTag === t 
                            ? 'bg-teal-600 text-white border-teal-600 shadow-md shadow-teal-100' 
                            : 'bg-white text-slate-500 border-slate-200 hover:border-teal-400'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-slate-100 flex gap-3">
                <button 
                  onClick={handleUpload} 
                  disabled={uploading || !fileToUpload || !newDesignTitle}
                  className="w-full py-3 bg-slate-900 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-bold hover:bg-slate-800 transition-all shadow-lg active:scale-95"
                >
                  {uploading ? <Loader2 className="animate-spin" size={20} /> : 'আপলোড করুন'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- FULL SCREEN IMAGE VIEW --- */}
      {selectedImage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-200">
           <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-sm" onClick={() => setSelectedImage(null)} />
           
           <button onClick={() => setSelectedImage(null)} className="absolute top-6 right-6 z-10 bg-white/10 hover:bg-white/20 text-white p-2 rounded-full transition-colors">
             <X size={28} />
           </button>

           <div className="relative w-full max-w-6xl h-full flex flex-col md:flex-row gap-6 items-center justify-center pointer-events-none">
              
              {/* Image Area - Responsive Full View */}
              <div className="flex-1 w-full h-full flex items-center justify-center pointer-events-auto min-h-0">
                 <img 
                    src={selectedImage.imageData} 
                    className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" 
                    alt="Full View" 
                 />
              </div>

              {/* Sidebar Info Area */}
              <div className="w-full md:w-80 bg-white rounded-2xl p-6 pointer-events-auto shadow-2xl shrink-0">
                 <div className="mb-6">
                    <span className="text-[10px] font-bold tracking-wider uppercase text-teal-600 bg-teal-50 px-2 py-1 rounded mb-2 inline-block">
                       {selectedImage.tag}
                    </span>
                    <h2 className="text-xl font-bold text-slate-800 leading-tight">{selectedImage.title}</h2>
                    <p className="text-xs text-slate-400 mt-1">আপলোড: {selectedImage.createdAt ? new Date(selectedImage.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}</p>
                 </div>

                 <div className="space-y-3">
                    <button 
                      onClick={(e) => downloadImageOnly(e, selectedImage.imageData, selectedImage.title)}
                      className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
                    >
                      <Download size={18} /> ছবি ডাউনলোড
                    </button>

                    <button 
                      onClick={() => openSourceLink(selectedImage.sourceLink)} 
                      className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg text-white
                        ${isAuthenticated 
                           ? 'bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700' 
                           : 'bg-slate-800 hover:bg-slate-900'}
                      `}
                    >
                      {isAuthenticated ? <Unlock size={18} /> : <Lock size={18} />}
                      {isAuthenticated ? 'AI ফাইল ডাউনলোড' : 'সোর্স ফাইল (লক)'}
                    </button>
                 </div>

                 {isAuthenticated && (
                   <div className="mt-8 pt-6 border-t border-slate-100">
                     <button 
                        onClick={(e) => { handleDelete(e, selectedImage.id); }} 
                        className="w-full py-2 text-red-500 hover:bg-red-50 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                     >
                        <Trash2 size={16} /> ডিজাইন মুছে ফেলুন
                     </button>
                   </div>
                 )}
              </div>
           </div>
        </div>
      )}
    </div>
  );
}