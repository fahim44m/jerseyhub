import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
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
  query,
  setDoc,
  updateDoc,
  increment,
  orderBy,
  where
} from 'firebase/firestore';
import { 
  Search, X, Image as ImageIcon, Loader2, Trash2, LogOut, 
  ShieldCheck, Palette, AlertCircle, Plus, Unlock, Lock,
  User, Crown, LayoutGrid, Users, BarChart3, Ban, UserCheck,
  MessageCircle, CheckCircle, Clock, HelpCircle, ChevronDown, ChevronUp,
  ExternalLink, Info, Phone, MinusCircle, HelpCircle as HelpIcon
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

// --- Helper Functions ---
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

const isLinkPublic = (url) => {
  if (!url) return false;
  const lowerUrl = url.toLowerCase();
  if (!lowerUrl.includes('drive.google.com')) return false;
  if (lowerUrl.includes('drive.google.com/drive/my-drive') || lowerUrl.includes('drive.google.com/drive/u/0')) {
    return false;
  }
  return true;
};

// --- Initial Loading Component ---
const InitialLoader = () => (
  <div className="fixed inset-0 z-[9999] bg-slate-900 flex flex-col items-center justify-center text-white">
    <div className="relative">
      <div className="w-16 h-16 border-4 border-teal-500/30 border-t-teal-500 rounded-full animate-spin"></div>
      <div className="absolute inset-0 flex items-center justify-center">
        <Palette size={20} className="text-teal-500" />
      </div>
    </div>
    <h2 className="mt-4 text-xl font-black tracking-widest animate-pulse">JERSEY HUB</h2>
    <p className="text-xs text-slate-500 font-bold mt-2">Loading Designs...</p>
  </div>
);

export default function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAppLoading, setIsAppLoading] = useState(true);
  const [designs, setDesigns] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [deleteRequests, setDeleteRequests] = useState([]);
  const [pendingDesigns, setPendingDesigns] = useState([]); 
  const [loadingDesigns, setLoadingDesigns] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('All');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState('user-login');
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [adminPanelOpen, setAdminPanelOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [lowBalanceModalOpen, setLowBalanceModalOpen] = useState(false);
  const [showUploadHelp, setShowUploadHelp] = useState(false);
  const [pointsInfoOpen, setPointsInfoOpen] = useState(false);
  const [missingInfoModalOpen, setMissingInfoModalOpen] = useState(false); 
  const [pendingDownload, setPendingDownload] = useState(null);
  const [loginCode, setLoginCode] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupCode, setSignupCode] = useState('');
  const [signupWhatsapp, setSignupWhatsapp] = useState('');
  const [updateWhatsapp, setUpdateWhatsapp] = useState('');
  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [authError, setAuthError] = useState('');
  const [authProcessing, setAuthProcessing] = useState(false);
  const [newDesignTitle, setNewDesignTitle] = useState('');
  const [newDesignTag, setNewDesignTag] = useState('Sublimation');
  const [sourceLink, setSourceLink] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);
  const [fileToUpload, setFileToUpload] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [linkError, setLinkError] = useState(''); 
  const fileInputRef = useRef(null);

  const FAHIM_ADMIN = { username: 'fahim4mm', password: '@Mdfahim44' };
  const WHATSAPP_NUMBER = "8801874002653";

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        const unsubDoc = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.isBanned && data.role !== 'admin') {
              signOut(auth);
              setAuthError("আপনার অ্যাকাউন্টটি ব্যান করা হয়েছে!");
              setAuthModalOpen(true);
              setUserData(null);
              setUser(null);
            } else {
              setUserData(data);
              setUser(currentUser);
              if (data.role !== 'admin' && (!data.whatsapp || data.whatsapp === '')) {
                setMissingInfoModalOpen(true);
              } else {
                setMissingInfoModalOpen(false);
              }
            }
          }
        });
        setAuthLoading(false);
        return () => unsubDoc();
      } else {
        setUserData(null);
        setUser(null);
        setAuthLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user && userData && pendingDownload) {
      const timer = setTimeout(() => {
        processDownload(pendingDownload);
        setPendingDownload(null);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [user, userData, pendingDownload]);

  useEffect(() => {
    const qDesigns = query(collection(db, 'designs'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(qDesigns, (snap) => {
      const allDesigns = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setDesigns(allDesigns);
      setLoadingDesigns(false);
      setTimeout(() => setIsAppLoading(false), 1500); 
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (userData?.role === 'admin') {
      const unsubReqs = onSnapshot(collection(db, 'deleteRequests'), (snap) => {
        setDeleteRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
        setAllUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      const qPending = query(collection(db, 'designs'), where('status', '==', 'pending'));
      const unsubPending = onSnapshot(qPending, (snap) => {
         setPendingDesigns(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      return () => { unsubReqs(); unsubUsers(); unsubPending(); };
    }
  }, [userData]);

  const clearAuthFields = () => {
    setLoginCode('');
    setSignupName('');
    setSignupCode('');
    setSignupWhatsapp('');
    setAdminUser('');
    setAdminPass('');
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthProcessing(true);
    try {
      if (authMode === 'admin-login') {
        if (adminUser === FAHIM_ADMIN.username && adminPass === FAHIM_ADMIN.password) {
          const adminEmail = "fahim_admin@jerseyhub.local";
          try {
            await signInWithEmailAndPassword(auth, adminEmail, adminPass);
          } catch {
            const cred = await createUserWithEmailAndPassword(auth, adminEmail, adminPass);
            await setDoc(doc(db, 'users', cred.user.uid), {
              name: 'Fahim (Admin)',
              role: 'admin',
              points: 999999,
              uid: cred.user.uid,
              isBanned: false
            });
          }
          clearAuthFields();
        } else {
          throw new Error("ভুল এডমিন ইউজারনেম অথবা পাসওয়ার্ড!");
        }
      } else if (authMode === 'user-signup') {
        if (signupCode.length < 6) throw new Error("কোড কমপক্ষে ৬ সংখ্যার হতে হবে");
        if (!signupWhatsapp || signupWhatsapp.length < 11) throw new Error("সঠিক WhatsApp নাম্বার দিন");
        const email = signupCode + "@user.local";
        const cred = await createUserWithEmailAndPassword(auth, email, signupCode);
        await setDoc(doc(db, 'users', cred.user.uid), {
          name: signupName,
          whatsapp: signupWhatsapp,
          uid: cred.user.uid,
          points: 10,
          role: 'user',
          isBanned: false,
          createdAt: serverTimestamp()
        });
        clearAuthFields();
      } else {
        const email = loginCode + "@user.local";
        await signInWithEmailAndPassword(auth, email, loginCode);
        clearAuthFields();
      }
      setAuthModalOpen(false);
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthProcessing(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setAdminPanelOpen(false);
    clearAuthFields();
  };

  const handleUpdateWhatsapp = async () => {
    if(!updateWhatsapp || updateWhatsapp.length < 11) {
      alert("Please enter a valid WhatsApp number");
      return;
    }
    await updateDoc(doc(db, 'users', user.uid), { whatsapp: updateWhatsapp });
    setMissingInfoModalOpen(false);
    setUpdateWhatsapp('');
  };

  const processDownload = async (design) => {
    if (userData.isBanned) return;
    if (userData.role === 'admin') { window.open(design.sourceLink, '_blank'); return; }
    if (userData.points < 1) { setLowBalanceModalOpen(true); return; }
    const confirm = window.confirm(`১ পয়েন্ট খরচ হবে। রাজি?`);
    if (!confirm) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), { points: increment(-1) });
      window.open(design.sourceLink, '_blank');
    } catch (err) { alert("Error!"); }
  };

  const handleDownloadAttempt = async (design) => {
    if (!user) { 
        setPendingDownload(design);
        setAuthMode('user-login');
        setAuthModalOpen(true); 
        return; 
    }
    processDownload(design);
  };

  const requestDelete = async (e, design) => {
    e.stopPropagation();
    const reason = window.prompt("ডিলিট করার কারণ লিখুন:");
    if (!reason) return;
    await addDoc(collection(db, 'deleteRequests'), {
      designId: design.id,
      designTitle: design.title,
      requestedBy: userData.name || 'User',
      reason,
      createdAt: serverTimestamp()
    });
    alert("এডমিনকে রিকোয়েস্ট পাঠানো হয়েছে।");
  };

  const handleUpload = async () => {
    if (!fileToUpload || !newDesignTitle || !sourceLink) return;
    if (!isLinkPublic(sourceLink)) {
      setLinkError("LINK NOT PUBLIC! দয়া করে লিংকটি চেক করুন।");
      return;
    }
    setUploading(true);
    try {
      const base64 = await compressImage(fileToUpload);
      await addDoc(collection(db, 'designs'), {
        title: newDesignTitle,
        tag: newDesignTag,
        imageData: base64,
        sourceLink,
        uploadedBy: user.uid,
        uploaderName: userData.name || 'Unknown',
        uploaderWhatsapp: userData.whatsapp || 'N/A',
        status: 'pending', 
        createdAt: serverTimestamp()
      });
      setUploadModalOpen(false);
      setNewDesignTitle('');
      setSourceLink('');
      setPreviewUrl(null);
      setFileToUpload(null);
      alert("ডিজাইন আপলোড হয়েছে! এডমিন অ্যাপরুভ করলে আপনি ০.৫ পয়েন্ট পাবেন।");
    } catch (err) { alert("Upload failed!"); }
    finally { setUploading(false); }
  };

  const addPoints = async (uid) => {
    const pts = prompt("কত পয়েন্ট দিবেন?");
    if (!pts || isNaN(pts)) return;
    await updateDoc(doc(db, 'users', uid), { points: increment(parseInt(pts)) });
  };

  const subtractPoints = async (uid) => {
    const pts = prompt("কত পয়েন্ট কাটতে চান?");
    if (!pts || isNaN(pts)) return;
    await updateDoc(doc(db, 'users', uid), { points: increment(-Math.abs(parseInt(pts))) });
  };

  const toggleBan = async (uid, currentStatus) => {
    const confirm = window.confirm(currentStatus ? "আনব্যান করতে চান?" : "ব্যান করতে চান?");
    if (!confirm) return;
    await updateDoc(doc(db, 'users', uid), { isBanned: !currentStatus });
  };

  const handleApproveDesign = async (design) => {
    if(!window.confirm("Approve this design? User will get 0.5 points.")) return;
    await updateDoc(doc(db, 'designs', design.id), { status: 'approved' });
    if (design.uploadedBy) {
         await updateDoc(doc(db, 'users', design.uploadedBy), { points: increment(0.5) });
    }
  };

  const handleRejectDesign = async (design) => {
    if(!window.confirm("Reject and Delete?")) return;
    await deleteDoc(doc(db, 'designs', design.id));
  };

  const filteredDesigns = useMemo(() => {
    return designs.filter(d => 
      (d.status === 'approved' || !d.status) && 
      (activeTab === 'All' || d.tag === activeTab) && 
      d.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [designs, activeTab, searchQuery]);

  if (isAppLoading) return <InitialLoader />;

  if (adminPanelOpen && userData?.role === 'admin') {
    return (
      <AdminDashboard 
        allUsers={allUsers} 
        deleteRequests={deleteRequests}
        pendingDesigns={pendingDesigns}
        onClose={() => setAdminPanelOpen(false)} 
        onAddPoints={addPoints}
        onSubtractPoints={subtractPoints}
        onToggleBan={toggleBan}
        onApproveDelete={async (req) => {
          await deleteDoc(doc(db, 'designs', req.designId));
          await deleteDoc(doc(db, 'deleteRequests', req.id));
        }}
        onRejectDelete={async (req) => {
          await deleteDoc(doc(db, 'deleteRequests', req.id));
        }}
        onApproveDesign={handleApproveDesign}
        onRejectDesign={handleRejectDesign}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-teal-600 rounded-xl flex items-center justify-center text-white shadow-lg"><Palette size={22} /></div>
          <div>
            <h1 className="text-xl font-black text-slate-800 tracking-tight">JERSEY HUB</h1>
            <p className="text-[10px] font-bold text-teal-600 uppercase">Fahim's Studio</p>
          </div>
        </div>
        <div className="hidden md:flex flex-1 max-w-md mx-10 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input type="text" placeholder="Search designs..." className="w-full pl-12 pr-4 py-2.5 bg-slate-100 rounded-xl outline-none text-sm" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        <div className="flex items-center gap-3">
          {user && userData ? (
            <>
              <div className="hidden sm:flex items-center bg-slate-100 rounded-full px-4 py-1.5 gap-2 border border-slate-200">
                <span className="text-xs font-bold text-slate-500">{userData.name}</span>
                <span className="text-sm font-black text-teal-600">{userData.points} Pts</span>
                <button onClick={() => setPointsInfoOpen(true)} className="w-5 h-5 bg-teal-500 text-white rounded-full flex items-center justify-center ml-1 shadow-md"><Plus size={12} strokeWidth={4}/></button>
              </div>
              {userData.role === 'admin' && (
                <button onClick={() => setAdminPanelOpen(true)} className="p-2.5 bg-slate-900 text-white rounded-xl"><ShieldCheck size={20}/></button>
              )}
              <button onClick={() => setUploadModalOpen(true)} className="bg-teal-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-teal-700 transition-all"><Plus size={18}/> Upload</button>
              <button onClick={handleLogout} className="p-2.5 text-slate-400 hover:text-red-500 transition-all"><LogOut size={20}/></button>
            </>
          ) : (
            <button onClick={() => setAuthModalOpen(true)} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg">Login</button>
          )}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {!user && (
          <div className="mb-12 bg-gradient-to-br from-slate-900 to-slate-800 rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-2xl">
            <div className="relative z-10 max-w-xl">
              <h2 className="text-4xl font-black mb-4">প্রিমিয়াম জার্সি ডিজাইন কালেকশন</h2>
              <div className="inline-flex items-center gap-2 bg-white/10 px-4 py-2 rounded-lg mb-6 backdrop-blur-sm border border-white/5">
                <LayoutGrid size={16} className="text-teal-400" />
                <span className="font-bold text-sm">TOTAL DESIGNS: <span className="text-teal-400 font-black text-lg ml-1">{designs.length}</span></span>
              </div>
              <p className="text-slate-400 text-lg mb-8 font-medium">নতুন ইউজারদের জন্য ১০ পয়েন্ট ফ্রী! আর ডিজাইন আপলোড করলে প্রতি ফাইলে ০.৫ পয়েন্ট বোনাস।</p>
              <div className="flex gap-4">
                <button onClick={() => {setAuthMode('user-signup'); setAuthModalOpen(true);}} className="bg-teal-500 hover:bg-teal-400 text-white px-8 py-3.5 rounded-2xl font-black transition-all">Signup Free</button>
                <button onClick={() => {setAuthMode('admin-login'); setAuthModalOpen(true);}} className="bg-white/10 hover:bg-white/20 px-8 py-3.5 rounded-2xl font-bold transition-all">Admin Access</button>
              </div>
            </div>
            <Crown className="absolute -right-10 -bottom-10 text-white/5 w-64 h-64 -rotate-12" />
          </div>
        )}

        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {['All', 'Sublimation', 'Full Sleeve', 'Half Sleeve', 'Collar'].map(t => (
            <button key={t} onClick={() => setActiveTab(t)} className={`px-5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 border ${activeTab === t ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-white text-slate-500 border-slate-200 hover:border-teal-500'}`}>{t}</button>
          ))}
        </div>

        <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-6 space-y-6">
          {filteredDesigns.map(design => (
            <div key={design.id} className="break-inside-avoid bg-white rounded-[2rem] border border-slate-200 overflow-hidden group hover:shadow-2xl transition-all cursor-pointer relative" onClick={() => setSelectedImage(design)}>
              <img src={design.imageData} className="w-full h-auto transform group-hover:scale-105 transition-all duration-500" />
              <div className="p-5">
                <h3 className="font-bold text-slate-800 text-sm truncate mb-4">{design.title}</h3>
                <div className="flex items-center justify-between">
                  <button onClick={(e) => requestDelete(e, design)} className="p-2 text-slate-300 hover:text-red-500 transition-all"><Trash2 size={16} /></button>
                  <button onClick={(e) => {e.stopPropagation(); handleDownloadAttempt(design);}} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 hover:bg-teal-600 transition-all">
                    {userData?.points > 0 ? <Unlock size={12}/> : <Lock size={12}/>} Get Link
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Points Info */}
      {pointsInfoOpen && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
           <div className="bg-white rounded-[2rem] w-full max-w-sm p-6 shadow-2xl relative">
              <button onClick={() => setPointsInfoOpen(false)} className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full"><X size={18} /></button>
              <h3 className="text-lg font-black text-slate-800 mb-6">পয়েন্ট ইনফরমেশন</h3>
              <div className="space-y-4">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-sm text-slate-600 font-medium">
                      <span className="block mb-1 text-teal-600 font-bold">• একটি ডিজাইন আপলোড করলে পাবেন ০.৫ Pts</span>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-sm text-slate-600 font-medium">
                      <span className="block mb-1 text-slate-800 font-bold">• পয়েন্টের জন্য এডমিন এর সাথে যোগাযোগ করুন।</span>
                      <span className="block text-slate-500 text-xs mt-2">নাম্বারঃ 01874002653</span>
                  </div>
                  <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" className="w-full py-3 bg-[#25D366] text-white rounded-xl font-bold uppercase flex justify-center items-center gap-2"><MessageCircle size={18} /> WhatsApp</a>
              </div>
           </div>
        </div>
      )}

      {/* Low Balance */}
      {lowBalanceModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white rounded-[2.5rem] w-full max-w-sm p-8 shadow-2xl text-center relative">
             <button onClick={() => setLowBalanceModalOpen(false)} className="absolute top-6 right-6 p-2"><X size={20}/></button>
             <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6"><AlertCircle size={40}/></div>
             <h2 className="text-2xl font-black text-slate-800 mb-2">পয়েন্ট শেষ!</h2>
             <p className="text-slate-500 mb-8">পয়েন্ট রিলোড করতে এডমিনের সাথে যোগাযোগ করুন।</p>
             <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" className="w-full py-4 bg-[#25D366] text-white rounded-xl font-black flex justify-center items-center gap-2"><MessageCircle size={20}/> WhatsApp Admin</a>
          </div>
        </div>
      )}

      {/* Auth Modal */}
      {authModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl relative">
            <button onClick={() => {setAuthModalOpen(false); clearAuthFields();}} className="absolute top-6 right-6 p-2"><X size={20}/></button>
            <h2 className="text-2xl font-black text-slate-800 text-center mb-8">{authMode === 'admin-login' ? 'Admin Login' : 'Auth'}</h2>
            <div className="flex p-1 bg-slate-100 rounded-xl mb-6">
              <button onClick={() => {setAuthMode('user-login'); clearAuthFields();}} className={`flex-1 py-2 rounded-lg text-xs font-bold ${authMode === 'user-login' ? 'bg-white shadow' : 'text-slate-400'}`}>Login</button>
              <button onClick={() => {setAuthMode('user-signup'); clearAuthFields();}} className={`flex-1 py-2 rounded-lg text-xs font-bold ${authMode === 'user-signup' ? 'bg-white shadow' : 'text-slate-400'}`}>Signup</button>
              <button onClick={() => {setAuthMode('admin-login'); clearAuthFields();}} className={`flex-1 py-2 rounded-lg text-xs font-bold ${authMode === 'admin-login' ? 'bg-white shadow' : 'text-slate-400'}`}>Admin</button>
            </div>
            <form onSubmit={handleAuth} className="space-y-4">
              {authMode === 'admin-login' ? (
                <><input type="text" placeholder="Username" className="w-full bg-slate-50 p-3 rounded-xl" value={adminUser} onChange={e=>setAdminUser(e.target.value)} /><input type="password" placeholder="Password" className="w-full bg-slate-50 p-3 rounded-xl" value={adminPass} onChange={e=>setAdminPass(e.target.value)} /></>
              ) : authMode === 'user-signup' ? (
                <><input type="text" placeholder="Name" className="w-full bg-slate-50 p-3 rounded-xl" value={signupName} onChange={e=>setSignupName(e.target.value)} /><input type="text" placeholder="WhatsApp" className="w-full bg-slate-50 p-3 rounded-xl" value={signupWhatsapp} onChange={e=>setSignupWhatsapp(e.target.value)} /><input type="password" placeholder="Code (6 digits)" className="w-full bg-slate-50 p-3 rounded-xl text-center tracking-widest" value={signupCode} onChange={e=>setSignupCode(e.target.value)} /></>
              ) : (
                <input type="password" placeholder="Enter Code" className="w-full bg-slate-50 p-3 rounded-xl text-center tracking-widest" value={loginCode} onChange={e=>setLoginCode(e.target.value)} />
              )}
              {authError && <p className="text-red-500 text-xs font-bold">{authError}</p>}
              <button disabled={authProcessing} className="w-full py-4 bg-slate-900 text-white rounded-xl font-black uppercase tracking-widest shadow-lg">Login</button>
            </form>
          </div>
        </div>
      )}

      {/* Upload Modal with Instruction Support */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto">
           <div className="bg-white rounded-[2rem] w-full max-w-4xl p-6 md:p-10 shadow-2xl flex flex-col gap-6 my-10 relative">
              <button onClick={() => setUploadModalOpen(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-900 transition-colors"><X size={24}/></button>
              
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black text-slate-800">Upload New Design</h2>
                <button 
                  onClick={() => setShowUploadHelp(!showUploadHelp)} 
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${showUploadHelp ? 'bg-teal-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  <HelpIcon size={16}/> {showUploadHelp ? 'Hide Rules' : 'How to Upload?'}
                </button>
              </div>

              {showUploadHelp && (
                <div className="bg-teal-50 border border-teal-100 rounded-3xl p-6 text-sm animate-in fade-in slide-in-from-top-4 duration-300">
                  <h3 className="font-black text-teal-800 mb-4 flex items-center gap-2"><Info size={18}/> এখানে ডিজাইন আপলোড করতে হলেঃ</h3>
                  <div className="space-y-4 text-slate-700 leading-relaxed">
                    <p className="flex items-start gap-2"><span className="w-5 h-5 bg-teal-500 text-white rounded-full flex items-center justify-center text-[10px] shrink-0 mt-0.5">১</span> ডিজাইন এর একটা ছবি দিতে হবে।</p>
                    <p className="flex items-start gap-2"><span className="w-5 h-5 bg-teal-500 text-white rounded-full flex items-center justify-center text-[10px] shrink-0 mt-0.5">২</span> ডিজাইন টাইটেল হচ্ছে ডিজাইন এর নাম বা কোড দিবেন।</p>
                    
                    <div className="pl-7">
                      <h4 className="font-bold text-teal-700 mb-2 italic">গুগল ড্রাইভ লিংক এর নিয়মঃ</h4>
                      <ul className="list-disc space-y-2 pl-4 text-slate-600">
                        <li>আপনার গুগল ড্রাইভ খুলুন উপরে বাম পাসে কর্নারে <b>+NEW</b> একটা আইকন আছে সেটাতে ক্লিক করে নিউ ফোল্ডার খুলুন।</li>
                        <li>ফোল্ডার এ ঢুকে আপনি যে ডিজাইন গুলা ওয়েবসাইটে আপলোড করবেন সেগুলা সে ড্রাইভ ফোল্ডারে ড্রাগ এন্ড ড্রপ করে আনবেন।</li>
                        <li>আপনি যে ফোল্ডার বানিয়েছেন সেটার নামের পাশে <b>৩ টা ডট</b> আছে সেটাতে ক্লিক করবেন।</li>
                        <li>শেয়ার অপশন এ ক্লিক করবেন। <b>General access</b> এটার নিচে <b>Restricted</b> লেখাতে ক্লিক করবেন পরে <b>Anyone with link</b> দিবেন।</li>
                        <li>শেষে ডিজাইন এর লিংকটি কপি করে <b>Google drive link</b> এর জায়গায় দিয়ে সাবমিট দিবেন।</li>
                      </ul>
                    </div>

                    <div className="bg-white/50 p-4 rounded-2xl border border-teal-200 mt-2">
                       <p className="font-bold text-teal-800">বুঝতে সমস্যা হলে WhatsApp করুনঃ</p>
                       <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" className="text-teal-600 font-black text-lg">01874002653</a>
                       <p className="text-xs text-slate-500 mt-1">মেসেজ দিলে আমি ভিডিও দিয়ে দেব।</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-8">
                <div 
                  onClick={() => fileInputRef.current.click()} 
                  className={`border-4 border-dashed rounded-[2.5rem] p-8 flex flex-col items-center justify-center transition-all cursor-pointer min-h-[300px] ${previewUrl ? 'border-teal-500 bg-teal-50/30' : 'border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300'}`}
                >
                  {previewUrl ? (
                    <div className="relative group">
                      <img src={previewUrl} className="max-h-56 rounded-2xl shadow-lg border-4 border-white" />
                      <div className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                         <p className="text-white font-bold text-xs">Change Image</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4 text-slate-400">
                        <ImageIcon size={32}/>
                      </div>
                      <p className="text-slate-500 font-bold">ডিজাইনের ছবি সিলেক্ট করুন</p>
                      <span className="text-[10px] text-slate-400 mt-1 uppercase font-black">Click to browse files</span>
                    </>
                  )}
                  <input ref={fileInputRef} type="file" hidden accept="image/*" onChange={e => {
                    const file = e.target.files[0];
                    if(file) { setFileToUpload(file); setPreviewUrl(URL.createObjectURL(file)); }
                  }} />
                </div>

                <div className="flex flex-col gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-3 mb-1 block tracking-widest">Design Title / Code</label>
                    <input type="text" placeholder="e.g. Argentina Home 2024" className="w-full bg-slate-100 p-4 rounded-2xl font-bold text-slate-800 border-2 border-transparent focus:border-teal-500 transition-all outline-none" value={newDesignTitle} onChange={e => setNewDesignTitle(e.target.value)} />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-3 mb-1 block tracking-widest">Google Drive Link (Public)</label>
                    <input type="text" placeholder="https://drive.google.com/..." className="w-full bg-slate-100 p-4 rounded-2xl font-bold text-slate-800 border-2 border-transparent focus:border-teal-500 transition-all outline-none" value={sourceLink} onChange={e => setSourceLink(e.target.value)} />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-3 mb-1 block tracking-widest">Select Category</label>
                    <div className="relative">
                      <select className="w-full bg-slate-100 p-4 rounded-2xl font-bold text-slate-800 appearance-none border-2 border-transparent focus:border-teal-500 transition-all outline-none" value={newDesignTag} onChange={e => setNewDesignTag(e.target.value)}>
                        {['Sublimation', 'Full Sleeve', 'Half Sleeve', 'Collar'].map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={20}/>
                    </div>
                  </div>

                  {linkError && (
                    <div className="bg-red-50 text-red-500 p-4 rounded-2xl text-xs font-bold border border-red-100 flex items-center gap-3">
                      <AlertCircle size={16}/> {linkError}
                    </div>
                  )}

                  <div className="mt-auto pt-6">
                    <button 
                      onClick={handleUpload} 
                      disabled={uploading || !fileToUpload || !newDesignTitle || !sourceLink} 
                      className={`w-full py-5 rounded-[1.5rem] font-black text-white shadow-xl shadow-teal-500/20 flex justify-center items-center gap-3 transition-all ${uploading || !fileToUpload || !newDesignTitle || !sourceLink ? 'bg-slate-300 cursor-not-allowed' : 'bg-teal-600 hover:bg-teal-700 active:scale-[0.98]'}`}
                    >
                      {uploading ? <Loader2 className="animate-spin" size={24}/> : (
                        <><Plus size={20}/> Submit for Approval</>
                      )}
                    </button>
                    <p className="text-center text-[10px] text-slate-400 mt-4 font-bold uppercase tracking-widest">Approved designs earn 0.5 points each</p>
                  </div>
                </div>
              </div>
           </div>
        </div>
      )}

      {/* Full Preview */}
      {selectedImage && (
        <div className="fixed inset-0 z-[110] bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-4">
          <button onClick={() => setSelectedImage(null)} className="absolute top-6 right-6 text-white/50"><X size={32}/></button>
          <div className="max-w-4xl w-full flex flex-col items-center gap-6">
            <img src={selectedImage.imageData} className="max-h-[70vh] rounded-3xl shadow-2xl border border-white/10" />
            <div className="bg-white p-6 rounded-[2rem] w-full max-w-md text-center">
              <h2 className="text-2xl font-black text-slate-800 mb-4">{selectedImage.title}</h2>
              <button onClick={() => handleDownloadAttempt(selectedImage)} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black flex justify-center items-center gap-2"><Unlock size={20}/> Get Source Link</button>
            </div>
          </div>
        </div>
      )}
      
      {/* Profile Update Modal */}
      {missingInfoModalOpen && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
          <div className="bg-white rounded-[2rem] w-full max-w-sm p-8 text-center">
             <h2 className="text-xl font-black text-slate-800 mb-2">প্রোফাইল আপডেট করুন</h2>
             <p className="text-slate-500 text-xs font-bold mb-6">WhatsApp নাম্বারটি যুক্ত করুন।</p>
             <input type="text" placeholder="WhatsApp Number" className="w-full bg-slate-50 p-3 rounded-xl mb-4 font-bold text-center" value={updateWhatsapp} onChange={e=>setUpdateWhatsapp(e.target.value)} />
             <button onClick={handleUpdateWhatsapp} className="w-full py-3 bg-slate-900 text-white rounded-xl font-black">Save</button>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminDashboard({ allUsers, deleteRequests, pendingDesigns, onClose, onAddPoints, onSubtractPoints, onToggleBan, onApproveDelete, onRejectDelete, onApproveDesign, onRejectDesign }) {
  const [activeAdminTab, setActiveAdminTab] = useState('users');

  return (
    <div className="fixed inset-0 bg-[#F1F5F9] z-[200] flex flex-col">
      <header className="h-20 bg-slate-900 text-white px-8 flex items-center justify-between">
        <div className="flex items-center gap-4"><ShieldCheck size={28}/><h2 className="text-xl font-black tracking-wider uppercase">FAHIM ADMIN</h2></div>
        <button onClick={onClose} className="bg-white/10 px-6 py-2 rounded-xl font-black text-sm">Exit</button>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-72 bg-white border-r border-slate-200 p-8 flex flex-col gap-3">
          <button onClick={() => setActiveAdminTab('users')} className={`flex items-center gap-4 px-6 py-4 rounded-2xl font-black text-sm ${activeAdminTab === 'users' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}><Users size={20}/> Users</button>
          <button onClick={() => setActiveAdminTab('approvals')} className={`flex items-center gap-4 px-6 py-4 rounded-2xl font-black text-sm ${activeAdminTab === 'approvals' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}><CheckCircle size={20}/> Reviews</button>
          <button onClick={() => setActiveAdminTab('requests')} className={`flex items-center gap-4 px-6 py-4 rounded-2xl font-black text-sm ${activeAdminTab === 'requests' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}><Trash2 size={20}/> Deletes</button>
        </aside>
        <main className="flex-1 overflow-y-auto p-10">
          {activeAdminTab === 'users' && (
            <div className="space-y-6">
              <h3 className="text-3xl font-black text-slate-900">User Management</h3>
              <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-100"><tr className="text-[10px] text-slate-400 uppercase font-black"><th className="px-8 py-5">User</th><th className="px-8 py-5">Status</th><th className="px-8 py-5">Points</th><th className="px-8 py-5 text-right">Actions</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {allUsers.map(u => (
                      <tr key={u.id} className="hover:bg-slate-50 group transition-all">
                        <td className="px-8 py-6"><div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${u.isBanned ? 'bg-red-100 text-red-600' : 'bg-teal-100 text-teal-600'}`}>{u?.name?.charAt(0) || "?"}</div><div><p className="font-black text-slate-800">{u.name}</p><p className="text-[10px] text-slate-400 font-bold uppercase">{u.whatsapp || "No WA"}</p></div></div></td>
                        <td className="px-8 py-6">{u.isBanned ? <span className="text-red-500 font-black text-[10px] bg-red-50 px-2 py-1 rounded">BANNED</span> : <span className="text-teal-600 font-black text-[10px] bg-teal-50 px-2 py-1 rounded">ACTIVE</span>}</td>
                        <td className="px-8 py-6 font-black text-xl">{u.points}</td>
                        <td className="px-8 py-6 text-right">
                          <div className="flex flex-col gap-1 items-end">
                            <button onClick={() => onAddPoints(u.id)} className="bg-teal-600 text-white px-4 py-1.5 rounded-lg text-[10px] font-black uppercase hover:bg-teal-700 w-24">Recharge</button>
                            <button onClick={() => onSubtractPoints(u.id)} className="bg-red-500 text-white px-4 py-1.5 rounded-lg text-[10px] font-black uppercase hover:bg-red-600 w-24">Minus</button>
                            {u.role !== 'admin' && (
                              <button onClick={() => onToggleBan(u.id, u.isBanned)} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase w-24 ${u.isBanned ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{u.isBanned ? 'Unban' : 'Ban'}</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {activeAdminTab === 'approvals' && (
            <div className="space-y-6">
              <h3 className="text-3xl font-black text-slate-900">Pending Approvals</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {pendingDesigns.map(d => (
                   <div key={d.id} className="bg-white p-6 rounded-[2.5rem] flex gap-4 border border-slate-200">
                     <img src={d.imageData} className="w-24 h-24 rounded-2xl object-cover bg-slate-50" />
                     <div className="flex-1">
                       <h4 className="font-black text-slate-900">{d.title}</h4>
                       <p className="text-[10px] font-bold text-slate-400">By: {d.uploaderName}</p>
                       <div className="flex gap-2 mt-4">
                         <button onClick={() => onApproveDesign(d)} className="flex-1 bg-teal-600 text-white py-2 rounded-xl text-[10px] font-black uppercase">Approve</button>
                         <button onClick={() => onRejectDesign(d)} className="px-4 bg-red-50 text-red-500 rounded-xl"><Trash2 size={16}/></button>
                       </div>
                     </div>
                   </div>
                ))}
              </div>
            </div>
          )}
          {activeAdminTab === 'requests' && (
            <div className="space-y-6">
               <h3 className="text-3xl font-black text-slate-900">Delete Requests</h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {deleteRequests.map(r => (
                   <div key={r.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-200">
                     <h4 className="font-black text-slate-900">{r.designTitle}</h4>
                     <p className="text-sm text-slate-500 mt-2 font-medium">"{r.reason}"</p>
                     <div className="flex gap-2 mt-6">
                        <button onClick={() => onApproveDelete(r)} className="flex-1 bg-red-500 text-white py-3 rounded-xl font-black text-xs uppercase">Delete</button>
                        <button onClick={() => onRejectDelete(r)} className="flex-1 bg-slate-100 text-slate-400 py-3 rounded-xl font-black text-xs uppercase">Dismiss</button>
                     </div>
                   </div>
                 ))}
               </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}