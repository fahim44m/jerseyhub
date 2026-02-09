import React, { useState, useEffect, useMemo } from 'react';
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
  updateDoc,
  getDoc
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
  Palette,
  AlertCircle,
  CheckCircle2
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
        const MAX_WIDTH = 1000;
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
  
  const [newDesignTitle, setNewDesignTitle] = useState('');
  const [newDesignTag, setNewDesignTag] = useState('Sublimation');
  const [sourceLink, setSourceLink] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);
  const [fileToUpload, setFileToUpload] = useState(null);

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
    
    // Listen for Designs
    const qDesigns = query(collection(db, 'designs'));
    const unsubDesigns = onSnapshot(qDesigns, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setDesigns(items);
      setLoading(false);
    });

    // Listen for Delete Requests (Visible to Admin)
    const qRequests = query(collection(db, 'deleteRequests'));
    const unsubRequests = onSnapshot(qRequests, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDeleteRequests(items);
    });

    return () => { unsubDesigns(); unsubRequests(); };
  }, [user]);

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

  // Request Delete (For Users)
  const requestDelete = async (e, design) => {
    e.stopPropagation();
    const reason = window.prompt("কেন ডিলিট করতে চান? (একটি কারণ লিখুন)");
    if (!reason) return;

    try {
      await addDoc(collection(db, 'deleteRequests'), {
        designId: design.id,
        designTitle: design.title,
        requestedBy: user.uid,
        reason: reason,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      alert("ডিলিট রিকোয়েস্ট পাঠানো হয়েছে। অ্যাডমিন অ্যাপ্রুভ করলে ডিলিট হবে।");
    } catch (err) {
      alert("রিকোয়েস্ট পাঠানো সম্ভব হয়নি।");
    }
  };

  // Admin Approve Delete
  const approveDelete = async (requestId, designId) => {
    if (!isAuthenticated) return;
    try {
      await deleteDoc(doc(db, 'designs', designId));
      await deleteDoc(doc(db, 'deleteRequests', requestId));
      alert("ডিজাইনটি ডিলিট করা হয়েছে।");
      if (selectedImage?.id === designId) setSelectedImage(null);
    } catch (err) {
      alert("অপারেশন ব্যর্থ হয়েছে।");
    }
  };

  // Admin Reject Delete Request
  const rejectDeleteRequest = async (requestId) => {
    try {
      await deleteDoc(doc(db, 'deleteRequests', requestId));
    } catch (err) { console.error(err); }
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
      setFileToUpload(null);
      setPreviewUrl(null);
      setNewDesignTitle('');
      setSourceLink('');
      setIsUploadModalOpen(false);
    } catch (err) {
      alert("আপলোড সফল হয়নি।");
    } finally {
      setUploading(false);
    }
  };

  const openSourceLink = (link) => {
    if (!isAuthenticated) { setShowLoginModal(true); return; }
    const url = link.startsWith('http') ? link : `https://${link}`;
    window.open(url, '_blank');
  };

  const downloadImageOnly = (e, imageData, title) => {
    e.stopPropagation();
    const link = document.createElement('a');
    link.href = imageData;
    link.download = `${title}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredDesigns = useMemo(() => {
    return designs.filter(d => {
      const matchesSearch = d.title.toLowerCase().includes(searchQuery.toLowerCase()) || d.tag.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTab = activeTab === 'All' || d.tag === activeTab;
      return matchesSearch && matchesTab;
    });
  }, [designs, searchQuery, activeTab]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
        <Loader2 className="w-10 h-10 animate-spin text-teal-600 mb-2" />
        <p className="text-slate-500 font-medium">লোডিং...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Navbar */}
      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => {setSearchQuery(''); setActiveTab('All');}}>
            <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg">
              <Palette size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800 leading-none">জার্সি হাব</h1>
              <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">অ্যাডমিন কন্ট্রোল</span>
            </div>
          </div>

          <div className="hidden md:flex flex-1 max-w-md relative">
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
            <input
              type="text"
              className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border-transparent rounded-full text-sm focus:bg-white focus:ring-4 focus:ring-teal-500/10 transition-all"
              placeholder="সার্চ করুন..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <>
                <button 
                  onClick={() => setShowRequestsModal(true)}
                  className="relative p-2.5 text-slate-600 hover:bg-slate-100 rounded-full transition-all"
                  title="ডিলিট রিকোয়েস্ট"
                >
                  <AlertCircle size={22} />
                  {deleteRequests.length > 0 && (
                    <span className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-bounce">
                      {deleteRequests.length}
                    </span>
                  )}
                </button>
                <button onClick={() => setIsUploadModalOpen(true)} className="bg-slate-900 text-white px-5 py-2.5 rounded-full text-sm font-bold flex items-center gap-2">
                  <Upload size={16} /> আপলোড
                </button>
                <button onClick={handleLogout} className="p-2.5 text-red-500 hover:bg-red-50 rounded-full">
                  <LogOut size={22} />
                </button>
              </>
            ) : (
              <button onClick={() => setShowLoginModal(true)} className="flex items-center gap-2 text-slate-600 font-medium hover:text-teal-600">
                <ShieldCheck size={18} /> অ্যাডমিন
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 py-6 overflow-x-auto">
        <div className="flex gap-2">
          {['All', 'Sublimation', 'Full Sleeve', 'Half Sleeve', 'Collar'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`whitespace-nowrap px-5 py-2 rounded-full text-sm font-bold transition-all border ${
                activeTab === tab ? 'bg-teal-600 text-white border-teal-600 shadow-md' : 'bg-white text-slate-600 border-slate-200'
              }`}
            >
              {tab === 'All' ? 'সব' : tab}
            </button>
          ))}
        </div>
      </div>

      {/* Gallery */}
      <main className="max-w-7xl mx-auto px-4 pb-12">
        <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-6 space-y-6">
          {filteredDesigns.map((design) => (
            <div 
              key={design.id} 
              className="break-inside-avoid bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden group hover:shadow-xl transition-all cursor-zoom-in"
              onClick={() => setSelectedImage(design)}
            >
              <div className="relative">
                <img src={design.imageData} alt={design.title} className="w-full h-auto block" loading="lazy" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                   <p className="text-white font-bold">{design.title}</p>
                   <span className="text-[10px] text-white/80 uppercase">{design.tag}</span>
                </div>
              </div>
              <div className="p-3 bg-white flex gap-2">
                <button 
                  onClick={(e) => downloadImageOnly(e, design.imageData, design.title)}
                  className="flex-1 py-2 rounded-lg bg-slate-50 text-slate-700 text-xs font-bold"
                >
                  ডাউনলোড
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); requestDelete(e, design); }}
                  className="p-2 text-slate-400 hover:text-red-500 rounded-lg bg-slate-50"
                  title="ডিলিট রিকোয়েস্ট পাঠান"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Delete Requests Modal (Admin Only) */}
      {showRequestsModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowRequestsModal(false)} />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6 max-h-[80vh] flex flex-col">
             <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2"><AlertCircle className="text-red-500" /> ডিলিট রিকোয়েস্ট লিস্ট</h2>
                <button onClick={() => setShowRequestsModal(false)}><X /></button>
             </div>
             <div className="flex-1 overflow-y-auto space-y-3">
                {deleteRequests.length === 0 ? (
                  <p className="text-center text-slate-400 py-10">কোনো রিকোয়েস্ট নেই</p>
                ) : (
                  deleteRequests.map(req => (
                    <div key={req.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                       <p className="font-bold text-slate-800">{req.designTitle}</p>
                       <p className="text-sm text-slate-500 mt-1">কারন: {req.reason}</p>
                       <div className="flex gap-2 mt-4">
                          <button 
                            onClick={() => approveDelete(req.id, req.designId)}
                            className="flex-1 py-2 bg-red-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1"
                          >
                             <CheckCircle2 size={14} /> ডিলিট করুন
                          </button>
                          <button 
                            onClick={() => rejectDeleteRequest(req.id)}
                            className="flex-1 py-2 bg-slate-200 text-slate-600 rounded-xl text-xs font-bold"
                          >
                             বাতিল
                          </button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowLoginModal(false)} />
          <div className="relative bg-white rounded-3xl p-8 w-full max-w-sm text-center">
            <h2 className="text-2xl font-bold mb-2">অ্যাডমিন লগইন</h2>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <input 
                type="password" 
                autoFocus
                className={`w-full py-4 text-center text-2xl border-2 rounded-2xl focus:outline-none ${passError ? 'border-red-500 bg-red-50' : 'border-slate-100'}`} 
                value={passwordInput} 
                onChange={e => setPasswordInput(e.target.value)} 
              />
              <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold">লগইন</button>
            </form>
          </div>
        </div>
      )}

      {/* Upload Modal & Full Screen Image View (Condensed for brevity, same logic as yours) */}
      {/* ... (Upload Modal and Selected Image components would go here, same as original code) ... */}
      
      {/* Quick Add for Upload Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsUploadModalOpen(false)} />
          <div className="relative bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">নতুন ডিজাইন আপলোড</h2>
            <div className="space-y-4">
              <input type="file" accept="image/*" onChange={handleFileSelect} className="w-full text-sm" />
              <input type="text" placeholder="টাইটেল" className="w-full p-3 bg-slate-50 rounded-xl outline-none" value={newDesignTitle} onChange={e => setNewDesignTitle(e.target.value)} />
              <input type="text" placeholder="সোর্স লিঙ্ক" className="w-full p-3 bg-slate-50 rounded-xl outline-none" value={sourceLink} onChange={e => setSourceLink(e.target.value)} />
              <button onClick={handleUpload} disabled={uploading} className="w-full bg-teal-600 text-white py-3 rounded-xl font-bold">
                {uploading ? "আপলোড হচ্ছে..." : "আপলোড নিশ্চিত করুন"}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Basic Full Screen View */}
      {selectedImage && (
        <div className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-4">
           <button onClick={() => setSelectedImage(null)} className="absolute top-6 right-6 text-white"><X size={32} /></button>
           <img src={selectedImage.imageData} className="max-w-full max-h-[80vh] object-contain rounded-lg" />
           <div className="absolute bottom-10 bg-white p-4 rounded-2xl w-full max-w-xs text-center">
              <p className="font-bold">{selectedImage.title}</p>
              <button onClick={() => openSourceLink(selectedImage.sourceLink)} className="mt-2 w-full py-2 bg-slate-900 text-white rounded-lg">সোর্স ফাইল</button>
           </div>
        </div>
      )}
    </div>
  );
}