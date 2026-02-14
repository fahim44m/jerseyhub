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
  ExternalLink, Info
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
  // Auth & User State
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  // App Loading State
  const [isAppLoading, setIsAppLoading] = useState(true);

  // App Data State
  const [designs, setDesigns] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [deleteRequests, setDeleteRequests] = useState([]);
  const [pendingDesigns, setPendingDesigns] = useState([]); 
  const [loadingDesigns, setLoadingDesigns] = useState(true);
  
  // UI State
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
  
  // State for resuming download after login
  const [pendingDownload, setPendingDownload] = useState(null);

  // Form State
  const [loginCode, setLoginCode] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupCode, setSignupCode] = useState('');
  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [authError, setAuthError] = useState('');
  const [authProcessing, setAuthProcessing] = useState(false);

  // Upload Form State
  const [newDesignTitle, setNewDesignTitle] = useState('');
  const [newDesignTag, setNewDesignTag] = useState('Sublimation');
  const [sourceLink, setSourceLink] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);
  const [fileToUpload, setFileToUpload] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const FAHIM_ADMIN = {
    username: 'fahim4mm',
    password: '@Mdfahim44'
  };

  const WHATSAPP_NUMBER = "8801874002653";

  // --- Effects ---

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

  // Resume download after login
  useEffect(() => {
    if (user && userData && pendingDownload) {
      // Small delay to ensure UI is ready
      const timer = setTimeout(() => {
        processDownload(pendingDownload);
        setPendingDownload(null);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [user, userData, pendingDownload]);

  // Fetch approved designs
  useEffect(() => {
    const qDesigns = query(collection(db, 'designs'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(qDesigns, (snap) => {
      const allDesigns = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setDesigns(allDesigns);
      setLoadingDesigns(false);
      
      // Stop initial loading after designs are fetched
      setTimeout(() => setIsAppLoading(false), 1500); 
    });
    return () => unsub();
  }, []);

  // Admin Data Fetching
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

  useEffect(() => {
    if (!uploadModalOpen) {
      setNewDesignTitle('');
      setSourceLink('');
      setPreviewUrl(null);
      setFileToUpload(null);
      setShowUploadHelp(false);
    }
  }, [uploadModalOpen]);

  // --- Auth Logic ---

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
        } else {
          throw new Error("ভুল এডমিন ইউজারনেম অথবা পাসওয়ার্ড!");
        }
      } else if (authMode === 'user-signup') {
        if (signupCode.length < 6) throw new Error("কোড কমপক্ষে ৬ সংখ্যার হতে হবে");
        const email = signupCode + "@user.local";
        const cred = await createUserWithEmailAndPassword(auth, email, signupCode);
        await setDoc(doc(db, 'users', cred.user.uid), {
          name: signupName,
          uid: cred.user.uid,
          points: 10,
          role: 'user',
          isBanned: false,
          createdAt: serverTimestamp()
        });
      } else {
        const email = loginCode + "@user.local";
        await signInWithEmailAndPassword(auth, email, loginCode);
      }
      setAuthModalOpen(false);
      clearForms();
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthProcessing(false);
    }
  };

  const clearForms = () => {
    setLoginCode(''); setSignupCode(''); setSignupName(''); setAdminUser(''); setAdminPass('');
  };

  const handleLogout = async () => {
    await signOut(auth);
    setAdminPanelOpen(false);
  };

  // --- Design Logic ---

  const processDownload = async (design) => {
    if (userData.isBanned) return;
    if (userData.role === 'admin') { window.open(design.sourceLink, '_blank'); return; }
    
    if (userData.points < 1) { 
      setLowBalanceModalOpen(true); 
      return; 
    }

    const confirm = window.confirm(`১ পয়েন্ট খরচ হবে। রাজি?`);
    if (!confirm) return;

    try {
      await updateDoc(doc(db, 'users', user.uid), { points: increment(-1) });
      window.open(design.sourceLink, '_blank');
    } catch (err) { alert("Error!"); }
  };

  const handleDownloadAttempt = async (design) => {
    // If user is not logged in, show login modal AND save pending download
    if (!user) { 
        setPendingDownload(design); // Save the design to download after login
        setAuthMode('user-login'); // Ensure login mode
        setAuthModalOpen(true); 
        return; 
    }
    
    // If logged in, proceed directly
    processDownload(design);
  };

  const requestDelete = async (e, design) => {
    e.stopPropagation();
    if (!user) { setAuthModalOpen(true); return; }
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
    setUploading(true);
    try {
      const base64 = await compressImage(fileToUpload);
      await addDoc(collection(db, 'designs'), {
        title: newDesignTitle,
        tag: newDesignTag,
        imageData: base64,
        sourceLink,
        uploadedBy: user.uid,
        status: 'pending', 
        createdAt: serverTimestamp()
      });
      setUploadModalOpen(false);
      alert("ডিজাইন আপলোড হয়েছে! এডমিন অ্যাপরুভ করলে এটি পাবলিশ হবে এবং আপনি ০.৫ পয়েন্ট পাবেন।");
    } catch (err) { alert("Upload failed!"); }
    finally { setUploading(false); }
  };

  const addPoints = async (uid) => {
    const pts = prompt("কত পয়েন্ট দিবেন?");
    if (!pts || isNaN(pts)) return;
    await updateDoc(doc(db, 'users', uid), { points: increment(parseInt(pts)) });
  };

  const toggleBan = async (uid, currentStatus) => {
    const confirm = window.confirm(currentStatus ? "আনব্যান করতে চান?" : "ব্যান করতে চান?");
    if (!confirm) return;
    await updateDoc(doc(db, 'users', uid), { isBanned: !currentStatus });
  };

  const handleApproveDesign = async (design) => {
    const confirm = window.confirm("Approve this design? User will get 0.5 points.");
    if(!confirm) return;

    try {
      await updateDoc(doc(db, 'designs', design.id), { status: 'approved' });
      if (design.uploadedBy) {
         await updateDoc(doc(db, 'users', design.uploadedBy), { points: increment(0.5) });
      }
    } catch (e) {
      console.error(e);
      alert("Error approving");
    }
  };

  const handleRejectDesign = async (design) => {
    const confirm = window.confirm("Reject and Delete this design?");
    if(!confirm) return;
    await deleteDoc(doc(db, 'designs', design.id));
  };

  const filteredDesigns = useMemo(() => {
    return designs.filter(d => 
      (d.status === 'approved' || !d.status) && 
      (activeTab === 'All' || d.tag === activeTab) && 
      d.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [designs, activeTab, searchQuery]);

  const totalApprovedDesigns = useMemo(() => {
    return designs.filter(d => d.status === 'approved' || !d.status).length;
  }, [designs]);

  // --- Main Render ---

  if (isAppLoading) {
    return <InitialLoader />;
  }

  if (adminPanelOpen && userData?.role === 'admin') {
    return (
      <AdminDashboard 
        allUsers={allUsers} 
        deleteRequests={deleteRequests}
        pendingDesigns={pendingDesigns}
        onClose={() => setAdminPanelOpen(false)} 
        onAddPoints={addPoints}
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
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-teal-600 rounded-xl flex items-center justify-center text-white shadow-lg">
            <Palette size={22} />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-800 tracking-tight">JERSEY HUB</h1>
            <p className="text-[10px] font-bold text-teal-600 uppercase">Fahim's Studio</p>
          </div>
        </div>

        <div className="hidden md:flex flex-1 max-w-md mx-10 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" placeholder="Search designs..." 
            className="w-full pl-12 pr-4 py-2.5 bg-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-teal-500/20 transition-all font-medium text-sm"
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3">
          {user && userData ? (
            <>
              <div className="hidden sm:flex items-center bg-slate-100 rounded-full px-4 py-1.5 gap-2 border border-slate-200">
                <span className="text-xs font-bold text-slate-500">{userData.name}</span>
                <span className="text-sm font-black text-teal-600">{userData.points} Pts</span>
                <button 
                  onClick={() => setPointsInfoOpen(true)}
                  className="w-5 h-5 bg-teal-500 hover:bg-teal-600 text-white rounded-full flex items-center justify-center ml-1 transition-all shadow-md"
                >
                  <Plus size={12} strokeWidth={4} />
                </button>
              </div>
              {userData.role === 'admin' && (
                <button onClick={() => setAdminPanelOpen(true)} className="p-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all">
                  <ShieldCheck size={20} />
                </button>
              )}
              <button onClick={() => setUploadModalOpen(true)} className="bg-teal-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-teal-700 transition-all">
                <Plus size={18} /> Upload
              </button>
              <button onClick={handleLogout} className="p-2.5 text-slate-400 hover:text-red-500 transition-all"><LogOut size={20} /></button>
            </>
          ) : (
            <button onClick={() => setAuthModalOpen(true)} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg active:scale-95 transition-all">
              Login
            </button>
          )}
        </div>
      </nav>

      {/* Hero & Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {!user && (
          <div className="mb-12 bg-gradient-to-br from-slate-900 to-slate-800 rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-2xl">
            <div className="relative z-10 max-w-xl">
              <h2 className="text-4xl font-black mb-4">প্রিমিয়াম জার্সি ডিজাইন কালেকশন</h2>
              
              {/* Dynamic Design Counter */}
              <div className="inline-flex items-center gap-2 bg-white/10 px-4 py-2 rounded-lg mb-6 backdrop-blur-sm border border-white/5">
                <LayoutGrid size={16} className="text-teal-400" />
                <span className="font-bold text-sm">TOTAL DESIGNS: <span className="text-teal-400 font-black text-lg ml-1">{totalApprovedDesigns}</span></span>
              </div>

              <p className="text-slate-400 text-lg mb-8 font-medium">নতুন ইউজারদের জন্য ১০ পয়েন্ট ফ্রী! আর ডিজাইন আপলোড করলে প্রতি ফাইলে ০.৫ পয়েন্ট বোনাস।</p>
              <div className="flex gap-4">
                <button onClick={() => {setAuthMode('user-signup'); setAuthModalOpen(true);}} className="bg-teal-500 hover:bg-teal-400 text-white px-8 py-3.5 rounded-2xl font-black transition-all active:scale-95">Signup Free</button>
                <button onClick={() => {setAuthMode('admin-login'); setAuthModalOpen(true);}} className="bg-white/10 hover:bg-white/20 px-8 py-3.5 rounded-2xl font-bold transition-all">Admin Access</button>
              </div>
            </div>
            <Crown className="absolute -right-10 -bottom-10 text-white/5 w-64 h-64 -rotate-12" />
          </div>
        )}
        
        {/* User is logged in but we still want to show stats */}
        {user && (
            <div className="mb-8 flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-400 font-bold text-xs uppercase tracking-widest">
                    <LayoutGrid size={16} />
                    <span>Total Designs: <span className="text-slate-900">{totalApprovedDesigns}</span></span>
                </div>
            </div>
        )}

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {['All', 'Sublimation', 'Full Sleeve', 'Half Sleeve', 'Collar'].map(t => (
            <button key={t} onClick={() => setActiveTab(t)} className={`px-5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 border ${activeTab === t ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-white text-slate-500 border-slate-200 hover:border-teal-500'}`}>
              {t}
            </button>
          ))}
        </div>

        {/* Design Grid */}
        <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-6 space-y-6">
          {filteredDesigns.map(design => (
            <div key={design.id} className="break-inside-avoid bg-white rounded-[2rem] border border-slate-200 overflow-hidden group hover:shadow-2xl transition-all cursor-pointer relative" onClick={() => setSelectedImage(design)}>
              <img src={design.imageData} className="w-full h-auto transform group-hover:scale-105 transition-all duration-500" />
              <div className="p-5">
                <h3 className="font-bold text-slate-800 text-sm truncate mb-4">{design.title}</h3>
                <div className="flex items-center justify-between">
                  <button onClick={(e) => requestDelete(e, design)} className="p-2 text-slate-300 hover:text-red-500 transition-all"><Trash2 size={16} /></button>
                  <button onClick={(e) => {e.stopPropagation(); handleDownloadAttempt(design);}} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-teal-600 transition-all">
                    {userData?.points > 0 ? <Unlock size={12} /> : <Lock size={12} />} Get Link
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* --- POINTS INFO MODAL (POPUP) --- */}
      {pointsInfoOpen && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
           <div className="bg-white rounded-[2rem] w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95 relative">
              <button onClick={() => setPointsInfoOpen(false)} className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full"><X size={18} /></button>
              
              <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-teal-100 text-teal-600 rounded-xl flex items-center justify-center">
                      <Info size={20} strokeWidth={3} />
                  </div>
                  <h3 className="text-lg font-black text-slate-800">পয়েন্ট ইনফরমেশন</h3>
              </div>

              <div className="space-y-4">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <p className="text-sm text-slate-600 font-medium leading-relaxed">
                          <span className="block mb-1 text-teal-600 font-bold">• আপনি যদি ফ্রিতে Pts পেতে চান তাহলে একটি ডিজাইন আপলোড করলে আপনি পাবেন ০.৫ Pts</span>
                      </p>
                  </div>
                  
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <p className="text-sm text-slate-600 font-medium leading-relaxed">
                          <span className="block mb-1 text-slate-800 font-bold">• আপনার যদি বেশি Pts প্রয়োজন হয় তাহলে এডমিন এর সাথে যোগাযোগ করুন।</span>
                          <span className="block text-slate-500 text-xs mt-2">এডমিন এর নাম্বারঃ <span className="font-mono font-bold text-slate-900">01874002653</span></span>
                      </p>
                  </div>

                  <a 
                    href={`https://wa.me/${WHATSAPP_NUMBER}`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="w-full py-3 bg-[#25D366] text-white rounded-xl font-bold uppercase tracking-wide flex justify-center items-center gap-2 shadow-lg shadow-green-100 mt-2"
                  >
                    <MessageCircle size={18} /> WhatsApp
                  </a>
              </div>
           </div>
        </div>
      )}

      {/* --- LOW BALANCE MODAL (WhatsApp) --- */}
      {lowBalanceModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white rounded-[2.5rem] w-full max-w-sm p-8 shadow-2xl animate-in zoom-in-95 relative text-center">
             <button onClick={() => setLowBalanceModalOpen(false)} className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-full"><X size={20} /></button>
             
             <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
               <AlertCircle size={40} />
             </div>
             
             <h2 className="text-2xl font-black text-slate-800 mb-2">পয়েন্ট শেষ!</h2>
             <p className="text-slate-500 font-medium mb-8">আপনার অ্যাকাউন্টে পর্যাপ্ত পয়েন্ট নেই। পয়েন্ট রিলোড করতে এডমিনের সাথে যোগাযোগ করুন।</p>
             
             <a 
               href={`https://wa.me/${WHATSAPP_NUMBER}`} 
               target="_blank" 
               rel="noreferrer"
               className="w-full py-4 bg-[#25D366] text-white rounded-xl font-black uppercase tracking-widest shadow-lg shadow-green-100 hover:bg-[#20bd5a] transition-all flex justify-center items-center gap-2"
             >
               <MessageCircle size={20} /> WhatsApp Admin
             </a>
             
             <p className="text-[10px] text-slate-400 mt-4 font-bold">WhatsApp: {WHATSAPP_NUMBER}</p>
          </div>
        </div>
      )}

      {/* --- AUTH MODAL --- */}
      {authModalOpen && (
        // UPDATE: Changed z-[100] to z-[150] to appear above image modal (z-[110])
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95 relative">
            <button onClick={() => setAuthModalOpen(false)} className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-full"><X size={20} /></button>
            
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-teal-50 text-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                {authMode === 'admin-login' ? <ShieldCheck size={32} /> : <User size={32} />}
              </div>
              <h2 className="text-2xl font-black text-slate-800">
                {authMode === 'admin-login' ? 'Admin Login' : authMode === 'user-signup' ? 'Create Account' : 'Welcome Back'}
              </h2>
            </div>

            <div className="flex p-1 bg-slate-100 rounded-xl mb-6">
              <button onClick={() => setAuthMode('user-login')} className={`flex-1 py-2 rounded-lg text-xs font-bold ${authMode === 'user-login' ? 'bg-white shadow' : 'text-slate-400'}`}>User Login</button>
              <button onClick={() => setAuthMode('user-signup')} className={`flex-1 py-2 rounded-lg text-xs font-bold ${authMode === 'user-signup' ? 'bg-white shadow' : 'text-slate-400'}`}>Signup</button>
              <button onClick={() => setAuthMode('admin-login')} className={`flex-1 py-2 rounded-lg text-xs font-bold ${authMode === 'admin-login' ? 'bg-white shadow' : 'text-slate-400'}`}>Admin</button>
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
              {authMode === 'admin-login' ? (
                <>
                  <input type="text" placeholder="Admin Username" required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold" value={adminUser} onChange={e => setAdminUser(e.target.value)} />
                  <input type="password" placeholder="Password" required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold" value={adminPass} onChange={e => setAdminPass(e.target.value)} />
                </>
              ) : authMode === 'user-signup' ? (
                <>
                  <input type="text" placeholder="Your Name" required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold" value={signupName} onChange={e => setSignupName(e.target.value)} />
                  <input type="password" placeholder="Set 6-Digit Code" required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-center tracking-widest" value={signupCode} onChange={e => setSignupCode(e.target.value)} />
                </>
              ) : (
                <input type="password" placeholder="Enter Your Code" required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-center tracking-widest" value={loginCode} onChange={e => setLoginCode(e.target.value)} />
              )}

              {authError && <div className="p-3 bg-red-50 text-red-500 text-xs font-bold rounded-xl flex items-center gap-2"><AlertCircle size={14}/> {authError}</div>}

              <button type="submit" disabled={authProcessing} className="w-full py-4 bg-slate-900 text-white rounded-xl font-black uppercase tracking-widest shadow-lg hover:bg-slate-800 transition-all flex justify-center items-center gap-2">
                {authProcessing ? <Loader2 className="animate-spin" /> : 'Login Now'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- UPLOAD MODAL --- */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto">
           <div className="bg-white rounded-[2rem] w-full max-w-2xl p-8 shadow-2xl flex flex-col gap-6 animate-in zoom-in-95 my-10">
              <div className="flex justify-between items-center border-b pb-4">
                <h2 className="text-xl font-black text-slate-800">Upload New Design</h2>
                <button onClick={() => setUploadModalOpen(false)}><X size={20}/></button>
              </div>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div onClick={() => fileInputRef.current.click()} className="border-4 border-dashed rounded-3xl p-6 flex flex-col items-center justify-center bg-slate-50 cursor-pointer hover:bg-teal-50 hover:border-teal-300 transition-all min-h-[200px]">
                  {previewUrl ? <img src={previewUrl} className="max-h-40 rounded-xl" /> : <ImageIcon size={40} className="text-slate-300 mb-2"/>}
                  <p className="text-xs font-bold text-slate-400 mt-2">Click to select photo</p>
                  <input ref={fileInputRef} type="file" hidden accept="image/*" onChange={e => {
                    const file = e.target.files[0];
                    if(file) { setFileToUpload(file); setPreviewUrl(URL.createObjectURL(file)); }
                  }} />
                </div>
                <div className="space-y-4">
                  <input type="text" placeholder="Design Title" className="w-full bg-slate-100 p-3 rounded-xl font-bold text-sm outline-none" value={newDesignTitle} onChange={e => setNewDesignTitle(e.target.value)} />
                  <input type="text" placeholder="Google Drive Link" className="w-full bg-slate-100 p-3 rounded-xl font-bold text-sm outline-none" value={sourceLink} onChange={e => setSourceLink(e.target.value)} />
                  <select className="w-full bg-slate-100 p-3 rounded-xl font-bold text-sm outline-none" value={newDesignTag} onChange={e => setNewDesignTag(e.target.value)}>
                    {['Sublimation', 'Full Sleeve', 'Half Sleeve', 'Collar'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <div className="bg-teal-50 p-3 rounded-xl">
                    <p className="text-[10px] text-teal-700 font-bold">নোট: এডমিন অ্যাপরুভ করলে ০.৫ পয়েন্ট পাবেন।</p>
                  </div>
                </div>
              </div>

              <button onClick={handleUpload} disabled={uploading} className="w-full py-4 bg-teal-600 text-white rounded-xl font-black flex justify-center items-center gap-2">
                {uploading ? <Loader2 className="animate-spin"/> : 'Submit for Review'}
              </button>

              {/* Upload Instructions Toggle */}
              <div className="border-t border-slate-100 pt-2">
                <button 
                  onClick={() => setShowUploadHelp(!showUploadHelp)}
                  className="w-full flex items-center justify-between text-slate-500 hover:text-teal-600 font-bold text-xs bg-slate-50 p-3 rounded-xl transition-all"
                >
                  <span className="flex items-center gap-2"><HelpCircle size={16}/> কিভাবে আপলোড করবেন?</span>
                  {showUploadHelp ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                </button>
                
                {showUploadHelp && (
                  <div className="mt-3 p-4 bg-slate-50 rounded-2xl text-xs text-slate-600 leading-relaxed space-y-4 animate-in slide-in-from-top-2 border border-slate-200">
                    <div>
                      <p className="font-black text-slate-800 mb-2 underline">এখানে ডিজাইন আপলোড করতে হলেঃ</p>
                      <ul className="list-disc pl-4 space-y-1">
                        <li>ডিজাইন এর একটা ছবি দিতে হবে।</li>
                        <li>ডিজাইন টাইটেল হচ্ছে ডিজাইন এর নাম বা কোড দিবেন।</li>
                      </ul>
                    </div>
                    
                    <div>
                      <p className="font-black text-teal-700 mb-2 underline">গুগল ড্রাইভ লিংক এর নিয়মঃ</p>
                      <p className="mb-2">( আপনার গুগল ড্রাইভ খুলুন উপরে বাম পাসে কর্নারে <strong>+NEW</strong> একটা আইকন আছে সেটাতে ক্লিক করে নিউ ফোল্ডার খুলুন ফোল্ডার এ ঢুকে আপনি যে ডিজাইন গুলা ওয়েবসাইটে আপলোড করবেন সেগুলা সে ড্রাইভ ফোল্ডারে ডিজাইন গুলা ড্রাগ এন্ড ড্রপ করে আনবেন পরে ডিজাইন গুলা আপনার ড্রাইভে সেভ হয়ে যাবে।</p>
                      <p className="mb-2">আপনি যে ফোল্ডার বানিয়েছেন সেটার নামের পাশে ৩ টা ডট আছে সেটাতে ক্লিক করবেন শেয়ার অপশন এ মাউস এর চিহ্ন টি রাখবেন আবার দেখবেন আরেকটা শেয়ার লেখা আসছে সেটাতে ক্লিক করবেন <strong>General access</strong> এটার নিচে <strong>Restricted</strong> লেখাতে ক্লিক করবেন পরে <strong>anyone with link</strong> দিবেন এটা দিলে আপনার ডিজাইন এর লিংক শেয়ার করলে যে কেউ ডাউনলোড করতে পারবে।</p>
                      <p>পরে আপনি যে ডিজাইন গুলা ফোল্ডারে রাখবেন একটা একটা করে আপলোড করবেন ওয়েবসাইট এ... ডিজাইন এর ৩ ডট এ ক্লিক করলে শেয়ার লেখা সেটাতে ক্লিক করবে বা মাউস পয়েন্টার রাখলেই কপি লিংক লেখা সেটা কপি করে Google drive link er জায়গায় দিয়ে দিবেন আর পরে সাবমিট দিয়ে দিবেন।</p>
                    </div>

                    <div className="flex items-center gap-2 bg-[#25D366]/10 text-[#075E54] p-3 rounded-xl font-bold border border-[#25D366]/20">
                      <MessageCircle size={16} />
                      <span>যদি বুঝতে সমস্যা হয় আমার WhatsApp নাম্বারঃ <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" className="underline hover:text-teal-600">01874002653</a> এই নাম্বারে মেসেজ দিবেন ভিডিও দিয়ে দিব।</span>
                    </div>
                  </div>
                )}
              </div>
           </div>
        </div>
      )}

      {/* Selected Image View */}
      {selectedImage && (
        <div className="fixed inset-0 z-[110] bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-4">
          <button onClick={() => setSelectedImage(null)} className="absolute top-6 right-6 text-white/50 hover:text-white"><X size={32}/></button>
          <div className="max-w-4xl w-full flex flex-col items-center gap-6">
            <img src={selectedImage.imageData} className="max-h-[70vh] rounded-3xl shadow-2xl border border-white/10" />
            <div className="bg-white p-6 rounded-[2rem] w-full max-w-md flex flex-col gap-4">
              <h2 className="text-2xl font-black text-slate-800">{selectedImage.title}</h2>
              <button onClick={() => handleDownloadAttempt(selectedImage)} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-teal-600 transition-all">
                <Unlock size={20}/> Get Source Link
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// --- Admin Dashboard Component ---
function AdminDashboard({ allUsers, deleteRequests, pendingDesigns, onClose, onAddPoints, onToggleBan, onApproveDelete, onRejectDelete, onApproveDesign, onRejectDesign }) {
  const [activeAdminTab, setActiveAdminTab] = useState('users');

  return (
    <div className="fixed inset-0 bg-[#F1F5F9] z-[200] flex flex-col font-sans animate-in slide-in-from-bottom-5 duration-500">
      <header className="h-20 bg-slate-900 text-white px-8 flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-teal-500 rounded-2xl flex items-center justify-center">
             <ShieldCheck size={28} />
          </div>
          <div>
            <h2 className="text-xl font-black leading-none uppercase tracking-wider">FAHIM ADMIN</h2>
            <p className="text-[10px] font-bold text-teal-400 uppercase tracking-widest mt-1">System Management</p>
          </div>
        </div>
        <button onClick={onClose} className="bg-white/10 hover:bg-white/20 px-6 py-2.5 rounded-xl font-black text-sm transition-all flex items-center gap-2 border border-white/5">
          <LayoutGrid size={18} /> Exit Dashboard
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-72 bg-white border-r border-slate-200 p-8 flex flex-col gap-3">
          <button onClick={() => setActiveAdminTab('users')} className={`flex items-center gap-4 px-6 py-4 rounded-2xl font-black text-sm transition-all ${activeAdminTab === 'users' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>
            <Users size={20} /> Users & Bans
          </button>
          
          <button onClick={() => setActiveAdminTab('approvals')} className={`flex items-center justify-between gap-4 px-6 py-4 rounded-2xl font-black text-sm transition-all ${activeAdminTab === 'approvals' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>
            <div className="flex items-center gap-4"><CheckCircle size={20} /> Design Reviews</div>
            {pendingDesigns.length > 0 && <span className="bg-teal-500 text-white px-2.5 py-1 rounded-lg text-[10px] animate-pulse">{pendingDesigns.length}</span>}
          </button>

          <button onClick={() => setActiveAdminTab('requests')} className={`flex items-center justify-between gap-4 px-6 py-4 rounded-2xl font-black text-sm transition-all ${activeAdminTab === 'requests' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>
            <div className="flex items-center gap-4"><Trash2 size={20} /> Delete Requests</div>
            {deleteRequests.length > 0 && <span className="bg-red-500 text-white px-2.5 py-1 rounded-lg text-[10px] animate-pulse">{deleteRequests.length}</span>}
          </button>
          
          <div className="mt-auto bg-slate-900 rounded-[2rem] p-6 text-white relative overflow-hidden">
             <BarChart3 className="absolute -right-4 -bottom-4 text-white/10 w-24 h-24" />
             <div className="relative z-10">
               <p className="text-teal-400 text-[10px] font-black uppercase tracking-widest mb-1">Total Users</p>
               <h4 className="text-3xl font-black">{allUsers.length}</h4>
               <p className="text-slate-400 text-[10px] mt-2 font-bold">Active Connections</p>
             </div>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-10 bg-slate-50/50">
          
          {/* USER MANAGEMENT TAB */}
          {activeAdminTab === 'users' && (
            <div className="space-y-8">
              <div className="flex justify-between items-end">
                <h3 className="text-3xl font-black text-slate-900">User Management</h3>
              </div>
              <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/50 border-b border-slate-100">
                    <tr>
                      <th className="px-8 py-5 font-black text-[10px] text-slate-400 uppercase tracking-widest">Profile</th>
                      <th className="px-8 py-5 font-black text-[10px] text-slate-400 uppercase tracking-widest">Status</th>
                      <th className="px-8 py-5 font-black text-[10px] text-slate-400 uppercase tracking-widest">Balance</th>
                      <th className="px-8 py-5 font-black text-[10px] text-slate-400 uppercase tracking-widest text-right">Control</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {allUsers.map(u => (
                      <tr key={u.id} className="hover:bg-slate-50 transition-all group">
                        <td className="px-8 py-6">
                           <div className="flex items-center gap-3">
                             <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${u.isBanned ? 'bg-red-100 text-red-600' : 'bg-teal-100 text-teal-600'}`}>
                               {u.name.charAt(0)}
                             </div>
                             <div>
                               <p className="font-black text-slate-800">{u.name}</p>
                               <p className="text-[10px] text-slate-400 font-bold uppercase">{u.role}</p>
                             </div>
                           </div>
                        </td>
                        <td className="px-8 py-6">
                          {u.isBanned ? (
                            <span className="flex items-center gap-1 text-red-500 font-black text-[10px] uppercase bg-red-50 px-3 py-1.5 rounded-lg w-fit">
                              <Ban size={12}/> Banned
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-teal-600 font-black text-[10px] uppercase bg-teal-50 px-3 py-1.5 rounded-lg w-fit">
                              <UserCheck size={12}/> Active
                            </span>
                          )}
                        </td>
                        <td className="px-8 py-6">
                           <p className="font-black text-xl text-slate-900">{u.points} <span className="text-[10px] text-slate-400">PTS</span></p>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                            <button onClick={() => onAddPoints(u.id)} className="bg-slate-100 text-slate-900 px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-teal-500 hover:text-white transition-all">Recharge</button>
                            {u.role !== 'admin' && (
                              <button onClick={() => onToggleBan(u.id, u.isBanned)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${u.isBanned ? 'bg-teal-600 text-white' : 'bg-red-50 text-red-500 hover:bg-red-500 hover:text-white'}`}>
                                {u.isBanned ? 'Unban' : 'Ban User'}
                              </button>
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

          {/* APPROVALS TAB */}
          {activeAdminTab === 'approvals' && (
            <div className="space-y-8">
              <h3 className="text-3xl font-black text-slate-900">Pending Designs</h3>
              {pendingDesigns.length === 0 ? (
                 <div className="bg-white p-20 rounded-[3rem] text-center border-2 border-dashed border-slate-200">
                   <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                     <CheckCircle2 size={40} className="text-slate-200" />
                   </div>
                   <p className="text-slate-400 font-black text-lg">No designs waiting for approval.</p>
                 </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {pendingDesigns.map(design => (
                    <div key={design.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex gap-6 hover:shadow-xl transition-all items-center">
                      <img src={design.imageData} className="w-32 h-32 rounded-2xl object-cover bg-slate-100" />
                      <div className="flex-1 space-y-2">
                        <h4 className="text-lg font-black text-slate-900">{design.title}</h4>
                        <span className="inline-block bg-teal-50 text-teal-600 text-[10px] font-black uppercase px-2 py-1 rounded-md">{design.tag}</span>
                        
                        {/* New Check Link Button */}
                        <a href={design.sourceLink} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-blue-500 text-xs font-bold hover:underline">
                            <ExternalLink size={12}/> Check Link
                        </a>

                        <div className="flex gap-2 mt-4">
                           <button onClick={() => onApproveDesign(design)} className="flex-1 bg-teal-500 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-teal-600 transition-all">Approve (+0.5)</button>
                           <button onClick={() => onRejectDesign(design)} className="px-4 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all"><Trash2 size={16}/></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* DELETE REQUESTS TAB */}
          {activeAdminTab === 'requests' && (
            <div className="space-y-8">
               <h3 className="text-3xl font-black text-slate-900">Delete Requests</h3>
               {deleteRequests.length === 0 ? (
                 <div className="bg-white p-20 rounded-[3rem] text-center border-2 border-dashed border-slate-200">
                   <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                     <CheckCircle2 size={40} className="text-slate-200" />
                   </div>
                   <p className="text-slate-400 font-black text-lg">No pending delete requests.</p>
                 </div>
               ) : (
                 <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                   {deleteRequests.map(req => (
                     <div key={req.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col gap-6 hover:shadow-xl transition-all">
                       <div className="flex justify-between items-start">
                         <div className="space-y-1">
                           <h4 className="text-xl font-black text-slate-900">{req.designTitle}</h4>
                           <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Requested by: <span className="text-teal-600">{req.requestedBy}</span></p>
                         </div>
                         <div className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center">
                            <Trash2 size={24} />
                         </div>
                       </div>
                       
                       <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                         <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Reason for removal</p>
                         <p className="text-sm text-slate-600 font-bold leading-relaxed">"{req.reason}"</p>
                       </div>

                       <div className="flex gap-3">
                         <button onClick={() => onApproveDelete(req)} className="flex-1 bg-red-500 text-white py-4 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-red-600 transition-all shadow-lg shadow-red-100">Confirm Delete</button>
                         <button onClick={() => onRejectDelete(req)} className="flex-1 bg-slate-100 text-slate-600 py-4 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all">Dismiss</button>
                       </div>
                     </div>
                   ))}
                 </div>
               )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function CheckCircle2(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>
  );
}