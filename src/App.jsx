import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged
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
  Share2, 
  Loader2, 
  Maximize2,
  Link as LinkIcon
} from 'lucide-react';

// --- গুরুত্বপূর্ণ নির্দেশ ---
// আপনি যদি আপনার নিজের Firebase ব্যবহার করতে চান, তবে নিচের firebaseConfig অবজেক্টে 
// আপনার Firebase Console থেকে পাওয়া তথ্যগুলো বসিয়ে দিন। 
// যেহেতু আপনি লোকাল পিসিতে চালাচ্ছেন, তাই __firebase_config কাজ করবে না।

const firebaseConfig = {
  apiKey: "AIzaSyDakYvo1uIfyWyl_incZvu3Dn4Ho11eWQg",
  authDomain: "jerseyhub-419ea.firebaseapp.com",
  projectId: "jerseyhub-419ea",
  storageBucket: "jerseyhub-419ea.firebasestorage.app",
  messagingSenderId: "973074107883",
  appId: "1:973074107883:web:08db5e64dd7b438c0e9dae",
};

// অ্যাপ ইনিশিয়ালাইজেশন
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'jersey-hub-local';

// --- ছবি ছোট করার হেল্পার ---
const compressImage = (file) => {
  return new Promise((resolve, reject) => {
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
  const [user, setUser] = useState(null);
  const [designs, setDesigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  
  const [newDesignTitle, setNewDesignTitle] = useState('');
  const [newDesignTag, setNewDesignTag] = useState('Sublimation');
  const [sourceLink, setSourceLink] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);
  const [fileToUpload, setFileToUpload] = useState(null);

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
      items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setDesigns(items);
      setLoading(false);
    }, (err) => {
      console.error("Firestore Error:", err);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

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
      setIsModalOpen(false);
    } catch (err) {
      alert("সেভ করা যায়নি। ফায়ারবেস কনফিগ চেক করুন।");
    } finally {
      setUploading(false);
    }
  };

  const openLink = (link) => {
    const url = link.startsWith('http') ? link : `https://${link}`;
    window.open(url, '_blank');
  };

  const filteredDesigns = useMemo(() => {
    return designs.filter(d => 
      d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.tag.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [designs, searchQuery]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
        <Loader2 className="w-10 h-10 animate-spin text-teal-600 mb-4" />
        <p className="text-slate-600 font-medium italic">জার্সি হাব লোড হচ্ছে...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
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
              placeholder="সার্চ করুন..." 
              className="w-full pl-10 pr-4 py-2 bg-slate-100 rounded-full border-none focus:ring-2 focus:ring-teal-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-full flex items-center gap-2 transition-all shadow-md active:scale-95"
          >
            <Upload size={18} /> <span className="hidden sm:inline">আপলোড</span>
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-8">
        {filteredDesigns.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-slate-200">
            <p className="text-slate-400">কোনো ডিজাইন পাওয়া যায়নি। নতুন কিছু আপলোড করুন!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredDesigns.map(design => (
              <div key={design.id} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden group">
                <div className="relative aspect-square overflow-hidden cursor-pointer" onClick={() => setSelectedImage(design)}>
                  <img src={design.imageData} alt={design.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Maximize2 className="text-white" size={32} />
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-bold truncate pr-2">{design.title}</h3>
                    <span className="text-[10px] bg-teal-50 text-teal-600 px-2 py-0.5 rounded border border-teal-100">{design.tag}</span>
                  </div>
                  <button 
                    onClick={() => openLink(design.sourceLink)}
                    className="w-full bg-slate-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-teal-600 transition-colors flex items-center justify-center gap-2"
                  >
                    <Download size={16} /> AI/EPS ফাইল
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal & Fullscreen Viewer remained logic same as previous working state */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
              <h2 className="font-bold">ডিজাইন আপলোড করুন</h2>
              <X className="cursor-pointer text-slate-400" onClick={() => setIsModalOpen(false)} />
            </div>
            <div className="p-6 space-y-4">
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:border-teal-400 transition-colors relative">
                <input type="file" accept="image/*" onChange={handleFileSelect} className="absolute inset-0 opacity-0 cursor-pointer" />
                {previewUrl ? <img src={previewUrl} className="h-32 mx-auto rounded" /> : <div className="py-4 text-slate-400">স্ক্রিনশট সিলেক্ট করুন</div>}
              </div>
              <input 
                type="text" placeholder="জার্সির নাম..." 
                className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-teal-500"
                value={newDesignTitle} onChange={e => setNewDesignTitle(e.target.value)}
              />
              <input 
                type="text" placeholder="ড্রাইভ/ডাউনলোড লিঙ্ক..." 
                className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-teal-500"
                value={sourceLink} onChange={e => setSourceLink(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                {['Sublimation', 'Full Sleeve', 'Collar'].map(t => (
                  <button 
                    key={t} onClick={() => setNewDesignTag(t)}
                    className={`px-3 py-1 rounded-full text-xs ${newDesignTag === t ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-6 bg-slate-50 flex gap-2">
              <button onClick={() => setIsModalOpen(false)} className="flex-1 py-2 rounded-lg border">বাতিল</button>
              <button 
                onClick={handleUpload} disabled={uploading || !fileToUpload}
                className="flex-1 py-2 bg-teal-600 text-white rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {uploading ? <Loader2 className="animate-spin" size={18} /> : 'আপলোড'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedImage && (
        <div className="fixed inset-0 z-[60] bg-black/95 flex flex-col items-center justify-center p-4" onClick={() => setSelectedImage(null)}>
          <img src={selectedImage.imageData} className="max-w-full max-h-[80vh] rounded shadow-2xl" />
          <h2 className="text-white mt-4 text-xl font-bold">{selectedImage.title}</h2>
          <button onClick={() => openLink(selectedImage.sourceLink)} className="mt-4 bg-teal-500 text-white px-8 py-2 rounded-full font-bold hover:bg-teal-400">ডাউনলোড করুন</button>
        </div>
      )}
    </div>
  );
}