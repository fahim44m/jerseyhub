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
  Download, 
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
  Save
} from 'lucide-react';

// Firebase Configuration
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

// Image Compression Helper
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

export default function App() {
  // State Management
  const [isAuthenticated, setIsAuthenticated] = useState(false); // Admin auth state
  const [showLoginModal, setShowLoginModal] = useState(false); // Toggle Login Popup
  const [passwordInput, setPasswordInput] = useState('');
  const [passError, setPassError] = useState(false);
  
  const [user, setUser] = useState(null);
  const [designs, setDesigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  
  const [newDesignTitle, setNewDesignTitle] = useState('');
  const [newDesignTag, setNewDesignTag] = useState('Sublimation');
  const [sourceLink, setSourceLink] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);
  const [fileToUpload, setFileToUpload] = useState(null);

  const SITE_PASSWORD = '866535';

  // Auth Effect (Anonymous login for database reading)
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

  // Firestore Data Fetching
  useEffect(() => {
    if (!user) return; // Wait for anonymous auth
    const q = query(collection(db, 'designs'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setDesigns(items);
      setLoading(false);
    }, (err) => {
      console.error("Firestore Error:", err);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  // Password Verification Logic
  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (passwordInput === SITE_PASSWORD) {
      setIsAuthenticated(true);
      setPassError(false);
      setShowLoginModal(false); // Close modal on success
      setPasswordInput('');
    } else {
      setPassError(true);
      setPasswordInput('');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
  };

  // Delete Logic (Admin Only)
  const handleDelete = async (e, designId) => {
    e.stopPropagation();
    if (!isAuthenticated) return;
    
    const confirmDelete = window.confirm("আপনি কি নিশ্চিত যে এই ডিজাইনটি ডিলিট করতে চান?");
    if (confirmDelete) {
      try {
        await deleteDoc(doc(db, 'designs', designId));
        if (selectedImage?.id === designId) setSelectedImage(null);
      } catch (err) {
        console.error("Delete Error:", err);
        alert("ডিলিট করা সম্ভব হয়নি।");
      }
    }
  };

  // Upload Logic (Admin Only)
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

  // Helper: Open Source Link (Admin Only)
  const openSourceLink = (link) => {
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }
    const url = link.startsWith('http') ? link : `https://${link}`;
    window.open(url, '_blank');
  };

  // Helper: Download Image Only (Public)
  const downloadImageOnly = (e, imageData, title) => {
    e.stopPropagation();
    const link = document.createElement('a');
    link.href = imageData;
    link.download = `${title || 'design'}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredDesigns = useMemo(() => {
    return designs.filter(d => 
      d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.tag.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [designs, searchQuery]);

  // Loading View
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
        <Loader2 className="w-10 h-10 animate-spin text-teal-600 mb-4" />
        <p className="text-slate-600 font-medium italic">জার্সি হাব লোড হচ্ছে...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      
      {/* --- HEADER --- */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm px-4 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="bg-teal-600 p-2 rounded-lg text-white">
              <ImageIcon size={24} />
            </div>
            <h1 className="text-xl font-bold text-teal-800 hidden md:block">জার্সি ডিজাইন হাব</h1>
          </div>
          
          <div className="flex-1 max-w-md relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="ডিজাইন খুঁজুন..." 
              className="w-full pl-10 pr-4 py-2 bg-slate-100 rounded-full border-none focus:ring-2 focus:ring-teal-500 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <>
                <button 
                  onClick={() => setIsUploadModalOpen(true)}
                  className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-full flex items-center gap-2 transition-all shadow-md active:scale-95"
                >
                  <Upload size={18} /> <span className="hidden sm:inline">আপলোড</span>
                </button>
                <button 
                  onClick={handleLogout}
                  className="bg-red-100 text-red-600 p-2 rounded-full hover:bg-red-200 transition-colors"
                  title="লগ আউট"
                >
                  <LogOut size={20} />
                </button>
              </>
            ) : (
              <button 
                onClick={() => setShowLoginModal(true)}
                className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-full flex items-center gap-2 transition-all shadow-md active:scale-95"
              >
                <LogIn size={18} /> <span className="hidden sm:inline">লগইন</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* --- MAIN GRID --- */}
      <main className="max-w-7xl mx-auto p-4 md:p-8">
        {filteredDesigns.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-slate-200">
            <p className="text-slate-400">কোনো ডিজাইন পাওয়া যায়নি।</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredDesigns.map(design => (
              <div key={design.id} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden group hover:shadow-lg transition-shadow duration-300">
                
                {/* Image Section */}
                <div className="relative aspect-square overflow-hidden cursor-pointer" onClick={() => setSelectedImage(design)}>
                  <img src={design.imageData} alt={design.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  
                  {/* Overlay for quick actions */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-3 transition-opacity">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setSelectedImage(design); }}
                      className="bg-white p-2 rounded-full text-slate-900 hover:text-teal-600 transition-colors"
                      title="ফুল ভিউ"
                    >
                      <Maximize2 size={20} />
                    </button>
                    {isAuthenticated && (
                      <button 
                        onClick={(e) => handleDelete(e, design.id)}
                        className="bg-red-500 p-2 rounded-full text-white hover:bg-red-600 transition-colors"
                        title="ডিলিট করুন"
                      >
                        <Trash2 size={20} />
                      </button>
                    )}
                  </div>

                  <div className="absolute top-2 right-2">
                      <span className="text-[10px] bg-white/95 text-teal-700 px-2 py-1 rounded shadow-sm font-bold tracking-wide uppercase">{design.tag}</span>
                  </div>
                </div>

                {/* Info & Buttons Section */}
                <div className="p-4">
                  <h3 className="font-bold truncate mb-3 text-slate-700">{design.title}</h3>
                  
                  <div className="grid grid-cols-2 gap-2">
                    {/* Public: Download Image */}
                    <button 
                      onClick={(e) => downloadImageOnly(e, design.imageData, design.title)}
                      className="bg-slate-100 text-slate-700 py-2 rounded-lg text-xs font-bold hover:bg-slate-200 transition-colors flex items-center justify-center gap-1"
                    >
                      <Save size={14} /> ছবি
                    </button>

                    {/* Restricted: Download Source */}
                    <button 
                      onClick={() => openSourceLink(design.sourceLink)}
                      className={`py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1 text-white
                        ${isAuthenticated ? 'bg-teal-600 hover:bg-teal-700' : 'bg-slate-800 hover:bg-slate-900'}
                      `}
                    >
                      {isAuthenticated ? <Unlock size={14} /> : <Lock size={14} />}
                      {isAuthenticated ? 'AI ফাইল' : 'সোর্স ফাইল'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* --- LOGIN MODAL --- */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm text-center relative">
            <button onClick={() => setShowLoginModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
              <X size={20} />
            </button>
            <div className="w-14 h-14 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="text-teal-600" size={24} />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">অ্যাডমিন এক্সেস</h2>
            <p className="text-slate-500 text-sm mb-6">AI/EPS ফাইল ডাউনলোড করতে পাসওয়ার্ড দিন।</p>
            
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <input 
                  type="password"
                  autoFocus
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="পাসওয়ার্ড লিখুন..."
                  className={`w-full p-3 text-center text-lg tracking-widest border rounded-xl focus:ring-2 focus:outline-none ${
                    passError ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'
                  }`}
                />
                {passError && <p className="text-red-500 text-xs mt-2 font-medium">ভুল পাসওয়ার্ড!</p>}
              </div>
              <button 
                type="submit"
                className="w-full bg-teal-600 text-white py-3 rounded-xl font-bold hover:bg-teal-700 transition-all active:scale-95"
              >
                আনলক করুন
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- UPLOAD MODAL (Admin Only) --- */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
              <h2 className="font-bold text-slate-700">নতুন ডিজাইন আপলোড</h2>
              <X className="cursor-pointer text-slate-400 hover:text-red-500" onClick={() => setIsUploadModalOpen(false)} />
            </div>
            <div className="p-6 space-y-4">
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:border-teal-400 transition-colors relative bg-slate-50/50">
                <input type="file" accept="image/*" onChange={handleFileSelect} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                {previewUrl ? (
                  <img src={previewUrl} className="h-40 mx-auto rounded shadow-sm object-contain" alt="Preview" />
                ) : (
                  <div className="py-8 text-slate-400 flex flex-col items-center">
                    <ImageIcon size={32} className="mb-2 opacity-50" />
                    <span className="text-sm">ডিজাইনের ছবি (JPG/PNG) এখানে দিন</span>
                  </div>
                )}
              </div>
              <input 
                type="text" placeholder="জার্সির নাম..." 
                className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                value={newDesignTitle} onChange={e => setNewDesignTitle(e.target.value)}
              />
              <input 
                type="text" placeholder="সোর্স ফাইলের লিঙ্ক (Drive/Dropbox)..." 
                className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                value={sourceLink} onChange={e => setSourceLink(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                {['Sublimation', 'Full Sleeve', 'Collar', 'Half Sleeve'].map(t => (
                  <button 
                    key={t} onClick={() => setNewDesignTag(t)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${newDesignTag === t ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-slate-500 border-slate-200 hover:border-teal-400'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-6 bg-slate-50 flex gap-3">
              <button onClick={() => setIsUploadModalOpen(false)} className="flex-1 py-2.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 font-medium">বাতিল</button>
              <button 
                onClick={handleUpload} disabled={uploading || !fileToUpload}
                className="flex-1 py-2.5 bg-teal-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium hover:bg-teal-700 shadow-sm"
              >
                {uploading ? <Loader2 className="animate-spin" size={18} /> : 'আপলোড নিশ্চিত করুন'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- FULL IMAGE PREVIEW --- */}
      {selectedImage && (
        <div className="fixed inset-0 z-[60] bg-black/95 flex flex-col items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setSelectedImage(null)}>
          <button onClick={() => setSelectedImage(null)} className="absolute top-4 right-4 text-white/50 hover:text-white p-2">
            <X size={32} />
          </button>
          
          <img src={selectedImage.imageData} className="max-w-full max-h-[75vh] rounded-lg shadow-2xl object-contain" alt="Full View" onClick={(e) => e.stopPropagation()} />
          
          <div className="mt-6 flex flex-col items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-white text-xl font-bold">{selectedImage.title}</h2>
            <div className="flex gap-4 mt-2">
              {/* Public Image Download */}
              <button 
                onClick={(e) => downloadImageOnly(e, selectedImage.imageData, selectedImage.title)}
                className="bg-white text-slate-900 px-6 py-2.5 rounded-full font-bold hover:bg-slate-200 flex items-center gap-2 transition-colors"
              >
                <Save size={18} /> ছবি সেভ করুন
              </button>

              {/* Restricted Source Download */}
              <button 
                onClick={() => openSourceLink(selectedImage.sourceLink)} 
                className={`px-6 py-2.5 rounded-full font-bold flex items-center gap-2 transition-colors text-white
                  ${isAuthenticated ? 'bg-teal-600 hover:bg-teal-500' : 'bg-slate-800 hover:bg-slate-700 border border-slate-700'}
                `}
              >
                {isAuthenticated ? <Unlock size={18} /> : <Lock size={18} />}
                {isAuthenticated ? 'AI ফাইল ডাউনলোড' : 'সোর্স ফাইল (লক)'}
              </button>
            </div>
            
            {/* Delete Option for Admin */}
            {isAuthenticated && (
              <button 
                onClick={(e) => { handleDelete(e, selectedImage.id); }} 
                className="mt-4 text-red-400 hover:text-red-300 text-sm flex items-center gap-1 opacity-80 hover:opacity-100"
              >
                <Trash2 size={14} /> ডিজাইন মুছে ফেলুন
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}